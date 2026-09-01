const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadInjectedBridgeScript() {
  const source = readFileSync(
    path.join(__dirname, "../src/webview/bridge/injectedScript.ts"),
    "utf8"
  );
  const compiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  assert.equal(compiled.diagnostics.length, 0);

  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (specifier) => {
      assert.equal(specifier, "@/config/webBundleUpdateConfig");
      return {
        WEB_BUNDLE_UPDATE_CONFIG: {
          appVariant: "none",
          channel: "test",
          manifestUrl: null,
        },
      };
    },
    process: { env: {} },
  });

  return exports.ROUTEONE_WEBVIEW_BRIDGE_SCRIPT;
}

function createDocument() {
  return {
    querySelector: () => ({ setAttribute: () => {} }),
    addEventListener: () => {},
    documentElement: { style: {} },
    body: { style: {} },
  };
}

test("장소 도착 등록 bridge가 무응답 요청을 60초 후 실패 처리한다", async () => {
  const messages = [];
  const timers = new Map();
  let nextTimerId = 1;
  const window = {
    __ROUTEONE_NATIVE_AUTH_SESSION_ID__: "native-session-1",
    ReactNativeWebView: {
      postMessage: (message) => messages.push(JSON.parse(message)),
    },
    addEventListener: () => {},
    setTimeout: (callback, delay) => {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: (timerId) => timers.delete(timerId),
    fetch: () => Promise.reject(new Error("Unexpected network access")),
  };

  vm.runInNewContext(loadInjectedBridgeScript(), {
    window,
    document: createDocument(),
    URL,
    Date,
  });
  window.__ROUTEONE_NATIVE_AUTH_SESSION_ID__ = "mutated-session";

  const request = window.RouteOneNative.syncRouteArrivalNotifications({
    places: [],
    language: "ko",
  });
  const timeout = [...timers.values()].find(({ delay }) => delay === 60_000);

  assert.ok(timeout);
  timeout.callback();
  await assert.rejects(request, /응답하지 않았어요/);
  assert.equal(
    messages.some(
      ({ type }) => type === "routeone:native-route-arrival-notifications-sync"
    ),
    true
  );
  const syncMessage = messages.find(
    ({ type }) => type === "routeone:native-route-arrival-notifications-sync"
  );
  assert.equal(syncMessage.requestPermissions, true);
  assert.equal(syncMessage.sessionId, "native-session-1");
});

test("장소 도착 등록 bridge가 권한 요청 생략 옵션을 네이티브에 전달한다", async () => {
  const messages = [];
  const timers = new Map();
  let nextTimerId = 1;
  const window = {
    __ROUTEONE_NATIVE_AUTH_SESSION_ID__: "native-session-1",
    ReactNativeWebView: {
      postMessage: (message) => messages.push(JSON.parse(message)),
    },
    addEventListener: () => {},
    setTimeout: (callback, delay) => {
      const timerId = nextTimerId++;
      timers.set(timerId, { callback, delay });
      return timerId;
    },
    clearTimeout: (timerId) => timers.delete(timerId),
    fetch: () => Promise.reject(new Error("Unexpected network access")),
  };

  vm.runInNewContext(loadInjectedBridgeScript(), {
    window,
    document: createDocument(),
    URL,
    Date,
  });
  window.__ROUTEONE_NATIVE_AUTH_SESSION_ID__ = "mutated-session";

  const request = window.RouteOneNative.syncRouteArrivalNotifications({
    places: [],
    language: "ko",
    requestPermissions: false,
  });
  const syncMessage = messages.find(
    ({ type }) => type === "routeone:native-route-arrival-notifications-sync"
  );

  assert.equal(syncMessage.requestPermissions, false);
  assert.equal(syncMessage.sessionId, "native-session-1");
  window.__ROUTEONE_NATIVE_ROUTE_ARRIVAL_NOTIFICATIONS_SYNC_RESPONSE__(
    syncMessage.id,
    {
      ok: true,
      activeCount: 0,
      pendingCount: 0,
      registrationStatus: "inactive",
      backgroundLocationStatus: "unused",
      notificationStatus: "unused",
    }
  );

  assert.deepEqual(JSON.parse(JSON.stringify(await request)), {
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "inactive",
    backgroundLocationStatus: "unused",
    notificationStatus: "unused",
  });
  assert.equal(
    [...timers.values()].some(({ delay }) => delay === 60_000),
    false
  );
});
