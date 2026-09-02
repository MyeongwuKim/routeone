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

function createPlace(index) {
  return {
    ...place,
    id: `${place.routeId}:stop-${index}`,
    stopId: `stop-${index}`,
    title: `테스트 장소 ${index}`,
    lat: place.lat + index * 0.001,
  };
}

function getNotificationId(targetPlace) {
  return `arrival:${targetPlace.routeId}:${targetPlace.stopId}:${dateKey}`;
}

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

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

function createLastKnownPosition({
  latitude = place.lat,
  longitude = place.lng,
  accuracy = 10,
  timestamp = Date.now(),
} = {}) {
  return {
    coords: { latitude, longitude, accuracy },
    timestamp,
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
    authSessionId: "native-session-1",
    sessionCleanupPending: false,
    get presented() { return nativeState.presented; },
    set presented(notifications) { nativeState.presented = notifications; },
    pending: nativeState.pending,
    nativeSyncs: [],
    scheduled: [],
    responses: [],
    tasks: new Map(),
    geofenceStarts: [],
    geofencingStatusChecks: 0,
    geofencingStarted: platform === "android",
    locationTrackingStarted: platform === "android",
    locationTrackingStarts: [],
    events: [],
    warnings: [],
    lastKnownPosition: createLastKnownPosition(),
    lastKnownPositionRequests: [],
    currentPosition: { lat: place.lat, lng: place.lng, accuracyMeters: 10 },
    currentPositionRequests: [],
    testPositions: [],
    locationAccuracy: "full",
    notificationAllowsAlert: true,
    onNotificationPermission: null,
    onPosition: null,
    onScheduleNotification: null,
    onStorageSet: null,
    onStorageSetComplete: null,
    onWarning: null,
    presentedError: null,
    nativeStatusError: null,
    nativeStatusPendingIdentifiers: null,
    nativeSyncError: null,
    scheduleError: null,
    storageGetError: null,
  };
  const granted = async () => ({ status: "granted", granted: true });
  const getForegroundPermission = async () => {
    state.events.push("foreground-permission");
    return {
      ...(await granted()),
      ios: { accuracy: state.locationAccuracy },
    };
  };
  const getNotificationPermission = async () => {
    state.events.push("notification-permission");
    await state.onNotificationPermission?.();
    return {
      ...(await granted()),
      ios: { allowsAlert: state.notificationAllowsAlert },
    };
  };
  const respond = (_ref, id, payload) => state.responses.push({ id, ...payload });
  const mocks = {
    "@/auth/nativeAuthStorage": {
      isNativeSessionCleanupPending: async () =>
        state.sessionCleanupPending,
      readStoredNativeAuthSession: async () => ({
        token: "native-auth-token",
        expiresAt: Date.now() + 60_000,
        expired: false,
        role: "USER",
        sessionId: state.authSessionId,
      }),
    },
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => {
        if (state.storageGetError) throw state.storageGetError;
        return storage.get(key) ?? null;
      },
      setItem: async (key, value) => {
        state.events.push(`storage-set-start:${key}`);
        await state.onStorageSet?.(key, value);
        storage.set(key, value);
        state.events.push(`storage-set-complete:${key}`);
        state.onStorageSetComplete?.(key, value);
      },
      removeItem: async (key) => { storage.delete(key); },
    },
    "expo-location": {
      getForegroundPermissionsAsync: getForegroundPermission,
      getBackgroundPermissionsAsync: granted,
      getLastKnownPositionAsync: async (options) => {
        state.lastKnownPositionRequests.push(options);
        return state.lastKnownPosition;
      },
      hasStartedGeofencingAsync: async () => {
        state.geofencingStatusChecks += 1;
        return state.geofencingStarted;
      },
      hasStartedLocationUpdatesAsync: async () =>
        state.locationTrackingStarted,
      stopGeofencingAsync: async () => {
        state.geofencingStarted = false;
      },
      stopLocationUpdatesAsync: async () => {
        state.locationTrackingStarted = false;
      },
      startGeofencingAsync: async (taskName, regions) => {
        state.geofenceStarts.push({ taskName, regions });
        state.geofencingStarted = true;
      },
      startLocationUpdatesAsync: async (taskName, options) => {
        state.locationTrackingStarts.push({ taskName, options });
        state.locationTrackingStarted = true;
      },
      Accuracy: { High: 4 },
      ActivityType: { OtherNavigation: 1 },
      GeofencingEventType: { Enter: 1, Exit: 2 },
    },
    "expo-notifications": {
      setNotificationHandler: () => {},
      getPermissionsAsync: getNotificationPermission,
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
        await state.onScheduleNotification?.(request);
        return request.identifier;
      },
    },
    "expo-task-manager": {
      isTaskDefined: (name) => state.tasks.has(name),
      defineTask: (name, task) => { state.tasks.set(name, task); },
    },
    "react-native": { Platform: { OS: platform } },
    "@/location/nativeCurrentPosition": {
      prepareNativeCurrentPosition: async (options) => {
        state.currentPositionRequests.push(options);
        await state.onPosition?.();
        return state.currentPosition;
      },
    },
    "@/nativeModules/routeArrivalNotifications": {
      syncIosRouteArrivalNotifications: async (notifications) => {
        state.nativeSyncs.push(notifications);
        state.events.push(`ios-sync:${notifications.length}`);
        if (state.nativeSyncError) throw state.nativeSyncError;
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
    "./locationBridge": {
      setNativeRouteArrivalTestPosition: (position) => {
        state.testPositions.push(position);
      },
    },
  };
  const exports = {};
  vm.runInNewContext(bridgeCode, {
    exports,
    require: (specifier) => {
      assert.ok(Object.hasOwn(mocks, specifier), `Unexpected import: ${specifier}`);
      return mocks[specifier];
    },
    process: { env: {} },
    console: {
      log: () => {},
      warn: (...args) => {
        state.warnings.push(args);
        state.onWarning?.(...args);
      },
    },
  }, { filename: bridgePath });

  return {
    state,
    bridge: exports,
    sync: (places = [place], options = {}) => exports.handleNativeRouteArrivalNotificationSyncRequest(
      {
        id: "sync",
        sessionId: "native-session-1",
        places,
        language: "ko",
        ...options,
      },
      { current: null }
    ),
    inbox: (acknowledgedIds = []) => exports.handleNativeDeliveredNotificationHistoryRequest(
      { id: "inbox", acknowledgedIds },
      { current: null }
    ),
  };
}

test("심사 계정은 장소 알림 없이 지역 중심을 테스트 현재 위치로 적용한다", async () => {
  const { bridge, state } = createHarness();
  const regionCenter = { lat: 37.8813, lng: 127.7298 };

  await bridge.handleNativeRouteArrivalTestLocationRequest(
    {
      type: "routeone:native-route-arrival-test-location",
      id: "reviewer-region",
      place: null,
      position: regionCenter,
      language: "ko",
    },
    { current: null },
    true
  );

  assert.equal(state.testPositions.length, 1);
  assert.equal(state.testPositions[0].lat, regionCenter.lat);
  assert.equal(state.testPositions[0].lng, regionCenter.lng);
  assert.equal(state.scheduled.length, 0);
  assert.equal(state.responses.at(-1).active, true);
  assert.equal(state.responses.at(-1).lat, regionCenter.lat);
  assert.equal(state.responses.at(-1).lng, regionCenter.lng);

  await bridge.handleNativeRouteArrivalTestLocationRequest(
    {
      type: "routeone:native-route-arrival-test-location",
      id: "reviewer-region-clear",
      place: null,
      position: null,
      language: "ko",
    },
    { current: null },
    true
  );

  assert.equal(state.testPositions.at(-1), null);
  assert.equal(state.responses.at(-1).active, false);
});

test("일반 계정의 테스트 위치 요청은 네이티브에서 차단한다", async () => {
  const { bridge, state } = createHarness();

  await bridge.handleNativeRouteArrivalTestLocationRequest(
    {
      type: "routeone:native-route-arrival-test-location",
      id: "regular-account-region",
      place: null,
      position: { lat: 37.8813, lng: 127.7298 },
      language: "ko",
    },
    { current: null },
    false
  );

  assert.equal(state.testPositions.length, 0);
  assert.equal(state.responses.at(-1).ok, false);
});

test("세션 정리 중이거나 세션 세대가 바뀌면 늦은 타깃 동기화를 거절한다", async () => {
  const pendingCleanup = createHarness();
  pendingCleanup.state.sessionCleanupPending = true;

  await pendingCleanup.sync();

  assert.equal(pendingCleanup.state.responses.at(-1).ok, false);
  assert.equal(pendingCleanup.state.storage.has(PLACES_KEY), false);
  assert.equal(pendingCleanup.state.nativeSyncs.length, 0);

  const changedSession = createHarness();
  changedSession.state.authSessionId = "native-session-2";

  await changedSession.sync();

  assert.equal(changedSession.state.responses.at(-1).ok, false);
  assert.equal(changedSession.state.storage.has(PLACES_KEY), false);
  assert.equal(changedSession.state.nativeSyncs.length, 0);
});

test("도착 알림 대상 저장이 끝난 뒤 권한을 확인한다", { timeout: 1000 }, async () => {
  const { state, sync } = createHarness();
  const storageSetStarted = createDeferred();
  const releaseStorageSet = createDeferred();
  let didBlockPlacesWrite = false;
  state.onStorageSet = async (key) => {
    if (key !== PLACES_KEY || didBlockPlacesWrite) {
      return;
    }

    didBlockPlacesWrite = true;
    storageSetStarted.resolve();
    await releaseStorageSet.promise;
  };

  const request = sync();
  await storageSetStarted.promise;

  assert.equal(state.storage.has(PLACES_KEY), false);
  assert.equal(state.events.includes("notification-permission"), false);

  releaseStorageSet.resolve();
  await request;

  const storedPlaces = JSON.parse(state.storage.get(PLACES_KEY));
  assert.equal(storedPlaces.length, 1);
  assert.equal(storedPlaces[0].stopId, place.stopId);
  assert.ok(
    state.events.indexOf(`storage-set-complete:${PLACES_KEY}`) <
      state.events.indexOf("notification-permission")
  );
});

test("iOS에서 당일 남은 장소 여러 개를 함께 저장하고 등록한다", async () => {
  const places = [createPlace(1), createPlace(2), createPlace(3)];
  const { state, sync } = createHarness();

  await sync(places, { checkCurrentPosition: false });

  assert.deepEqual(
    JSON.parse(state.storage.get(PLACES_KEY)).map(({ stopId }) => stopId),
    places.map(({ stopId }) => stopId)
  );
  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(
    state.nativeSyncs[0].map(({ stopId }) => stopId).join(","),
    places.map(({ stopId }) => stopId).join(",")
  );
  assert.equal(state.responses.at(-1).activeCount, 3);
  assert.equal(state.responses.at(-1).pendingCount, 3);
  assert.equal(state.responses.at(-1).registrationStatus, "registered");
});

test("iOS 대상 갱신은 계속 필요한 기존 위치 트리거를 선삭제하지 않는다", async () => {
  const firstPlace = createPlace(1);
  const secondPlace = createPlace(2);
  const thirdPlace = createPlace(3);
  const { state, sync } = createHarness();

  await sync([firstPlace, secondPlace, thirdPlace], {
    checkCurrentPosition: false,
  });
  await sync([secondPlace, thirdPlace], { checkCurrentPosition: false });

  assert.equal(
    JSON.stringify(
      state.nativeSyncs.map((notifications) =>
        notifications.map(({ stopId }) => stopId)
      )
    ),
    JSON.stringify([
      [firstPlace.stopId, secondPlace.stopId, thirdPlace.stopId],
      [secondPlace.stopId, thirdPlace.stopId],
    ])
  );
  assert.equal(state.pending.has(getNotificationId(firstPlace)), false);
  assert.equal(state.pending.has(getNotificationId(secondPlace)), true);
  assert.equal(state.pending.has(getNotificationId(thirdPlace)), true);
});

test("iOS 위치 알림은 20개까지 등록하고 21개를 조용히 자르지 않는다", async () => {
  const supportedPlaces = Array.from({ length: 20 }, (_, index) =>
    createPlace(index + 1)
  );
  const supported = createHarness();

  await supported.sync(supportedPlaces, { checkCurrentPosition: false });

  assert.equal(supported.state.responses.at(-1).ok, true);
  assert.equal(supported.state.nativeSyncs.at(-1).length, 20);
  assert.equal(JSON.parse(supported.state.storage.get(PLACES_KEY)).length, 20);

  const unsupported = createHarness();
  await unsupported.sync(
    [...supportedPlaces, createPlace(21)],
    { checkCurrentPosition: false }
  );

  assert.equal(unsupported.state.responses.at(-1).ok, false);
  assert.match(unsupported.state.responses.at(-1).error, /20/);
  assert.equal(unsupported.state.storage.has(PLACES_KEY), false);
  assert.equal(unsupported.state.nativeSyncs.length, 0);
});

test("권한 요청을 생략하면 대상만 저장하고 OS 등록을 시작하지 않는다", async () => {
  const { state, sync } = createHarness();

  await sync([place], { requestPermissions: false });

  const storedPlaces = JSON.parse(state.storage.get(PLACES_KEY));
  assert.equal(storedPlaces.length, 1);
  assert.equal(storedPlaces[0].stopId, place.stopId);
  assert.equal(state.events.includes("notification-permission"), false);
  assert.equal(state.events.includes("foreground-permission"), false);
  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.geofenceStarts.length, 0);
  assert.equal(state.lastKnownPositionRequests.length, 0);
  assert.equal(state.currentPositionRequests.length, 0);
  assert.deepEqual(state.responses.at(-1), {
    id: "sync",
    ok: true,
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "inactive",
    backgroundLocationStatus: "unused",
    notificationStatus: "unused",
  });
});

test("권한 요청을 생략하면 저장 대상이 같아도 기존 iOS 트리거를 해제한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: "기존 알림",
    notificationBody: "기존 알림 본문",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { state, sync } = createHarness({ storage, nativeState });

  await sync([place], { requestPermissions: false });

  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
  assert.equal(state.responses.at(-1).registrationStatus, "inactive");
});

test("권한 요청을 생략해 새 대상을 저장할 때 기존 iOS 타깃은 제거한다", async () => {
  const oldPlace = { ...place, language: "ko", notificationTitle: "old" };
  const replacement = {
    ...place,
    id: "route-1:stop-2",
    stopId: "stop-2",
    title: "다음 장소",
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([oldPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { state, sync } = createHarness({ storage, nativeState });

  await sync([replacement], { requestPermissions: false });

  assert.equal(
    JSON.parse(state.storage.get(PLACES_KEY))[0].stopId,
    replacement.stopId
  );
  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
  assert.equal(state.responses.at(-1).registrationStatus, "inactive");
});

test("정상 iOS 대상 교체는 권한 확인 전에 기존 트리거를 선삭제하지 않는다", async () => {
  const oldPlace = { ...place, language: "ko", notificationTitle: "old" };
  const replacement = {
    ...place,
    id: "route-1:stop-2",
    stopId: "stop-2",
    title: "다음 장소",
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([oldPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { state, sync } = createHarness({ storage, nativeState });
  state.onNotificationPermission = () => {
    throw new Error("permission lookup failed");
  };

  await sync([replacement]);

  const storedPlaces = JSON.parse(state.storage.get(PLACES_KEY));
  assert.equal(state.responses.at(-1).ok, false);
  assert.equal(storedPlaces.length, 1);
  assert.equal(storedPlaces[0].stopId, replacement.stopId);
  assert.equal(state.nativeSyncs.length, 0);
  assert.equal(state.pending.has(notificationId), true);
  assert.equal(state.scheduled.length, 0);
  assert.ok(
    state.events.indexOf(`storage-set-complete:${PLACES_KEY}`) <
      state.events.indexOf("notification-permission")
  );
});

test("빈 대상 목록은 저장과 기존 iOS 위치 트리거를 모두 제거한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: "기존 알림",
    notificationBody: "기존 알림 본문",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { state, sync } = createHarness({ storage, nativeState });

  await sync([]);

  assert.equal(state.storage.has(PLACES_KEY), false);
  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
  assert.ok(
    state.events.indexOf(`storage-set-complete:${PLACES_KEY}`) <
      state.events.indexOf("ios-sync:0")
  );
  assert.deepEqual(state.responses.at(-1), {
    id: "sync",
    ok: true,
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "inactive",
    backgroundLocationStatus: "unused",
    notificationStatus: "unused",
  });
});

test("세션 종료는 저장 대상과 기존 iOS 위치 트리거를 모두 제거한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: "기존 알림",
    notificationBody: "기존 알림 본문",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { state, bridge } = createHarness({ storage, nativeState });

  await bridge.clearNativeRouteArrivalNotificationsForSession();

  assert.equal(state.storage.has(PLACES_KEY), false);
  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
});

test("빈 대상 OS 해제가 실패해도 empty tombstone을 유지하고 재실행에서 다시 해제한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: "기존 알림",
    notificationBody: "기존 알림 본문",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const failedClear = createHarness({ storage, nativeState });
  failedClear.state.nativeSyncError = new Error("native clear failed");

  await failedClear.sync([]);

  assert.equal(failedClear.state.responses.at(-1).ok, false);
  assert.deepEqual(JSON.parse(storage.get(PLACES_KEY)), []);
  assert.equal(nativeState.pending.has(notificationId), true);
  assert.ok(
    failedClear.state.events.indexOf(`storage-set-complete:${PLACES_KEY}`) <
      failedClear.state.events.indexOf("ios-sync:0")
  );

  const reopened = createHarness({ storage, nativeState });
  await reopened.bridge.reconcileStoredRouteArrivalNotifications();

  assert.equal(reopened.state.nativeSyncs.length, 1);
  assert.equal(reopened.state.nativeSyncs[0].length, 0);
  assert.equal(nativeState.pending.has(notificationId), false);
});

test("타깃 교체와 겹친 이전 지오펜스 전달은 최신 저장 대상을 다시 확인한다", { timeout: 1000 }, async () => {
  const replacement = {
    ...place,
    id: "route-1:stop-2",
    stopId: "stop-2",
    title: "다음 장소",
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([place])]]);
  const { state, sync } = createHarness({ platform: "android", storage });
  const placesWriteStarted = createDeferred();
  const releasePlacesWrite = createDeferred();
  let didBlockPlacesWrite = false;
  state.lastKnownPosition = createLastKnownPosition({
    latitude: place.lat + 0.02,
  });
  state.currentPosition = {
    ...state.currentPosition,
    lat: place.lat + 0.02,
  };
  state.onStorageSet = async (key) => {
    if (key !== PLACES_KEY || didBlockPlacesWrite) {
      return;
    }

    didBlockPlacesWrite = true;
    placesWriteStarted.resolve();
    await releasePlacesWrite.promise;
  };

  const replacementRequest = sync([replacement]);
  await placesWriteStarted.promise;
  const geofence = state.tasks.get("routeone-route-arrival-geofence");
  const oldArrivalRequest = geofence({
    data: { eventType: 1, region: { identifier: place.id } },
  });

  releasePlacesWrite.resolve();
  await Promise.all([replacementRequest, oldArrivalRequest]);

  assert.equal(
    JSON.parse(state.storage.get(PLACES_KEY))[0].stopId,
    replacement.stopId
  );
  assert.equal(state.scheduled.length, 0);
});

test("최근 15초·정확도 100m 이내의 마지막 위치가 반경 안이면 새 GPS 없이 한 번만 알린다", async () => {
  const { state, sync } = createHarness();
  state.lastKnownPosition = createLastKnownPosition({
    accuracy: 100,
    timestamp: Date.now() - 1_000,
  });

  await sync();
  await sync();

  assert.equal(state.lastKnownPositionRequests.length, 2);
  for (const request of state.lastKnownPositionRequests) {
    assert.equal(request.maxAge, 15_000);
    assert.equal(request.requiredAccuracy, 100);
  }
  assert.equal(state.currentPositionRequests.length, 0);
  assert.equal(state.scheduled.length, 1);
  assert.equal(state.scheduled[0].identifier, notificationId);
  assert.equal(
    JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id],
    dateKey
  );
  assert.equal(state.responses.at(-1).registrationStatus, "delivered");
});

test("사전등록은 현재 위치를 판정하거나 도착 완료로 기록하지 않는다", async () => {
  const { state, sync } = createHarness();

  await sync([place], { checkCurrentPosition: false });

  assert.equal(state.responses.at(-1).ok, true);
  assert.equal(state.lastKnownPositionRequests.length, 0);
  assert.equal(state.currentPositionRequests.length, 0);
  assert.equal(state.scheduled.length, 0);
  assert.equal(state.storage.has(NOTIFIED_KEY), false);
});

test("마지막 위치로 도착을 확인하지 못하면 fresh GPS 처리를 마친 뒤 응답한다", { timeout: 1000 }, async () => {
  const { state, sync } = createHarness();
  state.lastKnownPosition = null;
  const freshPositionStarted = createDeferred();
  const releaseFreshPosition = createDeferred();
  const notificationScheduled = createDeferred();
  state.onPosition = async () => {
    freshPositionStarted.resolve();
    await releaseFreshPosition.promise;
  };
  state.onScheduleNotification = () => notificationScheduled.resolve();

  const request = sync();
  await freshPositionStarted.promise;
  assert.equal(state.responses.length, 0);

  releaseFreshPosition.resolve();
  await request;
  await notificationScheduled.promise;

  assert.equal(state.responses.at(-1).ok, true);
  assert.equal(state.currentPositionRequests.length, 1);
  assert.equal(state.scheduled.length, 1);
});

for (const [name, createInvalidLastKnownPosition] of [
  [
    "15초보다 오래된",
    () => createLastKnownPosition({ timestamp: Date.now() - 15_001 }),
  ],
  ["정확도가 100m를 넘는", () => createLastKnownPosition({ accuracy: 101 })],
]) {
  test(`${name} 마지막 위치는 fresh GPS로 다시 확인한다`, async () => {
    const { state, sync } = createHarness();
    const notificationScheduled = createDeferred();
    state.lastKnownPosition = createInvalidLastKnownPosition();
    state.onScheduleNotification = () => notificationScheduled.resolve();

    await sync();
    await notificationScheduled.promise;

    assert.equal(state.currentPositionRequests.length, 1);
    assert.equal(state.scheduled.length, 1);
  });
}

test("fresh GPS 오차가 반경보다 크면 강제종료 안전 ACK를 반환하지 않는다", async () => {
  const { state, sync } = createHarness();
  state.lastKnownPosition = null;
  state.currentPosition = {
    ...state.currentPosition,
    accuracyMeters: 301,
  };

  await sync();

  assert.equal(state.currentPositionRequests.length, 1);
  assert.equal(state.scheduled.length, 0);
  assert.equal(state.responses.at(-1).ok, false);
  assert.match(state.responses.at(-1).error, /위치 정확도/);
});

test("fresh reconcile과 백그라운드 작업 오류를 경고로 남긴다", async () => {
  const { state, sync } = createHarness();
  state.lastKnownPosition = null;
  state.onPosition = () => {
    throw new Error("fresh position failed");
  };

  await sync();
  const locationTask = state.tasks.get("routeone-route-arrival-location");
  state.storageGetError = new Error("background storage failed");
  await locationTask({ data: { locations: [state.currentPosition] } });

  assert.equal(state.responses.at(-1).ok, false);
  assert.ok(
    state.warnings.some(([message]) =>
      message.includes("sync failed")
    )
  );
  assert.ok(
    state.warnings.some(([message]) =>
      message.includes("background location reconcile failed")
    )
  );
});

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
    first.state.lastKnownPosition = createLastKnownPosition({
      latitude: place.lat + 0.02,
    });
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
  const notifiedStateStored = createDeferred();
  state.lastKnownPosition = null;
  state.onStorageSetComplete = (key) => {
    if (key === NOTIFIED_KEY) {
      notifiedStateStored.resolve();
    }
  };
  state.onPosition = () => {
    state.presented = [createNotification()];
    state.pending.delete(notificationId);
  };
  await sync();
  await notifiedStateStored.promise;

  assert.equal(state.scheduled.length, 0);
});

test("GPS 조회 중 iOS 알림이 수신 후 지워져도 네이티브 처리 기록으로 즉시 알림을 막는다", async () => {
  const { state, sync } = createHarness();
  const notifiedStateStored = createDeferred();
  state.lastKnownPosition = null;
  state.onStorageSetComplete = (key) => {
    if (key === NOTIFIED_KEY) {
      notifiedStateStored.resolve();
    }
  };
  state.onPosition = () => simulateBackgroundDelivery(state.nativeState, { dismissed: true });
  await sync();
  await notifiedStateStored.promise;

  assert.equal(state.presented.length, 0);
  assert.equal(state.scheduled.length, 0);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
});

test("GPS 조회 중에도 수신 기록 저장과 알림함 확인을 처리한다", { timeout: 1000 }, async () => {
  const { state, sync, inbox, bridge } = createHarness();
  const positionReceiptHandled = createDeferred();
  state.lastKnownPosition = null;
  state.onPosition = async () => {
    const notification = createNotification();
    state.presented = [notification];
    await bridge.recordDeliveredRouteArrivalNotification(notification);
    await inbox([notificationId]);
    positionReceiptHandled.resolve();
  };
  await sync();
  await positionReceiptHandled.promise;

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
      state.lastKnownPosition = null;
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
    const notificationScheduled = createDeferred();
    state.onScheduleNotification = () => notificationScheduled.resolve();
    await sync();
    await notificationScheduled.promise;
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

test("iOS 복구 시 저장된 다중 타깃의 누락된 위치 트리거를 모두 재등록한다", async () => {
  const places = [createPlace(1), createPlace(2), createPlace(3)];
  const storedPlaces = places.map((targetPlace) => ({
    ...targetPlace,
    language: "ko",
    notificationTitle: `${targetPlace.title}에 도착했어요`,
    notificationBody: "방문 인증 사진을 남겨보세요.",
    syncedDateKey: dateKey,
  }));
  const storage = new Map([[PLACES_KEY, JSON.stringify(storedPlaces)]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(getNotificationId(places[1]), { kind: "location" });
  const { bridge, state } = createHarness({ storage, nativeState });
  state.lastKnownPosition = createLastKnownPosition({
    latitude: place.lat + 0.2,
  });
  state.currentPosition = {
    ...state.currentPosition,
    lat: place.lat + 0.2,
  };

  await bridge.reconcileStoredRouteArrivalNotifications();

  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(
    state.nativeSyncs[0].map(({ stopId }) => stopId).join(","),
    places.map(({ stopId }) => stopId).join(",")
  );
  for (const targetPlace of places) {
    assert.equal(state.pending.has(getNotificationId(targetPlace)), true);
  }
});

test("권한 복귀 시 저장 타깃의 fresh GPS 판정이 끝나야 복구를 완료한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: `${place.title}에 도착했어요`,
    notificationBody: "방문 인증 사진을 남겨보세요.",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const { bridge, state } = createHarness({ storage });
  const freshPositionStarted = createDeferred();
  const releaseFreshPosition = createDeferred();
  let didFinish = false;
  state.lastKnownPosition = null;
  state.onPosition = async () => {
    freshPositionStarted.resolve();
    await releaseFreshPosition.promise;
  };

  const recovery = bridge.reconcileStoredRouteArrivalNotifications()
    .then(() => { didFinish = true; });

  await freshPositionStarted.promise;
  assert.equal(didFinish, false);

  releaseFreshPosition.resolve();
  await recovery;

  assert.equal(didFinish, true);
  assert.equal(state.scheduled.length, 1);
  assert.equal(JSON.parse(state.storage.get(NOTIFIED_KEY))[place.id], dateKey);
});

test("Android 복구 시 저장된 타깃으로 geofence와 location tracking을 모두 재등록한다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: `${place.title}에 도착했어요`,
    notificationBody: "방문 인증 사진을 남겨보세요.",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const { bridge, state } = createHarness({ platform: "android", storage });
  state.geofencingStarted = false;
  state.locationTrackingStarted = false;
  state.lastKnownPosition = createLastKnownPosition({
    latitude: place.lat + 0.02,
  });
  state.currentPosition = {
    ...state.currentPosition,
    lat: place.lat + 0.02,
  };

  await bridge.reconcileStoredRouteArrivalNotifications();

  assert.equal(state.geofenceStarts.length, 1);
  assert.equal(
    state.geofenceStarts[0].taskName,
    "routeone-route-arrival-geofence"
  );
  assert.equal(state.geofenceStarts[0].regions.length, 1);
  assert.equal(state.geofenceStarts[0].regions[0].identifier, place.id);
  assert.equal(state.geofenceStarts[0].regions[0].radius, 300);
  assert.equal(state.geofencingStatusChecks, 1);
  assert.equal(state.geofencingStarted, true);
  assert.equal(state.locationTrackingStarts.length, 1);
  assert.equal(
    state.locationTrackingStarts[0].taskName,
    "routeone-route-arrival-location"
  );
  assert.equal(state.locationTrackingStarted, true);
});

test("iPhone 정확한 위치가 꺼져 있으면 저장된 타깃을 재등록하지 않는다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: `${place.title}에 도착했어요`,
    notificationBody: "방문 인증 사진을 남겨보세요.",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { bridge, state } = createHarness({ storage, nativeState });
  state.locationAccuracy = "reduced";

  await bridge.reconcileStoredRouteArrivalNotifications();

  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
  assert.equal(state.lastKnownPositionRequests.length, 0);
  assert.equal(state.currentPositionRequests.length, 0);
});

test("iPhone 알림 배너가 꺼져 있으면 저장된 타깃을 재등록하지 않는다", async () => {
  const storedPlace = {
    ...place,
    language: "ko",
    notificationTitle: `${place.title}에 도착했어요`,
    notificationBody: "방문 인증 사진을 남겨보세요.",
    syncedDateKey: dateKey,
  };
  const storage = new Map([[PLACES_KEY, JSON.stringify([storedPlace])]]);
  const nativeState = createNativeNotificationState();
  nativeState.pending.set(notificationId, { kind: "location" });
  const { bridge, state } = createHarness({ storage, nativeState });
  state.notificationAllowsAlert = false;

  await bridge.reconcileStoredRouteArrivalNotifications();

  assert.equal(state.nativeSyncs.length, 1);
  assert.equal(state.nativeSyncs[0].length, 0);
  assert.equal(state.pending.has(notificationId), false);
  assert.equal(state.lastKnownPositionRequests.length, 0);
  assert.equal(state.currentPositionRequests.length, 0);
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
