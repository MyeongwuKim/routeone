import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import ts from "typescript";

let server;
let draftModel;
let checkoutState;
let checkoutFlow;
let createRouteCheckoutDraftStore;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  draftModel = await server.ssrLoadModule("/src/features/route-checkout/models/routeCheckoutDraft.ts");
  checkoutState = await server.ssrLoadModule("/src/features/route-checkout/models/routeCheckoutState.ts");
  checkoutFlow = await server.ssrLoadModule("/src/features/route-checkout/models/routeCheckoutFlow.ts");
  ({ createRouteCheckoutDraftStore } = await server.ssrLoadModule("/src/stores/routeCheckoutDraftStore.ts"));
});

after(async () => { await server?.close(); });

function loadSource(path, modules) {
  const source = readFileSync(new URL(`../src/features/route-checkout/${path}`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  assert.equal(result.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", result.outputText)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return exports;
}

// React's hook storage and commit boundaries are supplied here; session selection,
// provider actions, reducers, validation and persisted store execute production code.
function hookRuntime() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let didUpdate = false;
  const sameDependencies = (left, right) => left?.length === right.length && right.every((value, index) => Object.is(value, left[index]));
  const react = {
    useState(initialValue) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) {
        slots[index] = {
          value: typeof initialValue === "function" ? initialValue() : initialValue,
          set(value) {
            const next = typeof value === "function" ? value(slots[index].value) : value;
            if (!Object.is(next, slots[index].value)) didUpdate = true;
            slots[index].value = next;
          },
        };
      }
      return [slots[index].value, slots[index].set];
    },
    useReducer(reducer, initialValue) {
      const index = cursor++;
      slots[index] ??= { value: initialValue, dispatch(action) {
        const next = reducer(slots[index].value, action);
        if (!Object.is(next, slots[index].value)) didUpdate = true;
        slots[index].value = next;
      } };
      return [slots[index].value, slots[index].dispatch];
    },
    useRef(initialValue) {
      const index = cursor++;
      slots[index] ??= { current: initialValue };
      return slots[index];
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !sameDependencies(slots[index].dependencies, dependencies)) {
        slots[index] = { value: factory(), dependencies };
      }
      return slots[index].value;
    },
    useCallback(callback, dependencies) { return react.useMemo(() => callback, dependencies); },
    useLayoutEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || !sameDependencies(slots[index].dependencies, dependencies)) {
        slots[index] = { dependencies };
        effects.push(effect);
      }
    },
  };
  return {
    react,
    render(render) {
      for (let pass = 0; pass < 10; pass += 1) {
        cursor = 0;
        effects = [];
        didUpdate = false;
        const result = render();
        effects.forEach((effect) => effect());
        if (!didUpdate) return result;
      }
      assert.fail("Layout effects did not settle.");
    },
  };
}

function createDraft(overrides = {}) {
  const place = {
    id: "original", contentId: "original", contentTypeId: "12", areaCode: "32", signguCode: "1",
    touristTrendName: "", topRank: null, title: "원래 장소", address: "테스트 주소",
    lat: 37.76, lng: 128.9, contentTypeLabel: "관광지", categoryName: "자연관광", icon: "📍", images: [],
  };
  const routePlan = [{
    day: 1, date: "2099-09-04", startsFromCurrentLocation: true, startLocation: { lat: 37.75, lng: 128.9 },
    items: [{ id: place.id, place, stayMinutes: 75, recommendedStayMinutes: 90, startMinutes: 548, endMinutes: 623, travelMinutesFromPrevious: 8, isOverSchedule: false }],
  }];
  const snapshot = { stayOverrides: { original: 75 }, manualInsertions: [], removedPlaceIds: [], routePlanOverride: routePlan };
  return {
    id: "stored-draft", ownerUserId: null, context: { mode: "new" },
    savedPlaces: [{ id: place.id, place, thumbnailUrl: "", savedAt: 0 }],
    initialRoutePlan: null, initialStep: "cart",
    form: {
      step: "result", travelStartDate: "2099-09-04", tripDays: 2,
      dailyStartTime: "10:30", scheduleEndTime: "19:00", tempo: "relaxed",
      startLocationSelection: { location: { lat: 37.75, lng: 128.9 }, source: "map" },
    },
    editor: { applied: snapshot, draft: snapshot },
    createAttempt: { inputKey: "saved-body", requestId: "saved-request" }, updatedAt: 1,
    ...overrides,
  };
}

function otherPlaces() {
  const item = createDraft().savedPlaces[0];
  return [{ ...item, id: "other", place: { ...item.place, id: "other", contentId: "other", title: "다른 장소" } }];
}

function createHarness(stored = createDraft(), overrides = {}) {
  const storage = new Map();
  const store = createRouteCheckoutDraftStore({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  });
  if (stored) store.getState().saveDraft(stored);
  const events = [];
  const options = {
    context: { mode: "new" }, resumeDraft: false,
    savedPlaces: createDraft().savedPlaces,
    initialStep: "cart", initialTravelStartDate: "2099-10-04", initialTripDays: 1,
    currentLocation: { lat: 37.7, lng: 128.8 },
    onRemovePlace(id) { options.savedPlaces = options.savedPlaces.filter((item) => item.id !== id); events.push(["remove", id]); },
    onClearPlaces() { options.savedPlaces = []; events.push(["clear"]); },
    ...overrides,
  };
  let sessionRuntime;
  let providerRuntime;
  let useRouteCheckoutDraftSession;
  let RouteCheckoutProvider;
  let session;
  let context;
  const sharedModules = {
    "@/stores/routeCheckoutDraftStore": { useRouteCheckoutDraftStore: store },
    "../models/routeCheckoutState": checkoutState,
    "../models/routeCheckoutFlow": checkoutFlow,
    "../models/routeCheckoutDraft": draftModel,
  };
  function mount() {
    sessionRuntime = hookRuntime();
    providerRuntime = hookRuntime();
    ({ useRouteCheckoutDraftSession } = loadSource("hooks/useRouteCheckoutDraftSession.ts", {
      ...sharedModules,
      react: sessionRuntime.react,
      "@/stores/authUserStore": { useAuthUserStore: { getState: () => ({ user: null }) } },
      "../models/routeCheckoutDraft": draftModel,
    }));
    const jsx = (type, props) => ({ type, props });
    ({ RouteCheckoutProvider } = loadSource("components/RouteCheckoutContext.tsx", {
      ...sharedModules,
      react: providerRuntime.react,
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "@/lib/uiText": { useUiText: () => ({ cart: {} }) },
      "../hooks/useRouteCheckout": { RouteCheckoutContext: { Provider: "provider" } },
    }));
  }
  function render() {
    session = sessionRuntime.render(() => useRouteCheckoutDraftSession(options));
    const result = providerRuntime.render(() => RouteCheckoutProvider({ draft: session.draft, savedPlaces: session.savedPlaces, children: null }));
    context = result.props.value;
    return context;
  }
  mount();
  render();
  return {
    store, options, events,
    get session() { return session; },
    get context() { return context; },
    render,
    reopen(changes = {}) { Object.assign(options, changes); mount(); return render(); },
    changeCart(places) { options.savedPlaces = places; return render(); },
  };
}

test("같은 문맥은 입력·적용 전후 편집·요청 ID를 복원하고 다른 문맥은 새 작성본을 만든다", () => {
  const stored = createDraft();
  const harness = createHarness(stored);
  assert.equal(harness.context.draftId, stored.id);
  assert.equal(harness.context.travelStartDate, stored.form.travelStartDate);
  assert.equal(harness.context.tempo, stored.form.tempo);
  assert.deepEqual(harness.context.editorState, stored.editor);
  assert.deepEqual(harness.context.createAttempt, stored.createAttempt);
  const next = harness.reopen({ context: { mode: "shared-copy", sourceRouteId: "different-route" }, initialStep: "schedule" });
  assert.notEqual(next.draftId, stored.id);
  assert.equal(next.step, "schedule");
  assert.equal(next.travelStartDate, "2099-10-04");
  assert.equal(next.editorState, null);
  assert.equal(next.createAttempt, null);
  assert.deepEqual(harness.store.getState().draft.context, { mode: "shared-copy", sourceRouteId: "different-route" });
});

test("지난 날짜의 결과 초안은 날짜 선택부터 확인하고 다른 입력을 유지한다", () => {
  const source = createDraft();
  const stored = { ...source, form: { ...source.form, travelStartDate: "2000-01-01" } };
  const original = structuredClone(stored);
  const harness = createHarness(stored);
  assert.equal(harness.context.step, "schedule");
  assert.equal(harness.context.isScheduleValid, false);
  assert.equal(harness.context.travelStartDate, "2000-01-01");
  assert.equal(harness.context.tripDays, 2);
  assert.equal(harness.context.tempo, "relaxed");
  assert.deepEqual(stored, original);
});

test("카트를 바꿔 다시 열면 날짜·속도는 유지하고 이전 결과 편집과 저장 ID를 초기화한다", () => {
  const harness = createHarness(createDraft(), { savedPlaces: otherPlaces() });
  assert.equal(harness.context.travelStartDate, createDraft().form.travelStartDate);
  assert.equal(harness.context.tempo, "relaxed");
  assert.equal(harness.context.editorState, null);
  assert.equal(harness.context.createAttempt, null);
  assert.deepEqual(harness.store.getState().draft.savedPlaces, otherPlaces());
});

for (const draftContext of [
  { mode: "shared-copy", sourceRouteId: "shared-route" },
  { mode: "append", target: { routeId: "append-route", routeTitle: "이어 붙일 루트", nextDayIndex: 3, suggestedStartDate: "2099-09-04" } },
]) {
  test(`명시 재개의 ${draftContext.mode}는 기존 장소와 저장 대상을 보존하고 홈 카트를 건드리지 않는다`, () => {
    const stored = createDraft({ context: draftContext });
    const harness = createHarness(stored, { savedPlaces: otherPlaces(), resumeDraft: true });
    assert.deepEqual(harness.session.savedPlaces, stored.savedPlaces);
    assert.deepEqual(harness.session.draft.context, draftContext);
    assert.deepEqual(harness.context.editorState, stored.editor);
    if (draftContext.mode === "append") assert.equal(harness.context.appendTarget.routeId, "append-route");
    harness.session.removePlace("original");
    harness.render();
    assert.deepEqual(harness.session.savedPlaces, []);
    assert.deepEqual(harness.options.savedPlaces, otherPlaces());
    assert.deepEqual(harness.events, []);
    harness.session.clearPlaces();
    harness.render();
    assert.equal(harness.store.getState().draft, null);
    assert.deepEqual(harness.options.savedPlaces, otherPlaces());
    assert.deepEqual(harness.events, []);
  });
}

test("새 일정 재개 후 복원 목록을 수정해도 원래 같은 카트였다면 전체 삭제 때 함께 정리한다", () => {
  const stored = createDraft();
  stored.savedPlaces.push(...otherPlaces());
  const harness = createHarness(stored, { resumeDraft: true, savedPlaces: structuredClone(stored.savedPlaces) });
  harness.session.removePlace("original");
  harness.render();
  assert.deepEqual(harness.session.savedPlaces.map((item) => item.id), ["other"]);
  assert.deepEqual(harness.options.savedPlaces, stored.savedPlaces);
  harness.session.clearPlaces();
  harness.render();
  assert.equal(harness.store.getState().draft, null);
  assert.deepEqual(harness.options.savedPlaces, []);
  assert.deepEqual(harness.events, [["clear"]]);
});

test("결과 단계를 떠나 돌아오거나 모달을 닫았다 열어도 미적용 편집과 입력을 유지한다", () => {
  const harness = createHarness();
  const editor = structuredClone(harness.context.editorState);
  editor.draft.stayOverrides.original = 120;
  harness.context.setEditorState(editor);
  harness.context.setTripDays(3);
  harness.context.setStep("tempo");
  harness.render();
  assert.deepEqual(harness.context.editorState, editor);
  assert.deepEqual(harness.store.getState().draft.editor, editor);
  harness.context.setStep("result");
  harness.render();
  const reopened = harness.reopen();
  assert.equal(reopened.step, "result");
  assert.equal(reopened.tripDays, 3);
  assert.deepEqual(reopened.editorState, editor);
});

test("초안 삭제 뒤 늦은 입력·편집 effect와 요청 ID 갱신은 삭제한 초안을 되살리지 않는다", () => {
  const harness = createHarness();
  const staleEditor = harness.context.setEditorState;
  const staleAttempt = harness.context.setCreateAttempt;
  harness.context.clearDraft();
  assert.equal(harness.store.getState().draft, null);
  harness.context.setStep("schedule");
  harness.changeCart(otherPlaces());
  staleEditor(createDraft().editor);
  staleAttempt({ inputKey: "late-body", requestId: "late-request" });
  harness.render();
  assert.equal(harness.store.getState().draft, null);
});

test("같은 모달에서 카트 장소를 바꿔도 폼을 유지하며 이전 장소의 편집과 저장 ID를 비운다", () => {
  const harness = createHarness();
  harness.context.setStep("cart");
  harness.render();
  harness.changeCart(otherPlaces());
  assert.equal(harness.context.travelStartDate, createDraft().form.travelStartDate);
  assert.equal(harness.context.tempo, "relaxed");
  assert.equal(harness.context.editorState, null);
  assert.equal(harness.context.createAttempt, null);
  assert.equal(harness.store.getState().draft.editor, null);
  assert.equal(harness.store.getState().draft.createAttempt, null);
});
