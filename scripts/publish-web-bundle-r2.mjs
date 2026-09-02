#!/usr/bin/env node

/**
 * 용도:
 * 빌드된 웹 번들과 최신 manifest를 R2에 게시하고 이전 릴리스를 정리한다.
 *
 * 동작 방식:
 * 새 릴리스를 모두 업로드한 뒤 latest를 전환하며, 구버전 정리는 제한된
 * 재시도를 거쳐 실패하더라도 완료된 게시를 되돌리지 않고 경고로 남긴다.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const env = process.env;

const endpoint = required("CLOUDFLARE_ACCOUNT_ID", (value) => {
  return `https://${value}.r2.cloudflarestorage.com`;
});
const bucketName = required("R2_BUCKET_NAME");
const accessKeyId = env.R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
const secretAccessKey = env.R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;

if (!accessKeyId || !secretAccessKey) {
  fail("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.");
}

const retention = readPositiveInteger("ROUTEONE_WEB_BUNDLE_RETENTION", 5);
const awsMaxAttempts = readPositiveInteger("AWS_MAX_ATTEMPTS", 4);
const awsRetryMode = env.AWS_RETRY_MODE?.trim() || "standard";
const pruneRetryBaseDelayMs = readNonNegativeInteger(
  "ROUTEONE_WEB_BUNDLE_PRUNE_RETRY_DELAY_MS",
  1_000
);
const pruneMaxAttempts = 3;
const channel = readWebBundleChannel();
const distDir = resolve(env.ROUTEONE_WEB_DIST_DIR || "apps/web/dist");
const version = required("ROUTEONE_WEB_BUNDLE_VERSION");

if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)) {
  fail("ROUTEONE_WEB_BUNDLE_VERSION contains unsupported characters.");
}

const createdAt = new Date().toISOString();
const publicBaseUrl = trimTrailingSlashes(
  requiredAny(["R2_PUBLIC_BASE_URL", "EXPO_PUBLIC_WEB_BUNDLE_BASE_URL"])
);
const tmpRoot = mkdtempSync(join(tmpdir(), "routeone-web-bundle-"));
const bundleFileName = "web-ui.zip";
const bundlePath = join(tmpRoot, bundleFileName);
const releasePrefix = joinKey("releases", version);
const releaseWebPrefix = joinKey(releasePrefix, "web");
const entryKey = joinKey(releaseWebPrefix, "index.html");
const bundleKey = joinKey(releasePrefix, bundleFileName);
const releaseManifestKey = joinKey(releasePrefix, "manifest.json");
const latestManifestKey = joinKey("latest", "manifest.json");
const manifestPath = join(tmpRoot, "manifest.json");

try {
  assertDistDir();
  zipDist();

  const manifest = {
    version,
    channel,
    appVariant: channel,
    bundleUrl: `${publicBaseUrl}/${bundleKey}`,
    entryUrl: `${publicBaseUrl}/${entryKey}`,
    entryPath: "index.html",
    sha256: sha256(bundlePath),
    createdAt,
    runtimeReadySignal: true
  };

  uploadDistFiles();
  uploadFile(
    bundlePath,
    bundleKey,
    "application/zip",
    "public, max-age=31536000, immutable"
  );
  writeJson(manifestPath, manifest);
  uploadFile(
    manifestPath,
    releaseManifestKey,
    "application/json",
    "public, max-age=31536000, immutable"
  );
  uploadFile(manifestPath, latestManifestKey, "application/json", "no-store");
  try {
    await pruneReleases();
  } catch (error) {
    warnCleanup(
      `Retention cleanup stopped unexpectedly (${summarizeError(error)}). A later publish will retry it.`
    );
  }

  console.log(`Published ${bundleKey}`);
  console.log(`Published ${releaseWebPrefix}/`);
  console.log(`Published ${releaseManifestKey}`);
  console.log(`Updated ${latestManifestKey}`);
} finally {
  rmSync(tmpRoot, { force: true, recursive: true });
}

function required(name, transform = (value) => value) {
  const value = env[name]?.trim();

  if (!value) {
    fail(`${name} is required.`);
  }

  return transform(value);
}

function requiredAny(names, transform = (value) => value) {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value) {
      return transform(value);
    }
  }

  fail(`${names.join(" or ")} is required.`);
}

function readWebBundleChannel() {
  const value = (
    env.ROUTEONE_WEB_BUNDLE_CHANNEL ||
    env.EXPO_PUBLIC_APP_VARIANT ||
    env.APP_VARIANT ||
    "dev"
  )
    .trim()
    .toLowerCase();

  if (value === "dev" || value === "prod") {
    return value;
  }

  fail("ROUTEONE_WEB_BUNDLE_CHANNEL must be dev or prod.");
}

function readPositiveInteger(name, fallback) {
  const rawValue = env[name]?.trim();
  const value = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isInteger(value) || value < 1) {
    fail(`${name} must be a positive integer.`);
  }

  return value;
}

function readNonNegativeInteger(name, fallback) {
  const rawValue = env[name]?.trim();
  const value = rawValue ? Number.parseInt(rawValue, 10) : fallback;

  if (!Number.isInteger(value) || value < 0) {
    fail(`${name} must be a non-negative integer.`);
  }

  return value;
}

function assertDistDir() {
  if (!existsSync(distDir) || !statSync(distDir).isDirectory()) {
    fail(`Web dist directory does not exist: ${distDir}`);
  }
}

function zipDist() {
  run("zip", ["-qr", bundlePath, "."], { cwd: distDir });
}

function uploadFile(sourcePath, key, contentType, cacheControl) {
  runAws([
    "s3",
    "cp",
    sourcePath,
    `s3://${bucketName}/${key}`,
    "--content-type",
    contentType,
    "--cache-control",
    cacheControl
  ]);
}

function uploadDistFiles() {
  for (const filePath of listDistFiles(distDir)) {
    const relativePath = toPosixPath(relative(distDir, filePath));
    const key = joinKey(releaseWebPrefix, relativePath);

    uploadFile(
      filePath,
      key,
      getContentType(filePath),
      getCacheControl(relativePath)
    );
  }
}

function listDistFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".DS_Store" || entry.name === "__MACOSX") {
      continue;
    }

    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...listDistFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function getContentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".gif":
      return "image/gif";
    case ".html":
      return "text/html; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".jpeg":
    case ".jpg":
      return "image/jpeg";
    case ".js":
    case ".mjs":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}

function getCacheControl(relativePath) {
  if (toPosixPath(relativePath) === "index.html") {
    return "no-store";
  }

  if (toPosixPath(relativePath).startsWith("assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=3600";
}

async function pruneReleases() {
  const releases = listReleases();
  const keepVersions = new Set([version]);

  for (const release of releases) {
    if (keepVersions.size >= retention) {
      break;
    }

    keepVersions.add(release.version);
  }

  for (const release of releases) {
    if (keepVersions.has(release.version)) {
      continue;
    }

    if (await deleteReleaseWithRetry(release)) {
      console.log(`Deleted old release ${release.prefix}`);
    }
  }
}

async function deleteReleaseWithRetry(release) {
  const args = [
    "s3",
    "rm",
    `s3://${bucketName}/${release.prefix}`,
    "--recursive"
  ];

  for (let attempt = 1; attempt <= pruneMaxAttempts; attempt += 1) {
    const result = runAws(args, { allowFailure: true });

    if (result.status === 0) {
      return true;
    }

    const failure = summarizeCommandFailure(result);

    if (attempt === pruneMaxAttempts) {
      warnCleanup(
        `Could not delete ${release.prefix} after ${pruneMaxAttempts} attempts (${failure}). A later publish will retry it.`
      );
      return false;
    }

    const delayMs = Math.min(
      pruneRetryBaseDelayMs * 2 ** (attempt - 1),
      30_000
    );
    console.warn(
      `[web-bundle-cleanup] Failed to delete ${release.prefix} on attempt ${attempt}/${pruneMaxAttempts} (${failure}). Retrying in ${delayMs}ms.`
    );
    await wait(delayMs);
  }

  return false;
}

function listReleases() {
  const result = runAws(
    [
      "s3api",
      "list-objects-v2",
      "--bucket",
      bucketName,
      "--prefix",
      "releases/"
    ],
    { capture: true, allowFailure: true }
  );

  if (result.status !== 0 || !result.stdout) {
    warnCleanup(
      `Could not list existing releases; retention cleanup was skipped (${summarizeCommandFailure(result)}).`
    );
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    const releases = new Map();

    for (const item of parsed.Contents || []) {
      if (typeof item.Key !== "string" || !item.Key.startsWith("releases/")) {
        continue;
      }

      const releaseVersion = item.Key.slice("releases/".length).split("/")[0];

      if (!releaseVersion) {
        continue;
      }

      const modifiedAt = new Date(item.LastModified || 0).getTime();
      const current = releases.get(releaseVersion);

      if (!current || modifiedAt > current.modifiedAt) {
        releases.set(releaseVersion, {
          version: releaseVersion,
          prefix: `releases/${releaseVersion}/`,
          modifiedAt
        });
      }
    }

    return [...releases.values()].sort((a, b) => b.modifiedAt - a.modifiedAt);
  } catch (error) {
    warnCleanup(
      `Could not parse the existing release list; retention cleanup was skipped (${error instanceof Error ? error.message : String(error)}).`
    );
    return [];
  }
}

function runAws(args, options = {}) {
  return run(
    "aws",
    [
      ...args,
      "--endpoint-url",
      endpoint,
      "--region",
      "auto"
    ],
    options
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: {
      ...env,
      AWS_ACCESS_KEY_ID: accessKeyId,
      AWS_SECRET_ACCESS_KEY: secretAccessKey,
      AWS_EC2_METADATA_DISABLED: "true",
      AWS_MAX_ATTEMPTS: `${awsMaxAttempts}`,
      AWS_RETRY_MODE: awsRetryMode
    },
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.error) {
    if (options.allowFailure) {
      return { status: 1, stdout: "", stderr: result.error.message };
    }

    fail(result.error.message);
  }

  if (result.status !== 0 && !options.allowFailure) {
    fail(`${command} ${args.join(" ")} failed.`);
  }

  return result;
}

function summarizeCommandFailure(result) {
  return `exit code ${result.status ?? "unknown"}`;
}

function summarizeError(error) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/\s+/g, " ").slice(0, 300);
  }

  return String(error).replace(/\s+/g, " ").slice(0, 300);
}

function warnCleanup(message) {
  if (env.GITHUB_ACTIONS === "true") {
    console.warn(
      `::warning title=R2 release cleanup::${escapeWorkflowCommand(message)}`
    );
    return;
  }

  console.warn(`[web-bundle-cleanup] ${message}`);
}

function escapeWorkflowCommand(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function wait(delayMs) {
  if (delayMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, delayMs);
  });
}

function writeJson(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function joinKey(...segments) {
  return segments
    .flatMap((segment) => `${segment}`.split("/"))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join("/");
}

function toPosixPath(value) {
  return value.split(sep).join("/");
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
