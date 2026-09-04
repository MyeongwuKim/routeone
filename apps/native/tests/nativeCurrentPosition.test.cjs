const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const webRequire = createRequire(path.join(__dirname, "../../web/package.json"));
const TARGET = { lat: 0, lng: 0 };
const START_TIME = 1_000_000;
const compiledModules = new Map();

function loadModule(relativePath, mocks, globals = {}) {
  if (!compiledModules.has(relativePath)) {
    const source = readFileSync(path.join(__dirname, relativePath), "utf8")
      .replaceAll("import.meta.env", "({})");
    const result = ts.transpileModule(source, {
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    });
    assert.equal(result.diagnostics.length, 0);
    compiledModules.set(relativePath, result.outputText);
  }

  const exports = {};
  vm.runInNewContext(compiledModules.get(relativePath), {
    exports,
    require: (specifier) => {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
    Date,
    Error,
    setTimeout,
    clearTimeout,
    ...globals,
  });
  return exports;
}

function createPosition(timestamp, lat = TARGET.lat, accuracy = 10) {
  return {
    coords: { latitude: lat, longitude: TARGET.lng, accuracy },
    timestamp,
  };
}

function createHarness(globals = {}) {
  const state = {
    now: START_TIME,
    currentCalls: 0,
    lastKnownCalls: 0,
    permission: "granted",
    onCurrent: null,
    onLastKnown: null,
  };
  const clock = class extends Date {
    static now() { return state.now; }
  };
  const native = loadModule("../src/location/nativeCurrentPosition.ts", {
    "expo-location": {
      Accuracy: { High: 4 },
      getForegroundPermissionsAsync: async () => ({ status: state.permission }),
      requestForegroundPermissionsAsync: async () => ({ status: state.permission }),
      getLastKnownPositionAsync: async () => {
        state.lastKnownCalls += 1;
        return state.onLastKnown ? state.onLastKnown() : null;
      },
      getCurrentPositionAsync: async (options) => {
        state.currentCalls += 1;
        assert.equal(options.accuracy, 4);
        return state.onCurrent ? state.onCurrent() : createPosition(state.now);
      },
    },
  }, { Date: clock, ...globals });
  return { state, clock, native };
}

function createVisitService(harness, getCurrentPosition) {
  return loadModule("../../web/src/features/my-route/services/visitPhotoService.ts", {
    "@/lib/placeVerificationPolicy": {
      resolvePlaceVerificationPolicy: () => ({
        notificationRadiusMeters: 300,
        verificationRadiusMeters: 100,
      }),
    },
    "@/native-bridge": {
      nativeBridge: {
        runtime: { isAvailable: () => true },
        location: {
          getCurrentPosition: getCurrentPosition ??
            ((options) => harness.native.prepareNativeCurrentPosition(options)),
        },
      },
    },
  }, { Date: harness.clock, window: {} });
}

async function seedDistantCache(harness) {
  harness.state.onCurrent = () => createPosition(harness.state.now, 0.009);
  await harness.native.prepareNativeCurrentPosition();
  harness.state.now += 300_000;
  harness.state.onCurrent = () => createPosition(harness.state.now);
}

test("일반 위치는 5분 캐시를 유지하고 GPS 인증은 1km 전 위치 대신 새 좌표를 받는다", async () => {
  const harness = createHarness();
  await seedDistantCache(harness);

  const cached = await harness.native.prepareNativeCurrentPosition();
  assert.equal(cached.lat, 0.009);
  assert.equal(harness.state.currentCalls, 1);

  const position = await createVisitService(harness)
    .requestVisitVerificationPosition(TARGET);
  assert.equal(position.lat, TARGET.lat);
  assert.equal(position.timestamp, harness.state.now);
  assert.equal(position.accuracyMeters, 10);
  assert.equal(harness.state.currentCalls, 2);
  assert.equal(harness.state.lastKnownCalls, 1);
});

test("강제 갱신은 진행 중인 일반 캐시 조회를 공유하지 않는다", async () => {
  const harness = createHarness();
  await seedDistantCache(harness);
  const cachedRequest = harness.native.prepareNativeCurrentPosition();
  const freshRequest = harness.native.prepareNativeCurrentPosition({ forceRefresh: true });
  const [cached, fresh] = await Promise.all([cachedRequest, freshRequest]);

  assert.equal(cached.lat, 0.009);
  assert.equal(fresh.lat, TARGET.lat);
  assert.equal(harness.state.currentCalls, 2);
});

test("동시에 들어온 강제 갱신끼리는 새 GPS 요청을 공유한다", async () => {
  const harness = createHarness();
  const results = await Promise.all([
    harness.native.prepareNativeCurrentPosition({ forceRefresh: true }),
    harness.native.prepareNativeCurrentPosition({ forceRefresh: true }),
  ]);

  assert.equal(harness.state.currentCalls, 1);
  assert.equal(harness.state.lastKnownCalls, 0);
  assert.equal(results[0].timestamp, results[1].timestamp);
});

test("새 GPS 요청이 실패하면 정확한 이전 캐시가 있어도 인증에 사용하지 않는다", async () => {
  const harness = createHarness();
  await seedDistantCache(harness);
  harness.state.onCurrent = () => { throw new Error("synthetic GPS failure"); };

  await assert.rejects(
    createVisitService(harness).requestVisitVerificationPosition(TARGET),
    /synthetic GPS failure/
  );
  assert.equal(harness.state.currentCalls, 2);
  assert.equal(harness.state.lastKnownCalls, 1);

  harness.state.onCurrent = () => createPosition(harness.state.now);
  const retry = await createVisitService(harness)
    .requestVisitVerificationPosition(TARGET);
  assert.equal(retry.lat, TARGET.lat);
  assert.equal(harness.state.currentCalls, 3);
});

test("강제 갱신은 OS가 돌려준 오래된 timestamp를 현재 시각으로 바꾸지 않고 거절한다", async () => {
  const harness = createHarness();
  harness.state.onCurrent = () => createPosition(harness.state.now - 16_000);

  await assert.rejects(
    harness.native.prepareNativeCurrentPosition({ forceRefresh: true }),
    /갱신되지/
  );
  assert.equal(harness.state.lastKnownCalls, 0);
});

test("새 GPS 측정이 응답하지 않으면 제한 시간 후 실패하고 다음 요청을 다시 시작한다", async () => {
  const timers = new Map();
  let nextTimer = 0;
  const harness = createHarness({
    setTimeout: (callback, timeoutMs) => {
      const id = ++nextTimer;
      timers.set(id, { callback, timeoutMs });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  harness.state.onCurrent = () => new Promise(() => {});
  const request = harness.native.prepareNativeCurrentPosition({ forceRefresh: true });
  await new Promise(setImmediate);
  const timeout = [...timers.values()][0];
  assert.equal(timeout.timeoutMs, 20_000);
  timeout.callback();

  await assert.rejects(request, /새 위치를 확인하지 못했어요/);
  assert.equal(timers.size, 0);
  harness.state.onCurrent = () => createPosition(harness.state.now);
  const retry = await harness.native.prepareNativeCurrentPosition({ forceRefresh: true });
  assert.equal(retry.lat, TARGET.lat);
  assert.equal(harness.state.currentCalls, 2);
});

test("늦게 끝난 일반 조회가 새 GPS 캐시를 과거 위치로 덮어쓰지 않는다", async () => {
  const harness = createHarness();
  let resolveLastKnown;
  harness.state.onLastKnown = () => new Promise((resolve) => {
    resolveLastKnown = resolve;
  });
  const normalRequest = harness.native.prepareNativeCurrentPosition();
  const fresh = await harness.native.prepareNativeCurrentPosition({ forceRefresh: true });
  resolveLastKnown(createPosition(harness.state.now - 10_000, 0.009));
  await normalRequest;

  const nextPosition = await harness.native.prepareNativeCurrentPosition();
  assert.equal(nextPosition.timestamp, fresh.timestamp);
  assert.equal(nextPosition.lat, TARGET.lat);
});

test("위치 권한이 없으면 캐시나 OS 좌표를 읽지 않는다", async () => {
  const harness = createHarness();
  await seedDistantCache(harness);
  harness.state.permission = "denied";

  await assert.rejects(
    harness.native.prepareNativeCurrentPosition({ forceRefresh: true }),
    /위치 권한/
  );
  assert.equal(harness.state.currentCalls, 1);
});

test("구버전 native가 forceRefresh를 무시해도 오래된 위치를 인증하지 않는다", async () => {
  const harness = createHarness();
  const service = createVisitService(harness, (options) => {
    assert.equal(options.forceRefresh, true);
    return Promise.resolve({
      ...TARGET,
      accuracyMeters: 10,
      timestamp: harness.state.now - 240_000,
    });
  });

  await assert.rejects(service.requestVisitVerificationPosition(TARGET), /갱신되지/);
});

test("인증은 timestamp 누락·미래 시각과 불확실한 accuracy를 거절한다", async () => {
  const harness = createHarness();
  const service = createVisitService(harness);

  for (const timestamp of [undefined, NaN, harness.state.now - 15_001, harness.state.now + 5_001]) {
    assert.throws(() => service.assertVisitPositionFreshness({ timestamp }), /갱신되지/);
  }
  for (const accuracyMeters of [null, NaN, -1, 101]) {
    assert.throws(() => service.assertVisitPositionAccuracy({ accuracyMeters }), /정확도/);
  }
  assert.doesNotThrow(() => service.assertVisitPositionAccuracy({ accuracyMeters: 100 }));
});

test("인증 거리 100m 기준과 좌표 유효성 검사를 유지한다", () => {
  const service = createVisitService(createHarness());

  assert.doesNotThrow(() => service.assertVisitPositionNearPlace({ lat: 0.0008, lng: 0 }, TARGET));
  assert.throws(() => service.assertVisitPositionNearPlace({ lat: 0.001, lng: 0 }, TARGET), /떨어져/);
  assert.throws(() => service.assertVisitPositionNearPlace({ lat: NaN, lng: 0 }, TARGET), /현재 위치/);
  assert.throws(() => service.assertVisitPositionNearPlace(TARGET, { lat: 91, lng: 0 }), /장소 좌표/);
});

test("native 위치 bridge가 강제 갱신 옵션과 측정 시각·정확도를 전달한다", async () => {
  let forwardedOptions;
  let response;
  const position = { ...TARGET, timestamp: START_TIME, accuracyMeters: 12 };
  const bridge = loadModule("../src/webview/bridge/locationBridge.ts", {
    "@/location/nativeCurrentPosition": {
      prepareNativeCurrentPosition: async (options) => {
        forwardedOptions = options;
        return position;
      },
    },
    "./responses": {
      postNativeLocationResponse: (_ref, _id, payload) => { response = payload; },
    },
  });

  await bridge.handleNativeLocationRequest({
    type: "routeone:native-location-current",
    id: "synthetic-request",
    forceRefresh: true,
  }, { current: null });
  assert.equal(forwardedOptions.forceRefresh, true);
  assert.equal(response.timestamp, position.timestamp);
  assert.equal(response.accuracyMeters, position.accuracyMeters);
});

test("심사 위치가 설정되면 실제 GPS 대신 해당 좌표를 현재 위치로 반환한다", async () => {
  let nativePositionRequestCount = 0;
  let response;
  const bridge = loadModule("../src/webview/bridge/locationBridge.ts", {
    "@/location/nativeCurrentPosition": {
      prepareNativeCurrentPosition: async () => {
        nativePositionRequestCount += 1;
        return { ...TARGET, timestamp: START_TIME, accuracyMeters: 12 };
      },
    },
    "./responses": {
      postNativeLocationResponse: (_ref, _id, payload) => { response = payload; },
    },
  });
  const reviewerPosition = { lat: 37.8813, lng: 127.7298 };

  bridge.setNativeRouteArrivalTestPosition(reviewerPosition);
  await bridge.handleNativeLocationRequest({
    type: "routeone:native-location-current",
    id: "reviewer-position",
    forceRefresh: true,
  }, { current: null }, true);

  assert.equal(nativePositionRequestCount, 0);
  assert.equal(response.lat, reviewerPosition.lat);
  assert.equal(response.lng, reviewerPosition.lng);
  assert.equal(response.accuracyMeters, 1);

  await bridge.handleNativeLocationRequest({
    type: "routeone:native-location-current",
    id: "real-position",
    useRealPosition: true,
    forceRefresh: true,
  }, { current: null }, true);

  assert.equal(nativePositionRequestCount, 1);
});

test("주입 bridge는 forceRefresh를 JSON 메시지에 넣고 응답 timestamp를 보존한다", async () => {
  const { ROUTEONE_WEBVIEW_BRIDGE_SCRIPT } = loadModule("../src/webview/bridge/injectedScript.ts", {
    "@/config/webBundleUpdateConfig": {
      WEB_BUNDLE_UPDATE_CONFIG: { appVariant: "none", channel: "test", manifestUrl: null },
    },
  }, { process: { env: {} } });
  const messages = [];
  const window = {
    ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) },
    addEventListener: () => {},
    setTimeout: () => {},
    fetch: () => Promise.reject(new Error("Unexpected network access")),
  };
  const document = {
    querySelector: () => ({ setAttribute: () => {} }),
    addEventListener: () => {},
    documentElement: { style: {} },
    body: { style: {} },
  };
  vm.runInNewContext(ROUTEONE_WEBVIEW_BRIDGE_SCRIPT, { window, document, URL, Date });
  const request = window.RouteOneNative.getCurrentPosition({ forceRefresh: true });
  const message = messages.find((candidate) => candidate.type === "routeone:native-location-current");
  assert.equal(message.forceRefresh, true);

  window.__ROUTEONE_NATIVE_LOCATION_RESPONSE__(message.id, {
    ok: true, ...TARGET, timestamp: START_TIME, accuracyMeters: 9,
  });
  const result = await request;
  assert.equal(result.timestamp, START_TIME);
  assert.equal(result.accuracyMeters, 9);
});

test("일반 웹 지도 캐시 설정은 유지하고 강제 갱신만 maximumAge 0을 사용한다", async () => {
  const calls = [];
  const helper = loadModule("../../web/src/lib/currentPosition.ts", {
    "@/native-bridge": { nativeBridge: { location: { getCurrentPosition: () => null } } },
  }, {
    navigator: {
      geolocation: {
        getCurrentPosition: (resolve, _reject, options) => {
          calls.push(options);
          resolve(createPosition(START_TIME));
        },
      },
    },
  });

  const normal = await helper.getCurrentPosition();
  const fresh = await helper.getCurrentPosition({ forceRefresh: true });
  assert.equal(calls[0].maximumAge, 300_000);
  assert.equal(calls[0].enableHighAccuracy, false);
  assert.equal(calls[1].maximumAge, 0);
  assert.equal(calls[1].enableHighAccuracy, true);
  assert.equal(normal.timestamp, START_TIME);
  assert.equal(fresh.accuracyMeters, 10);
});

test("웹 강제 갱신은 일반 진행 요청을 공유하지 않고 늦은 응답이 최신 상태를 덮지 않는다", async () => {
  const requests = [];
  const { useCurrentPositionStore } = loadModule("../../web/src/stores/currentPositionStore.ts", {
    zustand: webRequire("zustand"),
    "@/lib/currentPosition": {
      getCurrentPosition: (options) => new Promise((resolve) => {
        requests.push({ options, resolve });
      }),
    },
  });
  const normalRequest = useCurrentPositionStore.getState().requestCurrentPosition();
  const freshRequest = useCurrentPositionStore.getState().requestCurrentPosition({ forceRefresh: true });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.forceRefresh, false);
  assert.equal(requests[1].options.forceRefresh, true);
  requests[1].resolve({ ...TARGET, timestamp: START_TIME, accuracyMeters: 10 });
  await freshRequest;
  requests[0].resolve({ lat: 0.009, lng: 0, timestamp: START_TIME - 10_000, accuracyMeters: 10 });
  await normalRequest;

  assert.equal(useCurrentPositionStore.getState().position.lat, TARGET.lat);
  assert.equal(useCurrentPositionStore.getState().position.timestamp, START_TIME);
});
