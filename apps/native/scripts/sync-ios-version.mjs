/**
 * app-versions.json에서 현재 variant의 iOS 앱 버전을 읽어 Xcode의
 * MARKETING_VERSION에 반영한다. Expo prebuild가 생성한 Info.plist 버전과
 * Xcode General 화면의 Version 표시가 어긋나지 않도록 prebuild 직후 실행한다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const versionsPath = path.join(nativeRoot, "app-versions.json");
const projectPath = path.join(
  nativeRoot,
  "ios",
  "RouteOne.xcodeproj",
  "project.pbxproj",
);
const appVariant = process.env.APP_VARIANT?.trim();

if (appVariant !== "dev" && appVariant !== "prod") {
  console.error('[sync-ios-version] APP_VARIANT must be "dev" or "prod".');
  process.exit(1);
}

const versions = JSON.parse(readFileSync(versionsPath, "utf8"));
const version = versions?.[appVariant]?.ios;

if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(
    `[sync-ios-version] Invalid ${appVariant}.ios version in app-versions.json.`,
  );
  process.exit(1);
}

const source = readFileSync(projectPath, "utf8");
const matches = source.match(/MARKETING_VERSION = [^;]+;/g) ?? [];

if (matches.length === 0) {
  console.error("[sync-ios-version] MARKETING_VERSION was not found.");
  process.exit(1);
}

const nextSource = source.replace(
  /MARKETING_VERSION = [^;]+;/g,
  `MARKETING_VERSION = ${version};`,
);

if (nextSource !== source) {
  writeFileSync(projectPath, nextSource);
  console.log(
    `[sync-ios-version] Synced ${matches.length} Xcode configuration(s) to ${version}.`,
  );
} else {
  console.log(`[sync-ios-version] Xcode version is already ${version}.`);
}
