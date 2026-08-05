#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const versionsPath = resolve(scriptDirectory, "../app-versions.json");
const appVariant = readAppVariant(process.env.APP_VARIANT);
const platform = readPlatform(process.env.ROUTEONE_BUILD_PLATFORM);
const versions = readVersions(versionsPath);
const version = versions[appVariant][platform];
const platformLabel = platform === "ios" ? "iOS" : "Android";
const prompt = `[${appVariant}/${platform}] ${platformLabel} 앱 버전 ${version}이 맞나요? (y/N) `;

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
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));

    for (const variant of ["dev", "prod"]) {
      for (const appPlatform of ["ios", "android"]) {
        const configuredVersion = parsed?.[variant]?.[appPlatform];

        if (
          typeof configuredVersion !== "string" ||
          !/^\d+\.\d+\.\d+$/.test(configuredVersion.trim())
        ) {
          fail(`Invalid app version: ${variant}.${appPlatform}`);
        }

        parsed[variant][appPlatform] = configuredVersion.trim();
      }
    }

    return parsed;
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail(`Invalid app version JSON: ${filePath}`);
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
