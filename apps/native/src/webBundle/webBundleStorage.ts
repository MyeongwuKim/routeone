import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { unzipSync } from "fflate";
import type {
  InstalledWebBundle,
  WebBundleManifest,
  WebBundleProgressReporter
} from "./webBundleTypes";
import { emitWebBundleProgress } from "./webBundleProgress";

type StoredBundleRecord = {
  version: string;
  entryPath: string;
  sha256: string;
  readySignalRequired: boolean;
};

type WebBundleState = {
  schemaVersion: 1;
  active: StoredBundleRecord | null;
  previous: StoredBundleRecord | null;
  pendingVersion: string | null;
  pendingAttempts: number;
  failedVersions: string[];
};

export type WebBundleStorageSnapshot = {
  active: InstalledWebBundle | null;
  failedVersions: string[];
};

const STORAGE_DIRECTORY_NAME = "routeone-web-bundles";
const STATE_FILE_NAME = "state.json";
const MAX_DOWNLOAD_BYTES = 30 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 150 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 5_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_FAILED_VERSIONS = 10;
let stateMutationQueue: Promise<unknown> = Promise.resolve();

function runStateMutation<T>(mutation: () => Promise<T>) {
  const result = stateMutationQueue.then(mutation, mutation);
  stateMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function createEmptyState(): WebBundleState {
  return {
    schemaVersion: 1,
    active: null,
    previous: null,
    pendingVersion: null,
    pendingAttempts: 0,
    failedVersions: []
  };
}

function getStorageDirectory() {
  return new Directory(Paths.document, STORAGE_DIRECTORY_NAME);
}

function getReleasesDirectory() {
  return new Directory(getStorageDirectory(), "releases");
}

function getDownloadDirectory() {
  return new Directory(Paths.cache, STORAGE_DIRECTORY_NAME);
}

function ensureStorageDirectories() {
  getStorageDirectory().create({ idempotent: true, intermediates: true });
  getReleasesDirectory().create({ idempotent: true, intermediates: true });
  getDownloadDirectory().create({ idempotent: true, intermediates: true });
}

function readStoredBundleRecord(value: unknown): StoredBundleRecord | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Partial<StoredBundleRecord>;

  if (
    typeof record.version !== "string" ||
    !/^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(record.version) ||
    typeof record.entryPath !== "string" ||
    !record.entryPath ||
    record.entryPath.startsWith("/") ||
    record.entryPath.split("/").includes("..") ||
    typeof record.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(record.sha256)
  ) {
    return null;
  }

  return {
    version: record.version,
    entryPath: record.entryPath,
    sha256: record.sha256,
    readySignalRequired: record.readySignalRequired === true
  };
}

async function readState(): Promise<WebBundleState> {
  ensureStorageDirectories();
  const stateFile = new File(getStorageDirectory(), STATE_FILE_NAME);

  if (!stateFile.exists) {
    return createEmptyState();
  }

  try {
    const value = JSON.parse(await stateFile.text()) as Partial<WebBundleState>;

    if (value.schemaVersion !== 1) {
      return createEmptyState();
    }

    const active = readStoredBundleRecord(value.active);
    const previous = readStoredBundleRecord(value.previous);

    return {
      schemaVersion: 1,
      active,
      previous,
      pendingVersion:
        typeof value.pendingVersion === "string" ? value.pendingVersion : null,
      pendingAttempts:
        typeof value.pendingAttempts === "number" && value.pendingAttempts >= 0
          ? Math.floor(value.pendingAttempts)
          : 0,
      failedVersions: Array.isArray(value.failedVersions)
        ? value.failedVersions.filter(
            (version): version is string =>
              typeof version === "string" &&
              /^[0-9A-Za-z][0-9A-Za-z._-]*$/.test(version)
          )
        : []
    };
  } catch (error) {
    console.warn("[web-bundle] failed to read update state", error);
    return createEmptyState();
  }
}

async function writeState(state: WebBundleState) {
  ensureStorageDirectories();
  const storageDirectory = getStorageDirectory();
  const stateFile = new File(storageDirectory, STATE_FILE_NAME);
  const temporaryFile = new File(storageDirectory, `${STATE_FILE_NAME}.tmp`);

  temporaryFile.create({ intermediates: true, overwrite: true });
  temporaryFile.write(JSON.stringify(state));
  await temporaryFile.move(stateFile, { overwrite: true });
}

function getReleaseDirectory(version: string) {
  return new Directory(getReleasesDirectory(), version);
}

function resolveInstalledBundle(
  record: StoredBundleRecord | null,
  pendingVersion: string | null
): InstalledWebBundle | null {
  if (!record) {
    return null;
  }

  const directory = getReleaseDirectory(record.version);
  const entryFile = new File(directory, ...record.entryPath.split("/"));

  if (!directory.exists || !entryFile.exists) {
    return null;
  }

  return {
    ...record,
    entryUri: entryFile.uri,
    directoryUri: directory.uri,
    pending: pendingVersion === record.version
  };
}

function appendFailedVersion(state: WebBundleState, version: string) {
  state.failedVersions = [
    version,
    ...state.failedVersions.filter((failedVersion) => failedVersion !== version)
  ].slice(0, MAX_FAILED_VERSIONS);
}

async function repairMissingActiveBundle(state: WebBundleState) {
  if (!state.active || resolveInstalledBundle(state.active, null)) {
    return state;
  }

  appendFailedVersion(state, state.active.version);
  state.active = resolveInstalledBundle(state.previous, null)
    ? state.previous
    : null;
  state.previous = null;
  state.pendingVersion = null;
  state.pendingAttempts = 0;
  await writeState(state);
  return state;
}

export async function prepareWebBundleStorage(): Promise<WebBundleStorageSnapshot> {
  let state = await repairMissingActiveBundle(await readState());

  if (
    state.active &&
    state.pendingVersion === state.active.version &&
    state.pendingAttempts >= 1
  ) {
    const failedVersion = state.active.version;
    appendFailedVersion(state, failedVersion);
    state.active = resolveInstalledBundle(state.previous, null)
      ? state.previous
      : null;
    state.previous = null;
    state.pendingVersion = null;
    state.pendingAttempts = 0;
    await writeState(state);

    const failedDirectory = getReleaseDirectory(failedVersion);

    if (failedDirectory.exists) {
      failedDirectory.delete();
    }
  } else if (
    state.active &&
    state.pendingVersion === state.active.version
  ) {
    state.pendingAttempts += 1;
    await writeState(state);
  }

  state = await repairMissingActiveBundle(state);

  return {
    active: resolveInstalledBundle(state.active, state.pendingVersion),
    failedVersions: [...state.failedVersions]
  };
}

function bytesToHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function readSafeZipPath(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");

  if (
    !normalized ||
    normalized.length > 512 ||
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(`Unsafe web bundle ZIP path: ${value}`);
  }

  const segments = normalized.split("/").filter(Boolean);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error(`Unsafe web bundle ZIP path: ${value}`);
  }

  return segments;
}

function extractBundle(bundleBytes: Uint8Array, stagingDirectory: Directory) {
  const entries = Object.entries(unzipSync(bundleBytes));

  if (entries.length > MAX_EXTRACTED_FILES) {
    throw new Error("Web bundle ZIP contains too many files.");
  }

  let extractedBytes = 0;

  for (const [entryName, contents] of entries) {
    if (
      entryName.startsWith("__MACOSX/") ||
      entryName.endsWith("/.DS_Store") ||
      entryName === ".DS_Store"
    ) {
      continue;
    }

    const segments = readSafeZipPath(entryName);

    if (entryName.endsWith("/")) {
      new Directory(stagingDirectory, ...segments).create({
        idempotent: true,
        intermediates: true
      });
      continue;
    }

    extractedBytes += contents.byteLength;

    if (extractedBytes > MAX_EXTRACTED_BYTES) {
      throw new Error("Web bundle ZIP is too large after extraction.");
    }

    const file = new File(stagingDirectory, ...segments);
    file.create({ intermediates: true, overwrite: true });
    file.write(contents);
  }
}

export async function installWebBundle(
  manifest: WebBundleManifest,
  reportProgress?: WebBundleProgressReporter
) {
  ensureStorageDirectories();
  const downloadFile = new File(
    getDownloadDirectory(),
    `${manifest.version}.zip`
  );
  const stagingDirectory = new Directory(
    getReleasesDirectory(),
    `.staging-${manifest.version}`
  );
  const releaseDirectory = getReleaseDirectory(manifest.version);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let activated = false;
  let promoted = false;

  try {
    if (stagingDirectory.exists) {
      stagingDirectory.delete();
    }

    emitWebBundleProgress(reportProgress, {
      stage: "downloading",
      progress: 0.26,
      message: "업데이트를 내려받고 있어요."
    });

    await File.downloadFileAsync(manifest.bundleUrl, downloadFile, {
      idempotent: true,
      signal: controller.signal,
      onProgress: ({ bytesWritten, totalBytes }) => {
        const ratio = totalBytes > 0 ? bytesWritten / totalBytes : 0;

        emitWebBundleProgress(reportProgress, {
          stage: "downloading",
          progress: 0.26 + Math.max(0, Math.min(1, ratio)) * 0.36,
          message: "업데이트를 내려받고 있어요."
        });
      }
    });

    if (downloadFile.size <= 0 || downloadFile.size > MAX_DOWNLOAD_BYTES) {
      throw new Error("Downloaded web bundle ZIP has an invalid size.");
    }

    emitWebBundleProgress(reportProgress, {
      stage: "verifying",
      progress: 0.68,
      message: "업데이트 파일을 확인하고 있어요."
    });

    const bundleBytes = await downloadFile.bytes();
    const actualSha256 = bytesToHex(
      await digest(CryptoDigestAlgorithm.SHA256, bundleBytes)
    );

    if (actualSha256 !== manifest.sha256) {
      throw new Error("Downloaded web bundle SHA-256 does not match manifest.");
    }

    emitWebBundleProgress(reportProgress, {
      stage: "extracting",
      progress: 0.76,
      message: "업데이트 압축을 풀고 있어요."
    });

    stagingDirectory.create({ intermediates: true });
    extractBundle(bundleBytes, stagingDirectory);

    const stagedEntryFile = new File(
      stagingDirectory,
      ...manifest.entryPath.split("/")
    );

    if (!stagedEntryFile.exists) {
      throw new Error(`Web bundle entry file is missing: ${manifest.entryPath}`);
    }

    emitWebBundleProgress(reportProgress, {
      stage: "applying",
      progress: 0.86,
      message: "새 버전을 적용하고 있어요."
    });

    if (releaseDirectory.exists) {
      releaseDirectory.delete();
    }

    stagingDirectory.rename(manifest.version);
    promoted = true;

    const state = await readState();
    state.previous = state.active;
    state.active = {
      version: manifest.version,
      entryPath: manifest.entryPath,
      sha256: manifest.sha256,
      readySignalRequired: manifest.readySignalRequired
    };
    state.pendingVersion = manifest.version;
    state.pendingAttempts = 0;
    state.failedVersions = state.failedVersions.filter(
      (version) => version !== manifest.version
    );
    await writeState(state);
    activated = true;

    const installedBundle = resolveInstalledBundle(
      state.active,
      state.pendingVersion
    );

    if (!installedBundle) {
      throw new Error("Installed web bundle could not be activated.");
    }

    emitWebBundleProgress(reportProgress, {
      stage: "applying",
      progress: 0.91,
      message: "새 버전을 적용하고 있어요."
    });

    return installedBundle;
  } finally {
    clearTimeout(timeoutId);

    if (downloadFile.exists) {
      downloadFile.delete();
    }

    if (!activated && stagingDirectory.exists) {
      stagingDirectory.delete();
    }

    if (!activated && promoted && releaseDirectory.exists) {
      releaseDirectory.delete();
    }
  }
}

function pruneUnusedReleases(state: WebBundleState) {
  const releasesDirectory = getReleasesDirectory();
  const retainedVersions = new Set(
    [state.active?.version, state.previous?.version].filter(
      (version): version is string => Boolean(version)
    )
  );

  for (const entry of releasesDirectory.list()) {
    if (entry instanceof Directory) {
      const version = entry.uri.replace(/\/$/, "").split("/").pop() ?? "";

      if (!retainedVersions.has(version)) {
        entry.delete();
      }
    }
  }
}

export function confirmWebBundleReady(version: string) {
  return runStateMutation(async () => {
    const state = await readState();

    if (state.active?.version !== version) {
      return;
    }

    state.pendingVersion = null;
    state.pendingAttempts = 0;
    state.failedVersions = state.failedVersions.filter(
      (failedVersion) => failedVersion !== version
    );
    await writeState(state);
    pruneUnusedReleases(state);
  });
}

export function rollbackWebBundle(version: string) {
  return runStateMutation(async () => {
    const state = await readState();

    if (state.active?.version !== version) {
      return resolveInstalledBundle(state.active, state.pendingVersion);
    }

    appendFailedVersion(state, version);
    state.active = resolveInstalledBundle(state.previous, null)
      ? state.previous
      : null;
    state.previous = null;
    state.pendingVersion = null;
    state.pendingAttempts = 0;
    await writeState(state);

    const failedDirectory = getReleaseDirectory(version);

    if (failedDirectory.exists) {
      failedDirectory.delete();
    }

    return resolveInstalledBundle(state.active, null);
  });
}
