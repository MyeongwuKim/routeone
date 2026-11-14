import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";
import ts from "typescript";

let server;
let modules;
let cache;
let transitionLock;
let routeDisplay;
let transport;
let routeApi;
let notificationSettingsKey;
let nativeSync;
let nativePosition;
let nativePhoto;
let nativeAppInfo;
let nativeUpload;
let authToken;
const storage = new Map();
const originalGlobals = new Map(["window", "localStorage", "fetch"].map((name) => [
  name, Object.getOwnPropertyDescriptor(globalThis, name),
]));
const hookUrl = new URL("../src/features/my-route/hooks/useRouteStopVisitMutation.ts", import.meta.url);
const progressUrl = new URL("../src/features/my-route/hooks/useRouteVisitProgress.ts", import.meta.url);

function compile(url, dependencies) {
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", compiled.outputText)((specifier) => {
    assert.ok(Object.hasOwn(dependencies, specifier), `Unexpected import: ${specifier}`);
    return dependencies[specifier];
  }, exports);
  return exports;
}

before(async () => {
  const windowEvents = new EventTarget();
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  for (const [name, value] of Object.entries({
    localStorage,
    window: {
      atob: globalThis.atob,
      addEventListener: windowEvents.addEventListener.bind(windowEvents),
      dispatchEvent: windowEvents.dispatchEvent.bind(windowEvents),
      localStorage,
      RouteOneNative: {
        getAppInfo: () => nativeAppInfo(),
        syncRouteArrivalNotifications: (options) => nativeSync(options),
        getCurrentPosition: (options) => nativePosition(options),
        takeVisitPhoto: (options) => nativePhoto(options),
        uploadVisitPhoto: (options) => nativeUpload(options),
      },
    },
    fetch() { throw new Error("방문 회귀 테스트에서 외부 요청을 실행할 수 없습니다."); },
  })) Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  // Hook와 progress의 React 호출만 작은 렌더 harness에 연결한다. 서비스·캐시·journal은 실제 모듈이다.
  modules = {};
  const source = ts.createSourceFile("hook.ts", readFileSync(hookUrl, "utf8"), ts.ScriptTarget.Latest, true);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier.text;
    if (["@tanstack/react-query", "./useRouteVisitProgress"].includes(specifier)) continue;
    const path = specifier.startsWith("@/") ? `/src/${specifier.slice(2)}` :
      `/src/features/my-route/${specifier.slice(3)}`;
    modules[specifier] = await server.ssrLoadModule(path);
  }
  authToken = await server.ssrLoadModule("/src/lib/authToken.ts");
  cache = modules["../myRouteCache"];
  transitionLock = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalTransitionLock.ts");
  routeDisplay = await server.ssrLoadModule("/src/features/my-route/routeDisplay.ts");
  transport = await server.ssrLoadModule("/src/lib/graphqlClient.ts");
  ({ routeApi } = modules["@/api/routeApi"]);
  ({ NOTIFICATION_SETTINGS_QUERY_KEY: notificationSettingsKey } = modules["@/api/notificationApi"]);
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
  const startedAt = `${today}T00:00:00.000Z`;
  const stops = [1, 2, 3].map((order) => ({
    id: `stop-${order}`, order, visitStatus: "PENDING", visitedAt: null,
    verifiedAt: null, verificationStatus: "NONE", checkedInAt: null, checkedOutAt: null,
    actualStayMinutes: null, verificationPhotoImageId: null, verificationPhotoUrl: null,
    verificationPhotoPublicationConsent: false, verificationPhotoPublishedAt: null,
    verificationLat: null, verificationLng: null, verificationAccuracyMeters: null,
    stayMinutes: 60, travelMinutesFromPrevious: 10,
    place: { id: `place-${order}`, contentId: `place-${order}`, contentTypeId: "12",
      title: `${order}번 테스트 장소`, lat: 37 + order / 100, lng: 127 + order / 100,
      images: [], categoryName: "자연", address: "테스트 주소" },
  }));
  return { id: "route-1", title: "방문 검증 일정", isMine: true,
    status: "ACTIVE", visibility: "PRIVATE", sharedAt: null, startedAt, completedAt: null,
    travelStartDate: today, travelEndDate: today, tripDays: 1, dailyStartMinutes: 540,
    totalStopCount: stops.length, completedStopCount: 0,
    days: [{ id: "day-1", dayIndex: 1, date: today, startedAt, stops }], stops };
}

function savedRoute(route, changes) {
  const days = route.days.map((day) => ({ ...day,
    stops: day.stops.map((stop) => ({ ...stop, ...changes[stop.id] })),
  }));
  return { ...route, days, stops: days.flatMap((day) => day.stops) };
}

function nativeResult(options) {
  return { activeCount: options.places.length, pendingCount: options.places.length,
    registrationStatus: options.places.length ? "registered" : "inactive",
    backgroundLocationStatus: "system-managed", notificationStatus: "granted" };
}

function createHarness(t, options = {}) {
  transitionLock.clearRouteArrivalTransitions();
  storage.clear();
  const route = options.route ?? createRoute();
  const events = [];
  const requests = [];
  const dialogs = {};
  let orderedStops = route.days[0].stops;
  let language = "ko";
  let mutationCursor = 0;
  let reactCursor = 0;
  const cells = [];
  const observers = [];
  const unsubscribes = [];
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity },
  } });
  client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [route] });
  client.setQueryData(notificationSettingsKey, { notificationSettings: { routeArrivalEnabled: true } });
  for (const key of [cache.MY_ROUTE_HISTORY_QUERY_KEY, ["place-photos", "place-1-12"], ["place-stay-summary", "place-1-12"]]) {
    client.setQueryData(key, { marker: "cached" });
  }
  const unsubscribeCache = client.getQueryCache().subscribe((event) => {
    if (event.type === "updated") events.push({ kind: "cache", action: event.action.type,
      key: event.query.queryKey, data: event.query.state.data });
  });
  nativeAppInfo = async () => {
    events.push({ kind: "app-info" });
    return options.appInfo ? options.appInfo() : grantedAppInfo();
  };
  nativeSync = async (syncOptions) => {
    events.push({ kind: "native", ids: syncOptions.places.map((place) => place.stopId), options: syncOptions });
    return options.nativeSync ? options.nativeSync(syncOptions, events) : nativeResult(syncOptions);
  };
  nativePosition = async (request) => {
    events.push({ kind: "position", request });
    if (options.position) return options.position();
    return { lat: route.stops[0].place.lat, lng: route.stops[0].place.lng,
      accuracyMeters: 5, timestamp: Date.now() };
  };
  nativePhoto = async ({ source }) => {
    events.push({ kind: "photo", source });
    if (options.photo) return options.photo();
    return { dataUrl: "data:image/jpeg;base64,YQ==", uploadedImageUrl: "https://example.test/photo.jpg" };
  };
  nativeUpload = async (request) => {
    events.push({ kind: "upload-transfer", request });
    return options.transfer?.(request);
  };
  const responseKeys = {
    markRouteStopVisited: "markRouteStopVisited", completeRouteStopVisit: "completeRouteStopVisit",
    checkInRouteStop: "checkInRouteStop", createRouteStopVisitPhotoUpload: "createRouteStopVisitPhotoUpload",
    setRouteStopPhotoPublication: "setRouteStopPhotoPublication", setRouteStopVisitPhoto: "setRouteStopVisitPhoto",
    deleteRouteStopVisitPhoto: "deleteRouteStopVisitPhoto", updateRouteStopVisitTimes: "updateRouteStopVisitTimes",
  };
  for (const [name, key] of Object.entries(responseKeys)) t.mock.method(routeApi, name, async (...args) => {
    const request = { name, args };
    requests.push(request);
    events.push({ kind: "api", request });
    const result = name === "createRouteStopVisitPhotoUpload" ? await options.upload?.(request) ?? { imageId: "image-1", imageUrl: "https://example.test/photo.jpg" } :
      await options.respond?.(request);
    if (!result) throw new Error("이 테스트에는 서버 응답 fixture가 필요합니다.");
    return { [key]: result };
  });
  t.mock.method(routeApi, "routeById", async (routeId) => {
    requests.push({ name: "routeById", args: [routeId] });
    events.push({ kind: "reread" });
    return { route: await options.reread?.() };
  });
  const react = {
    useRef(initial) {
      const index = reactCursor++;
      cells[index] ??= { current: initial };
      return cells[index];
    },
    useState(initial) {
      const index = reactCursor++;
      if (!(index in cells)) cells[index] = initial;
      return [cells[index], (value) => {
        cells[index] = typeof value === "function" ? value(cells[index]) : value;
        events.push({ kind: "progress", value: cells[index] });
      }];
    },
  };
  const progress = compile(progressUrl, { react });
  const useHook = compile(hookUrl, { ...modules,
    "@tanstack/react-query": {
      useQueryClient: () => client,
      useMutation(mutationOptions) {
        const index = mutationCursor++;
        if (!observers[index]) {
          observers[index] = new MutationObserver(client, mutationOptions);
          unsubscribes.push(observers[index].subscribe(() => {}));
        } else observers[index].setOptions(mutationOptions);
        const observer = observers[index];
        return { ...observer.getCurrentResult(), mutateAsync: observer.mutate.bind(observer),
          mutate(...args) { void observer.mutate(...args).catch(() => {}); } };
      },
    },
    "./useRouteVisitProgress": progress,
    "@/stores/uiToastStore": { useUiToastStore: (select) => select({ showToast: (...args) => events.push({ kind: "toast", args }) }) },
    "@/stores/appLanguageStore": { useAppLanguageStore: (select) => select({ language }) },
  }).useRouteStopVisitMutation;
  function setDialog(name) { return (value) => { dialogs[name] = value; events.push({ kind: name, value }); }; }
  function render() {
    mutationCursor = 0;
    reactCursor = 0;
    return useHook({ route, routeId: route.id, activeDayId: "day-1", orderedStops,
      isRetrospectiveCompletion: options.retrospective ?? false,
      setOrderedStops(value) { orderedStops = typeof value === "function" ? value(orderedStops) : value; events.push({ kind: "ordered", value: orderedStops }); },
      setBaseStopIds: (value) => events.push({ kind: "base", value }),
      setVisitCompletionTarget: setDialog("completion"), setActualStayMinutesTarget: setDialog("stay"),
      setPhotoPublicationTarget: setDialog("publication"), setVerificationPhotoPreviewTarget: setDialog("preview"),
      setVisitTimesEditTarget: setDialog("times"),
    });
  }
  t.after(() => {
    unsubscribes.forEach((unsubscribe) => unsubscribe()); unsubscribeCache(); client.clear();
    transitionLock.clearRouteArrivalTransitions(); storage.clear();
  });
  return { route, requests, events, dialogs, client, render,
    target: { routeDay: route.days[0], stop: route.stops[0] },
    get orderedStops() { return orderedStops; },
    get cachedRoute() { return client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes[0]; },
    get pending() { return observers.some((observer) => observer.getCurrentResult().isPending); },
    changeLanguage(value) { language = value; },
  };
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 60 && !check(); attempt += 1) await flushTasks();
  assert.ok(check(), "비동기 mutation이 예상 단계에 도달해야 합니다.");
}
function nativeCalls(harness) { return harness.events.filter((event) => event.kind === "native"); }
function visited(route, id = "stop-1") { return savedRoute(route, { [id]: {
  visitStatus: "VISITED", visitedAt: route.startedAt, verificationStatus: "MANUAL", actualStayMinutes: 30,
} }); }
function definiteFailure() { return new transport.GraphQLRequestError("저장 거절", {
  retryable: false, status: 400, code: "USER_FACING_ERROR",
}); }
function timeoutFailure() { return new transport.GraphQLRequestError("시간 초과", { retryable: true }); }
function quiet(t) { t.mock.method(console, "warn", () => {}); }

for (const source of ["gps", "camera", "library"]) test(`${source} 인증은 실제 위치·사진 검증과 check-in/수동 기록 경로를 유지한다`, async (t) => {
  const route = createRoute();
  let harness;
  harness = createHarness(t, { route, respond: ({ args }) => savedRoute(route, { "stop-1": {
    checkedInAt: route.startedAt, verificationStatus: args[1].status,
    verificationPhotoImageId: args[1].photoImageId, verificationPhotoUrl: args[1].photoUrl,
  } }) });
  const hook = harness.render();
  if (source === "gps") hook.completeStopVisitWithGps(harness.target);
  else hook.completeStopVisitWithPhoto(harness.target, source);
  await waitFor(() => harness.events.some((event) => event.kind === (source === "library" ? "stay" : "completion")));
  await waitFor(() => !harness.pending);
  assert.equal(harness.events.filter((event) => event.kind === "position").length, source === "library" ? 0 : 1);
  assert.equal(nativeCalls(harness).length, 0);
  if (source === "library") {
    assert.equal(harness.dialogs.stay.verification.status, "MANUAL");
    assert.equal(harness.requests.some((request) => request.name === "checkInRouteStop"), false);
  } else {
    const request = harness.requests.find((request) => request.name === "checkInRouteStop");
    assert.equal(request.args[1].status, source === "gps" ? "GPS" : "GPS_PHOTO");
    assert.equal(harness.cachedRoute.stops[0].checkedInAt, route.startedAt);
    assert.equal(harness.dialogs.completion, null);
    if (source === "camera") assert.equal(harness.dialogs.publication.stop.verificationPhotoUrl, "https://example.test/photo.jpg");
  }
});

for (const nextVisited of [true, false]) test(`완료=${nextVisited} 요청은 API 대기 중 낙관적 목록·캐시를 반영하고 저장 뒤 알림을 확정한다`, async (t) => {
  const route = nextVisited ? createRoute() : visited(createRoute());
  const response = deferred();
  const finalSync = deferred();
  let count = 0;
  const harness = createHarness(t, { route, respond: () => response.promise,
    nativeSync(options) { return ++count === 2 ? finalSync.promise : nativeResult(options); } });
  const hook = harness.render();
  const run = hook.persistStopVisit(harness.target.routeDay, harness.target.stop, nextVisited);
  assert.equal(await hook.persistStopVisit(harness.target.routeDay, harness.target.stop, nextVisited), false);
  await waitFor(() => harness.requests.length === 1);
  assert.equal(harness.orderedStops[0].visitStatus, nextVisited ? "VISITED" : "PENDING");
  assert.equal(harness.cachedRoute.stops[0].visitStatus, nextVisited ? "VISITED" : "PENDING");
  assert.ok(transitionLock.getUnresolvedRouteArrivalTransitions()[0].readyAt >= Date.now() + 29_000);
  assert.deepEqual(nativeCalls(harness)[0].ids, nextVisited ? ["stop-1", "stop-2"] : ["stop-2", "stop-1"]);
  const saved = nextVisited ? visited(route) : savedRoute(route, { "stop-1": { visitStatus: "PENDING", visitedAt: null } });
  response.resolve(saved);
  await waitFor(() => nativeCalls(harness).length === 2);
  assert.equal(harness.cachedRoute.stops[0].visitStatus, saved.stops[0].visitStatus);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  assert.equal(harness.render().visitProgress.isSaved, true);
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, nextVisited), false);
  finalSync.resolve(nativeResult(nativeCalls(harness)[1].options));
  assert.equal(await run, true);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  assert.equal(harness.render().visitProgress, null);
  assert.ok(harness.client.getQueryState(cache.MY_ROUTE_HISTORY_QUERY_KEY).isInvalidated);
  assert.ok(harness.client.getQueryState(["place-stay-summary", "place-1-12"]).isInvalidated);
});

test("체류 완료는 check-in 상태를 API 확정까지 유지하고 준비·저장·알림 진행을 연결한다", async (t) => {
  const route = savedRoute(createRoute(), { "stop-1": { checkedInAt: "2026-01-01T00:00:00Z", verificationStatus: "GPS" } });
  const response = deferred();
  const harness = createHarness(t, { route, respond: () => response.promise,
    nativeSync(options) { options.onProgress?.("locating"); return nativeResult(options); } });
  const run = harness.render().saveActualStayMinutes(harness.target, 45);
  await waitFor(() => harness.requests.length === 1);
  assert.deepEqual(harness.requests[0], { name: "completeRouteStopVisit", args: ["stop-1", 45] });
  assert.equal(harness.cachedRoute.stops[0].visitStatus, "PENDING");
  assert.equal(harness.orderedStops[0].visitStatus, "PENDING");
  assert.equal(harness.render().visitProgress.stage, "saving");
  response.resolve(visited(route));
  assert.equal(await run, true);
  assert.equal(harness.dialogs.stay, null);
  assert.equal(harness.cachedRoute.stops[0].visitStatus, "VISITED");
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
  assert.deepEqual(nativeCalls(harness).map((call) => call.options.checkCurrentPosition), [false, true]);
});

test("준비 실패는 저장 API를 보내지 않고 이전 알림·낙관적 상태를 되돌린다", async (t) => {
  quiet(t);
  let calls = 0;
  const harness = createHarness(t, { nativeSync(options) {
    if (++calls === 1) throw new Error("기기 준비 실패");
    return nativeResult(options);
  } });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), false);
  assert.equal(harness.requests.length, 0);
  assert.deepEqual(harness.cachedRoute, harness.route);
  assert.deepEqual(harness.orderedStops, harness.route.stops);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-1", "stop-2"], ["stop-1"]]);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("확정 실패는 재조회 없이 이전 알림과 화면을 복원한다", async (t) => {
  const harness = createHarness(t, { respond() { throw definiteFailure(); } });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), false);
  assert.deepEqual(harness.requests.map((request) => request.name), ["markRouteStopVisited"]);
  assert.deepEqual(harness.cachedRoute, harness.route);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-1", "stop-2"], ["stop-1"]]);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
  assert.ok(harness.events.some((event) => event.kind === "progress" && event.value?.stage === "recovering"));
});

for (const rereadFails of [false, true]) test(`방문 충돌은 재전송하지 않고 최신 목록을 조회한다 (재조회 실패 ${rereadFails})`, async t => {
  const route = createRoute();
  const latest = savedRoute(route, { "stop-1": { visitStatus: "SKIPPED" } });
  const conflict = new transport.GraphQLRequestError("다른 요청에서 방문 기록이 변경됐어요.", {
    retryable: false, status: 409, code: "USER_FACING_ERROR",
  });
  const h = createHarness(t, { route, respond() { throw conflict; }, reread() {
    if (rereadFails) throw timeoutFailure();
    return latest;
  } });
  assert.equal(await h.render().persistStopVisit(h.target.routeDay, h.target.stop, true), false);
  assert.deepEqual(h.requests.map(request => request.name), ["markRouteStopVisited", "routeById"]);
  assert.equal(h.client.getQueryState(cache.MY_ROUTES_QUERY_KEY).isInvalidated, true);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, rereadFails ? 1 : 0);
  assert.deepEqual(nativeCalls(h).map(call => call.ids), rereadFails
    ? [["stop-1", "stop-2"]] : [["stop-1", "stop-2"], ["stop-2"]]);
  assert.ok(h.events.some(event => event.kind === "toast" && event.args[0] === conflict.message));
});

for (const confirmed of [true, false]) test(`시간 초과 재조회 확정=${confirmed}에 맞춰 저장 또는 journal 보존을 선택한다`, async (t) => {
  const route = createRoute();
  const harness = createHarness(t, { route, respond() { throw timeoutFailure(); },
    reread: () => confirmed ? visited(route) : route });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), confirmed);
  assert.deepEqual(harness.requests.map((request) => request.name), ["markRouteStopVisited", "routeById"]);
  assert.equal(harness.cachedRoute.stops[0].visitStatus, confirmed ? "VISITED" : "PENDING");
  assert.equal(nativeCalls(harness).length, confirmed ? 2 : 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, confirmed ? 0 : 1);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), !confirmed);
  if (!confirmed) assert.ok(harness.events.some((event) => event.kind === "toast" && event.args[0].includes("여부를 확인 중")));
});

test("최종 알림 실패는 저장된 결과와 성공 안내를 유지하고 복구 journal을 남긴다", async (t) => {
  quiet(t);
  const route = createRoute();
  let calls = 0;
  const harness = createHarness(t, { route, respond: () => visited(route), nativeSync(options) {
    if (++calls === 2) throw new Error("최종 등록 실패");
    return nativeResult(options);
  } });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), true);
  assert.equal(harness.cachedRoute.stops[0].visitStatus, "VISITED");
  assert.equal(harness.orderedStops[0].visitStatus, "VISITED");
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 1);
  const toasts = harness.events.filter((event) => event.kind === "toast");
  assert.equal(toasts[0].args[0], "장소를 완료 처리했어요.");
  assert.match(toasts[1].args[0], /장소 상태는 저장했지만/);
});

test("최종 알림은 저장 뒤 최신 알림 설정과 목록을 다시 읽는다", async (t) => {
  const route = createRoute();
  const response = deferred();
  const harness = createHarness(t, { route, respond: () => response.promise });
  const run = harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true);
  await waitFor(() => harness.requests.length === 1);
  harness.client.setQueryData(notificationSettingsKey, { notificationSettings: { routeArrivalEnabled: false } });
  response.resolve(visited(route));
  assert.equal(await run, true);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-1", "stop-2"], []]);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
});


test("API 대기 중 언어를 변경하면 준비는 요청 언어, 최종 동기화는 최신 렌더 언어를 쓴다", async (t) => {
  const route = createRoute();
  const response = deferred();
  const harness = createHarness(t, { route, respond: () => response.promise });
  const run = harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true);
  await waitFor(() => harness.requests.length === 1);
  harness.changeLanguage("en");
  harness.render();
  response.resolve(visited(route));
  assert.equal(await run, true);
  assert.deepEqual(nativeCalls(harness).map((call) => call.options.language), ["ko", "en"]);
});

for (const failingWrite of [1, 2]) test(`journal ${failingWrite}번째 쓰기 실패는 저장 API를 전송하지 않는다`, async (t) => {
  quiet(t);
  const harness = createHarness(t);
  let writes = 0;
  const setItem = globalThis.localStorage.setItem;
  t.mock.method(globalThis.localStorage, "setItem", (key, value) => {
    if (++writes === failingWrite) throw new Error("테스트 journal 쓰기 실패");
    return setItem(key, value);
  });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), false);
  assert.equal(harness.requests.length, 0);
  assert.deepEqual(harness.cachedRoute, harness.route);
  assert.equal(nativeCalls(harness).length, failingWrite === 1 ? 0 : 1);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, failingWrite === 1 ? 0 : 1);
});

test("확정 실패 뒤 rollback도 실패하면 journal을 남기고 저장 실패 안내를 유지한다", async (t) => {
  quiet(t);
  let calls = 0;
  const harness = createHarness(t, { respond() { throw definiteFailure(); }, nativeSync(options) {
    if (++calls === 2) throw new Error("rollback 실패");
    return nativeResult(options);
  } });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), false);
  assert.deepEqual(harness.cachedRoute, harness.route);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 1);
  assert.equal(harness.events.findLast((event) => event.kind === "toast").args[0], "저장 거절");
});

test("낙관적 조회 취소 대기 중 렌더가 바뀌면 준비·저장은 갱신된 mutation 문맥을 쓴다", async (t) => {
  const route = createRoute();
  const cancellation = deferred();
  const harness = createHarness(t, { route, respond: () => visited(route) });
  let cancelling = false;
  t.mock.method(harness.client, "cancelQueries", () => {
    cancelling = true;
    return cancellation.promise;
  });
  const run = harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true);
  await waitFor(() => cancelling);
  harness.changeLanguage("en");
  harness.render();
  cancellation.resolve();
  assert.equal(await run, true);
  assert.deepEqual(nativeCalls(harness).map((call) => call.options.language), ["en", "en"]);
});

test("일반 준비 오류는 journal을 해제하고 네이티브 rollback 없이 저장을 중단한다", async (t) => {
  quiet(t);
  const harness = createHarness(t);
  t.mock.method(window.RouteOneNative, "getAppInfo", async () => { throw new Error("권한 조회 실패"); });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), false);
  assert.equal(harness.requests.length, 0);
  assert.equal(nativeCalls(harness).length, 0);
  assert.equal(transitionLock.getUnresolvedRouteArrivalTransitions().length, 0);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), false);
});

test("앨범 사진의 완료 저장은 사진 메타데이터와 캐시·알림·공개 입력창 반영 순서를 유지한다", async (t) => {
  const route = createRoute();
  const saved = { ...visited(route), updatedAt: "confirmed" };
  saved.stops[0].verificationPhotoImageId = "image-1";
  saved.stops[0].verificationPhotoUrl = "https://example.test/photo.jpg";
  const harness = createHarness(t, { route, respond: () => saved });
  harness.render().completeStopVisitWithPhoto(harness.target, "library");
  await waitFor(() => harness.dialogs.stay);
  await waitFor(() => !harness.pending);
  const target = harness.dialogs.stay;
  assert.equal(await harness.render().saveActualStayMinutes(target, 30), true);
  const request = harness.requests.find((entry) => entry.name === "markRouteStopVisited");
  assert.deepEqual(request.args, ["stop-1", true, {
    status: "MANUAL", lat: null, lng: null, accuracyMeters: null,
    photoImageId: "image-1", photoUrl: "https://example.test/photo.jpg",
  }, 30]);
  const indexOf = (check) => harness.events.findIndex(check);
  const savedCache = indexOf((event) => event.kind === "cache" && event.data?.myRoutes?.[0]?.updatedAt === "confirmed");
  const toast = indexOf((event) => event.kind === "toast" && event.args[0] === "사진 기록으로 완료 처리했어요.");
  const synced = harness.events.findLastIndex((event) => event.kind === "native");
  const invalidated = indexOf((event) => event.kind === "cache" && event.action === "invalidate" &&
    JSON.stringify(event.key) === JSON.stringify(cache.MY_ROUTE_HISTORY_QUERY_KEY));
  const publication = indexOf((event) => event.kind === "publication");
  const closed = indexOf((event) => event.kind === "stay" && event.value === null);
  assert.ok(savedCache >= 0 && savedCache < toast && toast < synced && synced < invalidated &&
    invalidated < publication && publication < closed);
  assert.equal(harness.dialogs.publication.stop.verificationPhotoImageId, "image-1");
});

test("빈 목록 캐시는 입력 루트를 사전 등록 원본으로 쓰고 저장 뒤 응답을 캐시에 추가한다", async (t) => {
  const route = createRoute();
  const harness = createHarness(t, { route, respond: () => visited(route) });
  harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [] });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), true);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [["stop-1", "stop-2"], ["stop-2"]]);
  assert.equal(harness.cachedRoute.id, route.id);
});

test("최종 알림은 저장 루트가 병합된 최신 목록에서 다른 루트도 유지한다", async (t) => {
  const route = createRoute();
  const harness = createHarness(t, { route, respond: () => visited(route) });
  const other = createRoute();
  other.id = "other-route";
  other.days = other.days.map((day) => ({ ...day, id: `other-${day.id}`,
    stops: day.stops.map((stop) => ({ ...stop, id: `other-${stop.id}` })) }));
  other.stops = other.days.flatMap((day) => day.stops);
  harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [route, other] });
  assert.equal(await harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true), true);
  assert.deepEqual(nativeCalls(harness).map((call) => call.ids), [
    ["stop-1", "other-stop-1", "stop-2"], ["stop-2", "other-stop-1"],
  ]);
  assert.deepEqual(harness.client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes[1], other);
});

test("이전 저장의 최종 알림 응답은 새 generation journal을 해제하지 않는다", async (t) => {
  const route = createRoute();
  const response = deferred();
  const harness = createHarness(t, { route, respond: () => response.promise });
  const run = harness.render().persistStopVisit(harness.target.routeDay, harness.target.stop, true);
  await waitFor(() => harness.requests.length === 1);
  const nextJournal = transitionLock.markRouteArrivalTransitionUnresolved(route.id, {
    expectation: { kind: "stop-visit", stopId: "stop-2", visited: true },
  });
  response.resolve(visited(route));
  assert.equal(await run, true);
  assert.deepEqual(transitionLock.getUnresolvedRouteArrivalTransitions(), [nextJournal]);
  assert.equal(transitionLock.isRouteArrivalTransitionLocked(), true);
  assert.equal(harness.render().visitProgress, null);
});


function switchAccount(harness, { sameToken = false } = {}) {
  if (sameToken) {
    authToken.clearAuthToken();
    authToken.setAuthToken("fixture-account-a");
  } else storage.set("routeone.authToken", "fixture-account-b");
  transitionLock.clearRouteArrivalTransitions();
  harness.client.clear();
  const otherRoute = { ...createRoute(), id: "route-b" };
  harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [otherRoute] });
  harness.client.setQueryData(notificationSettingsKey, { notificationSettings: { routeArrivalEnabled: false } });
  transitionLock.acquireRouteArrivalTransitionLock("route-1");
  const journal = transitionLock.markRouteArrivalTransitionUnresolved("route-1", {
    expectation: { kind: "stop-visit", stopId: "stop-2", visited: true },
  });
  const eventCount = harness.events.length;
  const requestCount = harness.requests.length;
  return () => {
    assert.deepEqual(harness.client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes.map(({ id }) => id), ["route-b"]);
    assert.equal(harness.events.length, eventCount, "이전 세션은 캐시·입력창·토스트·진행·네이티브를 갱신하지 않아야 한다.");
    assert.equal(harness.requests.length, requestCount, "이전 세션은 다음 API 요청을 보내지 않아야 한다.");
    assert.deepEqual(transitionLock.getUnresolvedRouteArrivalTransitions(), [journal]);
    assert.equal(transitionLock.hasActiveRouteArrivalTransition(), true, "이전 요청은 새 세션의 잠금을 해제하면 안 된다.");
  };
}

const accountOperations = {
  visit: (hook, target) => hook.persistStopVisit(target.routeDay, target.stop, true),
  cancel: (hook, target) => hook.persistStopVisit(target.routeDay, { ...target.stop, visitStatus: "VISITED", visitedAt: "2026-01-01" }, false),
  complete: (hook, target) => hook.saveActualStayMinutes({ ...target, stop: { ...target.stop, checkedInAt: "2026-01-01" } }, 30),
  checkIn: (hook, target) => hook.completeStopVisitWithGps(target),
  publication: (hook, target) => hook.setPhotoPublication(target, true),
  deletePhoto: (hook, target) => hook.deleteVerificationPhoto(target),
  replacePhoto: (hook, target) => hook.replaceVerificationPhoto(target),
  times: (hook, target) => hook.updateVisitTimes(target, "2026-01-01", null),
};
for (const [operation, start] of Object.entries(accountOperations)) for (const fails of [false, true]) {
  test(`계정 전환 뒤 ${operation} 지연 ${fails ? "실패" : "성공"} 결과는 새 계정에 반영하지 않는다`, async (t) => {
    const response = deferred();
    const h = createHarness(t, { respond: () => response.promise });
    storage.set("routeone.authToken", "fixture-account-a");
    const run = start(h.render(), h.target);
    await waitFor(() => h.requests.some(({ name }) => name !== "createRouteStopVisitPhotoUpload"));
    const assertUnchanged = switchAccount(h);
    if (fails) response.reject(definiteFailure());
    else response.resolve(visited(h.route));
    const result = run ? await run : undefined;
    await waitFor(() => !h.pending);
    assertUnchanged();
    if (run) assert.equal(result, false);
  });
}

test("같은 토큰으로 다시 로그인해도 이전 방문 요청은 새 세션에 반영하지 않는다", async (t) => {
  const response = deferred();
  const h = createHarness(t, { respond: () => response.promise });
  authToken.setAuthToken("fixture-account-a");
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => h.requests.length === 1);
  const assertUnchanged = switchAccount(h, { sameToken: true });
  response.resolve(visited(h.route));
  assert.equal(await run, false);
  assertUnchanged();
});

test("낙관적 조회 취소 대기 중 계정을 바꾸면 준비와 저장을 시작하지 않는다", async (t) => {
  const cancel = deferred();
  const h = createHarness(t, { respond: () => visited(h.route) });
  storage.set("routeone.authToken", "fixture-account-a");
  t.mock.method(h.client, "cancelQueries", () => cancel.promise);
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => h.events.some(({ kind }) => kind === "ordered"));
  const assertUnchanged = switchAccount(h);
  cancel.resolve();
  assert.equal(await run, false);
  assertUnchanged();
});

test("알림 준비 대기 중 계정을 바꾸면 저장·rollback·journal 해제를 실행하지 않는다", async (t) => {
  const prepared = deferred();
  const h = createHarness(t, { nativeSync: () => prepared.promise });
  storage.set("routeone.authToken", "fixture-account-a");
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => nativeCalls(h).length === 1);
  const assertUnchanged = switchAccount(h);
  prepared.resolve(nativeResult(nativeCalls(h)[0].options));
  assert.equal(await run, false);
  assertUnchanged();
});

for (const stage of ["position", "photo", "upload"]) test(`사진 ${stage} 대기 중 계정을 바꾸면 다음 단계와 UI 반영을 중단한다`, async (t) => {
  const response = deferred();
  const h = createHarness(t, {
    position: stage === "position" ? () => response.promise : undefined,
    photo: stage === "photo" ? () => response.promise : undefined,
    upload: stage === "upload" ? () => response.promise : undefined,
    respond: () => visited(h.route),
  });
  storage.set("routeone.authToken", "fixture-account-a");
  h.render().completeStopVisitWithPhoto(h.target, "camera");
  await waitFor(() => h.events.some(({ kind, request }) => stage === "upload"
    ? kind === "api" && request.name === "createRouteStopVisitPhotoUpload" : kind === stage));
  const assertUnchanged = switchAccount(h);
  response.resolve(stage === "position" ? { lat: h.target.stop.place.lat, lng: h.target.stop.place.lng, accuracyMeters: 5, timestamp: Date.now() }
    : stage === "photo" ? { dataUrl: "data:image/jpeg;base64,YQ==", uploadedImageUrl: "https://example.test/photo.jpg" }
      : { imageId: "image-1", imageUrl: "https://example.test/photo.jpg" });
  await waitFor(() => !h.pending);
  assertUnchanged();
});


function grantedAppInfo() {
  return { platform: "ios", capabilities: [], locationPermissionStatus: "granted",
    locationAccuracy: "full", notificationPermissionStatus: "granted" };
}

test("권한 상태 조회 대기 중 계정을 바꾸면 이전 장소의 네이티브 등록을 시작하지 않는다", async (t) => {
  const response = deferred();
  const h = createHarness(t, { appInfo: () => response.promise });
  storage.set("routeone.authToken", "fixture-account-a");
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => h.events.some(({ kind }) => kind === "app-info"));
  const assertUnchanged = switchAccount(h);
  response.resolve(grantedAppInfo());
  assert.equal(await run, false);
  assertUnchanged();
});

for (const phase of ["prepare", "saved", "rollback"]) test(`${phase} 알림 설정 조회 대기 중 계정을 바꾸면 이전 네이티브 등록을 시작하지 않는다`, async (t) => {
  const settings = deferred();
  let settingsRequested = false;
  const h = createHarness(t, { respond: () => {
    if (phase !== "prepare") h.client.removeQueries({ queryKey: notificationSettingsKey });
    if (phase === "rollback") throw definiteFailure();
    return visited(h.route);
  } });
  const notificationApi = modules["@/api/notificationApi"].notificationApi;
  t.mock.method(notificationApi, "settings", () => { settingsRequested = true; return settings.promise; });
  storage.set("routeone.authToken", "fixture-account-a");
  if (phase === "prepare") h.client.removeQueries({ queryKey: notificationSettingsKey });
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => settingsRequested);
  const assertUnchanged = switchAccount(h);
  settings.resolve({ notificationSettings: { routeArrivalEnabled: true } });
  assert.equal(await run, false);
  assertUnchanged();
});

test("최종 알림 응답과 진행 콜백은 계정 전환 뒤 새 journal과 화면을 건드리지 않는다", async (t) => {
  const response = deferred();
  let syncCount = 0;
  const h = createHarness(t, { respond: () => visited(h.route), nativeSync: (options) => {
    syncCount += 1;
    return syncCount === 1 ? nativeResult(options) : response.promise;
  } });
  storage.set("routeone.authToken", "fixture-account-a");
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true, {
    status: "MANUAL", photoImageId: "image-1", photoUrl: "https://example.test/photo.jpg",
  });
  await waitFor(() => nativeCalls(h).length === 2);
  const assertUnchanged = switchAccount(h);
  const finalSync = nativeCalls(h)[1].options;
  finalSync.onProgress("locating");
  response.resolve(nativeResult(finalSync));
  assert.equal(await run, false);
  assertUnchanged();
});

for (const eventType of ["native", "storage"]) test(`${eventType} 세션 변경 이벤트는 토큰이 같아도 이전 요청을 무효화한다`, (t) => {
  createHarness(t);
  authToken.setAuthToken("fixture-account-a");
  const request = authToken.createAuthSessionRequest();
  assert.equal(request.isCurrent(), true);
  const event = new Event(eventType === "native" ? authToken.AUTH_SESSION_CHANGE_EVENT : "storage");
  if (eventType === "storage") Object.defineProperty(event, "key", { value: "routeone.authToken" });
  window.dispatchEvent(event);
  assert.equal(request.isCurrent(), false);
});


test("세션 토큰 갱신만으로 무효화된 방문 요청도 자신이 획득한 실행 잠금은 해제한다", async (t) => {
  const response = deferred();
  const h = createHarness(t, { respond: () => response.promise });
  authToken.setAuthToken("fixture-account-a");
  const run = h.render().persistStopVisit(h.target.routeDay, h.target.stop, true);
  await waitFor(() => h.requests.length === 1);
  authToken.setAuthToken("fixture-account-a-refreshed");
  const journal = transitionLock.getUnresolvedRouteArrivalTransitions();
  response.resolve(visited(h.route));
  assert.equal(await run, false);
  assert.equal(h.render().visitProgress, null, "현재 Hook에 남은 이전 요청의 진행 표시도 정리한다.");
  assert.equal(transitionLock.hasActiveRouteArrivalTransition(), false,
    "전환 초기화 없이 토큰만 갱신되어도 이전 실행 잠금은 남으면 안 된다.");
  assert.deepEqual(transitionLock.getUnresolvedRouteArrivalTransitions(), journal,
    "확정 결과를 반영하지 않은 journal은 재조회 복구용으로 유지한다.");
});


for (const replace of [false, true]) test(`사진 ${replace ? "교체" : "인증"} 업로드 대기 중 계정을 바꾸면 웹 재전송을 시작하지 않는다`, async (t) => {
  const response = deferred();
  const h = createHarness(t, {
    photo: () => ({ uri: "fixture://photo.jpg", dataUrl: "data:image/jpeg;base64,YQ==" }),
    upload: () => ({ imageId: "image-1", imageUrl: "https://example.test/photo.jpg", uploadUrl: "https://upload.imagedelivery.net/fixture", fileName: "fixture.jpg" }),
    transfer: () => response.promise,
  });
  let uploads = 0;
  t.mock.method(globalThis, "fetch", async () => { uploads += 1; throw new Error("이전 계정의 업로드를 재전송하면 안 됩니다."); });
  storage.set("routeone.authToken", "fixture-account-a");
  const hook = h.render();
  if (replace) hook.replaceVerificationPhoto(h.target);
  else hook.completeStopVisitWithPhoto(h.target, "camera");
  await waitFor(() => h.events.some(({ kind }) => kind === "upload-transfer"));
  const assertUnchanged = switchAccount(h);
  response.resolve(null);
  await waitFor(() => !h.pending);
  assert.equal(uploads, 0);
  assertUnchanged();
});
