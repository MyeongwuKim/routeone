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
    ...overrides,
  };
  let saving = false;
  const slots = [];
  let cursor = 0;
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
    "./useRoutePlanDrivingTimes": driving,
  });
  t.after(() => { unsubscribe?.(); observer?.destroy(); client.clear(); });
  const render = () => {
    cursor = 0;
    return useRouteResultEditor(input);
  };
  return {
    input,
    requests,
    render,
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
