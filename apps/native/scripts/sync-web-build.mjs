import { spawnSync } from "node:child_process";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const nativeRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const webRoot = path.resolve(nativeRoot, "../web");
const webDist = path.join(webRoot, "dist");
const generatedFile = path.join(nativeRoot, "src/generated/webBundle.ts");
const shouldSkipBuild = process.argv.includes("--skip-build");
loadEnvFile(path.join(nativeRoot, ".env"));
const packageManager = process.env.npm_execpath?.includes("pnpm")
  ? "pnpm"
  : "npm";
const moduleSpecifierPrefix = "@routeone/";
const defaultWebviewBaseUrl = "https://routeone.native/";
const nativeWebviewBaseUrl = readNativeWebviewBaseUrl();
const nativeRuntimeConfig = {
  graphqlEndpoint: "/graphql",
  routerMode: "hash",
  webBundlePublicOrigin: readHttpOrigin(nativeWebviewBaseUrl)
};

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
}

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/g, "");
}

function readNativeWebviewBaseUrl() {
  const publicBaseUrl =
    process.env.EXPO_PUBLIC_WEB_BUNDLE_BASE_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    "";

  return publicBaseUrl
    ? `${trimTrailingSlashes(publicBaseUrl)}/`
    : defaultWebviewBaseUrl;
}

function readHttpOrigin(value) {
  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

async function buildNativeWebBundle() {
  const result = spawnSync(packageManager, ["run", "build"], {
    cwd: webRoot,
    env: {
      ...process.env,
      ROUTEONE_NATIVE_WEB_BUNDLE: "1",
    },
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!shouldSkipBuild) {
  await buildNativeWebBundle();
}

function normalizeDistAssetPath(assetPath) {
  return assetPath.trim().replace(/^\/+/, "").replace(/^\.\//, "");
}

function resolveDistAssetPath(assetPath, fromAssetPath) {
  const cleanAssetPath = assetPath.trim().split(/[?#]/)[0] ?? "";

  if (!cleanAssetPath || isExternalAssetUrl(cleanAssetPath)) {
    return null;
  }

  if (cleanAssetPath.startsWith("/")) {
    return normalizeDistAssetPath(cleanAssetPath);
  }

  if (!fromAssetPath) {
    return normalizeDistAssetPath(cleanAssetPath);
  }

  return path.posix
    .normalize(
      path.posix.join(path.posix.dirname(fromAssetPath), cleanAssetPath)
    )
    .replace(/^\.\//, "");
}

function toDistPath(assetPath) {
  const normalizedAssetPath = normalizeDistAssetPath(assetPath);
  const resolvedPath = path.resolve(webDist, normalizedAssetPath);

  if (!resolvedPath.startsWith(webDist)) {
    throw new Error(`Invalid dist asset path: ${assetPath}`);
  }

  return resolvedPath;
}

function getMimeType(filePath) {
  const extname = path.extname(filePath);

  if (extname === ".woff2") {
    return "font/woff2";
  }

  if (extname === ".woff") {
    return "font/woff";
  }

  if (extname === ".svg") {
    return "image/svg+xml";
  }

  if (extname === ".png") {
    return "image/png";
  }

  if (extname === ".jpg" || extname === ".jpeg") {
    return "image/jpeg";
  }

  if (extname === ".json") {
    return "application/json";
  }

  if (extname === ".js") {
    return "text/javascript";
  }

  if (extname === ".css") {
    return "text/css";
  }

  return "application/octet-stream";
}

function isExternalAssetUrl(assetUrl) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(assetUrl);
}

async function toDataUrl(assetPath) {
  const filePath = toDistPath(assetPath);
  const file = await readFile(filePath);

  return `data:${getMimeType(filePath)};base64,${file.toString("base64")}`;
}

async function inlineCssAssetUrls(css, cssAssetPath) {
  let result = css;
  const matches = [...css.matchAll(/url\((["']?)([^"')]+)\1\)/g)];

  for (const match of matches) {
    const assetPath = resolveDistAssetPath(match[2], cssAssetPath);

    if (!assetPath) {
      continue;
    }

    const dataUrl = await toDataUrl(assetPath);
    result = result.replace(match[0], () => `url("${dataUrl}")`);
  }

  return result;
}

async function inlineStylesheets(html) {
  let result = html;
  const matches = [
    ...html.matchAll(/<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)
  ];

  for (const match of matches) {
    const stylesheetPath = normalizeDistAssetPath(match[1]);
    const css = await readFile(toDistPath(stylesheetPath), "utf8");
    const inlinedCss = await inlineCssAssetUrls(css, stylesheetPath);
    result = result.replace(
      match[0],
      () =>
        `<style data-routeone-href="${match[1]}">\n${inlinedCss}\n</style>`
    );
  }

  return result;
}

function getTagAttribute(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, "i"));
  return match?.[1] ?? null;
}

function getEntryModuleScripts(html) {
  const scripts = [...html.matchAll(/<script\b[^>]*><\/script>/gi)];

  return scripts
    .map((match) => match[0])
    .filter((tag) => getTagAttribute(tag, "type") === "module")
    .map((tag) => getTagAttribute(tag, "src"))
    .filter((src) => typeof src === "string")
    .map((src) => normalizeDistAssetPath(src));
}

function cleanupDocument(html) {
  return html
    .replace(/<link\s+rel="icon"[^>]*>\s*/g, "")
    .replace(/<link\s+rel="preload"[^>]*as="font"[^>]*>\s*/g, "")
    .replace(
      /<link\b(?=[^>]*\brel=["']modulepreload["'])[^>]*>\s*/gi,
      ""
    )
    .replace(
      /<script\b(?=[^>]*\btype=["']module["'])(?=[^>]*\bsrc=)[^>]*><\/script>\s*/gi,
      ""
    )
    .replace(
      /<head>/,
      `<head>
    <base href="${nativeWebviewBaseUrl}" />
    <script data-routeone-runtime-config>
      window.RouteOneRuntimeConfig = Object.assign({}, window.RouteOneRuntimeConfig, ${JSON.stringify(
        nativeRuntimeConfig
      )});
    </script>`
    );
}

async function collectDistFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectDistFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(
        path
          .relative(webDist, entryPath)
          .split(path.sep)
          .join(path.posix.sep)
      );
    }
  }

  return files;
}

function toModuleSpecifier(assetPath) {
  return `${moduleSpecifierPrefix}${normalizeDistAssetPath(assetPath)}`;
}

function resolveJsImportPath(importPath, fromAssetPath) {
  return path.posix
    .normalize(path.posix.join(path.posix.dirname(fromAssetPath), importPath))
    .replace(/^\.\//, "");
}

function rewriteJsImportSpecifiers(source, assetPath) {
  const toNativeSpecifier = (importPath) =>
    toModuleSpecifier(resolveJsImportPath(importPath, assetPath));

  return source
    .replace(
      /\bfrom\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1/g,
      (_, quote, specifier) =>
        `from${quote}${toNativeSpecifier(specifier)}${quote}`
    )
    .replace(
      /\bimport\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1/g,
      (_, quote, specifier) =>
        `import${quote}${toNativeSpecifier(specifier)}${quote}`
    )
    .replace(
      /\bimport\s*\(\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1\s*\)/g,
      (_, quote, specifier) =>
        `import(${quote}${toNativeSpecifier(specifier)}${quote})`
    );
}

function rewriteJsPublicAssets(source, publicAssetDataUrls) {
  return source.replaceAll(
    "/gangwon-sigungu-boundary.json",
    publicAssetDataUrls.gangwonBoundary
  );
}

function rewriteJsSource(source, assetPath, publicAssetDataUrls) {
  return rewriteJsImportSpecifiers(
    rewriteJsPublicAssets(
      source.replace(/__vite__mapDeps\(\[[^\]]*\]\)/g, "[]"),
      publicAssetDataUrls
    ),
    assetPath
  );
}

async function buildNativeModuleScripts(entryScriptPaths) {
  const distFiles = await collectDistFiles(webDist);
  const jsAssetPaths = distFiles
    .filter((assetPath) => assetPath.endsWith(".js"))
    .sort();
  const publicAssetDataUrls = {
    gangwonBoundary: await toDataUrl("gangwon-sigungu-boundary.json")
  };
  const imports = {};

  for (const assetPath of jsAssetPaths) {
    const source = await readFile(toDistPath(assetPath), "utf8");
    const rewrittenSource = rewriteJsSource(
      source,
      assetPath,
      publicAssetDataUrls
    );

    imports[toModuleSpecifier(assetPath)] = `data:text/javascript;base64,${Buffer.from(
      rewrittenSource
    ).toString("base64")}`;
  }

  for (const entryScriptPath of entryScriptPaths) {
    const entrySpecifier = toModuleSpecifier(entryScriptPath);

    if (!imports[entrySpecifier]) {
      throw new Error(`Missing native entry module: ${entryScriptPath}`);
    }
  }

  const entryImports = entryScriptPaths
    .map(
      (entryScriptPath) =>
        `import ${JSON.stringify(toModuleSpecifier(entryScriptPath))};`
    )
    .join("\n");

  return {
    html: `<script type="importmap" data-routeone-native-modules>${JSON.stringify({
      imports
    })}</script>
    <script type="module" data-routeone-entry>
${entryImports}
    </script>`,
    moduleCount: jsAssetPaths.length
  };
}

let html = await readFile(path.join(webDist, "index.html"), "utf8");
const entryScriptPaths = getEntryModuleScripts(html);

if (entryScriptPaths.length === 0) {
  throw new Error("No Vite module entry script found in web dist.");
}

html = cleanupDocument(html);
html = await inlineStylesheets(html);

const nativeModuleScripts = await buildNativeModuleScripts(entryScriptPaths);
html = html.replace("</head>", `${nativeModuleScripts.html}\n  </head>`);

await mkdir(path.dirname(generatedFile), { recursive: true });
await writeFile(
  generatedFile,
  `/* This file is generated by scripts/sync-web-build.mjs. */\nexport const WEB_BUNDLE_BASE_URL = ${JSON.stringify(
    nativeWebviewBaseUrl
  )};\nexport const WEB_BUNDLE_PUBLIC_ORIGIN = ${JSON.stringify(
    readHttpOrigin(nativeWebviewBaseUrl)
  )};\nexport const WEB_BUNDLE_HTML = ${JSON.stringify(
    html
  )};\n`
);

console.log(
  `Generated ${path.relative(nativeRoot, generatedFile)} with ${nativeModuleScripts.moduleCount} split modules`
);
