import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspaceRoot = path.resolve(nativeRoot, "../..");

function findExpoModulesJsiPackageRoot() {
  const directPackageRoots = [
    path.join(nativeRoot, "node_modules/expo-modules-jsi"),
    path.join(workspaceRoot, "node_modules/expo-modules-jsi"),
  ];

  const directPackageRoot = directPackageRoots.find((candidate) =>
    existsSync(path.join(candidate, "apple/Sources/ExpoModulesJSI"))
  );

  if (directPackageRoot) {
    return directPackageRoot;
  }

  const pnpmStoreRoot = path.join(workspaceRoot, "node_modules/.pnpm");

  if (!existsSync(pnpmStoreRoot)) {
    return null;
  }

  const pnpmPackageRoot = readdirSync(pnpmStoreRoot)
    .filter((entry) => entry.startsWith("expo-modules-jsi@"))
    .map((entry) =>
      path.join(pnpmStoreRoot, entry, "node_modules/expo-modules-jsi")
    )
    .find((candidate) =>
      existsSync(path.join(candidate, "apple/Sources/ExpoModulesJSI"))
    );

  return pnpmPackageRoot ?? null;
}

const packageRoot = findExpoModulesJsiPackageRoot();
const sourcesRoot = packageRoot
  ? path.join(packageRoot, "apple/Sources/ExpoModulesJSI")
  : null;

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

if (!sourcesRoot || !existsSync(sourcesRoot)) {
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
