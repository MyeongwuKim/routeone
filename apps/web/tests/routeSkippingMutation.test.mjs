import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";
import ts from "typescript";

let server;
let cache;
let arrivalService;
let transitionLock;
let recovery;
let skipping;
let routeDisplay;
let nativeBridge;
let transport;
let text;
let notificationSettingsKey;
let notificationApi;
let nativeSync;
const storage = new Map();
const originalGlobals = new Map(
  ["window", "localStorage", "fetch"].map((name) => [
    name, Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);

before(async () => {
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const window = {
    localStorage,
    RouteOneNative: {
      getAppInfo: async () => ({
        platform: "ios", capabilities: [],
        locationPermissionStatus: "granted", locationAccuracy: "full",
        notificationPermissionStatus: "granted",
      }),
      syncRouteArrivalNotifications: (options) => nativeSync(options),
    },
  };
  for (const [name, value] of Object.entries({
    localStorage, window,
    fetch() { throw new Error("건너뛰기 회귀 테스트에서 외부 요청을 실행할 수 없습니다."); },
  })) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  cache = await server.ssrLoadModule("/src/features/my-route/myRouteCache.ts");
  arrivalService = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalNotificationService.ts");
  transitionLock = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalTransitionLock.ts");
  recovery = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalMutationRecovery.ts");
  skipping = await server.ssrLoadModule("/src/features/my-route/models/routeSkipping.ts");
  routeDisplay = await server.ssrLoadModule("/src/features/my-route/routeDisplay.ts");
  ({ nativeBridge } = await server.ssrLoadModule("/src/native-bridge/index.ts"));
  transport = await server.ssrLoadModule("/src/lib/graphqlClient.ts");
  ({ notificationApi, NOTIFICATION_SETTINGS_QUERY_KEY: notificationSettingsKey } = await server.ssrLoadModule("/src/api/notificationApi.ts"));
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  text = getUiText("ko");
});

after(async () => {
  transitionLock?.clearRouteArrivalTransitions();
  await server?.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function createRoute() {
  const today = routeDisplay.getTodayDateKey();
  const tomorrow = routeDisplay.addDaysToDateKey(today, 1);
  const startedAt = `${today}T00:00:00.000Z`;
  const makeStop = (id, order, visited = false) => ({
    id, order, visitStatus: visited ? "VISITED" : "PENDING",
    visitedAt: visited ? startedAt : null,
    verifiedAt: null, verificationStatus: "NONE",
    checkedInAt: null, checkedOutAt: null, actualStayMinutes: null,
    verificationPhotoImageId: null, verificationPhotoUrl: null,
    verificationPhotoPublicationConsent: false, verificationPhotoPublishedAt: null,
    verificationLat: null, verificationLng: null, verificationAccuracyMeters: null,
    stayMinutes: 60, travelMinutesFromPrevious: 10,
    place: {
      id: `place-${id}`, contentId: `place-${id}`, contentTypeId: "12",
      title: `${order}번 테스트 장소`, lat: 37 + order / 100, lng: 127 + order / 100,
      images: [], categoryName: "자연", address: "테스트 주소",
    },
  });
  const days = [
    { id: "day-1", dayIndex: 1, date: today, startedAt,
      stops: [makeStop("stop-1", 1, true), makeStop("stop-2", 2), makeStop("stop-3", 3)] },
    { id: "day-2", dayIndex: 2, date: tomorrow, startedAt: null,
      stops: [makeStop("stop-4", 1)] },
  ];
  return {
    id: "route-1", title: "회귀 검증 일정", isMine: true,
    status: "ACTIVE", visibility: "PRIVATE", sharedAt: null,
    startedAt, completedAt: null,
    travelStartDate: today, travelEndDate: tomorrow, tripDays: 2,
    dailyStartMinutes: 540, totalStopCount: 4, completedStopCount: 1,
    days, stops: days.flatMap((day) => day.stops),
  };
}

// 서버 응답 fixture는 원본 projection을 호출하지 않고 필요한 확정 상태를 명시한다.
function serverRoute(route, statuses, fields = {}) {
  const days = route.days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => {
      const status = statuses[stop.id];
      return status ? {
        ...stop, visitStatus: status,
        visitedAt: status === "VISITED" ? route.startedAt : null,
      } : stop;
    }),
  }));
  return { ...route, ...fields, days, stops: days.flatMap((day) => day.stops) };
}

function nativeResult(options) {
  return {
    activeCount: options.places.length, pendingCount: options.places.length,
    registrationStatus: options.places.length ? "registered" : "inactive",
    backgroundLocationStatus: "system-managed", notificationStatus: "granted",
  };
}

function definiteFailure() {
  return new transport.GraphQLRequestError("서버가 저장을 거절했어요.", {
    retryable: false, status: 400, code: "USER_FACING_ERROR",
  });
}

function timeoutFailure() {
  return new transport.GraphQLRequestError("시간 초과", { retryable: true });
}

function loadHook(modules) {
  const source = readFileSync(new URL(
    "../src/features/my-route/hooks/useRouteSkippingMutation.ts", import.meta.url
  ), "utf8");
  const compiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", compiled.outputText)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return exports.useRouteSkippingMutation;
}

function createHarness(t, options = {}) {
  transitionLock.clearRouteArrivalTransitions();
  storage.clear();
  const route = options.route ?? createRoute();
  const events = [];
  const requests = [];
  const selected = [];
  let token = "account-a-token";
  let cursor = 0;
  let observer;
  let unsubscribe;
  const refs = [];
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [route] });
  client.setQueryData(notificationSettingsKey, { notificationSettings: { routeArrivalEnabled: true } });
  client.setQueryData(["route-detail", route.id], { route: { ...route, owner: { id: "owner-a" } } });
  for (const key of [cache.MY_ROUTE_HISTORY_QUERY_KEY, ["shared-routes"], ["liked-shared-routes"], ["place-photos"], ["place-stay-summary"]]) {
    client.setQueryData(key, { marker: "cached" });
  }
  const unsubscribeCache = client.getQueryCache().subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success" &&
        event.query.queryHash === JSON.stringify(cache.MY_ROUTES_QUERY_KEY)) {
      events.push({ kind: "cache", route: event.query.state.data.myRoutes[0] });
    }
  });
  nativeSync = async (syncOptions) => {
    events.push({ kind: "native", ids: syncOptions.places.map((place) => place.stopId), options: syncOptions });
    return options.nativeSync ? options.nativeSync(syncOptions, events) : nativeResult(syncOptions);
  };
  const api = {
    async setRouteStopSkipped(stopId, skipped) {
      const request = { kind: "stop-skip", stopId, skipped };
      requests.push(request);
      events.push({ kind: "api", request });
      if (!options.respond) throw new Error("이 테스트에는 서버 응답 fixture가 필요합니다.");
      return { setRouteStopSkipped: await options.respond(request) };
    },
    async finishRouteDay(dayId) {
      const request = { kind: "day-finish", dayId };
      requests.push(request);
      events.push({ kind: "api", request });
      if (!options.respond) throw new Error("이 테스트에는 서버 응답 fixture가 필요합니다.");
      return { finishRouteDay: await options.respond(request) };
    },
    async routeById(routeId) {
      requests.push({ kind: "reread", routeId });
      events.push({ kind: "reread" });
      return { route: await options.reread?.(routeId) };
    },
  };
  const useHook = loadHook({
    react: {
      useRef(initialValue) {
        const index = cursor++;
        refs[index] ??= { current: initialValue };
        return refs[index];
      },
    },
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation(mutationOptions) {
        if (!observer) {
          observer = new MutationObserver(client, mutationOptions);
          unsubscribe = observer.subscribe(() => {});
        } else observer.setOptions(mutationOptions);
        return { ...observer.getCurrentResult(), mutateAsync: observer.mutate.bind(observer) };
      },
    },
    "@/api/routeApi": { routeApi: api },
    "@/api/notificationApi": { NOTIFICATION_SETTINGS_QUERY_KEY: notificationSettingsKey },
    "@/lib/authToken": { getAuthToken: () => token },
    "@/lib/uiText": { useUiText: () => text },
    "@/stores/uiToastStore": { useUiToastStore: (select) => select({ showToast: (...args) => events.push({ kind: "toast", args }) }) },
    "@/stores/appLanguageStore": { useAppLanguageStore: (select) => select({ language: "ko" }) },
    "@/native-bridge": { nativeBridge },
    "../myRouteCache": cache,
    "../models/routeSkipping": skipping,
    "../services/routeArrivalMutationRecovery": recovery,
    "../services/routeArrivalTransitionLock": transitionLock,
    "../services/routeArrivalNotificationService": arrivalService,
  });
  function render() {
    cursor = 0;
    return useHook({
      route, blocked: options.blocked ?? false,
      onSuccess(nextRoute) {
        assert.equal(client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes[0].id, nextRoute.id);
        selected.push(nextRoute);
        events.push({ kind: "selected-day", route: nextRoute });
      },
    });
  }
  render();
  t.after(() => {
    unsubscribe?.();
    unsubscribeCache();
    client.clear();
    transitionLock.clearRouteArrivalTransitions();
    storage.clear();
  });
  return {
    route, events, requests, selected, client, render,
    get state() { return observer.getCurrentResult(); },
    get cachedRoute() { return client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes[0]; },
    changeAccount() { token = "account-b-token"; },
  };
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 30 && !check(); attempt += 1) await flushTasks();
  assert.ok(check(), "비동기 mutation이 예상 단계에 도달해야 합니다.");
}

function nativeCalls(harness) {
  return harness.events.filter((event) => event.kind === "native");
}

function setArrivalEnabled(harness, enabled) {
  harness.client.setQueryData(notificationSettingsKey, { notificationSettings: { routeArrivalEnabled: enabled } });
}

for (const kind of ["skip", "undo", "finish"]) for (const fails of [false, true]) {
  test(`${kind} 저장 중 알림 OFF 뒤 ${fails ? "실패 복구" : "성공 확정"}도 등록 대상을 비운다`, async t => {
    const response = deferred();
    const route = kind === "undo" ? serverRoute(createRoute(), { "stop-2": "SKIPPED" }) : createRoute();
    const h = createHarness(t, { route, respond: () => response.promise });
    const run = kind === "finish" ? h.render().finishDay("day-1") : h.render().skipStop("stop-2", kind === "skip");
    await waitFor(() => h.requests.length === 1);
    setArrivalEnabled(h, false);
    if (fails) response.reject(definiteFailure());
    else response.resolve(serverRoute(route, { "stop-2": kind === "undo" ? "PENDING" : "SKIPPED" }));
    assert.equal(await run, !fails);
    const last = nativeCalls(h).at(-1);
    assert.deepEqual(last.ids, []);
    assert.equal(last.options.requestPermissions, false);
    assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  });
}

test("권한 상태 조회 중 알림을 끄면 조회가 끝나도 GPS 대상을 새로 등록하지 않는다", async t => {
  const info = deferred();
  let queried = false;
  t.mock.method(window.RouteOneNative, "getAppInfo", () => { queried = true; return info.promise; });
  const h = createHarness(t, { respond: () => serverRoute(h.route, { "stop-2": "SKIPPED" }) });
  const run = h.render().skipStop("stop-2", true);
  await waitFor(() => queried);
  setArrivalEnabled(h, false);
  info.resolve({ platform: "ios", capabilities: [], locationPermissionStatus: "granted", locationAccuracy: "full", notificationPermissionStatus: "granted" });
  assert.equal(await run, true);
  assert.ok(nativeCalls(h).length > 0);
  assert.ok(nativeCalls(h).every(call => call.ids.length === 0));
});

test("이전 설정 조회 응답보다 대기 중 변경된 OFF 캐시를 우선한다", async t => {
  const settings = deferred();
  let queried = false;
  t.mock.method(notificationApi, "settings", () => { queried = true; return settings.promise; });
  const h = createHarness(t, { respond: () => serverRoute(h.route, { "stop-2": "SKIPPED" }) });
  h.client.removeQueries({ queryKey: notificationSettingsKey });
  const run = h.render().skipStop("stop-2", true);
  await waitFor(() => queried);
  setArrivalEnabled(h, false);
  settings.resolve({ notificationSettings: { routeArrivalEnabled: true } });
  assert.equal(await run, true);
  assert.ok(nativeCalls(h).every(call => call.ids.length === 0));
});

test("기기에 이미 보낸 최종 등록이 OFF 뒤 늦게 끝나면 해제 요청으로 마무리한다", async t => {
  const final = deferred();
  let calls = 0;
  const h = createHarness(t, { respond: () => serverRoute(h.route, { "stop-2": "SKIPPED" }),
    nativeSync: options => ++calls === 2 ? final.promise : nativeResult(options) });
  const run = h.render().skipStop("stop-2", true);
  await waitFor(() => nativeCalls(h).length === 2);
  setArrivalEnabled(h, false);
  final.resolve(nativeResult(nativeCalls(h)[1].options));
  assert.equal(await run, true);
  assert.equal(nativeCalls(h).length, 3);
  assert.deepEqual(nativeCalls(h).at(-1).ids, []);
});

test("저장 중 OFF 뒤 다시 ON으로 바꾸면 최종 ON 설정으로 다음 목적지를 등록한다", async t => {
  const response = deferred();
  const h = createHarness(t, { respond: () => response.promise });
  const run = h.render().skipStop("stop-2", true);
  await waitFor(() => h.requests.length === 1);
  setArrivalEnabled(h, false);
  setArrivalEnabled(h, true);
  response.resolve(serverRoute(h.route, { "stop-2": "SKIPPED" }));
  assert.equal(await run, true);
  assert.deepEqual(nativeCalls(h).at(-1).ids, ["stop-3"]);
});

test("진행 작업은 Mutation 상태에서 읽고 닫기 가드는 첫 렌더 전에도 실행 중임을 안다", async t => {
  const response = deferred();
  const h = createHarness(t, { respond: () => response.promise });
  const hook = h.render();
  const run = hook.skipStop("stop-2", true);
  assert.equal(hook.isInFlight(), true);
  await waitFor(() => h.requests.length === 1);
  assert.deepEqual(h.render().pendingOperation, { kind: "stop-skip", stopId: "stop-2", skipped: true });
  response.resolve(serverRoute(h.route, { "stop-2": "SKIPPED" }));
  await run;
  assert.equal(h.render().pendingOperation, null);
  assert.equal(hook.isInFlight(), false);
});

function assertUnchanged(harness, original) {
  assert.deepEqual(harness.cachedRoute, original);
  assert.equal(harness.selected.length, 0);
  assert.equal(harness.events.some((event) => event.kind === "cache"), false);
}

test("건너뛰기는 알림 준비→API 확정→캐시·선택 DAY→최종 알림 순서로 반영한다", async (t) => {
  const response = deferred();
  const harness = createHarness(t, { respond: () => response.promise });
  const saved = serverRoute(harness.route, { "stop-2": "SKIPPED" });
  const run = harness.render().skipStop("stop-2", true);
  await waitFor(() => harness.requests.length === 1);
  assert.equal(harness.state.status, "pending");
  assert.equal(harness.render().savingStopId, "stop-2");
  assertUnchanged(harness, harness.route);
  assert.deepEqual(nativeCalls(harness)[0].ids, ["stop-2", "stop-3"]);
  assert.equal(nativeCalls(harness)[0].options.checkCurrentPosition, false);
  assert.deepEqual(transitionLock.getUnresolvedRouteArrivalTransitions()[0].expectation,
    { kind: "stop-skip", stopId: "stop-2", skipped: true });
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  response.resolve(saved);
  assert.equal(await run, true);
  assert.equal(harness.state.status, "success");
  assert.equal(harness.render().savingStopId, null);
  assert.deepEqual(harness.events.filter((event) => event.kind !== "toast").map((event) => event.kind),
    ["native", "api", "cache", "selected-day", "native"]);
  assert.deepEqual(nativeCalls(harness)[1].ids, ["stop-3"]);
  assert.equal(nativeCalls(harness)[1].options.checkCurrentPosition, true);
  assert.equal(harness.cachedRoute.completedStopCount, 1);
  assert.equal(harness.cachedRoute.days[0].stops[1].visitStatus, "SKIPPED");
  assert.equal(harness.cachedRoute.days[0].stops[1].visitedAt, null);
  assert.equal(harness.selected[0].days[0].stops[2].visitStatus, "PENDING");
  assert.equal(harness.client.getQueryData(["route-detail", "route-1"]).route.owner.id, "owner-a");
  for (const key of [cache.MY_ROUTE_HISTORY_QUERY_KEY, ["route-detail", "route-1"], ["shared-routes"], ["liked-shared-routes"], ["place-photos"], ["place-stay-summary"]]) {
    assert.equal(harness.client.getQueryState(key).isInvalidated, true);
  }
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  assert.equal(storage.size, 0);
});

test("DAY 마치기는 선택한 DAY 1의 미방문만 건너뛰고 DAY 2는 유지한다", async (t) => {
  const response = deferred();
  const harness = createHarness(t, { respond: () => response.promise });
  const saved = serverRoute(harness.route, { "stop-2": "SKIPPED", "stop-3": "SKIPPED" });
  const run = harness.render().finishDay("day-1");
  await waitFor(() => harness.requests.length === 1);
  assert.equal(harness.render().isFinishingDay, true);
  assert.equal(harness.render().savingStopId, null);
  assert.deepEqual(harness.requests, [{ kind: "day-finish", dayId: "day-1" }]);
  assert.deepEqual(nativeCalls(harness)[0].ids, ["stop-2"]);
  response.resolve(saved);
  assert.equal(await run, true);
  assert.deepEqual(harness.cachedRoute.days[0].stops.map((stop) => stop.visitStatus), ["VISITED", "SKIPPED", "SKIPPED"]);
  assert.deepEqual(harness.cachedRoute.days[1], harness.route.days[1]);
  assert.equal(harness.cachedRoute.status, "ACTIVE");
  assert.equal(harness.cachedRoute.completedStopCount, 1);
  assert.deepEqual(nativeCalls(harness)[1].ids, []);
  assert.equal(harness.render().isFinishingDay, false);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("완료·공유된 일정의 건너뛰기 취소는 진행 중·비공개 상태와 미방문 알림을 반영한다", async (t) => {
  const initial = serverRoute(createRoute(), {
    "stop-2": "SKIPPED", "stop-3": "VISITED", "stop-4": "VISITED",
  }, { status: "COMPLETED", visibility: "PUBLIC", completedStopCount: 3,
    completedAt: "2026-01-01T00:00:00.000Z", sharedAt: "2026-01-01T01:00:00.000Z" });
  const saved = serverRoute(initial, { "stop-2": "PENDING" }, {
    status: "ACTIVE", visibility: "PRIVATE", completedAt: null, sharedAt: null,
  });
  const harness = createHarness(t, { route: initial, respond: () => saved });
  assert.equal(await harness.render().skipStop("stop-2", false), true);
  assert.deepEqual(harness.requests, [{ kind: "stop-skip", stopId: "stop-2", skipped: false }]);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-2"], ["stop-2"]]);
  assert.equal(harness.cachedRoute.status, "ACTIVE");
  assert.equal(harness.cachedRoute.visibility, "PRIVATE");
  assert.equal(harness.cachedRoute.sharedAt, null);
  assert.equal(harness.cachedRoute.completedAt, null);
  assert.equal(harness.cachedRoute.completedStopCount, 3);
  assert.equal(harness.client.getQueryState(["shared-routes"]).isInvalidated, true);
});

test("서버의 확정 실패는 준비한 알림을 되돌리고 캐시와 선택 DAY를 유지한다", async (t) => {
  const harness = createHarness(t, { respond() { throw definiteFailure(); } });
  assert.equal(await harness.render().skipStop("stop-2", true), false);
  assert.equal(harness.state.status, "error");
  assertUnchanged(harness, harness.route);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-2", "stop-3"], ["stop-2"]]);
  assert.equal(nativeCalls(harness)[1].options.checkCurrentPosition, false);
  assert.equal(harness.requests.length, 1);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  assert.equal(storage.size, 0);
  assert.ok(harness.events.some((event) => event.kind === "toast" && event.args[0] === "서버가 저장을 거절했어요."));
});

for (const rereadFails of [false, true]) test(`건너뛰기 충돌은 서버 최신 상태로 알림을 맞추고 재전송하지 않는다 (조회 실패 ${rereadFails})`, async t => {
  const route = createRoute();
  const latest = serverRoute(route, { "stop-2": "VISITED" });
  const conflict = new transport.GraphQLRequestError("방문 기록이 다른 요청에서 변경됐어요.", {
    retryable: false, status: 409, code: "USER_FACING_ERROR",
  });
  const h = createHarness(t, { route, respond() { throw conflict; }, reread() {
    if (rereadFails) throw timeoutFailure();
    return latest;
  } });
  assert.equal(await h.render().skipStop("stop-2", true), false);
  assert.deepEqual(h.requests.map(request => request.kind), ["stop-skip", "reread"]);
  assert.equal(h.selected.length, 0);
  assert.equal(h.client.getQueryState(cache.MY_ROUTES_QUERY_KEY).isInvalidated, true);
  assert.equal(h.cachedRoute.stops[1].visitStatus, rereadFails ? "PENDING" : "VISITED");
  assert.deepEqual(nativeCalls(h).map(call => call.ids), rereadFails
    ? [["stop-2", "stop-3"]] : [["stop-2", "stop-3"], ["stop-3"]]);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, rereadFails ? 1 : 0);
});

test("충돌 재조회 중 계정이 바뀌면 이전 요청이 새 계정 캐시와 알림을 건드리지 않는다", async t => {
  const reread = deferred();
  const conflict = new transport.GraphQLRequestError("방문 기록이 변경됐어요.", {
    retryable: false, status: 409, code: "USER_FACING_ERROR",
  });
  const h = createHarness(t, { respond() { throw conflict; }, reread: () => reread.promise });
  const run = h.render().skipStop("stop-2", true);
  await waitFor(() => h.requests.length === 2);
  h.changeAccount();
  const before = structuredClone(h.cachedRoute);
  reread.resolve(serverRoute(h.route, { "stop-2": "VISITED" }));
  assert.equal(await run, false);
  assert.deepEqual(h.cachedRoute, before);
  assert.equal(nativeCalls(h).length, 1);
  assert.ok(!h.events.some(event => event.kind === "toast"));
});

test("API 시간 초과도 재조회가 건너뜀을 확인하면 확정 상태와 다음 알림을 반영한다", async (t) => {
  const route = createRoute();
  const saved = serverRoute(route, { "stop-2": "SKIPPED" });
  const harness = createHarness(t, { route,
    respond() { throw timeoutFailure(); }, reread: () => saved,
  });
  assert.equal(await harness.render().skipStop("stop-2", true), true);
  assert.deepEqual(harness.requests, [
    { kind: "stop-skip", stopId: "stop-2", skipped: true },
    { kind: "reread", routeId: "route-1" },
  ]);
  assert.equal(harness.cachedRoute.days[0].stops[1].visitStatus, "SKIPPED");
  assert.equal(harness.cachedRoute.completedStopCount, 1);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-2", "stop-3"], ["stop-3"]]);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

for (const rereadFailure of [false, true]) {
  test(`API 시간 초과 후 재조회가 ${rereadFailure ? "실패하면" : "기존 미방문이면"} 확정하지 않고 journal을 남긴다`, async (t) => {
    const route = createRoute();
    const harness = createHarness(t, { route,
      respond() { throw timeoutFailure(); },
      reread() { if (rereadFailure) throw timeoutFailure(); return route; },
    });
    assert.equal(await harness.render().skipStop("stop-2", true), false);
    assertUnchanged(harness, route);
    assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-2", "stop-3"]]);
    const journal = transitionLock.getUnresolvedRouteArrivalTransitions();
    assert.equal(journal.length, 1);
    assert.deepEqual(journal[0].expectation, { kind: "stop-skip", stopId: "stop-2", skipped: true });
    assert.ok(storage.has(transitionLock.ROUTE_ARRIVAL_TRANSITION_JOURNAL_STORAGE_KEY));
    assert.equal(await harness.render().skipStop("stop-3", true), false);
    assert.equal(harness.requests.length, 2);
    assert.ok(harness.events.some((event) => event.kind === "toast" && event.args[0] === text.dayRoute.skipSaveUnconfirmed));
  });
}

test("네이티브 사전 등록 실패는 API를 보내지 않고 기존 알림만 복원한다", async (t) => {
  let calls = 0;
  const harness = createHarness(t, {
    nativeSync(options) {
      if (++calls === 1) throw new Error("기기 등록 실패");
      return nativeResult(options);
    },
  });
  assert.equal(await harness.render().skipStop("stop-2", true), false);
  assert.equal(harness.requests.length, 0);
  assertUnchanged(harness, harness.route);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-2", "stop-3"], ["stop-2"]]);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("최종 알림 등록이 실패해도 서버 확정 캐시는 유지하고 journal을 남긴다", async (t) => {
  const route = createRoute();
  const saved = serverRoute(route, { "stop-2": "SKIPPED" });
  let calls = 0;
  t.mock.method(console, "warn", () => {});
  const harness = createHarness(t, { route, respond: () => saved,
    nativeSync(options) {
      if (++calls === 2) throw new Error("최종 기기 동기화 실패");
      return nativeResult(options);
    },
  });
  assert.equal(await harness.render().skipStop("stop-2", true), true);
  assert.equal(harness.cachedRoute.days[0].stops[1].visitStatus, "SKIPPED");
  assert.equal(harness.selected.length, 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 1);
  assert.ok(harness.events.some((event) => event.kind === "toast" && event.args[0] === text.dayRoute.skipArrivalSyncFailed));
});

test("연속 누름은 실제 pending mutation이 끝날 때까지 추가 API를 차단한다", async (t) => {
  const response = deferred();
  const harness = createHarness(t, { respond: () => response.promise });
  const hook = harness.render();
  const run = hook.skipStop("stop-2", true);
  assert.equal(await hook.skipStop("stop-2", true), false);
  await waitFor(() => harness.requests.length === 1);
  assert.equal(await harness.render().finishDay("day-1"), false);
  assert.equal(harness.state.status, "pending");
  assert.equal(harness.requests.length, 1);
  response.resolve(serverRoute(harness.route, { "stop-2": "SKIPPED" }));
  assert.equal(await run, true);
  assert.equal(harness.state.status, "success");
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("기존 방문 전환 잠금과 controller의 저장 차단은 건너뛰기 요청도 막는다", async (t) => {
  const harness = createHarness(t);
  const release = transitionLock.acquireRouteArrivalTransitionLock("other-visited-route");
  assert.equal(await harness.render().skipStop("stop-2", true), false);
  release();
  assert.equal(harness.requests.length, 0);
  assert.equal(nativeCalls(harness).length, 0);
  assert.equal(harness.state.status, "idle");
  const blocked = createHarness(t, { blocked: true });
  assert.equal(await blocked.render().finishDay("day-1"), false);
  assert.equal(blocked.requests.length, 0);
  assert.equal(nativeCalls(blocked).length, 0);
});

test("계정 전환 후 늦은 성공 응답은 새 계정 캐시·선택 DAY·알림에 반영하지 않는다", async (t) => {
  const response = deferred();
  const harness = createHarness(t, { respond: () => response.promise });
  const run = harness.render().skipStop("stop-2", true);
  await waitFor(() => harness.requests.length === 1);
  harness.changeAccount();
  const newAccountRoute = { ...createRoute(), id: "account-b-route" };
  harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [newAccountRoute] });
  harness.client.removeQueries({ queryKey: ["route-detail", "route-1"], exact: true });
  response.resolve(serverRoute(harness.route, { "stop-2": "SKIPPED" }));
  await run;
  assert.deepEqual(harness.cachedRoute, newAccountRoute);
  assert.equal(harness.client.getQueryData(["route-detail", "route-1"]), undefined);
  assert.equal(harness.selected.length, 0);
  assert.equal(nativeCalls(harness).length, 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
});

test("계정 전환 후 늦은 확정 실패는 이전 계정 알림을 다시 등록하지 않는다", async (t) => {
  const response = deferred();
  const harness = createHarness(t, { respond: () => response.promise });
  const run = harness.render().skipStop("stop-2", true);
  await waitFor(() => harness.requests.length === 1);
  harness.changeAccount();
  transitionLock.clearRouteArrivalTransitions();
  response.reject(definiteFailure());
  assert.equal(await run, false);
  assertUnchanged(harness, harness.route);
  assert.equal(nativeCalls(harness).length, 1);
  assert.equal(harness.requests.length, 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
});

test("조회 취소의 await 도중 계정이 바뀌어도 이전 응답을 새 캐시에 쓰지 않는다", async (t) => {
  const route = createRoute();
  const saved = serverRoute(route, { "stop-2": "SKIPPED" });
  const harness = createHarness(t, { route, respond: () => saved });
  const pendingRead = deferred();
  const nextAccountRoute = { ...createRoute(), id: "account-b-route" };
  let started = false;
  const query = harness.client.fetchQuery({
    queryKey: cache.MY_ROUTES_QUERY_KEY,
    queryFn({ signal }) {
      started = true;
      signal.addEventListener("abort", () => {
        harness.changeAccount();
        harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [nextAccountRoute] });
        harness.client.removeQueries({ queryKey: ["route-detail", "route-1"], exact: true });
      }, { once: true });
      return pendingRead.promise;
    },
  }).catch(() => null);
  await waitFor(() => started);
  await harness.render().skipStop("stop-2", true);
  await query;
  assert.deepEqual(harness.cachedRoute, nextAccountRoute);
  assert.equal(harness.client.getQueryData(["route-detail", "route-1"]), undefined);
  assert.equal(harness.selected.length, 0);
  assert.equal(nativeCalls(harness).length, 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
});

test("사전 알림 준비 도중 계정이 바뀌면 API 전송과 이전 계정 rollback을 막는다", async (t) => {
  const prepared = deferred();
  const harness = createHarness(t, { nativeSync: () => prepared.promise });
  const run = harness.render().skipStop("stop-2", true);
  await waitFor(() => nativeCalls(harness).length === 1);
  harness.changeAccount();
  prepared.resolve(nativeResult(nativeCalls(harness)[0].options));
  assert.equal(await run, false);
  assert.equal(harness.requests.length, 0);
  assert.equal(nativeCalls(harness).length, 1);
  assertUnchanged(harness, harness.route);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
});
