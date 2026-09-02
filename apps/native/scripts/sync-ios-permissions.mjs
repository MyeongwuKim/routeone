import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readEnvFile } from "./env-file.mjs";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const infoPlistPath = path.join(nativeRoot, "ios/RouteOne/Info.plist");
const entitlementsPath = path.join(
  nativeRoot,
  "ios/RouteOne/RouteOne.entitlements"
);
const explicitEnvFile = process.env.ROUTEONE_ENV_FILE?.trim();
const envMode = process.env.NODE_ENV?.trim();
const envPaths = explicitEnvFile
  ? [path.resolve(nativeRoot, explicitEnvFile)]
  : [
      path.join(nativeRoot, ".env"),
      ...(envMode ? [path.join(nativeRoot, `.env.${envMode}`)] : []),
    ];
const xcodeBuildNumber = "$(CURRENT_PROJECT_VERSION)";

const permissionEntries = [
  {
    key: "NSCameraUsageDescription",
    value:
      "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다.",
  },
  {
    key: "NSPhotoLibraryUsageDescription",
    value:
      "RouteOne이 지난 방문 사진 인증을 위해 선택한 사진을 사용합니다.",
  },
  {
    key: "NSLocationWhenInUseUsageDescription",
    value:
      "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다.",
  },
  {
    key: "NSLocationAlwaysAndWhenInUseUsageDescription",
    value:
      "RouteOne이 장소 근처에 도착했을 때 알림을 보내기 위해 위치를 사용합니다.",
  },
  {
    key: "NSLocationAlwaysUsageDescription",
    value:
      "RouteOne이 장소 근처에 도착했을 때 알림을 보내기 위해 위치를 사용합니다.",
  },
];

function readConfiguredEnv() {
  return Object.assign(
    {},
    ...envPaths.map((envPath) => readEnvFile(envPath))
  );
}

function escapePlistString(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function syncBuildNumber(source) {
  const buildNumberPattern =
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]*(<\/string>)/;

  if (source.includes(`<string>${xcodeBuildNumber}</string>`)) {
    return {
      source,
      didChange: false,
    };
  }

  if (buildNumberPattern.test(source)) {
    return {
      source: source.replace(
        buildNumberPattern,
        (_match, prefix, suffix) => `${prefix}${xcodeBuildNumber}${suffix}`
      ),
      didChange: true,
    };
  }

  const buildNumberEntry = [
    "\t<key>CFBundleVersion</key>",
    `\t<string>${xcodeBuildNumber}</string>`,
  ].join("\n");

  return {
    source: source.replace("</dict>", `${buildNumberEntry}\n</dict>`),
    didChange: true,
  };
}

function getGoogleIosUrlScheme() {
  const env = readConfiguredEnv();
  const explicitScheme =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME?.trim() ||
    process.env.GOOGLE_IOS_URL_SCHEME?.trim() ||
    env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ||
    env.GOOGLE_IOS_URL_SCHEME ||
    "";

  if (explicitScheme) {
    return explicitScheme;
  }

  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ||
    process.env.GOOGLE_IOS_CLIENT_ID?.trim() ||
    env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    env.GOOGLE_IOS_CLIENT_ID ||
    "";

  return clientId.endsWith(".apps.googleusercontent.com")
    ? `com.googleusercontent.apps.${clientId.replace(
        ".apps.googleusercontent.com",
        ""
      )}`
    : "";
}

function syncGoogleUrlScheme(source) {
  const googleIosUrlScheme = getGoogleIosUrlScheme();

  if (!googleIosUrlScheme) {
    return {
      source,
      didChange: false,
    };
  }

  const escapedScheme = escapePlistString(googleIosUrlScheme);
  const googleSchemePattern =
    /([ \t]*)<string>com\.googleusercontent\.apps\.[^<]+<\/string>\s*\n?/g;
  const existingGoogleSchemes = [
    ...source.matchAll(
      /<string>(com\.googleusercontent\.apps\.[^<]+)<\/string>/g
    ),
  ].map((match) => match[1]);

  if (existingGoogleSchemes.length > 0) {
    let didWriteScheme = false;
    const nextSource = source.replace(
      googleSchemePattern,
      (_match, indentation) => {
        if (didWriteScheme) {
          return "";
        }

        didWriteScheme = true;
        return `${indentation}<string>${escapedScheme}</string>\n`;
      }
    );

    return {
      source: nextSource,
      didChange:
        existingGoogleSchemes.length !== 1 ||
        existingGoogleSchemes[0] !== googleIosUrlScheme,
    };
  }

  const bundleUrlSchemesMarker = "\t\t\t</array>";
  const insertion = `\t\t\t\t<string>${escapedScheme}</string>\n`;

  if (source.includes(bundleUrlSchemesMarker)) {
    return {
      source: source.replace(
        bundleUrlSchemesMarker,
        `${insertion}${bundleUrlSchemesMarker}`
      ),
      didChange: true,
    };
  }

  const bundleUrlTypes = [
    "\t<key>CFBundleURLTypes</key>",
    "\t<array>",
    "\t\t<dict>",
    "\t\t\t<key>CFBundleURLSchemes</key>",
    "\t\t\t<array>",
    `\t\t\t\t<string>${escapedScheme}</string>`,
    "\t\t\t</array>",
    "\t\t</dict>",
    "\t</array>",
  ].join("\n");

  return {
    source: source.replace("</dict>", `${bundleUrlTypes}\n</dict>`),
    didChange: true,
  };
}

function syncPermissionEntries(source) {
  const missingEntries = permissionEntries.filter(
    ({ key }) => !source.includes(`<key>${key}</key>`)
  );

  if (missingEntries.length === 0) {
    return {
      source,
      count: 0,
    };
  }

  const insertion = missingEntries
    .map(
      ({ key, value }) =>
        `\t<key>${key}</key>\n\t<string>${escapePlistString(value)}</string>`
    )
    .join("\n");

  const insertionMarker = "\t<key>RCTNewArchEnabled</key>";

  return {
    source: source.includes(insertionMarker)
      ? source.replace(insertionMarker, `${insertion}\n${insertionMarker}`)
      : source.replace("</dict>", `${insertion}\n</dict>`),
    count: missingEntries.length,
  };
}

function syncBackgroundLocationMode(source) {
  if (source.includes("<string>location</string>")) {
    return {
      source,
      didChange: false,
    };
  }

  const backgroundModeEntry = [
    "\t<key>UIBackgroundModes</key>",
    "\t<array>",
    "\t\t<string>location</string>",
    "\t</array>",
  ].join("\n");

  if (source.includes("<key>UIBackgroundModes</key>")) {
    return {
      source: source.replace(
        /(<key>UIBackgroundModes<\/key>\s*<array>)/,
        `$1\n\t\t<string>location</string>`
      ),
      didChange: true,
    };
  }

  return {
    source: source.replace("</dict>", `${backgroundModeEntry}\n</dict>`),
    didChange: true,
  };
}

function syncAppleEntitlement() {
  if (!existsSync(entitlementsPath)) {
    console.warn("[sync-ios-permissions] Entitlements not found, skipping.");
    return null;
  }

  const source = readFileSync(entitlementsPath, "utf8");

  if (source.includes("<key>com.apple.developer.applesignin</key>")) {
    return null;
  }

  const entry = [
    "\t<key>com.apple.developer.applesignin</key>",
    "\t<array>",
    "\t\t<string>Default</string>",
    "\t</array>",
  ].join("\n");

  const nextSource = source.includes("<dict/>")
    ? source.replace("<dict/>", `<dict>\n${entry}\n</dict>`)
    : source.replace("</dict>", `${entry}\n</dict>`);

  writeFileSync(entitlementsPath, nextSource);
  return "added";
}

if (!existsSync(infoPlistPath)) {
  console.warn("[sync-ios-permissions] Info.plist not found, skipping.");
  process.exit(0);
}

const source = readFileSync(infoPlistPath, "utf8");
const buildNumberResult = syncBuildNumber(source);
const permissionResult = syncPermissionEntries(buildNumberResult.source);
const backgroundLocationResult = syncBackgroundLocationMode(permissionResult.source);
const googleResult = syncGoogleUrlScheme(backgroundLocationResult.source);
const appleEntitlementResult = syncAppleEntitlement();

if (
  buildNumberResult.didChange ||
  permissionResult.count > 0 ||
  backgroundLocationResult.didChange ||
  googleResult.didChange
) {
  writeFileSync(infoPlistPath, googleResult.source);
}

if (
  !buildNumberResult.didChange &&
  !permissionResult.count &&
  !backgroundLocationResult.didChange &&
  !googleResult.didChange &&
  !appleEntitlementResult
) {
  console.log("[sync-ios-permissions] No iOS auth or permission entries needed.");
  process.exit(0);
}

const changes = [
  buildNumberResult.didChange
    ? "linked build number to CURRENT_PROJECT_VERSION"
    : null,
  permissionResult.count
    ? `added permission entries: ${permissionResult.count}`
    : null,
  googleResult.didChange ? "synced Google URL scheme" : null,
  backgroundLocationResult.didChange ? "enabled background location mode" : null,
  appleEntitlementResult === "added"
    ? "added Apple Sign In entitlement"
    : null,
].filter(Boolean);

console.log(`[sync-ios-permissions] ${changes.join(", ")}.`);
