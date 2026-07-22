#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

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
const channel = readWebBundleChannel();
const distDir = resolve(env.ROUTEONE_WEB_DIST_DIR || "apps/web/dist");
const buildNumber = readPositiveInteger(
  "ROUTEONE_WEB_BUNDLE_BUILD_NUMBER",
  Number.parseInt(env.GITHUB_RUN_NUMBER || "", 10) || Date.now()
);
const version =
  env.ROUTEONE_WEB_BUNDLE_VERSION?.trim() ||
  `1.0.${buildNumber}`;

if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(version)) {
  fail("ROUTEONE_WEB_BUNDLE_VERSION contains unsupported characters.");
}

const createdAt = new Date().toISOString();
const publicBaseUrl = trimTrailingSlashes(required("R2_PUBLIC_BASE_URL"));
const tmpRoot = mkdtempSync(join(tmpdir(), "routeone-web-bundle-"));
const bundleFileName = "web-ui.zip";
const bundlePath = join(tmpRoot, bundleFileName);
const releasePrefix = joinKey("releases", version);
const bundleKey = joinKey(releasePrefix, bundleFileName);
const releaseManifestKey = joinKey(releasePrefix, "manifest.json");
const latestManifestKey = joinKey("latest", "manifest.json");
const manifestPath = join(tmpRoot, "manifest.json");

try {
  assertDistDir();
  zipDist();

  const minimumNativeVersion = readMinimumNativeVersion();
  const manifest = {
    version,
    channel,
    appVariant: channel,
    bundleUrl: `${publicBaseUrl}/${bundleKey}`,
    entryPath: "index.html",
    sha256: sha256(bundlePath),
    createdAt,
    runtimeReadySignal: true,
    minimumNativeVersion
  };

  uploadFile(bundlePath, bundleKey, "application/zip", "public, max-age=31536000, immutable");
  writeJson(manifestPath, manifest);
  uploadFile(
    manifestPath,
    releaseManifestKey,
    "application/json",
    "public, max-age=31536000, immutable"
  );
  uploadFile(manifestPath, latestManifestKey, "application/json", "no-store");
  pruneReleases();

  console.log(`Published ${bundleKey}`);
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

function pruneReleases() {
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

    runAws([
      "s3",
      "rm",
      `s3://${bucketName}/${release.prefix}`,
      "--recursive"
    ]);
    console.log(`Deleted old release ${release.prefix}`);
  }
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
  } catch {
    return [];
  }
}

function readMinimumNativeVersion() {
  const configPath = env.ROUTEONE_NATIVE_CONFIG_PATH
    ? resolve(env.ROUTEONE_NATIVE_CONFIG_PATH)
    : null;
  const expoConfig = configPath && existsSync(configPath)
    ? readExpoConfig(configPath)
    : {};
  const nativeVersion = env.ROUTEONE_NATIVE_VERSION?.trim() || expoConfig.version || null;
  const iosVersion = env.ROUTEONE_IOS_NATIVE_VERSION?.trim() || nativeVersion;
  const androidVersion =
    env.ROUTEONE_ANDROID_NATIVE_VERSION?.trim() || nativeVersion;

  if (!iosVersion || !androidVersion) {
    fail("Native iOS and Android versions are required.");
  }

  return {
    ios: iosVersion,
    android: androidVersion
  };
}

function readExpoConfig(configPath) {
  try {
    const parsed = JSON.parse(readFileSync(configPath, "utf8"));
    return parsed.expo || parsed;
  } catch {
    fail(`Failed to read native config JSON: ${configPath}`);
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
      AWS_EC2_METADATA_DISABLED: "true"
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

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
