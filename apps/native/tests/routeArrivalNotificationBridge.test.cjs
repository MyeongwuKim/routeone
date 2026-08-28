const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const bridgePath = path.join(
  __dirname,
  "../src/webview/bridge/routeArrivalNotificationBridge.ts"
);
const compiledBridge = ts.transpileModule(readFileSync(bridgePath, "utf8"), {
  reportDiagnostics: true,
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
});
assert.equal(compiledBridge.diagnostics.length, 0,
  compiledBridge.diagnostics.map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
  ).join("\n")
);
const bridgeCode = compiledBridge.outputText;
const PLACES_KEY = "routeone:native-route-arrival-places:v1";
const NOTIFIED_KEY = "routeone:native-route-arrival-notified:v2";
const HISTORY_KEY = "routeone:native-delivered-notification-history:v1";
const now = new Date();
const dateKey = [
  now.getFullYear(),
  `${now.getMonth() + 1}`.padStart(2, "0"),
  `${now.getDate()}`.padStart(2, "0"),
].join("-");
const place = {
  id: "route-1:stop-1",
  routeId: "route-1",
  routeTitle: "테스트 여행",
  dayId: "day-1",
  dayIndex: 1,
  dayDateKey: dateKey,
  stopId: "stop-1",
  title: "테스트 장소",
  lat: 37.5,
  lng: 127,
};
const notificationId = `arrival:${place.routeId}:${place.stopId}:${dateKey}`;

function createNotification() {
  return {
    date: Date.now(),
    request: {
      identifier: notificationId,
      content: {
        data: {
          notificationId,
          type: "route-arrival",
          routeId: place.routeId,
          routeTitle: place.routeTitle,
          dayId: place.dayId,
          stopId: place.stopId,
          placeTitle: place.title,
          dateKey,
        },
      },
    },
  };
}

function createNativeNotificationState() {
  return {
    pending: new Map(),
    presented: [],
    handledIdentifiers: new Set(),
  };
}

function simulateBackgroundDelivery(nativeState, { dismissed = false } = {}) {
  assert.equal(nativeState.pending.get(notificationId)?.kind, "location");
  nativeState.pending.delete(notificationId);
  // Supply the native status contract; ledger inference belongs to native tests.
  nativeState.handledIdentifiers.add(notificationId);
  const notification = createNotification();
  if (!dismissed) nativeState.presented.push(notification);
  return notification;
}

function createHarness({
  platform = "ios",
  storage = new Map(),
  nativeState = createNativeNotificationState(),
  legacyNativeStatus = false,
} = {}) {
  const state = {
    storage,
    nativeState,
    get presented() { return nativeState.presented; },
    set presented(notifications) { nativeState.presented = notifications; },
    pending: nativeState.pending,
    nativeSyncs: [],
    scheduled: [],
    responses: [],
    tasks: new Map(),
    currentPosition: { lat: place.lat, lng: place.lng, accuracyMeters: 10 },
    onPosition: null,
    presentedError: null,
    nativeStatusError: null,
    nativeStatusPendingIdentifiers: null,
    scheduleError: null,
  };
  const granted = async () => ({ status: "granted", granted: true });
  const respond = (_ref, id, payload) => state.responses.push({ id, ...payload });
  const mocks = {
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => storage.get(key) ?? null,
      setItem: async (key, value) => { storage.set(key, value); },
      removeItem: async (key) => { storage.delete(key); },
    },
    "expo-location": {
      getForegroundPermissionsAsync: granted,
      getBackgroundPermissionsAsync: granted,
      hasStartedGeofencingAsync: async () => platform === "android",
      hasStartedLocationUpdatesAsync: async () => platform === "android",
      stopGeofencingAsync: async () => {},
      stopLocationUpdatesAsync: async () => {},
      startGeofencingAsync: async () => {},
      GeofencingEventType: { Enter: 1, Exit: 2 },
    },
    "expo-notifications": {
      setNotificationHandler: () => {},
      getPermissionsAsync: granted,
      setNotificationChannelAsync: async () => {},
      AndroidImportance: { HIGH: 4 },
      AndroidNotificationPriority: { HIGH: "high" },
      getPresentedNotificationsAsync: async () => {
        if (state.presentedError) throw state.presentedError;
        return [...state.presented];
      },
      dismissNotificationAsync: async (identifier) => {
        state.presented = state.presented.filter(
          (notification) => notification.request.identifier !== identifier
        );
      },
      scheduleNotificationAsync: async (request) => {
        if (state.scheduleError) throw state.scheduleError;
        state.scheduled.push(request);
        state.pending.set(request.identifier, { kind: "immediate", request });
        return request.identifier;
      },
    },
    "expo-task-manager": {
      isTaskDefined: (name) => state.tasks.has(name),
      defineTask: (name, task) => { state.tasks.set(name, task); },
    },
    "react-native": { Platform: { OS: platform } },
    "@/location/nativeCurrentPosition": {
      prepareNativeCurrentPosition: async () => {
        await state.onPosition?.();
        return state.currentPosition;
      },
    },
    "@/nativeModules/routeArrivalNotifications": {
      syncIosRouteArrivalNotifications: async (notifications) => {
        state.nativeSyncs.push(notifications);
        const requested = new Set(notifications.map((n) => n.identifier));
        const delivered = new Set(state.presented.map((n) => n.request.identifier));

        // Native sync cancels obsolete location requests, not pending immediate alerts.
        for (const [identifier, pending] of state.pending) {
          if (pending.kind === "location" && !requested.has(identifier)) {
            state.pending.delete(identifier);
          }
        }
        for (const notification of notifications) {
          if (
            delivered.has(notification.identifier) ||
            nativeState.handledIdentifiers.has(notification.identifier) ||
            state.pending.has(notification.identifier)
          ) {
            continue;
          }
          state.pending.set(notification.identifier, {
            kind: "location",
            request: notification,
          });
        }
        return notifications.length;
      },
      getIosRouteArrivalNotificationStatus: async () => {
        if (state.nativeStatusError) throw state.nativeStatusError;
        const status = {
          pendingIdentifiers: state.nativeStatusPendingIdentifiers ?? [...state.pending.keys()],
          deliveredIdentifiers: state.presented.map((n) => n.request.identifier),
        };
        if (!legacyNativeStatus) {
          status.handledIdentifiers = [...nativeState.handledIdentifiers];
        }
        return status;
      },
    },
    "./responses": {
      postNativeDeliveredNotificationHistoryResponse: respond,
      postNativeRouteArrivalNotificationSyncResponse: respond,
      postNativeRouteArrivalTestLocationResponse: respond,
    },
    "./locationBridge": { setNativeRouteArrivalTestPosition: () => {} },
  };
  const exports = {};
  vm.runInNewContext(bridgeCode, {
    exports,
    require: (specifier) => {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
    process: { env: {} },
    console: { log: () => {} },
  }, { filename: bridgePath });

  return {
    state,
    bridge: exports,
    sync: (places = [place]) => exports.handleNativeRouteArrivalNotificationSyncRequest(
      { id: "sync", places, language: "ko" },
      { current: null }
    ),
    inbox: (acknowledgedIds = []) => exports.handleNativeDeliveredNotificationHistoryRequest(
      { id: "inbox", acknowledgedIds },
      { current: null }
    ),
  };
}

test("백그라운드 알림을 알림함에 동기화한 뒤 앱을 다시 열어도 재등록하지 않는다", async () => {
  const first = createHarness();
  first.state.presented = [createNotification()];
  await first.inbox();
  await first.inbox([notificationId]);

  assert.equal(first.state.presented.length, 0);
  assert.equal(JSON.parse(first.state.storage.get(HISTORY_KEY)).length, 0);

  const reopened = createHarness({ storage: first.state.storage });
  await reopened.sync();

  assert.equal(reopened.state.nativeSyncs.flat().length, 0);
  assert.equal(reopened.state.scheduled.length, 0);
  assert.equal(reopened.state.responses.at(-1).registrationStatus, "delivered");
});

for (const dismissed of [true, false]) {
  test(`앱 종료 중 받은 iOS 알림이 ${dismissed ? "지워져도" : "남아 있어도"} 앱 재시작 시 다시 보내지 않는다`, async () => {
    const first = createHarness();
    first.state.currentPosition = { ...first.state.currentPosition, lat: place.lat + 0.02 };
    await first.sync();
    assert.equal(first.state.scheduled.length, 0);

    const received = simulateBackgroundDelivery(first.state.nativeState, { dismissed });
    assert.equal(first.state.storage.has(NOTIFIED_KEY), false);
    assert.equal(first.state.storage.has(HISTORY_KEY), false);

    const reopened = createHarness({
      storage: first.state.storage,
      nativeState: first.state.nativeState,
    });
    if (dismissed) {
      // iOS can briefly return a stale pending snapshot alongside a handled ID.
      reopened.state.nativeStatusPendingIdentifiers = [notificationId];
    }
    await reopened.sync();

    assert.equal(reopened.state.nativeSyncs.flat().length, 0);
    assert.equal(reopened.state.scheduled.length, 0);
    assert.equal(JSON.parse(reopened.state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
    assert.equal(reopened.state.responses.at(-1).pendingCount, 0);
    assert.equal(reopened.state.responses.at(-1).registrationStatus, "delivered");

    await reopened.inbox();
    assert.equal(reopened.state.responses.at(-1).ok, true);
    const history = JSON.parse(reopened.state.storage.get(HISTORY_KEY));
    if (dismissed) {
      // A handled ID has no delivery timestamp and must not create an inbox item.
      assert.equal(history.length, 0);
      assert.equal(reopened.state.responses.at(-1).notifications.length, 0);
    } else {
      assert.equal(history.length, 1);
      assert.equal(history[0].id, notificationId);
      assert.equal(history[0].deliveredAt, new Date(received.date).toISOString());
    }
  });
}

test("JS 날짜 요약이 더 최신이어도 오늘의 네이티브 처리 기록으로 재발송을 막는다", async () => {
  const { state, sync } = createHarness();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = [
    tomorrow.getFullYear(),
    `${tomorrow.getMonth() + 1}`.padStart(2, "0"),
    `${tomorrow.getDate()}`.padStart(2, "0"),
  ].join("-");
  state.nativeState.handledIdentifiers.add(notificationId);
  state.storage.set(NOTIFIED_KEY, JSON.stringify({ [place.id]: tomorrowKey }));

  await sync();

  assert.equal(state.responses.at(-1).ok, true);
  assert.equal(state.nativeSyncs.flat().length, 0);
  assert.equal(state.scheduled.length, 0);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], tomorrowKey);
});

test("알림 탭으로 저장된 수신 기록도 iOS 재등록에서 제외한다", async () => {
  const { bridge, state, sync } = createHarness();
  await bridge.recordDeliveredRouteArrivalNotification(createNotification());
  await sync();

  assert.equal(state.nativeSyncs.flat().length, 0);
  assert.equal(state.scheduled.length, 0);
});

test("처리 기록 필드가 없는 구버전 iOS 모듈도 기존 수신 기록으로 중복을 막는다", async () => {
  const { state, sync } = createHarness({ legacyNativeStatus: true });
  await sync();
  await sync();

  assert.equal(state.responses.at(-1).ok, true);
  assert.equal(state.scheduled.length, 1);
});

test("iOS 수신 콜백이 늦어도 연속 앱 복귀에서 즉시 알림은 한 번만 예약한다", async () => {
  const { state, sync, bridge } = createHarness();
  await sync();
  await Promise.all([
    bridge.reconcileStoredRouteArrivalNotifications(),
    sync(),
  ]);

  assert.equal(state.scheduled.length, 1);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
});

test("현재 위치 조회 중 시스템 알림이 도착하면 즉시 알림을 추가 발송하지 않는다", async () => {
  const { state, sync } = createHarness();
  state.onPosition = () => {
    state.presented = [createNotification()];
    state.pending.delete(notificationId);
  };
  await sync();

  assert.equal(state.scheduled.length, 0);
});

test("GPS 조회 중 iOS 알림이 수신 후 지워져도 네이티브 처리 기록으로 즉시 알림을 막는다", async () => {
  const { state, sync } = createHarness();
  state.onPosition = () => simulateBackgroundDelivery(state.nativeState, { dismissed: true });
  await sync();

  assert.equal(state.presented.length, 0);
  assert.equal(state.scheduled.length, 0);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
});

test("GPS 조회 중에도 수신 기록 저장과 알림함 확인을 처리한다", { timeout: 1000 }, async () => {
  const { state, sync, inbox, bridge } = createHarness();
  state.onPosition = async () => {
    const notification = createNotification();
    state.presented = [notification];
    await bridge.recordDeliveredRouteArrivalNotification(notification);
    await inbox([notificationId]);
  };
  await sync();

  assert.equal(state.presented.length, 0);
  assert.equal(state.scheduled.length, 0);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
});

test("알림함 확인과 앱 복귀가 겹쳐도 수신 기록을 지우거나 재발송하지 않는다", async () => {
  const { state, sync, inbox, bridge } = createHarness();
  state.presented = [createNotification()];
  state.storage.set(PLACES_KEY, JSON.stringify([place]));

  await Promise.all([
    inbox([notificationId]),
    bridge.reconcileStoredRouteArrivalNotifications(),
    sync(),
  ]);

  assert.equal(state.scheduled.length, 0);
  assert.equal(state.nativeSyncs.flat().length, 0);
});

test("시스템 알림 조회 실패 시 재발송을 보류하고 다음 동기화에서 재시도한다", async () => {
  const { state, sync } = createHarness();
  state.presentedError = new Error("notification center unavailable");
  await sync();

  assert.equal(state.scheduled.length, 0);
  assert.equal(state.responses.at(-1).ok, false);

  state.presentedError = null;
  await sync();
  assert.equal(state.scheduled.length, 1);
});

for (const duringPositionLookup of [false, true]) {
  test(`iOS 처리 기록 조회가 ${duringPositionLookup ? "GPS 조회 이후" : "등록 전에"} 실패하면 재발송을 보류한다`, async () => {
    const { state, sync } = createHarness();
    const nativeStatusError = new Error("native notification status unavailable");
    if (duringPositionLookup) {
      state.onPosition = () => { state.nativeStatusError = nativeStatusError; };
    } else {
      state.nativeStatusError = nativeStatusError;
    }
    await sync();

    assert.equal(state.scheduled.length, 0);
    assert.equal(state.storage.has(NOTIFIED_KEY), false);
    assert.equal(state.responses.at(-1).ok, false);

    state.nativeStatusError = null;
    state.onPosition = null;
    await sync();
    assert.equal(state.scheduled.length, 1);
  });
}

test("예약 실패는 발송 완료로 기록하지 않고 다른 장소 알림도 막지 않는다", async () => {
  const { state, sync } = createHarness();
  state.scheduleError = new Error("scheduling failed");
  await sync();
  assert.equal(state.storage.has(NOTIFIED_KEY), false);

  state.scheduleError = null;
  await sync();
  await sync([{ ...place, id: "route-1:stop-2", stopId: "stop-2" }]);
  assert.deepEqual(state.scheduled.map((n) => n.identifier), [
    notificationId,
    `arrival:route-1:stop-2:${dateKey}`,
  ]);
});

test("Android 지오펜스와 앱 복귀가 겹쳐도 한 번만 발송한다", async () => {
  const { state, sync } = createHarness({ platform: "android" });
  state.storage.set(PLACES_KEY, JSON.stringify([place]));
  const geofence = state.tasks.get("routeone-route-arrival-geofence");

  await Promise.all([
    geofence({ data: { eventType: 1, region: { identifier: place.id } } }),
    sync(),
  ]);

  assert.equal(state.scheduled.length, 1);
  assert.equal(JSON.parse(state.storage.get(HISTORY_KEY)).length, 1);
});
