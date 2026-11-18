const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(relativePath, modules = {}, globals = {}) {
  const compiled = ts.transpileModule(
    readFileSync(path.join(__dirname, relativePath), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  );
  const exports = {};
  vm.runInNewContext(compiled.outputText, {
    exports,
    require: (specifier) => {
      assert.ok(Object.hasOwn(modules, specifier), `Unexpected module: ${specifier}`);
      return modules[specifier];
    },
    console,
    ...globals,
  });
  return exports;
}

function harness() {
  const counts = [];
  const state = { token: "test-token", sessionId: "session-1", cleanupPending: false, badgeError: false };
  let queue = Promise.resolve();
  const enqueue = (operation) => {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  };
  const exports = loadModule("../src/webview/bridge/notificationBadgeBridge.ts", {
    "expo-notifications": {
      setBadgeCountAsync: async (count) => {
        if (state.badgeError) throw new Error("test OS error");
        counts.push(count);
        return true;
      },
    },
    "@/auth/nativeAuthStorage": {
      enqueueNativeAuthSessionOperation: enqueue,
      isNativeSessionCleanupPending: async () => state.cleanupPending,
      readStoredNativeAuthSession: async () => state,
    },
  }, { console: { warn: () => {} } });
  return { counts, state, enqueue, ...exports };
}

const message = (count, sessionId = "session-1") => ({
  type: "routeone:native-notification-badge", sessionId, count,
});

test("배지 메시지는 음수·소수·비정상 숫자와 세션 없는 요청을 거절한다", () => {
  const { isNativeNotificationBadgeMessage: accepts } = loadModule("../src/webview/bridge/messageGuards.ts");
  assert.equal(accepts(message(0)), true);
  assert.equal(accepts(message(12)), true);
  for (const count of [-1, 1.5, NaN, Infinity, "1", null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(accepts(message(count)), false);
  }
  assert.equal(accepts(message(1, "")), false);
  assert.equal(accepts(message(1, "  ")), false);
  assert.equal(accepts(null), false);
});

test("현재 세션의 미확인 개수를 반영하고 0으로 배지를 제거한다", async () => {
  const h = harness();
  await h.handleNativeNotificationBadgeMessage(message(3));
  await h.handleNativeNotificationBadgeMessage(message(0));
  assert.deepEqual(h.counts, [3, 0]);
});

test("계정 전환·로그아웃·세션 정리 중 이전 메시지로 배지가 복구되지 않는다", async () => {
  const h = harness();
  await h.enqueue(async () => {
    await h.setNativeNotificationBadgeCount(0);
    h.state.sessionId = "session-2";
  });
  await h.handleNativeNotificationBadgeMessage(message(8));
  h.state.token = null;
  await h.handleNativeNotificationBadgeMessage(message(8, "session-2"));
  h.state.token = "new-test-token";
  h.state.cleanupPending = true;
  await h.handleNativeNotificationBadgeMessage(message(8, "session-2"));
  assert.deepEqual(h.counts, [0]);
});

test("OS 배지 실패는 세션 정리나 다음 배지 갱신을 막지 않는다", async () => {
  const h = harness();
  h.state.badgeError = true;
  assert.equal(await h.setNativeNotificationBadgeCount(0), false);
  h.state.badgeError = false;
  await h.handleNativeNotificationBadgeMessage(message(2));
  assert.deepEqual(h.counts, [2]);
});

test("주입된 웹 브리지는 호출 시점 세션을 보내고 잘못된 개수를 전송하지 않는다", () => {
  const messages = [];
  const { ROUTEONE_WEBVIEW_BRIDGE_SCRIPT } = loadModule("../src/webview/bridge/injectedScript.ts", {
    "@/config/webBundleUpdateConfig": { WEB_BUNDLE_UPDATE_CONFIG: { appVariant: "none", channel: "test", manifestUrl: null } },
  }, { process: { env: {} } });
  const window = {
    __ROUTEONE_NATIVE_AUTH_SESSION_ID__: "session-1",
    ReactNativeWebView: { postMessage: (value) => messages.push(JSON.parse(value)) },
    addEventListener: () => {},
    setTimeout: () => 1,
    fetch: () => Promise.reject(new Error("Unexpected network access")),
  };
  vm.runInNewContext(ROUTEONE_WEBVIEW_BRIDGE_SCRIPT, {
    window,
    document: { querySelector: () => ({ setAttribute: () => {} }), addEventListener: () => {}, documentElement: { style: {} }, body: { style: {} } },
    URL, Date,
  });
  assert.equal(window.RouteOneNative.setBadgeCount(2), true);
  window.__ROUTEONE_NATIVE_AUTH_SESSION_ID__ = "session-2";
  assert.equal(window.RouteOneNative.setBadgeCount(0), true);
  assert.equal(window.RouteOneNative.setBadgeCount(-1), false);
  const badgeMessages = messages.filter(({ type }) => type === "routeone:native-notification-badge");
  assert.deepEqual(badgeMessages, [message(2), message(0, "session-2")]);
  delete window.ReactNativeWebView;
  assert.equal(window.RouteOneNative.setBadgeCount(1), false);
});
