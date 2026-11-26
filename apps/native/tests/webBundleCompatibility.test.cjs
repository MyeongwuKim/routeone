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

const appVersions = require("../app-versions.json");

function loadWebBundleConfig(channel, version, buildOverrides = {}) {
  const runtimeEnv = {
    APP_VARIANT: channel,
    EXPO_PUBLIC_APP_VARIANT: channel,
    EXPO_PUBLIC_WEB_BUNDLE_BASE_URL: "https://bundle.example.test",
  };
  const { default: { expo: config } } = load("app.config.ts", {
    "./app-versions.json": {
      [channel]: { ios: version, android: version },
    },
  }, { ...runtimeEnv, ...buildOverrides });
  const { WEB_BUNDLE_UPDATE_CONFIG } = load("src/config/webBundleUpdateConfig.ts", {
    "expo-constants": { expoConfig: config },
  }, runtimeEnv);
  return { config, runtime: WEB_BUNDLE_UPDATE_CONFIG };
}

test("개발과 운영은 루트 매니페스트를 쓰고 운영은 최소 버전을 요구한다", () => {
  for (const channel of ["dev", "prod"]) {
    const { config, runtime } = loadWebBundleConfig(channel, appVersions[channel].ios, {
      EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD_V2: "https://bundle.example.test/runtime/v2/latest/manifest.json",
    });
    const expected = "https://bundle.example.test/latest/manifest.json";
    assert.equal(config.extra.routeone.webBundleManifestUrl, expected);
    assert.equal(runtime.manifestUrl, expected);
    assert.equal(runtime.requiresMinimumNativeVersion, channel === "prod");
  }
});

test("운영 빌드에서 지정한 매니페스트 주소를 WebView 런타임이 사용한다", () => {
  const manifestUrl = "https://bundle.example.test/custom/latest/manifest.json";
  const { runtime } = loadWebBundleConfig("prod", appVersions.prod.ios, {
    EXPO_PUBLIC_WEB_BUNDLE_MANIFEST_URL_PROD: manifestUrl,
  });
  assert.equal(runtime.manifestUrl, manifestUrl);
});

test("호환되지 않는 원격 번들은 설치하거나 원격 대체 화면으로 열지 않는다", async () => {
  const compare = load("src/version/compareVersions.ts", {});
  const checker = load("src/webBundle/webBundleVersionChecker.ts", {
    "@/version/compareVersions": compare
  });
  for (const [channel, nativeVersion, min, expected] of [
    ["prod", "1.1.1", null, "embedded"],
    ["prod", "1.1.1", "1.2.0", "embedded"],
    ["prod", "1.1.1", "1.1.1", "installed"],
    ["dev", "1.0.2", "1.1.0", "installed-old"],
    ["dev", "1.1.0", "1.1.0", "installed"],
    ["dev", "1.0.2", null, "installed"],
  ]) {
    let installed = 0;
    const { runtime } = loadWebBundleConfig(channel, nativeVersion);
    const version = channel === "prod" && !min ? "1.0.34" : "1.2.0";
    const manifest = {
      version,
      channel,
      entryUrl: `https://bundle.example.test/releases/${version}/web/index.html`,
      minimumNativeVersion: min,
    };
    const { resolveWebBundle } = load("src/webBundle/webBundleLoader.ts", {
      "react-native": { Platform: { OS: "ios" } },
      "@/config/webBundleUpdateConfig": { WEB_BUNDLE_UPDATE_CONFIG: runtime },
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
