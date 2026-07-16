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

const channel = readChannel();
const retention = readPositiveInteger("ROUTEONE_WEB_BUNDLE_RETENTION", 5);
const prefix = trimSlashes(env.ROUTEONE_WEB_BUNDLE_PREFIX || "routeone-web-bundles");
const distDir = resolve(env.ROUTEONE_WEB_DIST_DIR || "apps/web/dist");
const shortSha = (env.GITHUB_SHA || "local").slice(0, 7);
const buildNumber = readPositiveInteger(
  "ROUTEONE_WEB_BUNDLE_BUILD_NUMBER",
  Number.parseInt(env.GITHUB_RUN_NUMBER || "", 10) || Date.now()
);
const version =
  env.ROUTEONE_WEB_BUNDLE_VERSION?.trim() ||
  `${channel}-${buildNumber}-${shortSha}`;
const safeVersion = version.replace(/[^a-zA-Z0-9._-]/g, "-");
const createdAt = new Date().toISOString();
const publicBaseUrl = trimTrailingSlashes(env.R2_PUBLIC_BASE_URL || "");
const tmpRoot = mkdtempSync(join(tmpdir(), "routeone-web-bundle-"));
const bundleFileName = `web-${safeVersion}.zip`;
const bundlePath = join(tmpRoot, bundleFileName);
const bundleKey = joinKey(prefix, channel, "bundles", bundleFileName);
const manifestKey = joinKey(prefix, channel, "manifest.json");
const versionsKey = joinKey(prefix, channel, "versions.json");
const existingVersionsPath = join(tmpRoot, "versions.json");
const manifestPath = join(tmpRoot, "manifest.json");
const nextVersionsPath = join(tmpRoot, "next-versions.json");

try {
  assertDistDir();
  zipDist();

  const bundleStat = statSync(bundlePath);
  const manifest = {
    schemaVersion: 1,
    channel,
    web: {
      version,
      buildNumber,
      bundleKey,
      bundleUrl: publicBaseUrl ? `${publicBaseUrl}/${bundleKey}` : null,
      sha256: sha256(bundlePath),
      sizeBytes: bundleStat.size,
      createdAt,
      git: {
        branch: env.GITHUB_REF_NAME || null,
        commit: env.GITHUB_SHA || null,
        runNumber: env.GITHUB_RUN_NUMBER || null,
        runId: env.GITHUB_RUN_ID || null
      }
    },
    native: readNativeVersions(),
    retention: {
      maxBundles: retention
    }
  };

  uploadFile(bundlePath, bundleKey, "application/zip", "public, max-age=31536000, immutable");

  const versions = buildNextVersions(manifest);
  writeJson(manifestPath, manifest);
  writeJson(nextVersionsPath, versions);
  uploadFile(manifestPath, manifestKey, "application/json", "no-store");
  uploadFile(nextVersionsPath, versionsKey, "application/json", "no-store");
  pruneBundles(versions);

  console.log(`Published ${bundleKey}`);
  console.log(`Updated ${manifestKey}`);
  console.log(`Updated ${versionsKey}`);
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

function readChannel() {
  const value = env.ROUTEONE_WEB_BUNDLE_CHANNEL?.trim().toLowerCase();

  if (value === "dev" || value === "prod") {
    return value;
  }

  fail('ROUTEONE_WEB_BUNDLE_CHANNEL must be "dev" or "prod".');
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

function buildNextVersions(manifest) {
  const current = readExistingVersions();
  const nextEntry = {
    channel: manifest.channel,
    web: manifest.web,
    native: manifest.native
  };
  const seenKeys = new Set([manifest.web.bundleKey]);
  const entries = [nextEntry];

  for (const item of current) {
    const key = item?.web?.bundleKey;

    if (!key || seenKeys.has(key)) {
      continue;
    }

    entries.push(item);
    seenKeys.add(key);

    if (entries.length >= retention) {
      break;
    }
  }

  return {
    schemaVersion: 1,
    channel,
    updatedAt: manifest.web.createdAt,
    latest: nextEntry,
    versions: entries
  };
}

function readExistingVersions() {
  const result = runAws(
    ["s3", "cp", `s3://${bucketName}/${versionsKey}`, existingVersionsPath],
    { allowFailure: true, capture: true }
  );

  if (result.status !== 0 || !existsSync(existingVersionsPath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(existingVersionsPath, "utf8"));
    return Array.isArray(parsed?.versions) ? parsed.versions : [];
  } catch {
    return [];
  }
}

function pruneBundles(versions) {
  const keepKeys = new Set(
    versions.versions
      .map((item) => item?.web?.bundleKey)
      .filter((key) => typeof key === "string")
  );
  const objects = listBundleObjects();

  for (const object of objects) {
    if (keepKeys.size < retention) {
      keepKeys.add(object.Key);
    }
  }

  for (const object of objects) {
    if (keepKeys.has(object.Key)) {
      continue;
    }

    runAws(["s3", "rm", `s3://${bucketName}/${object.Key}`]);
    console.log(`Deleted old bundle ${object.Key}`);
  }
}

function listBundleObjects() {
  const result = runAws(
    [
      "s3api",
      "list-objects-v2",
      "--bucket",
      bucketName,
      "--prefix",
      joinKey(prefix, channel, "bundles/")
    ],
    { capture: true, allowFailure: true }
  );

  if (result.status !== 0 || !result.stdout) {
    return [];
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return (parsed.Contents || [])
      .filter((item) => typeof item.Key === "string" && item.Key.endsWith(".zip"))
      .sort((a, b) => {
        return new Date(b.LastModified || 0).getTime() - new Date(a.LastModified || 0).getTime();
      });
  } catch {
    return [];
  }
}

function readNativeVersions() {
  const configPath = env.ROUTEONE_NATIVE_CONFIG_PATH
    ? resolve(env.ROUTEONE_NATIVE_CONFIG_PATH)
    : null;
  const expoConfig = configPath && existsSync(configPath)
    ? readExpoConfig(configPath)
    : {};
  const nativeVersion = env.ROUTEONE_NATIVE_VERSION?.trim() || expoConfig.version || null;

  return {
    ios: {
      version: env.ROUTEONE_IOS_NATIVE_VERSION?.trim() || nativeVersion,
      buildNumber:
        env.ROUTEONE_IOS_BUILD_NUMBER?.trim() ||
        expoConfig.ios?.buildNumber ||
        null,
      bundleIdentifier: expoConfig.ios?.bundleIdentifier || null
    },
    android: {
      version: env.ROUTEONE_ANDROID_NATIVE_VERSION?.trim() || nativeVersion,
      versionCode: readOptionalInteger(
        env.ROUTEONE_ANDROID_VERSION_CODE?.trim(),
        expoConfig.android?.versionCode ?? null
      ),
      package: expoConfig.android?.package || null
    }
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

function readOptionalInteger(rawValue, fallback) {
  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value < 1) {
    fail("ROUTEONE_ANDROID_VERSION_CODE must be a positive integer.");
  }

  return value;
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

function trimSlashes(value) {
  return value.replace(/^\/+|\/+$/g, "");
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
