import type {
  NativeWebBundlePlatform,
  WebBundleManifest
} from "./webBundleTypes";

const MANIFEST_TIMEOUT_MS = 5_000;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRemoteUrl(value: unknown, fieldName: string) {
  if (typeof value !== "string") {
    throw new Error(`Web bundle manifest ${fieldName} is missing.`);
  }

  const url = new URL(value);
  const isLocalDevelopmentUrl =
    __DEV__ &&
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopmentUrl) {
    throw new Error(`Web bundle manifest ${fieldName} must use HTTPS.`);
  }

  return url.href;
}

function readEntryPath(value: unknown) {
  const entryPath = typeof value === "string" ? value : "index.html";
  const normalized = entryPath.replace(/\\/g, "/").replace(/^\.\//, "");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => !part || part === "..")
  ) {
    throw new Error("Web bundle manifest entryPath is invalid.");
  }

  return normalized;
}

function readMinimumNativeVersion(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return { android: value, ios: value };
  }

  if (!isRecord(value)) {
    throw new Error("Web bundle minimumNativeVersion is invalid.");
  }

  const result: Partial<Record<NativeWebBundlePlatform, string>> = {};

  for (const platform of ["android", "ios"] as const) {
    const platformVersion = value[platform];

    if (platformVersion === undefined || platformVersion === null) {
      continue;
    }

    if (typeof platformVersion !== "string" || !platformVersion.trim()) {
      throw new Error("Web bundle minimumNativeVersion is invalid.");
    }

    result[platform] = platformVersion.trim();
  }

  return result;
}

function parseManifest(value: unknown): WebBundleManifest {
  if (!isRecord(value)) {
    throw new Error("Web bundle manifest must be an object.");
  }

  const version = typeof value.version === "string" ? value.version.trim() : "";
  const sha256 = typeof value.sha256 === "string" ? value.sha256.trim() : "";

  if (!VERSION_PATTERN.test(version)) {
    throw new Error("Web bundle manifest version is invalid.");
  }

  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error("Web bundle manifest sha256 is invalid.");
  }

  return {
    version,
    bundleUrl: readRemoteUrl(value.bundleUrl, "bundleUrl"),
    entryPath: readEntryPath(value.entryPath),
    sha256: sha256.toLowerCase(),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    readySignalRequired: value.runtimeReadySignal === true,
    minimumNativeVersion: readMinimumNativeVersion(
      value.minimumNativeVersion
    )
  };
}

export async function fetchWebBundleManifest(manifestUrl: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

  try {
    const response = await fetch(manifestUrl, {
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Web bundle manifest request failed (${response.status}).`);
    }

    return parseManifest(await response.json());
  } finally {
    clearTimeout(timeoutId);
  }
}
