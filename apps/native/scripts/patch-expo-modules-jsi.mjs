import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const packageRoot = path.join(nativeRoot, "node_modules/expo-modules-jsi");
const sourcesRoot = path.join(packageRoot, "apple/Sources/ExpoModulesJSI");

function walkSwiftFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    const stats = statSync(entryPath);

    if (stats.isDirectory()) {
      return walkSwiftFiles(entryPath);
    }

    return entry.endsWith(".swift") ? [entryPath] : [];
  });
}

if (!existsSync(sourcesRoot)) {
  console.warn("[patch-expo-modules-jsi] expo-modules-jsi sources not found, skipping.");
  process.exit(0);
}

let replacementCount = 0;

for (const filePath of walkSwiftFiles(sourcesRoot)) {
  const source = readFileSync(filePath, "utf8");
  const patched = source
    .split("\n")
    .map((line) => {
      if (!line.includes("runtime: JavaScriptRuntime?")) {
        return line;
      }

      const normalizedLine = line.replace(
        /\bnonisolated\(unsafe\)\s+nonisolated\(unsafe\)\s+weak\s+var\b/g,
        "nonisolated(unsafe) weak var"
      );

      if (normalizedLine.includes("nonisolated(unsafe) weak var")) {
        if (normalizedLine !== line) {
          replacementCount += 1;
        }
        return normalizedLine;
      }

      const patchedLine = normalizedLine.replace(
        /\bweak\s+(?:let|var)\b/g,
        "nonisolated(unsafe) weak var"
      );

      if (patchedLine !== normalizedLine) {
        replacementCount += 1;
      }

      return patchedLine;
    })
    .join("\n");

  if (patched !== source) {
    writeFileSync(filePath, patched);
  }
}

if (replacementCount > 0) {
  console.log(
    `[patch-expo-modules-jsi] Patched ${replacementCount} weak runtime declarations for Xcode 26.`
  );
} else {
  console.log("[patch-expo-modules-jsi] No patch needed.");
}
