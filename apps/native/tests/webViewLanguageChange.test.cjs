const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(relativePath, mocks = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(path.join(__dirname, relativePath), "utf8"),
    { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } },
  );
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, URL, URLSearchParams, Error, console,
    require(specifier) {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
  });
  return exports;
}

// 네이티브 UI 대신 실제 화면 함수의 Hook과 Effect를 렌더 주기별로 실행한다.
function createRenderer() {
  const slots = [];
  let cursor;
  let pendingEffects;
  const changed = (slot, deps) => !slot || !deps ||
    deps.length !== slot.deps.length || deps.some((value, i) => !Object.is(value, slot.deps[i]));
  const react = {
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: initial };
        slot.set = (value) => { slot.value = typeof value === "function" ? value(slot.value) : value; };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useMemo(factory, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) slots[index] = { value: factory(), deps };
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      if (changed(slots[index], deps)) {
        const previous = slots[index];
        slots[index] = { deps };
        pendingEffects.push(() => {
          previous?.cleanup?.();
          slots[index].cleanup = effect();
        });
      }
    },
  };
  return {
    react,
    render(callback) {
      cursor = 0;
      pendingEffects = [];
      const tree = callback();
      pendingEffects.forEach((effect) => effect());
      return tree;
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

const constants = loadModule("../src/constants/nativeWebView.ts");
const bundle = { key: "test-bundle", kind: "embedded", source: { uri: "https://masil.example.test" } };
const noop = () => {};
const subscription = () => ({ remove: noop });

function createHarness(t, resolve = async () => bundle) {
  const renderer = createRenderer();
  t.after(() => renderer.unmount());
  const events = { resolves: 0, prepares: 0, alerts: [] };
  const jsx = (type, props, key) => ({ type, props, key });
  const Screen = loadModule("../src/components/native-webview/NativeWebViewScreen.tsx", {
    react: renderer.react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": {
      View: "View", Text: "Text", StatusBar: "StatusBar", Pressable: "Pressable",
      StyleSheet: { create: (styles) => styles },
      AppState: { currentState: "active", addEventListener: subscription },
      BackHandler: { exitApp: noop },
      Alert: { alert: (...args) => events.alerts.push(args) },
    },
    "react-native-webview": { WebView: "WebView" },
    "expo-notifications": {
      addNotificationReceivedListener: subscription,
      addNotificationResponseReceivedListener: subscription,
      getLastNotificationResponse: () => null, clearLastNotificationResponse: noop,
    },
    "@/constants/nativeWebView": constants,
    "@/webBundle/webBundleErrors": { isFatalWebBundleInstallError: (error) => error?.reason === "download" },
    "@/webBundle/webBundleProgress": { INITIAL_WEB_BUNDLE_PROGRESS: { stage: "preparing", progress: 0, message: "Preparing" } },
    "@/webBundle/webBundleLoader": {
      resolveWebBundle: (...args) => { events.resolves += 1; return resolve(...args); },
      markResolvedWebBundleReady: async () => {}, rollbackResolvedWebBundle: async () => bundle,
    },
    "@/webBundle/webViewReadyRecovery": {
      createWebViewReadyRecoveryController: () => ({
        prepareBundle: () => { events.prepares += 1; },
        markReady: noop, stopWaiting: noop, waitForReady: noop, dispose: noop,
      }),
    },
    "@/webview/bridge": { handleNativeBridgeMessage: async () => {}, ROUTEONE_WEBVIEW_BRIDGE_SCRIPT: "" },
    "@/auth/testFeatureAccess": { isNativeTestFeatureEnabled: () => false },
    "@/config/webBundleUpdateConfig": { WEB_BUNDLE_UPDATE_CONFIG: {} },
    "@/language/nativeEnglishLanguagePack": { getNativeLanguagePackBaseUrl: () => "https://masil.example.test", usesLocalEnglishLanguagePack: false },
    "@/monitoring/sentry": { reportHandledNativeError: noop },
    "@/webview/bridge/externalLinkBridge": { shouldKeepUrlInWebView: () => true, openNativeExternalUrl: async () => {} },
    "@/webview/bridge/routeArrivalNotificationBridge": {
      reconcileStoredRouteArrivalNotifications: async () => {}, recordDeliveredRouteArrivalNotification: async () => {},
    },
    "@/webview/authPreparingOverlayScript": { createAuthSessionPreparingScript: () => "" },
    "./NativeDevBuildBadge": { default: "NativeDevBuildBadge", __esModule: true },
    "./RouteOneLaunchScreen": { default: "LaunchScreen", __esModule: true },
  }).default;
  return {
    events,
    render: (appLanguage = "ko") => renderer.render(() => Screen({
      appLanguage, englishLanguagePack: null, isAuthSessionPreparing: false,
      nativeAuthExpiresAt: null, nativeAuthRole: null, nativeAuthSessionId: null, nativeAuthToken: null,
      onAppLanguageChange: noop, onAuthSessionChange: noop, onLoginRequest: noop,
    })),
  };
}

function find(tree, type) {
  if (!tree || typeof tree !== "object") return null;
  if (tree.type === type) return tree;
  for (const child of [tree.props?.children].flat()) {
    const match = find(child, type);
    if (match) return match;
  }
  return null;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("실행 중 언어를 바꿔도 번들 조회와 WebView 준비를 다시 시작하지 않는다", async (t) => {
  const harness = createHarness(t);
  harness.render();
  await flush();
  let tree = harness.render();
  const source = find(tree, "WebView").props.source;
  find(tree, "WebView").props.onMessage({ nativeEvent: { data: JSON.stringify({ type: "routeone:web-bundle-ready" }) } });
  tree = harness.render();
  assert.equal(find(tree, "LaunchScreen"), null);

  for (const language of ["en", "ko"]) {
    tree = harness.render(language);
    await flush();
    tree = harness.render(language);
    assert.equal(harness.events.resolves, 1, "언어 변경은 번들을 다시 조회하지 않아야 합니다.");
    assert.equal(harness.events.prepares, 1);
    assert.equal(find(tree, "WebView").props.source, source);
    assert.equal(find(tree, "LaunchScreen"), null);
  }
});

test("시작 중 영어팩 진행률은 시작 화면에 표시하고 준비 완료 시 닫는다", async (t) => {
  const harness = createHarness(t);
  harness.render("en");
  await flush();
  let tree = harness.render("en");
  const message = (type, progress) => find(tree, "WebView").props.onMessage({ nativeEvent: { data: JSON.stringify({ type, progress }) } });
  message("routeone:startup-language-progress", 0.4);
  tree = harness.render("en");
  assert.equal(find(tree, "LaunchScreen").props.progress, 0.4);
  assert.equal(find(tree, "LaunchScreen").props.message, constants.WEB_VIEW_TEXT.en.progressMessages.language);
  message("routeone:startup-language-complete");
  message("routeone:web-bundle-ready");
  assert.equal(find(harness.render("en"), "LaunchScreen"), null);
});

test("번들 준비 중 언어가 바뀌어도 요청을 유지하고 오류는 현재 언어로 표시한다", async (t) => {
  let reject;
  const pending = new Promise((_, fail) => { reject = fail; });
  const harness = createHarness(t, () => pending);
  harness.render();
  harness.render("en");
  reject({ reason: "download" });
  await flush();
  const tree = harness.render("en");
  assert.equal(harness.events.resolves, 1);
  assert.equal(harness.events.alerts[0][0], constants.WEB_VIEW_TEXT.en.fatalAlertTitle);
  assert.ok(harness.events.alerts[0][1].includes(constants.WEB_VIEW_TEXT.en.fatalInstallMessages.download));
  assert.ok(JSON.stringify(tree).includes(constants.WEB_VIEW_TEXT.en.fatalInstallMessages.download));
});
