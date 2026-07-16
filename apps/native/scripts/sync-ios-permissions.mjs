import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const infoPlistPath = path.join(nativeRoot, "ios/RouteOne/Info.plist");
const entitlementsPath = path.join(
  nativeRoot,
  "ios/RouteOne/RouteOne.entitlements"
);
const envPath = path.join(nativeRoot, ".env");

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

function readEnvFile() {
  if (!existsSync(envPath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");

        if (separatorIndex < 0) {
          return null;
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");

        return key ? [key, value] : null;
      })
      .filter(Boolean)
  );
}

function escapePlistString(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getGoogleIosUrlScheme() {
  const env = readEnvFile();
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

function isAppleSignInEnabled() {
  const env = readEnvFile();
  const value =
    process.env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN?.trim() ??
    env.EXPO_PUBLIC_ENABLE_APPLE_SIGN_IN ??
    "";

  return value.toLowerCase() === "true" || value === "1";
}

function syncGoogleUrlScheme(source) {
  const googleIosUrlScheme = getGoogleIosUrlScheme();

  if (!googleIosUrlScheme || source.includes(`<string>${googleIosUrlScheme}</string>`)) {
    return {
      source,
      didChange: false,
    };
  }

  const bundleUrlSchemesMarker = "\t\t\t</array>";
  const insertion = `\t\t\t\t<string>${escapePlistString(googleIosUrlScheme)}</string>\n`;

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
    `\t\t\t\t<string>${escapePlistString(googleIosUrlScheme)}</string>`,
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
  const appleEntryPattern =
    /\s*<key>com\.apple\.developer\.applesignin<\/key>\s*<array>\s*<string>Default<\/string>\s*<\/array>/;

  if (!isAppleSignInEnabled()) {
    if (!source.includes("<key>com.apple.developer.applesignin</key>")) {
      return null;
    }

    const nextSource = source
      .replace(appleEntryPattern, "")
      .replace(/<dict>\s*<\/dict>/, "<dict/>");

    writeFileSync(entitlementsPath, nextSource);
    return "removed";
  }

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
const permissionResult = syncPermissionEntries(source);
const backgroundLocationResult = syncBackgroundLocationMode(permissionResult.source);
const googleResult = syncGoogleUrlScheme(backgroundLocationResult.source);
const appleEntitlementResult = syncAppleEntitlement();

if (
  permissionResult.count > 0 ||
  backgroundLocationResult.didChange ||
  googleResult.didChange
) {
  writeFileSync(infoPlistPath, googleResult.source);
}

if (
  !permissionResult.count &&
  !backgroundLocationResult.didChange &&
  !googleResult.didChange &&
  !appleEntitlementResult
) {
  console.log("[sync-ios-permissions] No iOS auth or permission entries needed.");
  process.exit(0);
}

const changes = [
  permissionResult.count
    ? `added permission entries: ${permissionResult.count}`
    : null,
  googleResult.didChange ? "added Google URL scheme" : null,
  backgroundLocationResult.didChange ? "enabled background location mode" : null,
  appleEntitlementResult === "added"
    ? "added Apple Sign In entitlement"
    : null,
  appleEntitlementResult === "removed"
    ? "removed Apple Sign In entitlement"
    : null,
].filter(Boolean);

console.log(`[sync-ios-permissions] ${changes.join(", ")}.`);
