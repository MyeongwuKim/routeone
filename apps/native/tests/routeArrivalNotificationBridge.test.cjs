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

function createHarness({ platform = "ios", storage = new Map() } = {}) {
  const state = {
    storage,
    presented: [],
    pending: new Set(),
    nativeSyncs: [],
    scheduled: [],
    responses: [],
    tasks: new Map(),
    onPosition: null,
    presentedError: null,
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
        state.pending.add(request.identifier);
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
        return { lat: place.lat, lng: place.lng, accuracyMeters: 10 };
      },
    },
    "@/nativeModules/routeArrivalNotifications": {
      syncIosRouteArrivalNotifications: async (notifications) => {
        state.nativeSyncs.push(notifications);
        const delivered = new Set(state.presented.map((n) => n.request.identifier));
        state.pending = new Set(
          notifications.map((n) => n.identifier).filter((id) => !delivered.has(id))
        );
        return notifications.length;
      },
      getIosRouteArrivalNotificationStatus: async () => ({
        pendingIdentifiers: [...state.pending],
        deliveredIdentifiers: state.presented.map((n) => n.request.identifier),
      }),
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

test("알림 탭으로 저장된 수신 기록도 iOS 재등록에서 제외한다", async () => {
  const { bridge, state, sync } = createHarness();
  await bridge.recordDeliveredRouteArrivalNotification(createNotification());
  await sync();

  assert.equal(state.nativeSyncs.flat().length, 0);
  assert.equal(state.scheduled.length, 0);
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
