const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const compiledModules = new Map();

function loadModule(relativePath, mocks, globals = {}) {
  if (!compiledModules.has(relativePath)) {
    const result = ts.transpileModule(
      readFileSync(path.join(__dirname, relativePath), "utf8"),
      {
        reportDiagnostics: true,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
        },
      }
    );
    assert.equal(result.diagnostics.length, 0);
    compiledModules.set(relativePath, result.outputText);
  }

  const exports = {};
  vm.runInNewContext(compiledModules.get(relativePath), {
    exports,
    require(specifier) {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
    ...globals,
  });
  return exports;
}

/** 실제 설정과 정책 resolver를 연결하되 네트워크·기기 저장소는 호출 횟수를 기록하는 대역으로 바꾼다. */
function createHarness({ isDev, env = {}, extra = {} }) {
  const calls = { fetch: 0, cacheRead: 0, cacheWrite: 0 };
  const { NATIVE_UPDATE_CONFIG: config } = loadModule(
    "../src/config/nativeUpdateConfig.ts",
    {
      "expo-constants": {
        __esModule: true,
        default: {
          expoConfig: { version: "1.0.0", extra: { routeone: extra } },
        },
      },
    },
    { __DEV__: isDev, process: { env } }
  );
  const manifest = {
    schemaVersion: 1,
    channel: config.appVariant,
    platforms: {
      ios: {
        enabled: true,
        minimumVersion: "1.0.1",
        storeUrl: "https://apps.apple.com/app/id123456789",
      },
      android: {
        enabled: false,
        minimumVersion: "1.0.0",
        storeUrl: null,
      },
    },
  };
  const policy = loadModule(
    "../src/nativeUpdate/nativeUpdatePolicy.ts",
    {
      "@react-native-async-storage/async-storage": {
        __esModule: true,
        default: {
          async getItem() {
            calls.cacheRead += 1;
            return JSON.stringify(manifest);
          },
          async setItem() {
            calls.cacheWrite += 1;
          },
        },
      },
      "react-native": { Platform: { OS: "ios" } },
      "@/config/nativeUpdateConfig": { NATIVE_UPDATE_CONFIG: config },
      "@/version/compareVersions": loadModule(
        "../src/version/compareVersions.ts",
        {}
      ),
    },
    {
      URL,
      AbortController,
      setTimeout,
      clearTimeout,
      console,
      async fetch(url) {
        calls.fetch += 1;
        assert.equal(url, config.policyUrl);
        return { ok: true, json: async () => manifest };
      },
    }
  );

  return { calls, config, resolve: policy.resolveNativeUpdateRequirement };
}

test("로컬 개발 앱은 dev·prod 정책이 설정돼도 네트워크와 캐시 없이 업데이트 검사를 건너뛴다", async () => {
  for (const variant of ["dev", "prod"]) {
    const harness = createHarness({
      isDev: true,
      env: { EXPO_PUBLIC_APP_VARIANT: variant },
      extra: {
        appVariant: variant,
        nativeUpdateChecksEnabled: true,
        nativeUpdatePolicyUrl: `https://updates.example.com/${variant}/native/latest.json`,
      },
    });

    assert.equal(harness.config.checksEnabled, false, variant);
    assert.equal(await harness.resolve(), null, variant);
    assert.deepEqual(harness.calls, { fetch: 0, cacheRead: 0, cacheWrite: 0 });
  }
});

test("배포용 dev·prod 앱은 최소 버전보다 낮으면 업데이트를 계속 요구한다", async () => {
  for (const variant of ["dev", "prod"]) {
    const harness = createHarness({
      isDev: false,
      env: {
        EXPO_PUBLIC_APP_VARIANT: variant,
        [`EXPO_PUBLIC_NATIVE_UPDATE_POLICY_URL_${variant.toUpperCase()}`]:
          `https://updates.example.com/${variant}/native/latest.json`,
      },
      extra: { appVariant: variant, nativeUpdateChecksEnabled: true },
    });

    assert.equal(harness.config.checksEnabled, true, variant);
    const requirement = await harness.resolve();
    assert.equal(requirement.currentVersion, "1.0.0", variant);
    assert.equal(requirement.minimumVersion, "1.0.1", variant);
    assert.equal(requirement.storeUrl, "https://apps.apple.com/app/id123456789");
    assert.deepEqual(harness.calls, { fetch: 1, cacheRead: 0, cacheWrite: 1 });
  }
});

test("variant none·명시적 비활성·정책 URL 없음은 배포 모드에서도 검사를 시작하지 않는다", async () => {
  const cases = [
    {
      env: { EXPO_PUBLIC_APP_VARIANT: "none" },
      extra: {
        appVariant: "dev",
        nativeUpdatePolicyUrl: "https://updates.example.com/native/latest.json",
      },
    },
    {
      env: { EXPO_PUBLIC_APP_VARIANT: "prod" },
      extra: {
        nativeUpdateChecksEnabled: false,
        nativeUpdatePolicyUrl: "https://updates.example.com/native/latest.json",
      },
    },
    {
      env: { EXPO_PUBLIC_APP_VARIANT: "prod" },
      extra: { nativeUpdateChecksEnabled: true },
    },
  ];

  for (const options of cases) {
    const harness = createHarness({ isDev: false, ...options });
    assert.equal(harness.config.checksEnabled, false);
    assert.equal(await harness.resolve(), null);
    assert.deepEqual(harness.calls, { fetch: 0, cacheRead: 0, cacheWrite: 0 });
  }
});
