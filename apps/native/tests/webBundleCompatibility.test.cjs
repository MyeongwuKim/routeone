const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, dependencies, env = {}) {
  const source = readFileSync(join(__dirname, "..", relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true
    }
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    URL,
    process: { env },
    __DEV__: false,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    }
  });
  return exports;
}

const runtime = require("../../../config/web-bundle-runtime.json");

test("운영 1.1.0부터 새 경로를 사용하고 구형 운영 앱과 dev는 기존 경로를 사용한다", () => {
  for (const [appVariant, version, path] of [
    ["prod", "1.0.1", "latest/manifest.json"],
    ["prod", "1.1.0", "runtime/v2/latest/manifest.json"],
    ["dev", "1.1.0", "latest/manifest.json"],
  ]) {
    const env = {
      APP_VARIANT: appVariant,
      EXPO_PUBLIC_APP_VARIANT: appVariant,
      EXPO_PUBLIC_WEB_BUNDLE_BASE_URL: "https://bundle.example.test",
      EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD: "https://bundle.example.test/latest/manifest.json",
    };
    const { default: { expo: config } } = load("app.config.ts", {
      "./app-versions.json": {
        dev: { ios: version, android: version },
        prod: { ios: version, android: version }
      },
      "../../config/web-bundle-runtime.json": runtime
    }, env);
    const { WEB_BUNDLE_UPDATE_CONFIG } = load("src/config/webBundleUpdateConfig.ts", {
      "expo-constants": { expoConfig: config }
    }, env);
    assert.equal(config.extra.routeone.webBundleManifestUrl, `https://bundle.example.test/${path}`);
    assert.equal(WEB_BUNDLE_UPDATE_CONFIG.manifestUrl, `https://bundle.example.test/${path}`);
  }
});

test("호환되지 않는 원격 번들은 설치하거나 원격 대체 화면으로 열지 않는다", async () => {
  const compare = load("src/version/compareVersions.ts", {});
  const checker = load("src/webBundle/webBundleVersionChecker.ts", {
    "@/version/compareVersions": compare
  });
  for (const [channel, nativeVersion, min, expected] of [
    ["prod", "1.1.0", null, "embedded"],
    ["prod", "1.1.0", "1.2.0", "embedded"],
    ["prod", "1.1.0", "1.1.0", "installed"],
    ["dev", "1.0.2", "1.1.0", "installed-old"],
    ["dev", "1.1.0", "1.1.0", "installed"],
    ["dev", "1.0.2", null, "installed"],
  ]) {
    let installed = 0;
    const manifest = {
      version: "1.2.0",
      channel,
      entryUrl: `https://bundle.example.test/${channel === "prod" ? "runtime/v2/" : ""}releases/1.2.0/web/index.html`,
      minimumNativeVersion: min,
    };
    const { resolveWebBundle } = load("src/webBundle/webBundleLoader.ts", {
      "react-native": { Platform: { OS: "ios" } },
      "@/config/webBundleUpdateConfig": {
        WEB_BUNDLE_UPDATE_CONFIG: {
          updatesEnabled: true,
          channel,
          nativeVersion,
          requiresMinimumNativeVersion: channel === "prod",
          publicOrigin: "https://bundle.example.test",
          manifestUrl: `https://bundle.example.test/${channel === "prod" ? "runtime/v2/" : ""}latest/manifest.json`
        }
      },
      "@/generated/webBundle": { WEB_BUNDLE_HTML: "<html/>" },
      "./webBundleManifest": { fetchWebBundleManifest: async () => manifest },
      "./webBundleStorage": {
        prepareWebBundleStorage: async () => ({
          active: { ...manifest, version: "1.0.4", minimumNativeVersion: null },
          failedVersions: []
        }),
        installWebBundle: async () => {
          installed += 1;
          return manifest;
        }
      },
      "./webBundleProgress": { emitWebBundleProgress() {} },
      "./webBundleErrors": {},
      "./webBundleVersionChecker": checker
    });
    const result = await resolveWebBundle();
    assert.equal(result.kind, expected === "installed-old" ? "installed" : expected);
    if (expected === "installed-old") {
      assert.equal(result.version, "1.0.4");
    }
    assert.equal(installed, expected === "installed" ? 1 : 0);
  }
});
