import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { QueriesObserver, QueryClient } from "@tanstack/react-query";
import { createServer } from "vite";
import ts from "typescript";

let server;
let routePlanBuilder;
let routeMapModel;
let routeResultEditorState;
let placeDuplicate;

const featurePath = "../src/features/route-checkout/";
const commonStart = { lat: 37, lng: 127 };
const secondDayStart = { lat: 38, lng: 128 };

function compileHook(name) {
  const source = readFileSync(new URL(`${featurePath}hooks/${name}.ts`, import.meta.url), "utf8");
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(result.diagnostics.length, 0);
  return result.outputText;
}

const editorCode = compileHook("useRouteResultEditor");
const drivingCode = compileHook("useRoutePlanDrivingTimes");

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  routePlanBuilder = await server.ssrLoadModule("/src/features/route-checkout/utils/routePlanBuilder.ts");
  routeMapModel = await server.ssrLoadModule("/src/features/route-checkout/models/routeMapModel.ts");
  routeResultEditorState = await server.ssrLoadModule("/src/features/route-checkout/models/routeResultEditorState.ts");
  placeDuplicate = await server.ssrLoadModule("/src/lib/placeDuplicate.ts");
});

after(async () => { await server?.close(); });

function createPlan() {
  return [commonStart, secondDayStart].map((startLocation, index) => ({
    day: index + 1,
    date: `2026-09-0${index + 4}`,
    startLocation,
    startsFromCurrentLocation: true,
    items: [1, 2].map((stop) => {
      const id = `day-${index + 1}-place-${stop}`;
      return {
        id,
        place: {
          id,
          contentId: id,
          contentTypeId: "12",
          title: id,
          address: "테스트 주소",
          lat: startLocation.lat + stop * 0.01,
          lng: startLocation.lng,
          contentTypeLabel: "관광지",
          categoryName: "자연관광",
          icon: "📍",
          images: [],
        },
        stayMinutes: 60,
        recommendedStayMinutes: 60,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
      };
    }),
  }));
}

function createSavedFoodPlace(id, lng) {
  return {
    id,
    thumbnailUrl: "",
    savedAt: 0,
    place: {
      id,
      contentId: id,
      contentTypeId: "39",
      areaCode: "1",
      signguCode: "1",
      touristTrendName: "",
      topRank: null,
      title: id,
      address: "테스트 주소",
      lat: commonStart.lat,
      lng,
      contentTypeLabel: "음식점",
      categoryName: "음식점",
      icon: "🍽",
      images: [],
    },
  };
}

function loadHook(code, modules) {
  const exports = {};
  new Function("require", "exports", code)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected hook import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return exports;
}

function createHarness(t, overrides = {}) {
  t.mock.method(globalThis, "fetch", () => { throw new Error("External requests are disabled in this test."); });
  const initialRoutePlan = createPlan();
  let persistedEditorState = null;
  const input = {
    savedPlaces: initialRoutePlan.flatMap((day) => day.items.map((item) => ({ place: item.place }))),
    initialRoutePlan,
    travelStartDate: "2026-09-04",
    tripDays: 2,
    dailyStartMinutes: 540,
    dailyEndMinutes: 1080,
    tempo: "balanced",
    isScheduleValid: true,
    currentLocation: commonStart,
    isRouteSaveInFlight: () => saving,
    onEditorStateChange: (state) => { persistedEditorState = JSON.parse(JSON.stringify(state)); },
    ...overrides,
  };
  let saving = false;
  const slots = [];
  let cursor = 0;
  let effects = [];
  // Only React's state/memo storage is supplied here. Reducers, route builders,
  // driving-time hooks and Query Core observers execute their production code.
  const react = {
    useReducer(reducer, initialArg, initialize) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = initialize ? initialize(initialArg) : initialArg;
      return [slots[index], (action) => { slots[index] = reducer(slots[index], action); }];
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !dependencies.every((value, key) => Object.is(value, previous.dependencies[key]))) {
        slots[index] = { value: factory(), dependencies };
      }
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || !dependencies.every((value, key) => Object.is(value, previous.dependencies[key]))) {
        slots[index] = { dependencies };
        effects.push(effect);
      }
    },
  };
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let observer;
  let unsubscribe;
  const requests = [];
  let respond = () => ({ durationMs: (10 + requests.length) * 60_000 });
  const driving = loadHook(drivingCode, {
    react,
    "@tanstack/react-query": {
      useQueries({ queries }) {
        if (!observer) {
          observer = new QueriesObserver(client, queries);
          unsubscribe = observer.subscribe(() => {});
        } else {
          observer.setQueries(queries);
        }
        return observer.getCurrentResult();
      },
    },
    "@/lib/naverDirectionsApi": {
      async fetchDrivingRouteFromCurrentLocation(request) {
        requests.push(request);
        return respond(request);
      },
    },
  });
  const { useRouteResultEditor } = loadHook(editorCode, {
    react,
    "@/lib/placeDuplicate": placeDuplicate,
    "../utils/routePlanBuilder": routePlanBuilder,
    "../models/routeMapModel": routeMapModel,
    "../models/routeResultEditorState": routeResultEditorState,
    "./useRoutePlanDrivingTimes": driving,
  });
  t.after(() => { unsubscribe?.(); observer?.destroy(); client.clear(); });
  const render = () => {
    cursor = 0;
    effects = [];
    const result = useRouteResultEditor(input);
    effects.forEach((effect) => effect());
    return result;
  };
  return {
    input,
    requests,
    render,
    getPersistedEditorState() { return persistedEditorState; },
    remount() {
      input.initialEditorState = persistedEditorState;
      slots.length = 0;
      unsubscribe?.();
      observer?.destroy();
      observer = undefined;
      unsubscribe = undefined;
    },
    setSaving(value) { saving = value; },
    respondWith(handler) { respond = handler; },
    async settle() {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const result = render();
        if (!result.isRouteTravelLoading && client.isFetching() === 0) return result;
        await flushTasks();
      }
      assert.fail("Driving-time queries did not settle.");
    },
  };
}

test("처음 선택한 공통 출발지는 모든 DAY의 기본값이다", async (t) => {
  const harness = createHarness(t, { initialRoutePlan: null });
  const result = await harness.settle();
  assert.equal(result.routePlan.length, 2);
  for (const day of result.routePlan) assert.deepEqual(day.startLocation, commonStart);
});

test("가까운 장소가 모두 최소 이동시간이어도 실제 거리로 방문 순서를 정한다", () => {
  const routePlan = routePlanBuilder.buildRoutePlan({
    savedPlaces: [
      createSavedFoodPlace("far-place", commonStart.lng + 0.02),
      createSavedFoodPlace("near-place", commonStart.lng + 0.001),
    ],
    travelStartDate: "2026-09-04",
    tripDays: 1,
    dailyStartMinutes: 540,
    dailyEndMinutes: 1080,
    tempo: "balanced",
    stayOverrides: {},
    currentLocation: commonStart,
  });

  assert.deepEqual(
    routePlan[0].items.map((item) => item.id),
    ["near-place", "far-place"]
  );
  assert.equal(routePlan[0].items[0].travelMinutesFromPrevious, 8);
});

test("공유 루트의 초기 DAY별 출발지와 원본 입력을 보존한다", async (t) => {
  const harness = createHarness(t);
  const original = structuredClone(harness.input.initialRoutePlan);
  const result = await harness.settle();
  assert.deepEqual(result.routePlan.map((day) => day.startLocation), [commonStart, secondDayStart]);
  assert.deepEqual(harness.input.initialRoutePlan, original);
});

test("DAY 2 출발지 편집은 해당 DAY만 정렬·재조회하고 다른 DAY의 이동시간을 유지한다", async (t) => {
  const harness = createHarness(t);
  const before = await harness.settle();
  const requestCount = harness.requests.length;
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  harness.respondWith(() => delayed);
  const nextStart = { lat: 38.04, lng: 128 };
  before.handleChangeDayStartLocation(2, nextStart);
  const pending = harness.render();

  assert.equal(pending.isRouteEditDirty, true);
  assert.deepEqual(pending.routeTravelLoadingDays, [2]);
  assert.deepEqual(pending.routePlan[0], before.routePlan[0]);
  assert.deepEqual(pending.routePlan[1].items.map((item) => item.id), ["day-2-place-2", "day-2-place-1"]);
  release({ durationMs: 25 * 60_000 });
  const after = await harness.settle();

  assert.deepEqual(after.routePlan[0], before.routePlan[0]);
  assert.deepEqual(after.routePlan[1].startLocation, nextStart);
  assert.equal(after.routePlan[1].items[0].travelMinutesFromPrevious, 25);
  assert.equal(after.routePlan[1].items[0].startMinutes, 565);
  const changedRequests = harness.requests.slice(requestCount);
  assert.equal(changedRequests.length, 2);
  assert.deepEqual(changedRequests[0], {
    startLat: nextStart.lat,
    startLng: nextStart.lng,
    goalLat: 38.02,
    goalLng: 128,
  });
  assert.ok(changedRequests.every((request) => request.goalLng === 128));
});

test("DAY별 출발지 적용 후 다른 편집을 취소하면 적용한 출발지로 복원한다", async (t) => {
  const harness = createHarness(t);
  const initial = await harness.settle();
  initial.handleChangeDayStartLocation(2, { lat: 38.04, lng: 128 });
  (await harness.settle()).handleApplyRouteEdits();
  const applied = await harness.settle();
  assert.equal(applied.isRouteEditDirty, false);

  applied.handleChangeDayStartLocation(1, { lat: 37.04, lng: 127 });
  let edited = await harness.settle();
  edited.handleChangeStayMinutes("day-2-place-2", 95);
  edited = await harness.settle();
  assert.equal(edited.routePlan[1].items[0].stayMinutes, 95);
  assert.deepEqual(edited.routePlan[1].startLocation, applied.routePlan[1].startLocation);
  edited.handleCancelRouteEdits();
  const restored = await harness.settle();

  assert.equal(restored.isRouteEditDirty, false);
  assert.deepEqual(restored.routePlan, applied.routePlan);
});

test("저장 중에는 DAY 출발지·체류시간·적용·취소가 편집 상태를 바꾸지 않는다", async (t) => {
  const harness = createHarness(t);
  const initial = await harness.settle();
  initial.handleChangeDayStartLocation(2, { lat: 38.04, lng: 128 });
  const draft = await harness.settle();
  const requestCount = harness.requests.length;
  harness.setSaving(true);
  draft.handleChangeDayStartLocation(1, { lat: 0, lng: 0 });
  draft.handleChangeStayMinutes("day-2-place-2", 95);
  draft.handleApplyRouteEdits();
  draft.handleCancelRouteEdits();
  const locked = await harness.settle();

  assert.equal(locked.isRouteEditDirty, true);
  assert.deepEqual(locked.routePlan, draft.routePlan);
  assert.equal(harness.requests.length, requestCount);
  harness.setSaving(false);
  locked.handleCancelRouteEdits();
  assert.deepEqual((await harness.settle()).routePlan, initial.routePlan);
});

test("적용한 삽입·삭제·순서·DAY 출발지·체류시간은 결과 단계 재진입 후에도 복원한다", async (t) => {
  const harness = createHarness(t);
  const initial = await harness.settle();
  initial.handleChangeStayMinutes("day-1-place-1", 95);
  (await harness.settle()).handleRemoveRoutePlace("day-1-place-2");
  const insertedPlace = createSavedFoodPlace("inserted-place", commonStart.lng + 0.015).place;
  const point = { title: "테스트 지점", subtitle: "", ...commonStart };
  (await harness.settle()).handleInsertPlace({ day: 1, insertIndex: 1, from: point, to: point }, insertedPlace);
  const inserted = await harness.settle();
  inserted.handleReorderRoutePlan(inserted.routePlan.map((day) => ({ ...day, items: [...day.items].reverse() })));
  (await harness.settle()).handleChangeDayStartLocation(2, { lat: 38.05, lng: 128 });
  (await harness.settle()).handleApplyRouteEdits();
  const applied = await harness.settle();
  const snapshot = harness.getPersistedEditorState();
  assert.ok(snapshot, "편집 상태를 결과 단계 밖으로 전달해야 한다");
  assert.deepEqual(snapshot.applied, snapshot.draft);
  assert.equal(snapshot.applied.stayOverrides["day-1-place-1"], 95);
  assert.equal(applied.isRouteEditDirty, false);
  assert.ok(applied.routePlan[0].items.some((item) => item.id === "inserted-place"));
  assert.equal(applied.routePlan[0].items.some((item) => item.id === "day-1-place-2"), false);

  harness.remount();
  const restored = await harness.settle();
  assert.equal(restored.isRouteEditDirty, false);
  assert.deepEqual(restored.routePlan, applied.routePlan);
  restored.handleCancelRouteEdits();
  assert.deepEqual((await harness.settle()).routePlan, applied.routePlan);
});

test("미적용 편집을 복원한 뒤 취소하면 복원된 적용 기준으로 돌아간다", async (t) => {
  const harness = createHarness(t);
  (await harness.settle()).handleChangeStayMinutes("day-1-place-1", 85);
  (await harness.settle()).handleApplyRouteEdits();
  const applied = await harness.settle();
  applied.handleRemoveRoutePlace("day-2-place-1");
  (await harness.settle()).handleChangeStayMinutes("day-1-place-1", 125);
  (await harness.settle()).handleChangeDayStartLocation(2, { lat: 38.05, lng: 128 });
  const draft = await harness.settle();
  assert.equal(draft.isRouteEditDirty, true);
  const snapshot = harness.getPersistedEditorState();
  assert.ok(snapshot);
  assert.notDeepEqual(snapshot.applied, snapshot.draft);

  harness.remount();
  const restored = await harness.settle();
  assert.equal(restored.isRouteEditDirty, true);
  assert.deepEqual(restored.routePlan, draft.routePlan);
  restored.handleCancelRouteEdits();
  const cancelled = await harness.settle();
  assert.equal(cancelled.isRouteEditDirty, false);
  assert.deepEqual(cancelled.routePlan, applied.routePlan);
});

test("복원 후 저장 잠금과 잠금 해제는 적용 상태와 편집 상태를 지우지 않는다", async (t) => {
  const harness = createHarness(t);
  (await harness.settle()).handleChangeStayMinutes("day-1-place-1", 85);
  (await harness.settle()).handleApplyRouteEdits();
  await harness.settle();
  const snapshot = harness.getPersistedEditorState();
  assert.ok(snapshot);
  harness.remount();
  const restored = await harness.settle();
  harness.setSaving(true);
  restored.handleChangeStayMinutes("day-1-place-1", 125);
  restored.handleRemoveRoutePlace("day-2-place-1");
  restored.handleApplyRouteEdits();
  restored.handleCancelRouteEdits();
  await harness.settle();
  assert.deepEqual(harness.getPersistedEditorState(), snapshot);
  harness.setSaving(false);
  const retryable = await harness.settle();
  assert.equal(retryable.isRouteEditDirty, false);
  assert.deepEqual(retryable.routePlan, restored.routePlan);
  retryable.handleChangeStayMinutes("day-1-place-1", 125);
  assert.equal((await harness.settle()).isRouteEditDirty, true);
});

test("초안의 자동 배치 삭제·수동 삽입도 초기 일정보다 우선 복원하고 취소할 수 있다", async (t) => {
  const point = { title: "테스트 지점", subtitle: "", ...commonStart };
  const applied = { stayOverrides: {}, manualInsertions: [], removedPlaceIds: [], routePlanOverride: null };
  const initialEditorState = {
    applied,
    draft: {
      ...applied,
      stayOverrides: { "day-1-place-1": 85 },
      removedPlaceIds: ["day-1-place-2"],
      manualInsertions: [{
        request: { day: 2, insertIndex: 0, from: point, to: point },
        place: createSavedFoodPlace("restored-insertion", commonStart.lng + 0.015).place,
      }],
    },
  };
  const original = structuredClone(initialEditorState);
  const harness = createHarness(t, { initialEditorState });
  const restored = await harness.settle();
  assert.equal(restored.isRouteEditDirty, true);
  const items = restored.routePlan.flatMap((day) => day.items);
  assert.equal(items.some((item) => item.id === "day-1-place-2"), false);
  assert.ok(items.some((item) => item.id === "restored-insertion"));
  assert.equal(items.find((item) => item.id === "day-1-place-1").stayMinutes, 85);
  harness.remount();
  const remounted = await harness.settle();
  assert.deepEqual(remounted.routePlan, restored.routePlan);
  remounted.handleCancelRouteEdits();
  const cancelled = await harness.settle();
  assert.equal(cancelled.isRouteEditDirty, false);
  assert.deepEqual(
    cancelled.routePlan.flatMap((day) => day.items.map((item) => item.id)).sort(),
    createPlan().flatMap((day) => day.items.map((item) => item.id)).sort()
  );
  assert.deepEqual(initialEditorState, original);
});
