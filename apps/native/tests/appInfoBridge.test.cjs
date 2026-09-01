const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const bridgePath = path.join(
  __dirname,
  "../src/webview/bridge/appInfoBridge.ts"
);
const compiledBridge = ts.transpileModule(readFileSync(bridgePath, "utf8"), {
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});

assert.equal(
  compiledBridge.diagnostics.length,
  0,
  compiledBridge.diagnostics
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    )
    .join("\n")
);

function createHarness({ allowsAlert }) {
  let response = null;
  const exports = {};
  const platform = {
    OS: "ios",
    Version: "18.0",
    constants: {},
  };

  vm.runInNewContext(compiledBridge.outputText, {
    exports,
    require: (specifier) => {
      if (specifier === "expo-constants") {
        return {
          __esModule: true,
          default: {
            expoConfig: {
              ios: { buildNumber: "1", bundleIdentifier: "app.routeone" },
            },
            expoRuntimeVersion: "test",
          },
        };
      }
      if (specifier === "expo-image-picker") {
        return {
          getCameraPermissionsAsync: async () => ({
            status: "granted",
            granted: true,
          }),
          getMediaLibraryPermissionsAsync: async () => ({
            status: "granted",
            granted: true,
            accessPrivileges: "all",
          }),
        };
      }
      if (specifier === "expo-location") {
        return {
          getForegroundPermissionsAsync: async () => ({
            status: "granted",
            granted: true,
            ios: { accuracy: "full" },
          }),
        };
      }
      if (specifier === "expo-notifications") {
        return {
          getPermissionsAsync: async () => ({
            status: "granted",
            granted: true,
            ios: { allowsAlert },
          }),
        };
      }
      if (specifier === "react-native") {
        return { Platform: platform };
      }
      if (specifier === "@/config/webBundleUpdateConfig") {
        return {
          WEB_BUNDLE_UPDATE_CONFIG: {
            nativeVersion: "1.0.0",
            channel: "test",
            appVariant: "none",
          },
        };
      }
      if (specifier === "./nativeCapabilities") {
        return { NATIVE_CAPABILITIES: [] };
      }
      if (specifier === "./responses") {
        return {
          postNativeAppInfoResponse: (_webViewRef, _requestId, payload) => {
            response = payload;
          },
        };
      }

      throw new Error(`Unexpected module: ${specifier}`);
    },
  });

  return {
    get response() {
      return response;
    },
    request: () =>
      exports.handleNativeAppInfoRequest(
        { type: "routeone:native-app-info", id: "request-1" },
        { current: null },
        { webBundleVersion: null, webBundleKind: "remote" }
      ),
  };
}

test("iOS 알림 권한이 granted여도 배너가 꺼져 있으면 denied로 전달한다", async () => {
  const harness = createHarness({ allowsAlert: false });

  await harness.request();

  assert.equal(harness.response.notificationPermissionStatus, "denied");
});

test("iOS 알림 배너가 허용되어 있으면 granted로 전달한다", async () => {
  const harness = createHarness({ allowsAlert: true });

  await harness.request();

  assert.equal(harness.response.notificationPermissionStatus, "granted");
});
