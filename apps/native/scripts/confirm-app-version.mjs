#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { styleText } from "node:util";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const versionsPath = resolve(scriptDirectory, "../app-versions.json");
const minimumVersionsPath = resolve(scriptDirectory, "../minimum-app-versions.json");
const webBundleRuntimePath = resolve(scriptDirectory, "../../../config/web-bundle-runtime.json");
const appVariant = readAppVariant(process.env.APP_VARIANT);
const platform = readPlatform(process.env.ROUTEONE_BUILD_PLATFORM);
const versions = readVersions(versionsPath);
const version = versions[appVariant][platform];
const platformLabel = platform === "ios" ? "iOS" : "Android";
const minimumApp = readJson(minimumVersionsPath)?.[appVariant]?.[platform];
const webBundle = readJson(webBundleRuntimePath)?.[appVariant];

if (typeof minimumApp?.enabled !== "boolean" || !isVersion(minimumApp.minimumVersion)) {
  fail(`Invalid minimum app version policy: ${appVariant}.${platform} in ${minimumVersionsPath}`);
}

if (!isVersion(webBundle?.minimumNativeVersion)) {
  fail(`Invalid web bundle minimum native version: ${appVariant} in ${webBundleRuntimePath}`);
}

// Compare against the local policy. A published manifest can specify its own minimum.
const meetsWebBundleMinimum = version.localeCompare(webBundle.minimumNativeVersion.trim(), "en", {
  numeric: true,
}) >= 0;
const divider = styleText("cyan", "─".repeat(44));
const prompt = `${styleText("bold", "이 설정으로 빌드를 진행할까요?")} (y/N) `;
const compatibility = meetsWebBundleMinimum
  ? styleText("green", "충족")
  : styleText("red", "미충족");
const forceUpdate = minimumApp.enabled
  ? styleText("yellow", "사용")
  : "사용 안 함";

console.log([
  "",
  divider,
  `  ${styleText(["bold", "cyan"], `${platformLabel} 빌드 버전 확인 · ${appVariant}`)}`,
  divider,
  `  빌드할 앱 버전          ${styleText(["bold", "cyan"], version)}`,
  "",
  `  ${styleText("bold", "앱 업데이트 정책")}`,
  `    최소 앱 버전          ${styleText("cyan", minimumApp.minimumVersion.trim())}`,
  `    강제 업데이트         ${forceUpdate}`,
  "",
  `  ${styleText("bold", "웹 번들 호환 설정")}`,
  `    최소 네이티브 버전    ${styleText("cyan", webBundle.minimumNativeVersion.trim())}`,
  `    이 빌드의 호환 기준   ${compatibility}`,
  "",
  "  로컬 설정 파일 기준",
  divider,
].join("\n"));

if (
  readBoolean(process.env.CI) ||
  readBoolean(process.env.ROUTEONE_SKIP_APP_VERSION_CONFIRM)
) {
  console.log(`${prompt}y (non-interactive)`);
  process.exit(0);
}

const readline = createInterface({ input: stdin, output: stdout });

try {
  const answer = (await readline.question(prompt)).trim().toLowerCase();

  if (answer !== "y" && answer !== "yes") {
    console.error(
      `빌드를 취소했습니다. ${versionsPath}의 ${appVariant}.${platform} 값을 확인해 주세요.`
    );
    process.exitCode = 1;
  }
} finally {
  readline.close();
}

function readAppVariant(value) {
  const variant = value?.trim().toLowerCase();

  if (variant === "dev" || variant === "prod") {
    return variant;
  }

  fail("APP_VARIANT must be dev or prod before confirming the app version.");
}

function readPlatform(value) {
  const platformValue = value?.trim().toLowerCase();

  if (platformValue === "ios" || platformValue === "android") {
    return platformValue;
  }

  fail(
    "ROUTEONE_BUILD_PLATFORM must be ios or android before confirming the app version."
  );
}

function readVersions(filePath) {
  const parsed = readJson(filePath);

  for (const variant of ["dev", "prod"]) {
    for (const appPlatform of ["ios", "android"]) {
      const configuredVersion = parsed?.[variant]?.[appPlatform];

      if (!isVersion(configuredVersion)) {
        fail(`Invalid app version: ${variant}.${appPlatform}`);
      }

      parsed[variant][appPlatform] = configuredVersion.trim();
    }
  }

  return parsed;
}

function isVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value.trim());
}

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail(`Invalid JSON: ${filePath}`);
    }

    throw error;
  }
}

function readBoolean(value) {
  return ["1", "true", "yes"].includes(value?.trim().toLowerCase() || "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
