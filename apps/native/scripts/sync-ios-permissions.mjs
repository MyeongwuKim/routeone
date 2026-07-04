import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const infoPlistPath = path.join(nativeRoot, "ios/RouteOne/Info.plist");

const permissionEntries = [
  {
    key: "NSCameraUsageDescription",
    value:
      "RouteOne이 방문한 장소의 사진 인증을 남기기 위해 카메라를 사용합니다.",
  },
  {
    key: "NSLocationWhenInUseUsageDescription",
    value:
      "RouteOne이 장소 근처 도착 여부와 방문 인증을 확인하기 위해 현재 위치를 사용합니다.",
  },
];

function escapePlistString(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

if (!existsSync(infoPlistPath)) {
  console.warn("[sync-ios-permissions] Info.plist not found, skipping.");
  process.exit(0);
}

const source = readFileSync(infoPlistPath, "utf8");
const missingEntries = permissionEntries.filter(
  ({ key }) => !source.includes(`<key>${key}</key>`)
);

if (missingEntries.length === 0) {
  console.log("[sync-ios-permissions] No permission entries needed.");
  process.exit(0);
}

const insertion = missingEntries
  .map(
    ({ key, value }) =>
      `\t<key>${key}</key>\n\t<string>${escapePlistString(value)}</string>`
  )
  .join("\n");

const insertionMarker = "\t<key>RCTNewArchEnabled</key>";
const nextSource = source.includes(insertionMarker)
  ? source.replace(insertionMarker, `${insertion}\n${insertionMarker}`)
  : source.replace("</dict>", `${insertion}\n</dict>`);

writeFileSync(infoPlistPath, nextSource);
console.log(
  `[sync-ios-permissions] Added ${missingEntries.length} permission entr${
    missingEntries.length === 1 ? "y" : "ies"
  }.`
);
