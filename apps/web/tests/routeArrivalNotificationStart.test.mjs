import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const todayKey = "2026-08-25";
let arrivalTarget;
let arrivalService;
let locationPermissionService;
let transitionLock;
let startAttemptJournal;
let startAttemptRecovery;
let arrivalMutationRecovery;
let graphqlClient;
let uiModalStore;
let capturedNativeSyncOptions;
let nativeAppInfo;
let previousWindow;
let previousLocalStorage;
let server;

before(async () => {
  previousWindow = globalThis.window;
  previousLocalStorage = globalThis.localStorage;
  const localStorageEntries = new Map();
  globalThis.localStorage = {
    get length() {
      return localStorageEntries.size;
    },
    clear() {
      localStorageEntries.clear();
    },
    getItem(key) {
      return localStorageEntries.get(key) ?? null;
    },
    key(index) {
      return [...localStorageEntries.keys()][index] ?? null;
    },
    removeItem(key) {
      localStorageEntries.delete(key);
    },
    setItem(key, value) {
      localStorageEntries.set(key, String(value));
    },
  };
  nativeAppInfo = {
    platform: "ios",
    capabilities: [],
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "granted",
  };
  globalThis.window = {
    RouteOneNative: {
      getAppInfo: async () => nativeAppInfo,
      syncRouteArrivalNotifications: async (options) => {
        capturedNativeSyncOptions = options;
        const storesOnly = options.requestPermissions === false;

        return {
          activeCount: storesOnly ? 0 : options.places.length,
          pendingCount: storesOnly ? 0 : options.places.length,
          registrationStatus: storesOnly ? "inactive" : "registered",
          backgroundLocationStatus: "system-managed",
          notificationStatus: "granted",
        };
      },
    },
  };
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
      alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  arrivalTarget = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalNotificationTarget.ts"
  );
  arrivalService = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalNotificationService.ts"
  );
  locationPermissionService = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartLocationPermissionService.ts"
  );
  transitionLock = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalTransitionLock.ts"
  );
  startAttemptJournal = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartAttemptJournal.ts"
  );
  startAttemptRecovery = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartAttemptRecovery.ts"
  );
  arrivalMutationRecovery = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalMutationRecovery.ts"
  );
  graphqlClient = await server.ssrLoadModule("/src/lib/graphqlClient.ts");
  uiModalStore = await server.ssrLoadModule(
    "/src/stores/uiModalStore.ts"
  );
});

after(async () => {
  await server?.close();
  if (previousWindow === undefined) {
    delete globalThis.window;
  } else {
    globalThis.window = previousWindow;
  }
  if (previousLocalStorage === undefined) {
    delete globalThis.localStorage;
  } else {
    globalThis.localStorage = previousLocalStorage;
  }
});

function createRoute() {
  const days = [
    {
      id: "day-2",
      dayIndex: 2,
      date: "2026-09-11",
      startedAt: null,
      stops: [
        {
          id: "day-2-stop-1",
          order: 1,
          visitStatus: "PENDING",
          visitedAt: null,
          place: {
            title: "두 번째 장소",
            lat: 37.2,
            lng: 127.2,
          },
        },
      ],
    },
    {
      id: "day-1",
      dayIndex: 1,
      date: "2026-09-10",
      startedAt: null,
      stops: [
        {
          id: "day-1-stop-2",
          order: 2,
          visitStatus: "PENDING",
          visitedAt: null,
          place: {
            title: "두 번째 장소",
            lat: 37.15,
            lng: 127.15,
          },
        },
        {
          id: "day-1-stop-1",
          order: 1,
          visitStatus: "PENDING",
          visitedAt: null,
          place: {
            title: "첫 번째 장소",
            lat: 37.1,
            lng: 127.1,
          },
        },
      ],
    },
  ];

  return {
    id: "route-1",
    status: "DRAFT",
    startedAt: null,
    completedAt: null,
    travelStartDate: "2026-09-10",
    travelEndDate: "2026-09-11",
    days,
    stops: days.flatMap((day) => day.stops),
  };
}

function getCurrentDateKey() {
  const now = new Date();

  return [
    now.getFullYear(),
    `${now.getMonth() + 1}`.padStart(2, "0"),
    `${now.getDate()}`.padStart(2, "0"),
  ].join("-");
}

test("여행 시작 전 등록 미리보기는 오늘 DAY 날짜를 구성한다", () => {
  const dayStartedAt = `${todayKey}T01:30:00.000Z`;
  const preview = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    todayKey,
    dayStartedAt
  );

  assert.equal(preview.status, "ACTIVE");
  assert.equal(preview.startedAt, dayStartedAt);
  assert.equal(preview.travelStartDate, todayKey);
  assert.equal(preview.travelEndDate, "2026-08-26");
  assert.equal(
    preview.days.find((routeDay) => routeDay.id === "day-1").date,
    todayKey
  );
  assert.equal(
    preview.days.find((routeDay) => routeDay.id === "day-2").date,
    "2026-08-26"
  );
});

test("등록 미리보기는 오늘 미완료 장소를 순서대로 모두 선택한다", () => {
  const preview = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    todayKey,
    `${todayKey}T01:30:00.000Z`
  );
  const targets = arrivalTarget.getRouteArrivalMonitoringTargets(preview, todayKey);

  assert.deepEqual(
    targets.map(({ activeDestination }) => activeDestination.id),
    ["day-1-stop-1", "day-1-stop-2"]
  );
});

test("서버 시작 전에는 오늘 첫 장소만 사전 등록한다", async () => {
  capturedNativeSyncOptions = null;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  await arrivalService.prepareRouteArrivalNotificationsForStart(
    [route],
    route,
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`,
    "ko",
    true
  );

  assert.equal(capturedNativeSyncOptions.checkCurrentPosition, false);
  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-1"]
  );
});

test("위치 권한 없이 진행해도 서버 시작 전에 desired target을 저장한다", async () => {
  capturedNativeSyncOptions = null;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  const result = await arrivalService.prepareRouteArrivalNotificationsForStart(
    [route],
    route,
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`,
    "ko",
    true,
    {
      requestPermissions: false,
      requireConfirmedRegistration: false,
    }
  );

  assert.equal(result.registrationStatus, "inactive");
  assert.equal(capturedNativeSyncOptions.requestPermissions, false);
  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-1"]
  );
});

test("위치 권한 없이 시작한 뒤 대상만 저장하고 권한 요청은 건너뛴다", async () => {
  capturedNativeSyncOptions = null;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();
  const startedRoute = arrivalTarget.createRouteArrivalStartPreview(
    route,
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );

  const result = await arrivalService.syncTodayRouteArrivalNotifications(
    [startedRoute],
    "ko",
    startedRoute.id,
    {
      routeArrivalEnabled: true,
      checkCurrentPosition: false,
      requestPermissions: false,
    }
  );

  assert.equal(result.registrationStatus, "inactive");
  assert.equal(capturedNativeSyncOptions.requestPermissions, false);
  assert.equal(capturedNativeSyncOptions.checkCurrentPosition, false);
  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-1"]
  );
});

test("방문 완료 전에는 현재 장소와 예상 다음 장소를 함께 사전 등록한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "granted",
  };
  capturedNativeSyncOptions = null;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  const preparation =
    await arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
      [currentRoute],
      [nextRoute],
      "ko",
      currentRoute.id,
      { routeArrivalEnabled: true }
    );

  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-1", "day-1-stop-2"]
  );
  assert.equal(capturedNativeSyncOptions.checkCurrentPosition, false);
  assert.notEqual(capturedNativeSyncOptions.requestPermissions, false);
  assert.deepEqual(preparation, {
    requestPermissions: true,
    rollbackRequired: true,
  });
});

test("방문 완료 후에는 다음 장소 반경의 현재 위치를 즉시 확인한다", async () => {
  capturedNativeSyncOptions = null;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  await arrivalService.syncRouteArrivalNotificationsAfterVisitChange(
    [nextRoute],
    "ko",
    nextRoute.id,
    {
      routeArrivalEnabled: true,
      requestPermissions: true,
      requireConfirmedRegistration: true,
    }
  );

  assert.equal(capturedNativeSyncOptions.checkCurrentPosition, true);
  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-2"]
  );
});

test("방문 완료 전환 lock은 중첩된 작업이 모두 끝날 때까지 전역 동기화를 막는다", () => {
  const releaseFirst =
    transitionLock.acquireRouteArrivalTransitionLock("route-1");
  const releaseSecond =
    transitionLock.acquireRouteArrivalTransitionLock("route-1");

  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  releaseFirst();
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  releaseFirst();
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  releaseSecond();
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("결과 불명 방문 전환은 활성 작업이 끝나도 재조회 전까지 lock을 유지한다", () => {
  let notificationCount = 0;
  const unsubscribe = transitionLock.subscribeRouteArrivalTransitionLock(
    () => {
      notificationCount += 1;
    }
  );
  const release =
    transitionLock.acquireRouteArrivalTransitionLock("route-unresolved");

  transitionLock.markRouteArrivalTransitionUnresolved("route-unresolved", {
    expectation: {
      kind: "stop-visit",
      stopId: "day-1-stop-1",
      visited: true,
    },
    now: 1_000,
    delayMs: 0,
  });
  release();

  assert.equal(
    transitionLock.isRouteArrivalTransitionLocked("route-unresolved"),
    true
  );
  assert.deepEqual(
    transitionLock.getUnresolvedRouteArrivalTransitionRouteIds(),
    ["route-unresolved"]
  );
  assert.equal(
    transitionLock.getRouteArrivalTransitionReconciliationDelayMs(1_000),
    0
  );

  transitionLock.resolveRouteArrivalTransition("route-unresolved");
  unsubscribe();

  assert.equal(
    transitionLock.isRouteArrivalTransitionLocked("route-unresolved"),
    false
  );
  assert.ok(notificationCount >= 4);
});

test("API 전환 journal은 WebView 모듈이 다시 로드돼도 복구한다", async () => {
  const transition =
    transitionLock.markRouteArrivalTransitionUnresolved("route-durable", {
      expectation: { kind: "route-start" },
      now: 1_000,
      delayMs: 0,
    });
  const storedJournal = JSON.parse(
    globalThis.localStorage.getItem(
      transitionLock.ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY
    )
  );

  assert.equal(storedJournal[0].routeId, "route-durable");
  assert.deepEqual(storedJournal[0].expectation, {
    kind: "route-start",
  });

  const hydratedTransitionLock = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalTransitionLock.ts?hydrate-test"
  );

  assert.equal(
    hydratedTransitionLock.isRouteArrivalTransitionLocked("route-durable"),
    true
  );
  assert.equal(
    hydratedTransitionLock.getUnresolvedRouteArrivalTransitions()[0]
      .generation,
    transition.generation
  );

  hydratedTransitionLock.resolveRouteArrivalTransition(
    "route-durable",
    transition.generation
  );
  transitionLock.resolveRouteArrivalTransition(
    "route-durable",
    transition.generation
  );

  assert.equal(
    globalThis.localStorage.getItem(
      transitionLock.ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY
    ),
    null
  );
});

test("손상된 API 전환 journal은 보수적인 unknown lock으로 복구한다", async () => {
  globalThis.localStorage.setItem(
    transitionLock.ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY,
    "{broken-json"
  );

  const hydratedTransitionLock = await server.ssrLoadModule(
    "/src/features/my-route/services/routeArrivalTransitionLock.ts?corrupted-journal-test"
  );
  const [corruptedTransition] =
    hydratedTransitionLock.getUnresolvedRouteArrivalTransitions();

  assert.equal(hydratedTransitionLock.isRouteArrivalTransitionLocked(), true);
  assert.deepEqual(corruptedTransition.expectation, { kind: "unknown" });
  assert.equal(
    arrivalMutationRecovery.isRouteArrivalTransitionExpectationCommitted(
      corruptedTransition.expectation,
      null
    ),
    false
  );
  assert.equal(
    arrivalMutationRecovery.getRouteArrivalTransitionPendingFingerprint(
      corruptedTransition.expectation,
      null
    ),
    "unknown:missing"
  );

  hydratedTransitionLock.resolveRouteArrivalTransition(
    corruptedTransition.routeId,
    corruptedTransition.generation
  );
});

test("영속 journal을 저장할 수 없으면 안전한 API 전환을 시작하지 않는다", () => {
  const currentLocalStorage = globalThis.localStorage;
  delete globalThis.localStorage;

  try {
    const transition =
      transitionLock.markRouteArrivalTransitionUnresolved(
        "route-no-storage",
        {
          expectation: { kind: "route-start" },
          now: 1_000,
          delayMs: 0,
        }
      );

    assert.equal(transition, null);
    assert.equal(
      transitionLock.isRouteArrivalTransitionLocked("route-no-storage"),
      false
    );
  } finally {
    globalThis.localStorage = currentLocalStorage;
  }
});

test("이전 generation의 재조회 결과는 새 unresolved lock을 해제하지 않는다", () => {
  const firstTransition =
    transitionLock.markRouteArrivalTransitionUnresolved("route-generation", {
      expectation: { kind: "route-start" },
      now: 1_000,
      delayMs: 0,
    });
  const secondTransition =
    transitionLock.markRouteArrivalTransitionUnresolved("route-generation", {
      expectation: {
        kind: "stop-visit",
        stopId: "day-1-stop-1",
        visited: true,
      },
      now: 1_000,
      delayMs: 0,
    });

  transitionLock.resolveRouteArrivalTransition(
    "route-generation",
    firstTransition.generation
  );
  assert.equal(
    transitionLock.isRouteArrivalTransitionLocked("route-generation"),
    true
  );

  transitionLock.resolveRouteArrivalTransition(
    "route-generation",
    secondTransition.generation
  );
  assert.equal(
    transitionLock.isRouteArrivalTransitionLocked("route-generation"),
    false
  );
});

test("PENDING 상태는 같은 서버 snapshot을 두 번 확인할 수 있게 기록한다", () => {
  const transition =
    transitionLock.markRouteArrivalTransitionUnresolved("route-pending", {
      expectation: {
        kind: "stop-visit",
        stopId: "day-1-stop-1",
        visited: true,
      },
      now: 1_000,
      delayMs: 0,
    });
  const firstObservation =
    transitionLock.recordRouteArrivalTransitionPendingObservation(
      "route-pending",
      transition.generation,
      "pending:v1",
      { now: 1_000, delayMs: 0 }
    );
  const secondObservation =
    transitionLock.recordRouteArrivalTransitionPendingObservation(
      "route-pending",
      transition.generation,
      "pending:v1",
      { now: 1_000, delayMs: 0 }
    );
  const changedObservation =
    transitionLock.recordRouteArrivalTransitionPendingObservation(
      "route-pending",
      transition.generation,
      "pending:v2",
      { now: 1_000, delayMs: 0 }
    );

  assert.equal(firstObservation.stablePendingReadCount, 1);
  assert.equal(secondObservation.stablePendingReadCount, 2);
  assert.equal(changedObservation.stablePendingReadCount, 1);

  transitionLock.resolveRouteArrivalTransition(
    "route-pending",
    transition.generation
  );
});

test("API 전송 직전 도착 알림 journal의 정산 시각과 snapshot을 초기화한다", () => {
  const transition = transitionLock.markRouteArrivalTransitionUnresolved(
    "route-arrival-dispatch",
    {
      expectation: { kind: "route-start" },
      now: 500,
      delayMs: 0,
    }
  );

  assert.ok(transition);
  transitionLock.recordRouteArrivalTransitionPendingObservation(
    transition.routeId,
    transition.generation,
    "route-start:DRAFT:v1",
    { now: 600, delayMs: 0 }
  );
  const dispatched =
    transitionLock.markRouteArrivalTransitionRequestDispatched(
      transition.routeId,
      transition.generation,
      { now: 1_000 }
    );

  assert.equal(
    dispatched.readyAt,
    1_000 +
      transitionLock.ROUTE_ARRIVAL_TRANSITION_API_SETTLEMENT_DELAY_MS
  );
  assert.equal(dispatched.pendingFingerprint, null);
  assert.equal(dispatched.stablePendingReadCount, 0);
  transitionLock.resolveRouteArrivalTransition(
    transition.routeId,
    transition.generation
  );
});

test("여행 시작 intent는 listener가 깨어나기 전에 active lock과 함께 영속화한다", () => {
  const observedStates = [];
  const unsubscribe = startAttemptJournal.subscribeRouteStartAttempts(() => {
    observedStates.push({
      active: startAttemptJournal.hasActiveRouteStartAttempt("route-start-1"),
      locked: startAttemptJournal.isRouteStartAttemptLocked("route-start-1"),
      stored: JSON.parse(
        globalThis.localStorage.getItem(
          startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY
        ) ?? "[]"
      ),
    });
  });
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: " route-start-1 ",
      startedAt: "2026-08-25",
      dayStartedAt: "2026-08-25T01:30:00.000Z",
    },
    { now: 1_000, delayMs: 0 }
  );

  assert.ok(started);
  assert.equal(observedStates[0].active, true);
  assert.equal(observedStates[0].locked, true);
  assert.equal(observedStates[0].stored[0].routeId, "route-start-1");
  assert.deepEqual(started.attempt, {
    routeId: "route-start-1",
    generation: started.attempt.generation,
    startedAt: "2026-08-25",
    dayStartedAt: "2026-08-25T01:30:00.000Z",
    createdAt: 1_000,
    readyAt: 1_000,
    status: "pending",
    pendingFingerprint: null,
    stablePendingReadCount: 0,
  });

  started.release();
  started.release();
  assert.equal(
    startAttemptJournal.hasActiveRouteStartAttempt("route-start-1"),
    false
  );
  assert.equal(
    startAttemptJournal.isRouteStartAttemptLocked("route-start-1"),
    true
  );

  assert.equal(
    startAttemptJournal.resolveRouteStartAttempt(
      "route-start-1",
      started.attempt.generation
    ),
    true
  );
  unsubscribe();
});

test("여행 시작 intent는 WebView 모듈 reload 뒤에도 입력과 상태를 복구한다", async () => {
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-hydrate",
      startedAt: "2026-08-25",
      dayStartedAt: null,
    },
    { now: 2_000, delayMs: 7_000 }
  );

  assert.ok(started);
  started.release();

  const hydratedJournal = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartAttemptJournal.ts?hydrate-test"
  );
  const [hydratedAttempt] = hydratedJournal.getRouteStartAttempts();

  assert.deepEqual(hydratedAttempt, started.attempt);
  assert.equal(
    hydratedJournal.hasActiveRouteStartAttempt("route-start-hydrate"),
    false
  );
  assert.equal(
    hydratedJournal.isRouteStartAttemptLocked("route-start-hydrate"),
    true
  );
  assert.equal(
    hydratedJournal.getRouteStartAttemptReconciliationDelayMs(3_000),
    6_000
  );

  hydratedJournal.resolveRouteStartAttempt(
    "route-start-hydrate",
    started.attempt.generation
  );
  startAttemptJournal.resolveRouteStartAttempt(
    "route-start-hydrate",
    started.attempt.generation
  );
});

test("여행 시작 intent는 안정된 서버 snapshot과 복구 상태 전환을 기록한다", () => {
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-status",
      startedAt: "2026-08-25",
      dayStartedAt: "2026-08-25T01:30:00.000Z",
    },
    { now: 3_000, delayMs: 0 }
  );

  assert.ok(started);
  started.release();

  const firstObservation =
    startAttemptJournal.recordRouteStartAttemptPendingObservation(
      "route-start-status",
      started.attempt.generation,
      "route-start:DRAFT:v1",
      { now: 3_000, delayMs: 5_000 }
    );
  const secondObservation =
    startAttemptJournal.recordRouteStartAttemptPendingObservation(
      "route-start-status",
      started.attempt.generation,
      "route-start:DRAFT:v1",
      { now: 8_000, delayMs: 0 }
    );

  assert.equal(firstObservation.stablePendingReadCount, 1);
  assert.equal(secondObservation.stablePendingReadCount, 2);
  assert.equal(
    startAttemptJournal.getRouteStartAttemptReconciliationDelayMs(8_000),
    0
  );

  const unavailable =
    startAttemptJournal.markRouteStartAttemptStatusUnavailable(
      "route-start-status",
      started.attempt.generation,
      { now: 9_000 }
    );

  assert.equal(unavailable.status, "status-unavailable");
  assert.equal(
    startAttemptJournal.getRouteStartAttemptReconciliationDelayMs(9_000),
    null
  );

  const retried = startAttemptJournal.retryRouteStartAttemptNow(
    "route-start-status",
    started.attempt.generation,
    { now: 10_000 }
  );
  assert.equal(retried.status, "pending");
  assert.equal(retried.readyAt, 10_000);
  assert.equal(retried.stablePendingReadCount, 2);

  const dispatched =
    startAttemptJournal.markRouteStartAttemptRequestDispatched(
      "route-start-status",
      started.attempt.generation,
      { now: 10_500 }
    );
  assert.equal(dispatched.status, "pending");
  assert.equal(
    dispatched.readyAt,
    10_500 +
      startAttemptJournal.ROUTE_START_ATTEMPT_API_SETTLEMENT_DELAY_MS
  );
  assert.equal(dispatched.pendingFingerprint, null);
  assert.equal(dispatched.stablePendingReadCount, 0);

  const deferred = startAttemptJournal.deferRouteStartAttempt(
    "route-start-status",
    started.attempt.generation,
    { now: 10_000, delayMs: 2_000 }
  );
  assert.equal(deferred.readyAt, 12_000);

  const restartRequired =
    startAttemptJournal.markRouteStartAttemptRestartRequired(
      "route-start-status",
      started.attempt.generation,
      { now: 12_000 }
    );
  assert.equal(restartRequired.status, "restart-required");
  assert.equal(
    startAttemptJournal.getRouteStartAttemptReconciliationDelayMs(12_000),
    null
  );

  startAttemptJournal.resolveRouteStartAttempt(
    "route-start-status",
    started.attempt.generation
  );
});

test("중단된 시작은 서버 시작 여부와 안정된 DRAFT snapshot을 구분한다", () => {
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-decision",
      startedAt: "2026-08-25",
      dayStartedAt: "2026-08-25T01:30:00.000Z",
    },
    { now: 15_000, delayMs: 0 }
  );

  assert.ok(started);
  started.release();
  const draftRoute = {
    ...createRoute(),
    id: "route-start-decision",
    updatedAt: "2026-08-25T01:31:00.000Z",
  };
  const firstDecision =
    startAttemptRecovery.getRouteStartAttemptRecoveryDecision(
      started.attempt,
      draftRoute
    );

  assert.equal(firstDecision.kind, "observe");
  const observed =
    startAttemptJournal.recordRouteStartAttemptPendingObservation(
      started.attempt.routeId,
      started.attempt.generation,
      firstDecision.pendingFingerprint,
      { now: 15_000, delayMs: 0 }
    );
  const stableDecision =
    startAttemptRecovery.getRouteStartAttemptRecoveryDecision(
      observed,
      draftRoute
    );
  const serverStartedDecision =
    startAttemptRecovery.getRouteStartAttemptRecoveryDecision(
      observed,
      {
        ...draftRoute,
        status: "ACTIVE",
        startedAt: "2026-08-25T01:30:00.000Z",
      }
    );

  assert.equal(stableDecision.kind, "restart-required");
  assert.equal(serverStartedDecision.kind, "started");
  startAttemptJournal.resolveRouteStartAttempt(
    started.attempt.routeId,
    started.attempt.generation
  );
});

test("기존 복수 pending journal은 가장 빠른 intent 기준으로 재조회한다", async () => {
  globalThis.localStorage.setItem(
    startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY,
    JSON.stringify([
      {
        routeId: "route-start-later",
        generation: 20_001,
        startedAt: "2026-08-25",
        dayStartedAt: null,
        createdAt: 20_000,
        readyAt: 30_000,
        status: "pending",
        pendingFingerprint: null,
        stablePendingReadCount: 0,
      },
      {
        routeId: "route-start-earlier",
        generation: 20_002,
        startedAt: "2026-08-25",
        dayStartedAt: null,
        createdAt: 20_000,
        readyAt: 22_000,
        status: "pending",
        pendingFingerprint: null,
        stablePendingReadCount: 0,
      },
    ])
  );
  const hydratedJournal = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartAttemptJournal.ts?multiple-pending-test"
  );

  assert.equal(
    hydratedJournal.getRouteStartAttemptReconciliationDelayMs(20_000),
    2_000
  );
  assert.equal(hydratedJournal.clearRouteStartAttempts(), true);
});

test("복구 중에는 다른 일정의 여행 시작 intent를 만들지 않는다", () => {
  const first = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-global-lock-a",
      startedAt: "2026-08-25",
    },
    { now: 25_000, delayMs: 0 }
  );

  assert.ok(first);
  assert.equal(
    startAttemptJournal.beginRouteStartAttempt(
      {
        routeId: "route-start-global-lock-b",
        startedAt: "2026-08-25",
      },
      { now: 25_000, delayMs: 0 }
    ),
    null
  );

  first.release();
  assert.equal(
    startAttemptJournal.beginRouteStartAttempt(
      {
        routeId: "route-start-global-lock-b",
        startedAt: "2026-08-25",
      },
      { now: 25_000, delayMs: 0 }
    ),
    null
  );
  startAttemptJournal.resolveRouteStartAttempt(
    first.attempt.routeId,
    first.attempt.generation
  );
});

test("이전 generation 결과는 새 여행 시작 intent를 해제하거나 갱신하지 않는다", () => {
  const first = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-generation",
      startedAt: "2026-08-25",
    },
    { now: 30_000, delayMs: 0 }
  );

  assert.ok(first);
  first.release();

  const replacementWithoutGeneration =
    startAttemptJournal.beginRouteStartAttempt(
      {
        routeId: "route-start-generation",
        startedAt: "2026-08-26",
      },
      { now: 31_000, delayMs: 0 }
    );

  assert.equal(replacementWithoutGeneration, null);
  assert.equal(
    startAttemptJournal.getRouteStartAttempts()[0].generation,
    first.attempt.generation
  );

  const second = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-generation",
      startedAt: "2026-08-26",
    },
    {
      now: 31_000,
      delayMs: 0,
      replaceGeneration: first.attempt.generation,
    }
  );

  assert.ok(second);
  second.release();
  assert.equal(
    startAttemptJournal.resolveRouteStartAttempt(
      "route-start-generation",
      first.attempt.generation
    ),
    false
  );
  assert.equal(
    startAttemptJournal.markRouteStartAttemptRestartRequired(
      "route-start-generation",
      first.attempt.generation
    ),
    null
  );
  assert.equal(
    startAttemptJournal.getRouteStartAttempts()[0].startedAt,
    "2026-08-26"
  );

  startAttemptJournal.resolveRouteStartAttempt(
    "route-start-generation",
    second.attempt.generation
  );
});

test("여행 시작 intent를 영속화할 수 없으면 active lock까지 원복한다", () => {
  const currentLocalStorage = globalThis.localStorage;
  delete globalThis.localStorage;

  try {
    const started = startAttemptJournal.beginRouteStartAttempt({
      routeId: "route-start-no-storage",
      startedAt: "2026-08-25",
    });

    assert.equal(started, null);
    assert.equal(
      startAttemptJournal.hasActiveRouteStartAttempt(
        "route-start-no-storage"
      ),
      false
    );
    assert.equal(
      startAttemptJournal.isRouteStartAttemptLocked(
        "route-start-no-storage"
      ),
      false
    );
  } finally {
    globalThis.localStorage = currentLocalStorage;
  }
});

test("여행 시작 intent 삭제 저장이 실패하면 journal과 lock을 유지한다", () => {
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-remove-storage-failure",
      startedAt: "2026-08-25",
    },
    { now: 35_000, delayMs: 0 }
  );
  const currentRemoveItem = globalThis.localStorage.removeItem;

  assert.ok(started);
  started.release();
  globalThis.localStorage.removeItem = (key) => {
    if (key === startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY) {
      throw new Error("forced remove failure");
    }
    currentRemoveItem.call(globalThis.localStorage, key);
  };

  try {
    assert.equal(
      startAttemptJournal.resolveRouteStartAttempt(
        started.attempt.routeId,
        started.attempt.generation
      ),
      false
    );
    assert.equal(
      startAttemptJournal.isRouteStartAttemptLocked(
        started.attempt.routeId
      ),
      true
    );
  } finally {
    globalThis.localStorage.removeItem = currentRemoveItem;
  }

  assert.equal(
    startAttemptJournal.resolveRouteStartAttempt(
      started.attempt.routeId,
      started.attempt.generation
    ),
    true
  );
});

test("로그아웃 정리는 다른 계정에 여행 시작 intent를 남기지 않는다", () => {
  const started = startAttemptJournal.beginRouteStartAttempt(
    {
      routeId: "route-start-logout",
      startedAt: "2026-08-25",
    },
    { now: 40_000, delayMs: 0 }
  );

  assert.ok(started);
  started.release();
  assert.equal(startAttemptJournal.clearRouteStartAttempts(), true);
  assert.deepEqual(startAttemptJournal.getRouteStartAttempts(), []);
  assert.equal(startAttemptJournal.isRouteStartAttemptLocked(), false);
  assert.equal(
    globalThis.localStorage.getItem(
      startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY
    ),
    null
  );
});

test("로그아웃 정리는 다른 계정에 도착 알림 transition을 남기지 않는다", () => {
  const release = transitionLock.acquireRouteArrivalTransitionLock(
    "route-arrival-logout"
  );
  const transition = transitionLock.markRouteArrivalTransitionUnresolved(
    "route-arrival-logout",
    {
      expectation: { kind: "route-start" },
      now: 41_000,
      delayMs: 0,
    }
  );

  assert.ok(transition);
  assert.equal(transitionLock.clearRouteArrivalTransitions(), true);
  assert.deepEqual(
    transitionLock.getUnresolvedRouteArrivalTransitions(),
    []
  );
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  assert.equal(
    globalThis.localStorage.getItem(
      transitionLock.ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY
    ),
    null
  );
  release();
});

test("손상된 여행 시작 intent 항목은 hydration에서 제외한다", async () => {
  globalThis.localStorage.setItem(
    startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY,
    JSON.stringify([
      {
        routeId: "route-start-invalid",
        generation: 1,
        startedAt: "",
        dayStartedAt: null,
        createdAt: 1_000,
        readyAt: 1_000,
        status: "pending",
        pendingFingerprint: null,
        stablePendingReadCount: 0,
      },
    ])
  );

  const hydratedJournal = await server.ssrLoadModule(
    "/src/features/my-route/services/routeStartAttemptJournal.ts?invalid-hydrate-test"
  );

  assert.deepEqual(hydratedJournal.getRouteStartAttempts(), []);
  assert.equal(
    globalThis.localStorage.getItem(
      startAttemptJournal.ROUTE_START_ATTEMPT_STORAGE_KEY
    ),
    null
  );
});

test("복구 모달 교체는 이전 cleanup을 실행하고 오래된 close를 무시한다", () => {
  const modal = uiModalStore.useUiModalStore;
  let firstDismissCount = 0;
  let secondDismissCount = 0;
  const firstModalId = modal.getState().openModal({
    title: "첫 번째 복구 모달",
    onDismiss: () => {
      firstDismissCount += 1;
    },
  });
  const secondModalId = modal.getState().openModal({
    title: "두 번째 복구 모달",
    onDismiss: () => {
      secondDismissCount += 1;
    },
  });

  assert.equal(firstDismissCount, 1);
  modal.getState().closeModal(firstModalId);
  assert.equal(modal.getState().isOpen, true);
  assert.equal(modal.getState().modalId, secondModalId);
  assert.equal(secondDismissCount, 0);

  modal.getState().closeModal(secondModalId);
  assert.equal(modal.getState().isOpen, false);
  assert.equal(secondDismissCount, 1);
});

test("비재시도 4xx와 사용자 입력 오류만 확정 실패로 분류한다", () => {
  const ambiguousGraphqlError = new graphqlClient.GraphQLRequestError(
    "방문 상태 오류",
    { retryable: false, status: 200 }
  );
  const definitiveClientError = new graphqlClient.GraphQLRequestError(
    "잘못된 요청",
    { retryable: false, status: 400 }
  );
  const retryableServerError = new graphqlClient.GraphQLRequestError(
    "서버 오류",
    { retryable: true, status: 500 }
  );
  const statuslessError = new graphqlClient.GraphQLRequestError(
    "응답 없음",
    { retryable: false }
  );
  const userFacingError = new graphqlClient.GraphQLRequestError(
    "날짜가 겹쳐요.",
    {
      retryable: false,
      status: 200,
      code: "USER_FACING_ERROR",
    }
  );
  const internalServerError = new graphqlClient.GraphQLRequestError(
    "서버 오류",
    {
      retryable: false,
      status: 200,
      code: "INTERNAL_SERVER_ERROR",
    }
  );

  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      ambiguousGraphqlError
    ),
    false
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      definitiveClientError
    ),
    true
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      retryableServerError
    ),
    false
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      statuslessError
    ),
    false
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      userFacingError
    ),
    true
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      internalServerError
    ),
    false
  );
  assert.equal(
    arrivalMutationRecovery.isDefinitiveRouteMutationFailure(
      new TypeError("network")
    ),
    false
  );
});

test("결과 불명 요청 재조회는 해당 장소가 VISITED일 때만 성공으로 복구한다", () => {
  const pendingRoute = createRoute();
  const visitedRoute = arrivalTarget.createRouteArrivalVisitPreview(
    pendingRoute,
    "day-1-stop-1",
    "2026-08-25T02:00:00.000Z"
  );

  assert.equal(
    arrivalMutationRecovery.getConfirmedVisitedRoute(
      pendingRoute,
      "day-1-stop-1"
    ),
    null
  );
  assert.equal(
    arrivalMutationRecovery.getConfirmedVisitedRoute(
      visitedRoute,
      "day-1-stop-1"
    ),
    visitedRoute
  );
});

test("여행 시작 결과 재조회는 ACTIVE와 startedAt이 함께 반영돼야 성공으로 복구한다", () => {
  const draftRoute = createRoute();
  const startedRoute = arrivalTarget.createRouteArrivalStartPreview(
    draftRoute,
    todayKey,
    "2026-08-25T01:30:00.000Z"
  );

  assert.equal(
    arrivalMutationRecovery.getConfirmedStartedRoute(draftRoute),
    null
  );
  assert.equal(
    arrivalMutationRecovery.getConfirmedStartedRoute(startedRoute),
    startedRoute
  );
});

test("현재 타깃과 예상 타깃이 같으면 route-stop 기준으로 한 번만 등록한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "granted",
  };
  capturedNativeSyncOptions = null;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const outOfOrderPreview = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-2",
    `${currentDateKey}T02:00:00.000Z`
  );

  await arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
    [currentRoute],
    [outOfOrderPreview],
    "ko",
    currentRoute.id,
    { routeArrivalEnabled: true }
  );

  assert.deepEqual(
    capturedNativeSyncOptions.places.map(({ stopId }) => stopId),
    ["day-1-stop-1"]
  );
});

test("방문 전환 사전 등록에서 current-next union 중 일부가 누락되면 실패한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "granted",
  };
  const previousSync = globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  globalThis.window.RouteOneNative.syncRouteArrivalNotifications = async () => ({
    activeCount: 1,
    pendingCount: 1,
    registrationStatus: "registered",
    backgroundLocationStatus: "system-managed",
    notificationStatus: "granted",
  });
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
        [currentRoute],
        [nextRoute],
        "ko",
        currentRoute.id,
        { routeArrivalEnabled: true }
      ),
      /기기가 다음 장소 도착 알림을 준비하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications = previousSync;
  }
});

test("권한이 있는 authoritative 재동기화는 OS activeCount ACK를 확인한다", async () => {
  const previousSync =
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  globalThis.window.RouteOneNative.syncRouteArrivalNotifications =
    async (options) => {
      capturedNativeSyncOptions = options;

      return {
        activeCount: 0,
        pendingCount: 0,
        registrationStatus: "registered",
        backgroundLocationStatus: "system-managed",
        notificationStatus: "granted",
      };
    };
  const currentDateKey = getCurrentDateKey();
  const startedRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );

  try {
    await assert.rejects(
      arrivalService.syncTodayRouteArrivalNotifications(
        [startedRoute],
        "ko",
        startedRoute.id,
        {
          routeArrivalEnabled: true,
          checkCurrentPosition: false,
          requestPermissions: true,
          requireConfirmedRegistration: true,
        }
      ),
      /기기가 장소 도착 알림 갱신을 확인하지 못했어요/
    );
    assert.equal(capturedNativeSyncOptions.requestPermissions, true);
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications =
      previousSync;
  }
});

test("OS 알림 권한이 없으면 방문 완료를 막지 않고 대상만 저장한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "denied",
  };
  capturedNativeSyncOptions = null;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  const preparation =
    await arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
      [currentRoute],
      [nextRoute],
      "ko",
      currentRoute.id,
      { routeArrivalEnabled: true }
    );

  assert.equal(capturedNativeSyncOptions.requestPermissions, false);
  assert.deepEqual(preparation, {
    requestPermissions: false,
    rollbackRequired: true,
  });
});

test("권한 조회가 실패하면 storage-only로 낮추지 않고 방문 사전등록을 중단한다", async () => {
  const previousGetAppInfo = globalThis.window.RouteOneNative.getAppInfo;
  globalThis.window.RouteOneNative.getAppInfo = async () => {
    throw new Error("app info unavailable");
  };
  capturedNativeSyncOptions = null;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
        [currentRoute],
        [nextRoute],
        "ko",
        currentRoute.id,
        { routeArrivalEnabled: true }
      ),
      /app info unavailable/
    );
    assert.equal(capturedNativeSyncOptions, null);
  } finally {
    globalThis.window.RouteOneNative.getAppInfo = previousGetAppInfo;
  }
});

test("권한이 없어도 네이티브 desired target 저장 응답이 없으면 방문 API 준비를 중단한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "denied",
    locationAccuracy: "unavailable",
    notificationPermissionStatus: "denied",
  };
  const previousSync =
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  delete globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  const currentDateKey = getCurrentDateKey();
  const currentRoute = arrivalTarget.createRouteArrivalStartPreview(
    createRoute(),
    currentDateKey,
    `${currentDateKey}T01:30:00.000Z`
  );
  const nextRoute = arrivalTarget.createRouteArrivalVisitPreview(
    currentRoute,
    "day-1-stop-1",
    `${currentDateKey}T02:00:00.000Z`
  );

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForVisitTransition(
        [currentRoute],
        [nextRoute],
        "ko",
        currentRoute.id,
        { routeArrivalEnabled: true }
      ),
      /다음 장소 도착 알림 대상 저장을 확인하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications =
      previousSync;
  }
});

test("iPhone 위치 권한이 없으면 여행 시작 경고 대상으로 판단한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "denied",
  };

  assert.equal(
    await locationPermissionService.getRouteStartLocationPermissionState(),
    "denied"
  );
  assert.equal(
    await locationPermissionService.canSyncRouteArrivalForCurrentPermission(),
    false
  );
});

test("iPhone 최초 위치 권한은 네이티브 권한 요청 흐름에서 처리한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "undetermined",
    locationAccuracy: "unavailable",
    notificationPermissionStatus: "undetermined",
  };

  assert.equal(
    await locationPermissionService.getRouteStartLocationPermissionState(),
    "undetermined"
  );
  assert.equal(
    await locationPermissionService.canSyncRouteArrivalForCurrentPermission(),
    false
  );
  assert.equal(
    await locationPermissionService.shouldRequestRouteArrivalRegistrationForStart(
      false
    ),
    true
  );
});

test("iPhone 위치 권한이 허용되면 기존 등록 흐름을 사용한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "granted",
  };

  assert.equal(
    await locationPermissionService.getRouteStartLocationPermissionState(),
    "granted"
  );
  assert.equal(
    await locationPermissionService.canSyncRouteArrivalForCurrentPermission(),
    true
  );
  assert.equal(
    await locationPermissionService.canRequireRouteArrivalRegistration(),
    true
  );
});

test("iPhone 정확한 위치가 꺼져 있으면 여행 시작 경고 대상으로 판단한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "reduced",
  };

  assert.equal(
    await locationPermissionService.getRouteStartLocationPermissionState(),
    "denied"
  );
  assert.equal(
    await locationPermissionService.canSyncRouteArrivalForCurrentPermission(),
    false
  );
  assert.equal(
    await locationPermissionService.canRequireRouteArrivalRegistration(),
    false
  );
});

test("iPhone 알림 배너 권한이 꺼져 있으면 시작 시 storage-only 경로를 선택한다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "denied",
  };

  assert.equal(
    await locationPermissionService.shouldRequestRouteArrivalRegistrationForStart(
      false
    ),
    false
  );
  assert.equal(
    await locationPermissionService.canRequireRouteArrivalRegistration(),
    false
  );
});

test("iPhone 권한 상태가 unavailable이면 방문 전환을 storage-only로 낮추지 않는다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "ios",
    locationPermissionStatus: "granted",
    locationAccuracy: "full",
    notificationPermissionStatus: "unavailable",
  };

  await assert.rejects(
    locationPermissionService.canRequireRouteArrivalRegistration(),
    /permission status is unavailable/
  );
});

test("브라우저와 Android는 iPhone 위치 권한 경고를 적용하지 않는다", async () => {
  nativeAppInfo = {
    ...nativeAppInfo,
    platform: "android",
    locationPermissionStatus: "denied",
  };
  assert.equal(
    await locationPermissionService.getRouteStartLocationPermissionState(),
    "not-required"
  );
  assert.equal(
    await locationPermissionService.shouldRequestRouteArrivalRegistrationForStart(
      false
    ),
    true
  );

  const previousNativeBridge = globalThis.window.RouteOneNative;
  delete globalThis.window.RouteOneNative;

  try {
    assert.equal(
      await locationPermissionService.getRouteStartLocationPermissionState(),
      "not-required"
    );
    assert.equal(
      await locationPermissionService.shouldRequestRouteArrivalRegistrationForStart(
        false
      ),
      false
    );
  } finally {
    globalThis.window.RouteOneNative = previousNativeBridge;
  }
});

test("네이티브 브리지가 응답하지 않으면 도착 알림을 켠 여행 시작을 거부한다", async () => {
  const previousSync = globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  delete globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForStart(
        [route],
        route,
        currentDateKey,
        `${currentDateKey}T01:30:00.000Z`,
        "ko",
        true
      ),
      /기기가 장소 도착 알림을 등록하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications = previousSync;
  }
});

test("권한 없는 시작도 desired target 저장 응답이 없으면 API 준비를 중단한다", async () => {
  const previousSync =
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  delete globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForStart(
        [route],
        route,
        currentDateKey,
        `${currentDateKey}T01:30:00.000Z`,
        "ko",
        true,
        {
          requestPermissions: false,
          requireConfirmedRegistration: false,
        }
      ),
      /장소 도착 알림 대상 저장을 확인하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications =
      previousSync;
  }
});

test("OS 등록 확인이 inactive이면 도착 알림을 켠 여행 시작을 거부한다", async () => {
  const previousSync = globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  globalThis.window.RouteOneNative.syncRouteArrivalNotifications = async () => ({
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "inactive",
    backgroundLocationStatus: "unused",
    notificationStatus: "granted",
  });
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForStart(
        [route],
        route,
        currentDateKey,
        `${currentDateKey}T01:30:00.000Z`,
        "ko",
        true
      ),
      /기기가 장소 도착 알림을 등록하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications = previousSync;
  }
});

test("오늘 요청한 첫 장소가 등록되지 않으면 여행 시작을 거부한다", async () => {
  const previousSync = globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  globalThis.window.RouteOneNative.syncRouteArrivalNotifications = async () => ({
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "registered",
    backgroundLocationStatus: "system-managed",
    notificationStatus: "granted",
  });
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    await assert.rejects(
      arrivalService.prepareRouteArrivalNotificationsForStart(
        [route],
        route,
        currentDateKey,
        `${currentDateKey}T01:30:00.000Z`,
        "ko",
        true
      ),
      /기기가 장소 도착 알림을 등록하지 못했어요/
    );
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications = previousSync;
  }
});

test("브라우저에서는 도착 알림 설정이 켜져 있어도 여행 시작 준비를 막지 않는다", async () => {
  const previousNativeBridge = globalThis.window.RouteOneNative;
  delete globalThis.window.RouteOneNative;
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    const result = await arrivalService.prepareRouteArrivalNotificationsForStart(
      [route],
      route,
      currentDateKey,
      `${currentDateKey}T01:30:00.000Z`,
      "ko",
      true
    );

    assert.equal(result, null);
  } finally {
    globalThis.window.RouteOneNative = previousNativeBridge;
  }
});

test("도착 알림을 끈 경우 inactive 응답이 여행 시작을 막지 않는다", async () => {
  const previousSync = globalThis.window.RouteOneNative.syncRouteArrivalNotifications;
  globalThis.window.RouteOneNative.syncRouteArrivalNotifications = async () => ({
    activeCount: 0,
    pendingCount: 0,
    registrationStatus: "inactive",
    backgroundLocationStatus: "unused",
    notificationStatus: "unused",
  });
  const route = createRoute();
  const currentDateKey = getCurrentDateKey();

  try {
    const result = await arrivalService.prepareRouteArrivalNotificationsForStart(
      [route],
      route,
      currentDateKey,
      `${currentDateKey}T01:30:00.000Z`,
      "ko",
      false
    );

    assert.equal(result.registrationStatus, "inactive");
  } finally {
    globalThis.window.RouteOneNative.syncRouteArrivalNotifications = previousSync;
  }
});
