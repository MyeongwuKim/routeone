import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";
import ts from "typescript";

let server;
let checkout;
let routeApi;
let cache;
let routeDisplay;
let dateConflict;
let transport;
let text;
let draftStore;
let authUserStore;
let authToken;
const storage = new Map();
const originalGlobals = new Map(
  ["window", "localStorage", "fetch"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);

function loadSource(path, modules) {
  const source = readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", compiled.outputText)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return exports;
}

before(async () => {
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  for (const [name, value] of Object.entries({
    localStorage,
    window: { localStorage, setTimeout(callback) { callback(); return 0; } },
    fetch() { throw new Error("초안 수명 테스트에서 외부 요청을 실행할 수 없습니다."); },
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
  checkout = await server.ssrLoadModule("/src/api/routeCheckoutApi.ts");
  ({ routeApi } = await server.ssrLoadModule("/src/api/routeApi.ts"));
  cache = await server.ssrLoadModule("/src/features/my-route/myRouteCache.ts");
  routeDisplay = await server.ssrLoadModule("/src/features/my-route/routeDisplay.ts");
  dateConflict = await server.ssrLoadModule("/src/features/route-checkout/utils/routeDateConflict.ts");
  transport = await server.ssrLoadModule("/src/lib/graphqlClient.ts");
  ({ getUiText: text } = await server.ssrLoadModule("/src/lib/uiText.ts"));
  text = text("ko");
  ({ useRouteCheckoutDraftStore: draftStore } = await server.ssrLoadModule("/src/stores/routeCheckoutDraftStore.ts"));
  ({ useAuthUserStore: authUserStore } = await server.ssrLoadModule("/src/stores/authUserStore.ts"));
  authToken = await server.ssrLoadModule("/src/lib/authToken.ts");
});

after(async () => {
  await server?.close();
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

function createInput() {
  const place = {
    id: "draft-place", contentId: "draft-place", contentTypeId: "12",
    areaCode: "32", signguCode: "1", touristTrendName: "", topRank: null,
    title: "초안 장소", address: "테스트 주소", lat: 37.78, lng: 128.88,
    contentTypeLabel: "관광지", categoryName: "자연", icon: "📍", images: [],
  };
  return {
    routePlan: [{ day: 1, items: [{ place, stayMinutes: 60, travelMinutesFromPrevious: 8 }] }],
    travelStartDate: "2027-09-04", tripDays: 1,
    dailyStartMinutes: 540, scheduleEndMinutes: 1080,
    startLocation: { lat: 37.77, lng: 128.87 },
  };
}

function createSavedRoute() {
  return {
    id: "saved-route", title: "저장된 루트", status: "DRAFT", tripDays: 1,
    travelStartDate: "2027-09-04", totalStopCount: 1,
    days: [{ id: "saved-day", dayIndex: 1, date: "2027-09-04", stops: [] }],
  };
}

function createHarness(t, options = {}) {
  const input = options.input ?? createInput();
  const events = [];
  const requests = [];
  const modals = [];
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [] });
  t.after(() => client.clear());
  let authenticated = options.authenticated ?? true;
  let saving = false;
  let savedAttempt = options.createAttempt ?? null;
  let respond = options.respond ?? (() => ({ createRoute: createSavedRoute() }));
  let hook;

  const context = {
    draftId: "draft-1",
    appendTarget: options.appendTarget ?? null,
    createAttempt: savedAttempt,
    setCreateAttempt(attempt) {
      savedAttempt = structuredClone(attempt);
      events.push("persist-attempt");
    },
    clearDraft() { events.push("clear-draft"); },
    isRouteSaveInFlight: () => saving,
    startSavingRoute() { saving = true; return true; },
    finishSavingRoute() { saving = false; events.push("finished"); },
  };
  // Hook과 본문 변환은 실제 코드를 실행하고 외부 API 전송만 대체한다.
  t.mock.method(routeApi, "createRoute", async body => {
    assert.equal(savedAttempt?.requestId, body.clientRequestId, "API 호출 전에 요청 ID를 보관해야 합니다.");
    requests.push({ kind: "create", body: structuredClone(body), requestId: body.clientRequestId });
    events.push("request");
    return respond(body);
  });
  t.mock.method(routeApi, "appendRouteDays", async body => {
    requests.push({ kind: "append", body: structuredClone(body), routeId: body.routeId });
    return respond(body);
  });
  const modules = {
    "@tanstack/react-query": { useQueryClient: () => client },
    "react-router-dom": { useNavigate: () => (path) => events.push(["navigate", path]) },
    "@/api/routeCheckoutApi": checkout,
    "@/api/routeApi": { routeApi: { myRoutes: async () => ({ myRoutes: [] }) } },
    "@/features/my-route/myRouteCache": cache,
    "@/features/my-route/routeDisplay": routeDisplay,
    "@/lib/graphqlClient": transport,
    "@/lib/authToken": { getAuthToken: () => authenticated ? "test-token" : null },
    "@/lib/uiText": { useUiText: () => text },
    "@/hooks/useLoginRequest": { useLoginRequest: () => (...args) => events.push(["login", ...args]) },
    "@/stores/routeEditFlowStore": {
      useRouteEditFlowStore(selector) {
        return selector({
          appendTarget: { routeId: "unrelated-global-route", routeTitle: "다른 대상" },
          clearAppendTarget() { events.push("clear-append"); },
        });
      },
    },
    "@/stores/uiModalStore": { useUiModalStore: (select) => select({ openModal: (modal) => modals.push(modal) }) },
    "@/stores/uiToastStore": { useUiToastStore: (select) => select({ showToast: (...args) => events.push(["toast", ...args]) }) },
    "../utils/routeDateConflict": dateConflict,
    "./useRouteCheckout": { useRouteCheckout: () => context },
  };
  function mount() {
    const refs = [];
    let cursor = 0;
    context.createAttempt = savedAttempt;
    const { useRouteCheckoutSave } = loadSource("features/route-checkout/hooks/useRouteCheckoutSave.ts", {
      ...modules,
      react: {
        useCallback: (callback) => callback,
        useRef(initialValue) {
          const index = cursor++;
          refs[index] ??= { current: initialValue };
          return refs[index];
        },
      },
    });
    cursor = 0;
    hook = useRouteCheckoutSave({
      input, canSave: true,
      onClose() { events.push("close"); },
      onClearPlaces() {
        assert.ok(client.getQueryData(cache.MY_ROUTES_QUERY_KEY)?.myRoutes.length);
        events.push("clear-places");
      },
      onChooseDate() { events.push("choose-date"); },
    });
  }
  mount();
  return {
    input, events, requests, modals, client,
    get savedAttempt() { return savedAttempt; },
    authenticate() { authenticated = true; },
    respondWith(response) { respond = response; },
    remount() { savedAttempt = JSON.parse(JSON.stringify(savedAttempt)); mount(); },
    async save() { hook.handleSaveRoute(); await flushTasks(); },
  };
}

test("생성 성공 뒤에만 캐시를 반영하고 초안과 담은 장소를 정리한다", async (t) => {
  const harness = createHarness(t);
  await harness.save();
  assert.equal(harness.requests.length, 1);
  assert.equal(harness.requests[0].kind, "create");
  assert.deepEqual(harness.events.filter((event) => typeof event === "string"), [
    "persist-attempt", "request", "clear-draft", "clear-append", "clear-places", "close", "finished",
  ]);
  assert.equal(harness.client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes[0].id, "saved-route");
});

test("생성 실패는 요청 ID와 초안을 보존하고 편집 내용이 달라지면 새 ID로 저장한다", async (t) => {
  const harness = createHarness(t, { respond() { throw new Error("저장 실패"); } });
  await harness.save();
  const firstId = harness.savedAttempt.requestId;
  assert.equal(harness.events.includes("clear-draft"), false);
  assert.equal(harness.events.includes("close"), false);
  harness.input.dailyStartMinutes += 30;
  await harness.save();
  assert.notEqual(harness.savedAttempt.requestId, firstId);
});

test("응답 시간 초과 후 재실행한 저장은 동일 요청 ID를 사용하며 이미 저장된 날짜와 충돌하지 않는다", async (t) => {
  const harness = createHarness(t, {
    respond() { throw new transport.GraphQLRequestError("시간 초과", { retryable: true }); },
  });
  await harness.save();
  const requestId = harness.savedAttempt.requestId;
  assert.equal(harness.events.includes("clear-draft"), false);
  assert.ok(harness.events.some((event) => Array.isArray(event) && event[1] === text.cart.routeSaveUnconfirmedError));
  harness.remount();
  harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [createSavedRoute()] });
  harness.respondWith(() => ({ createRoute: createSavedRoute() }));
  await harness.save();
  assert.deepEqual(harness.requests.map((request) => request.requestId), [requestId, requestId]);
  assert.equal(harness.events.filter((event) => event === "clear-draft").length, 1);
});

for (const alreadySaved of [true, false]) {
  test(`${alreadySaved ? "저장 후 응답 유실" : "저장 전 통신 실패"} 뒤 이동 시간이 갱신돼도 최초 본문·ID로 복구하고 초안·장소를 정리한다`, async t => {
    const harness = createHarness(t, {
      respond() { throw new transport.GraphQLRequestError("응답 확인 실패", { retryable: true }); },
    });
    await harness.save();
    const firstBody = structuredClone(harness.requests[0].body);
    assert.equal(harness.events.includes("clear-draft"), false);
    assert.equal(harness.events.includes("clear-places"), false);

    harness.input.routePlan[0].items[0].travelMinutesFromPrevious += 3;
    harness.remount();
    if (alreadySaved) harness.client.setQueryData(cache.MY_ROUTES_QUERY_KEY, { myRoutes: [createSavedRoute()] });
    harness.respondWith(body => {
      assert.deepEqual(body, firstBody, "서버의 동일 요청 본문 검사도 통과해야 한다.");
      return { createRoute: createSavedRoute() };
    });
    await harness.save();

    assert.equal(harness.requests.length, 2);
    assert.deepEqual(harness.requests[1].body, firstBody);
    assert.equal(harness.modals.length, 1);
    assert.equal(harness.modals[0].title, text.cart.routeSavedTitle(1));
    assert.equal(harness.events.filter(event => event === "clear-draft").length, 1);
    assert.equal(harness.events.filter(event => event === "clear-places").length, 1);
    assert.equal(harness.events.filter(event => event === "close").length, 1);
    assert.deepEqual(harness.client.getQueryData(cache.MY_ROUTES_QUERY_KEY).myRoutes.map(route => route.id), ["saved-route"]);
  });
}

test("재실행 후 이동 시간이 바뀌고 재시도도 실패하면 초안·장소·최초 요청을 유지한다", async t => {
  const harness = createHarness(t, {
    respond() { throw new transport.GraphQLRequestError("시간 초과", { retryable: true }); },
  });
  await harness.save();
  const original = structuredClone(harness.savedAttempt);
  const body = structuredClone(harness.requests[0].body);
  harness.input.routePlan[0].items[0].travelMinutesFromPrevious += 5;
  harness.remount();
  await harness.save();
  assert.deepEqual(harness.savedAttempt, original);
  assert.deepEqual(harness.requests.map(request => request.body), [body, body]);
  assert.equal(harness.events.includes("clear-draft"), false);
  assert.equal(harness.events.includes("clear-places"), false);
});

for (const change of ["date", "stay", "place"]) {
  test(`사용자가 ${change}를 직접 바꾸면 이동 시간도 변했더라도 현재 입력과 새 ID를 사용한다`, async t => {
    const harness = createHarness(t, { respond() { throw new Error("저장 실패"); } });
    await harness.save();
    const firstId = harness.savedAttempt.requestId;
    harness.input.routePlan[0].items[0].travelMinutesFromPrevious += 3;
    if (change === "date") harness.input.travelStartDate = "2027-09-05";
    if (change === "stay") harness.input.routePlan[0].items[0].stayMinutes += 10;
    if (change === "place") harness.input.routePlan[0].items[0].place.contentId = "different-place";
    harness.remount();
    harness.respondWith(() => ({ createRoute: createSavedRoute() }));
    await harness.save();
    assert.notEqual(harness.requests[1].requestId, firstId);
    assert.deepEqual(harness.requests[1].body, {
      ...checkout.buildCreateRouteInput(harness.input), clientRequestId: harness.savedAttempt.requestId,
    });
    assert.equal(harness.events.filter(event => event === "clear-places").length, 1);
  });
}

test("로그인 안내에서 초안을 유지하고 로그인 후 저장을 이어간다", async (t) => {
  const harness = createHarness(t, { authenticated: false });
  await harness.save();
  assert.equal(harness.requests.length, 0);
  assert.equal(harness.savedAttempt, null);
  assert.equal(harness.events.includes("clear-draft"), false);
  harness.modals[0].actions[1].onClick();
  assert.deepEqual(harness.events.at(-1), ["login", "route-save", { preserveCurrentScreen: true }]);
  harness.authenticate();
  await harness.save();
  assert.equal(harness.requests.length, 1);
});

test("전역 DAY 추가 대상이 남아 있어도 공유 복사 Context는 새 루트로 저장한다", async (t) => {
  const harness = createHarness(t, { appendTarget: null });
  await harness.save();
  assert.equal(harness.requests[0].kind, "create");
});

test("복원한 DAY 추가는 Context의 대상에만 저장하고 성공 뒤 초안을 정리한다", async (t) => {
  const harness = createHarness(t, {
    appendTarget: { routeId: "restored-route", routeTitle: "복원 대상", nextDayIndex: 2, suggestedStartDate: "2027-09-04" },
    respond: () => ({ appendRouteDays: createSavedRoute() }),
  });
  await harness.save();
  assert.equal(harness.requests[0].kind, "append");
  assert.equal(harness.requests[0].routeId, "restored-route");
  assert.equal(harness.savedAttempt, null);
  assert.ok(harness.events.includes("clear-draft"));
});

function createAccountHarness() {
  const events = [];
  const modals = [];
  const jsx = (type, props) => ({ type, props });
  const select = (state) => (selector) => selector(state);
  const clear = (name) => () => events.push(name);
  const { default: MyAccountPage } = loadSource("pages/MyAccountPage.tsx", {
    react: { useState: (initial) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "@tanstack/react-query": { useQueryClient: () => ({ clear: clear("query-clear") }) },
    "react-router-dom": { useNavigate: () => (path) => events.push(["navigate", path]) },
    "react-icons/md": {},
    "@/api/authApi": { authApi: { deleteMyAccount: async () => events.push("delete-account") } },
    "@/api/notificationApi": { notificationApi: { unregisterPushDevice: async () => {} } },
    "@/components/account/AccountDetailsSection": {},
    "@/components/account/useAccountUser": {
      useAccountUser: () => ({ user: { role: "USER" }, isLoading: false, retry() {} }),
    },
    "@/lib/authToken": { getAuthToken: () => "test-token", clearAuthToken: clear("auth-clear") },
    "@/features/my-route/services/routeArrivalTransitionLock": { clearRouteArrivalTransitions() {} },
    "@/features/my-route/services/routeStartAttemptJournal": { clearRouteStartAttempts() {} },
    "@/lib/uiText": { useUiText: () => text },
    "@/native-bridge": {
      nativeBridge: {
        runtime: { isAvailable: () => false },
        notifications: {
          getPushToken: async () => null,
          syncRouteArrivals: async () => {}, syncFestivals: async () => {}, syncRouteReviews: async () => {},
        },
      },
    },
    "@/stores/authUserStore": { useAuthUserStore: select({ clearUser: clear("user-clear") }) },
    "@/stores/homeExploreStore": { useHomeExploreStore: select({ resetForArea() {} }) },
    "@/stores/mapSheetStore": { useMapSheetStore: select({ resetSheet() {} }) },
    "@/stores/routeEditFlowStore": { useRouteEditFlowStore: select({ clearAppendTarget() {} }) },
    "@/stores/routeCheckoutDraftStore": {
      useRouteCheckoutDraftStore: select({ clearDraft: clear("draft-clear") }),
    },
    "@/stores/serviceAreaStore": { useDefaultServiceArea: () => ({ defaultRegion: { sigunguCode: "1" } }) },
    "@/stores/uiModalStore": { useUiModalStore: select({ openModal: (modal) => modals.push(modal) }) },
    "@/stores/uiLoadingStore": { useUiLoadingStore: select({ showLoading() {}, hideLoading() {} }) },
    "@/stores/uiToastStore": { useUiToastStore: select({ showToast() {} }) },
  });
  const actions = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.props?.title && node.props?.onClick) actions.push(node.props);
    for (const child of [node.props?.children].flat(Infinity)) visit(child);
  }
  visit(MyAccountPage());
  return { events, modals, actions };
}

for (const action of ["logout", "switchAccount", "deleteAccount"]) {
  test(`명시적 ${action} 완료는 작성 중 초안 전체를 정리한다`, async () => {
    const harness = createAccountHarness();
    const row = harness.actions.find(({ title }) => title === text.account[action]);
    assert.ok(row);
    await row.onClick();
    if (action === "deleteAccount") {
      harness.modals[0].actions.find(({ variant }) => variant === "danger").onClick();
    }
    await flushTasks();
    assert.equal(harness.events.filter((event) => event === "draft-clear").length, 1);
    assert.ok(harness.events.indexOf("draft-clear") < harness.events.indexOf("auth-clear"));
    assert.ok(harness.events.includes("user-clear"));
  });
}

test("로그인한 계정은 비로그인 초안을 승계하고 세션 만료는 유지하며 다른 계정 로그인은 제거한다", () => {
  draftStore.getState().saveDraft({
    id: "guest-draft", ownerUserId: null, context: { mode: "new" },
    savedPlaces: [], initialRoutePlan: null, initialStep: "cart",
    form: {
      step: "schedule", travelStartDate: "2027-09-04", tripDays: 1,
      dailyStartTime: "09:00", scheduleEndTime: "18:00", tempo: null,
      startLocationSelection: null,
    },
    editor: null, createAttempt: null, updatedAt: Date.now(),
  });
  assert.equal(draftStore.getState().draft?.id, "guest-draft");
  authUserStore.getState().setUser({ id: "owner-a" });
  assert.equal(draftStore.getState().draft.ownerUserId, "owner-a");
  authUserStore.getState().setUser(null);
  authToken.clearAuthToken("expired");
  assert.equal(draftStore.getState().draft.ownerUserId, "owner-a");
  authUserStore.getState().setUser({ id: "owner-a" });
  assert.equal(draftStore.getState().draft.id, "guest-draft");
  authUserStore.getState().setUser({ id: "owner-b" });
  assert.equal(draftStore.getState().draft, null);
  authUserStore.setState({ user: null });
});
