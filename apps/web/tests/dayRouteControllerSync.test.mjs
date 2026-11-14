import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import ts from "typescript";

let server;
let display;
let adapters;
let formatting;
let layout;
let origins;
let text;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  display = await server.ssrLoadModule("/src/features/my-route/routeDisplay.ts");
  adapters = await server.ssrLoadModule("/src/features/my-route/adapters/dayRouteAdapters.ts");
  formatting = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteFormatting.ts");
  layout = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteLayout.ts");
  origins = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteStartLocation.ts");
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  text = getUiText("ko");
});
after(async () => { await server?.close(); });

// 경로를 명시해 커밋 검사가 각 실제 Hook 변경과 이 회귀 테스트의 연결을 찾을 수 있게 한다.
const hookSources = {
  useDayRoutePopupController: "../src/features/my-route/hooks/useDayRoutePopupController.ts",
  useDayRoutePopupState: "../src/features/my-route/hooks/useDayRoutePopupState.ts",
  useDayRouteLayoutEditor: "../src/features/my-route/hooks/useDayRouteLayoutEditor.ts",
  useDayRouteStartLocationEditor: "../src/features/my-route/hooks/useDayRouteStartLocationEditor.ts",
  useDayRouteGpsTest: "../src/features/my-route/hooks/useDayRouteGpsTest.ts",
  useRouteStopDrag: "../src/features/my-route/hooks/useRouteStopDrag.ts",
};

function loadSource(name, modules) {
  const path = hookSources[name];
  assert.ok(path, `Unknown hook source: ${name}`);
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const result = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  assert.equal(result.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", result.outputText)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected controller import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return exports;
}

function createRoute() {
  const today = display.getTodayDateKey();
  const days = [1, 2].map((dayIndex) => ({
    id: `day-${dayIndex}`, dayIndex, routeId: "controller-route", date: today,
    plannedStartMinutes: 540, startedAt: `${today}T00:00:00.000Z`, startLocation: null,
    stops: [1, 2].map((order) => ({
      id: `day-${dayIndex}-stop-${order}`, routeId: "controller-route", dayId: `day-${dayIndex}`,
      order, visitStatus: "PENDING", visitedAt: null, checkedInAt: null,
      stayMinutes: 60, verificationStatus: "NONE",
      place: { title: `DAY ${dayIndex} 장소 ${order}`, contentId: `${dayIndex}-${order}`, contentTypeId: "12", address: "", lat: 37.7, lng: 128.8, categoryLabel: "관광지", regionCode: "1", regionLabelKey: "32:1" },
    })),
  }));
  return {
    id: "controller-route", days, stops: days.flatMap((day) => day.stops),
    tripDays: 2, totalStopCount: 4, completedStopCount: 0, status: "ACTIVE",
    visibility: "PRIVATE", isMine: true, travelStartDate: today, travelEndDate: display.addDaysToDateKey(today, 1),
    startedAt: `${today}T00:00:00.000Z`, startLocation: null, dailyStartMinutes: 540,
  };
}

function createHarness(route = createRoute()) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let changed = false;
  const same = (left, right) => left?.length === right.length && right.every((value, index) => Object.is(left[index], value));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = {
        value: typeof initial === "function" ? initial() : initial,
        set(value) {
          const next = typeof value === "function" ? value(slots[index].value) : value;
          if (!Object.is(next, slots[index].value)) changed = true;
          slots[index].value = next;
        },
      };
      return [slots[index].value, slots[index].set];
    },
    useReducer(reducer, initial, initialize) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = {
        value: initialize ? initialize(initial) : initial,
        dispatch(action) { const next = reducer(slots[index].value, action); changed ||= next !== slots[index].value; slots[index].value = next; },
      };
      return [slots[index].value, slots[index].dispatch];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useMemo(factory, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) slots[index] = { value: factory(), dependencies };
      return slots[index].value;
    },
    useLayoutEffect(effect, dependencies) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].dependencies, dependencies)) { slots[index] = { dependencies }; effects.push(effect); }
    },
    useEffect(effect, dependencies) { return react.useLayoutEffect(effect, dependencies); },
  };
  const noop = () => {};
  const succeed = async () => true;
  const select = (values) => (selector) => selector(values);
  const { useDayRoutePopupState } = loadSource("useDayRoutePopupState", { react });
  let pendingSkip = null;
  let savingStopId = null;
  let layoutSuccess;
  let layoutPending = false;
  const layoutRequests = [];
  const stayRequests = [];
  const modals = [];
  const input = { route, day: route.days[0], onClose: noop };
  const modules = {
    react,
    "react-router-dom": { useNavigate: () => noop },
    "@/components/account/useAccountUser": { useAccountUser: () => ({ user: { id: "owner", role: "USER" } }) },
    "@/hooks/useAuthSession": { useAuthSession: () => ({ isAuthenticated: true }) },
    "@/stores/mapSheetStore": { useMapSheetStore: select({ openSheet: noop }) },
    "@/stores/uiModalStore": { useUiModalStore: select({ openModal: (modal) => modals.push(modal) }) },
    "@/stores/uiToastStore": { useUiToastStore: select({ showToast: noop }) },
    "@/stores/appLanguageStore": { useAppLanguageStore: select({ language: "ko" }) },
    "@/stores/serviceAreaStore": { useEffectiveServiceArea: () => ({ center: { lat: 37, lng: 128 } }) },
    "@/stores/currentPositionStore": { useCurrentPositionStore: select({ applyPosition: noop, clearPosition: noop, requestCurrentPosition: succeed }) },
    "@/lib/currentPosition": { getCurrentPosition: succeed },
    "@/lib/uiText": { useUiText: () => text },
    "@/lib/placeVerificationPolicy": { resolvePlaceVerificationPolicy: () => ({}) },
    "@/native-bridge": { nativeBridge: { runtime: { isAvailable: () => false } } },
    "../routeDisplay": display,
    "../adapters/dayRouteAdapters": adapters,
    "../utils/dayRouteFormatting": formatting,
    "../utils/dayRouteLayout": layout,
    "../utils/dayRouteStartLocation": origins,
    "./useDayRouteTravelSegments": { useDayRouteTravelSegments: () => ({}) },
    "./useDayRoutePopupState": { useDayRoutePopupState },
    "./useRouteLayoutMutation": { useRouteLayoutMutation: ({ onSuccess }) => {
      layoutSuccess = onSuccess;
      return { isSavingLayout: layoutPending, saveLayout: (value) => { layoutRequests.push(value); layoutPending = true; } };
    } },
    "./useRouteStopStayMutation": { useRouteStopStayMutation: () => ({ changeStayMinutes: (...args) => stayRequests.push(args), staySavingStopId: null }) },
    "./useRouteShareMutation": { useRouteShareMutation: () => ({ isSharingRoute: false, shareRoute: noop }) },
    "./useRouteStartDateMutation": { useRouteStartDateMutation: () => ({ isUpdatingRouteStartDate: false, updateRouteStartDate: succeed }) },
    "./useRouteDayStartMutation": { useRouteDayStartMutation: () => ({ isUpdatingRouteDayStart: false, updateRouteDayStart: succeed }) },
    "./useRouteStopVisitMutation": { useRouteStopVisitMutation: () => ({ visitSavingStopId: null, persistStopVisit: succeed }) },
    "./useRouteSkippingMutation": { useRouteSkippingMutation: ({ onSuccess }) => ({
      savingStopId, isFinishingDay: false, finishDay: succeed,
      pendingOperation: savingStopId ? { kind: "stop-skip", stopId: savingStopId, skipped: true } : null,
      isInFlight: () => savingStopId !== null,
      skipStop: async (stopId) => {
        savingStopId = stopId;
        pendingSkip = { onSuccess };
        return true;
      },
    }) },
    "./useRouteStartLocationMutation": { useRouteStartLocationMutation: () => ({ isUpdatingRouteStartLocation: false, updateRouteStartLocation: succeed }) },
    "../services/visitPhotoService": { isTestAccountModeEnabled: () => false, isVisitVerificationBypassEnabled: () => false },
  };
  // GPS 테스트도 프로덕션 훅을 조합해 컨트롤러의 실제 의존성 경계를 검증한다.
  modules["./useDayRouteGpsTest"] = loadSource("useDayRouteGpsTest", modules);
  modules["./useDayRouteStartLocationEditor"] = loadSource("useDayRouteStartLocationEditor", modules);
  modules["./useRouteStopDrag"] = loadSource("useRouteStopDrag", modules);
  modules["./useDayRouteLayoutEditor"] = loadSource("useDayRouteLayoutEditor", modules);
  const { useDayRoutePopupController } = loadSource("useDayRoutePopupController", modules);
  function render() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      cursor = 0; effects = []; changed = false;
      const result = useDayRoutePopupController(input);
      effects.forEach((effect) => effect());
      if (!changed) return result;
    }
    assert.fail("Controller effects did not settle.");
  }
  return {
    render, input, modals, layoutRequests, stayRequests,
    startSkip(controller, day, stop) {
      controller.schedule.handleToggleStopSkipped(day, stop);
      modals.at(-1).actions.find((action) => action.variant === "primary").onClick();
    },
    completeSkip(nextRoute) { assert.ok(pendingSkip); pendingSkip.onSuccess(nextRoute); savingStopId = null; },
    completeLayout(nextRoute) { layoutPending = false; layoutSuccess(nextRoute); },
    failLayout() { layoutPending = false; },
    setRoute(nextRoute) { input.route = nextRoute; input.day = nextRoute.days.find((day) => day.id === input.day.id) ?? nextRoute.days[0]; },
  };
}

test("DAY 1 건너뜀 응답이 늦게 와도 현재 선택한 DAY 2 장소에 DAY 1을 덮어쓰지 않는다", () => {
  const harness = createHarness();
  const initial = harness.render();
  harness.startSkip(initial, harness.input.route.days[0], harness.input.route.days[0].stops[0]);
  harness.render().schedule.handleSelectDay(harness.input.route.days[1]);
  const selected = harness.render();
  const selectedId = selected.schedule.activeDay.id;
  const result = structuredClone(harness.input.route);
  result.days[0].stops[0].visitStatus = "SKIPPED";
  harness.completeSkip(result);
  const finished = harness.render();
  assert.equal(finished.schedule.activeDay.id, selectedId);
  assert.deepEqual(finished.schedule.stopsByDayId[selectedId].map((stop) => stop.id), harness.input.route.days.find((day) => day.id === selectedId).stops.map((stop) => stop.id));
});

test("건너뛰기 중에는 첫 재렌더 전에도 닫기를 막고 완료 후 다시 허용한다", () => {
  const h = createHarness();
  let closed = 0;
  h.input.onClose = () => { closed += 1; };
  const initial = h.render();
  h.startSkip(initial, h.input.route.days[0], h.input.route.days[0].stops[0]);
  initial.header.onClose();
  assert.equal(closed, 0);
  const pending = h.render();
  assert.equal(pending.header.isCloseDisabled, true);
  assert.equal(pending.overlays.skippingOperation.kind, "stop-skip");
  pending.header.onClose();
  assert.equal(closed, 0);
  h.completeSkip(structuredClone(h.input.route));
  const finished = h.render();
  assert.equal(finished.header.isCloseDisabled, false);
  assert.equal(finished.overlays.skippingOperation, null);
  finished.header.onClose();
  assert.equal(closed, 1);
});

test("결과 불명 뒤 서버 재조회가 갱신한 방문 상태를 활성 DAY의 오래된 PENDING 배열이 덮지 않는다", () => {
  const harness = createHarness();
  harness.render();
  const result = structuredClone(harness.input.route);
  result.days[0].stops[0].visitStatus = "SKIPPED";
  result.days[0].stops[1].visitStatus = "VISITED";
  result.days[0].stops[1].visitedAt = `${display.getTodayDateKey()}T01:00:00.000Z`;
  result.stops = result.days.flatMap((day) => day.stops);
  harness.setRoute(result);
  const refreshed = harness.render();
  assert.deepEqual(refreshed.schedule.stopsByDayId["day-1"].map((stop) => stop.visitStatus), ["SKIPPED", "VISITED"]);
  assert.equal(refreshed.header.routeSkippedStopCount, 1);
  assert.equal(refreshed.header.routeCompletedStopCount, 1);
});

test("서버 재조회 중 순서·체류시간 draft는 유지하고 취소하면 최신 서버 상태로 돌아간다", () => {
  const harness = createHarness();
  harness.render().header.handleStartOrderEditing();
  let editing = harness.render();
  editing.overlays.handleChangeStayMinutes(harness.input.route.days[0], harness.input.route.days[0].stops[0], 95);
  editing.schedule.handleMoveStopToDay("day-1-stop-2", "day-1", "day-2");
  editing = harness.render();
  const draft = structuredClone(editing.schedule.stopsByDayId);
  const result = structuredClone(harness.input.route);
  result.days[0].stops[0].visitStatus = "SKIPPED";
  result.stops = result.days.flatMap((day) => day.stops);
  harness.setRoute(result);
  editing = harness.render();
  assert.equal(editing.header.isOrderEditing, true);
  assert.deepEqual(editing.schedule.stopsByDayId, draft);
  editing.footer.handleCancelOrderEditing();
  const cancelled = harness.render();
  assert.deepEqual(cancelled.schedule.stopsByDayId["day-1"], result.days[0].stops);
});

test("편집 중 DAY 선택과 서버 재조회는 출발지 draft를 유지하고 취소 때 최신 출발지로 돌아간다", async () => {
  const harness = createHarness();
  const route = harness.input.route;
  harness.render().header.handleStartOrderEditing();
  harness.render().schedule.openStartLocationPicker(route.days[1]);
  const draftLocation = { lat: 37.2, lng: 128.3 };
  await harness.render().overlays.handleApplyStartLocation(draftLocation);
  harness.render().schedule.handleSelectDay(route.days[1]);
  const refreshed = structuredClone(route);
  refreshed.days[1].startLocation = { lat: 37.4, lng: 128.5 };
  harness.setRoute(refreshed);
  const editing = harness.render();
  assert.equal(editing.schedule.activeDay.id, "day-2");
  assert.equal(editing.header.isOrderEditing, true);
  assert.deepEqual(editing.schedule.sortedDays[1].startLocation, draftLocation);
  editing.footer.handleCancelOrderEditing();
  assert.deepEqual(harness.render().schedule.sortedDays[1].startLocation, refreshed.days[1].startLocation);
});

test("마지막 방문 한 곳과 기존 건너뜀이 전체를 처리하면 조기 완료 확인을 표시한다", () => {
  const route = createRoute();
  route.days[0].stops[0].visitStatus = "VISITED";
  route.days[0].stops[0].visitedAt = `${display.getTodayDateKey()}T01:00:00.000Z`;
  route.days[1].stops.forEach((stop) => { stop.visitStatus = "SKIPPED"; });
  const harness = createHarness(route);
  const initial = harness.render();
  initial.overlays.handleCompleteStopVisitManually({ routeDay: route.days[0], stop: route.days[0].stops[1] });
  const confirming = harness.render();
  assert.equal(confirming.overlays.earlyRouteCompletionTarget?.stop.id, "day-1-stop-2");
  assert.equal(confirming.overlays.actualStayMinutesTarget, null);
});

test("건너뜀 저장 중 순서 편집을 시작해 요청 결과와 새 draft를 섞지 않는다", () => {
  const harness = createHarness();
  const initial = harness.render();
  harness.startSkip(initial, harness.input.route.days[0], harness.input.route.days[0].stops[0]);
  harness.render().header.handleStartOrderEditing();
  assert.equal(harness.render().header.isOrderEditing, false);
});

test("편집 저장의 응답을 반영한 직후 이전 route prop으로 저장된 값을 되돌리지 않는다", () => {
  const harness = createHarness();
  harness.render().header.handleStartOrderEditing();
  harness.render();
  const saved = structuredClone(harness.input.route);
  saved.days[0].stops[0].stayMinutes = 95;
  saved.days[0].stops.reverse();
  harness.completeLayout(saved);
  const finished = harness.render();
  assert.equal(finished.header.isOrderEditing, false);
  assert.deepEqual(finished.schedule.stopsByDayId["day-1"], saved.days[0].stops);
});

test("편집의 이동·삭제·체류시간 변경은 draft에 모이고 저장은 DAY ID와 현재 순서를 전송한다", () => {
  const harness = createHarness();
  const initial = harness.render();
  initial.header.handleStartOrderEditing();
  let editing = harness.render();
  assert.deepEqual([...editing.schedule.expandedDayIds], ["day-1", "day-2"]);
  assert.equal(editing.footer.isOrderDirty, false);
  editing.footer.handleSaveOrder();
  assert.equal(harness.layoutRequests.length, 0);

  editing.schedule.handleMoveStopToDay("day-1-stop-2", "day-1", "day-2");
  editing.schedule.handleRemoveStopFromLayout("day-2", "day-2-stop-1");
  editing.overlays.handleChangeStayMinutes(harness.input.route.days[1], harness.input.route.days[1].stops[1], 95);
  editing = harness.render();
  assert.deepEqual(editing.schedule.stopsByDayId["day-1"].map((stop) => stop.id), ["day-1-stop-1"]);
  assert.deepEqual(editing.schedule.stopsByDayId["day-2"].map((stop) => [stop.id, stop.stayMinutes]), [["day-2-stop-2", 95], ["day-1-stop-2", 60]]);
  assert.equal(harness.stayRequests.length, 0);
  editing.footer.handleSaveOrder();
  assert.deepEqual(harness.layoutRequests, [{
    routeId: harness.input.route.id,
    days: [
      { dayId: "day-1", stops: [{ stopId: "day-1-stop-1", stayMinutes: 60 }] },
      { dayId: "day-2", stops: [{ stopId: "day-2-stop-2", stayMinutes: 95 }, { stopId: "day-1-stop-2", stayMinutes: 60 }] },
    ],
    deletedDayIds: [],
  }]);
});

test("드래그도 같은 편집 세션을 갱신하고 먼저 바꾼 체류시간과 출발지를 보존한다", async (t) => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const handlers = new Map();
  const frames = new Map();
  let frameId = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    addEventListener: (name, handler) => handlers.set(name, handler),
    removeEventListener: (name, handler) => { if (handlers.get(name) === handler) handlers.delete(name); },
    requestAnimationFrame: (handler) => { frames.set(++frameId, handler); return frameId; },
    cancelAnimationFrame: (id) => frames.delete(id),
  } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  });
  const harness = createHarness();
  const route = harness.input.route;
  harness.render().header.handleStartOrderEditing();
  let editing = harness.render();
  editing.overlays.handleChangeStayMinutes(route.days[0], route.days[0].stops[0], 95);
  editing.schedule.openStartLocationPicker(route.days[1]);
  const location = { lat: 37.2, lng: 128.3 };
  await harness.render().overlays.handleApplyStartLocation(location);
  editing = harness.render();
  editing.schedule.registerDropZone("day-2", 1, { getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100 }) });
  editing.schedule.startDragStop({
    dayId: "day-1", stop: editing.schedule.stopsByDayId["day-1"][0], fromIndex: 0,
    event: { button: 0, pointerId: 1, clientX: 0, clientY: 0, currentTarget: { setPointerCapture() {}, hasPointerCapture: () => false } },
  });
  const pointer = { pointerId: 1, clientX: 50, clientY: 80, preventDefault() {} };
  handlers.get("pointermove")(pointer);
  frames.forEach((frame) => frame());
  assert.equal(harness.render().schedule.draggedStopId, "day-1-stop-1");
  handlers.get("pointerup")(pointer);
  editing = harness.render();
  assert.equal(editing.schedule.draggedStopId, null);
  assert.deepEqual(editing.schedule.stopsByDayId["day-1"].map((stop) => stop.id), ["day-1-stop-2"]);
  assert.deepEqual(editing.schedule.stopsByDayId["day-2"].map((stop) => [stop.id, stop.stayMinutes]), [["day-2-stop-1", 60], ["day-2-stop-2", 60], ["day-1-stop-1", 95]]);
  assert.deepEqual(editing.schedule.sortedDays[1].startLocation, location);
});

test("출발지 선택은 편집 draft에 적용되고 원래 좌표 복원·취소·재시작 때 변경과 picker를 지운다", async () => {
  const route = createRoute();
  route.startLocation = { lat: 37, lng: 128 };
  const harness = createHarness(route);
  harness.render().header.handleStartOrderEditing();
  harness.render().schedule.openStartLocationPicker(route.days[1]);
  let editing = harness.render();
  assert.equal(editing.overlays.startLocationPickerTarget.mode, "draft");
  const location = { lat: 37.2, lng: 128.3 };
  assert.equal(await editing.overlays.handleApplyStartLocation(location), true);
  editing = harness.render();
  assert.deepEqual(editing.schedule.sortedDays[1].startLocation, location);
  assert.equal(editing.footer.isOrderDirty, true);
  assert.equal(await editing.overlays.handleApplyStartLocation(route.startLocation), true);
  editing = harness.render();
  assert.equal(editing.footer.isOrderDirty, false);
  await editing.overlays.handleApplyStartLocation(location);
  harness.render().footer.handleSaveOrder();
  assert.equal(Object.hasOwn(harness.layoutRequests[0].days[0], "startLocation"), false);
  assert.deepEqual(harness.layoutRequests[0].days[1].startLocation, location);
  harness.failLayout();
  harness.render().footer.handleCancelOrderEditing();
  const cancelled = harness.render();
  assert.equal(cancelled.overlays.startLocationPickerTarget, null);
  assert.equal(cancelled.header.isOrderEditing, false);
  assert.equal(cancelled.schedule.sortedDays[1].startLocation, null);
  cancelled.header.handleStartOrderEditing();
  assert.equal(harness.render().footer.isOrderDirty, false);
});

test("DAY 삭제는 확인 뒤 활성 DAY를 옮기고 저장 전 DAY 번호를 보존하며 마지막 DAY를 남긴다", () => {
  const harness = createHarness();
  harness.render().header.handleStartOrderEditing();
  let editing = harness.render();
  editing.schedule.handleRequestDeleteDay(harness.input.route.days[0]);
  assert.equal(harness.render().schedule.sortedDays.length, 2);
  harness.modals.at(-1).actions.find((action) => action.variant === "danger").onClick();
  editing = harness.render();
  assert.equal(editing.schedule.activeDay.id, "day-2");
  assert.deepEqual(editing.schedule.sortedDays.map((day) => [day.id, day.dayIndex]), [["day-2", 2]]);
  assert.equal(editing.schedule.expandedDayIds.has("day-1"), false);
  assert.equal(editing.schedule.expandedDayIds.has("day-2"), true);
  editing.schedule.handleRequestDeleteDay(harness.input.route.days[1]);
  assert.equal(harness.modals.at(-1).title, "마지막 DAY는 남겨둘게요");
  assert.equal(harness.render().schedule.sortedDays.length, 1);
  editing.footer.handleSaveOrder();
  assert.deepEqual(harness.layoutRequests[0].deletedDayIds, ["day-1"]);
  assert.deepEqual(harness.layoutRequests[0].days.map((day) => day.dayId), ["day-2"]);
  const saved = { ...harness.input.route, tripDays: 1, days: [{ ...harness.input.route.days[1], dayIndex: 1 }] };
  harness.completeLayout(saved);
  harness.setRoute(saved);
  const finished = harness.render();
  assert.deepEqual(finished.schedule.sortedDays.map((day) => [day.id, day.dayIndex]), [["day-2", 1]]);
});

test("비활성 DAY 삭제는 선택을 유지하고 활성 마지막 DAY 삭제는 앞 DAY를 선택한다", () => {
  const harness = createHarness();
  const route = harness.input.route;
  const thirdDay = structuredClone(route.days[1]);
  thirdDay.id = "day-3";
  thirdDay.dayIndex = 3;
  thirdDay.stops = [];
  harness.setRoute({ ...route, tripDays: 3, days: [...route.days, thirdDay] });
  harness.render().header.handleStartOrderEditing();
  harness.render().schedule.handleSelectDay(thirdDay);
  let editing = harness.render();
  editing.schedule.handleRequestDeleteDay(route.days[1]);
  harness.modals.at(-1).actions.find((action) => action.variant === "danger").onClick();
  editing = harness.render();
  assert.equal(editing.schedule.activeDay.id, thirdDay.id);
  editing.schedule.handleRequestDeleteDay(thirdDay);
  harness.modals.at(-1).actions.find((action) => action.variant === "danger").onClick();
  assert.equal(harness.render().schedule.activeDay.id, "day-1");
});

test("저장 실패와 재시도는 draft를 유지하고 저장 중 취소를 막으며 완료 때 현재 선택 DAY를 유지한다", () => {
  const harness = createHarness();
  harness.render().header.handleStartOrderEditing();
  let editing = harness.render();
  editing.schedule.handleRemoveStopFromLayout("day-1", "day-1-stop-2");
  editing = harness.render();
  const draft = structuredClone(editing.schedule.stopsByDayId);
  editing.footer.handleSaveOrder();
  editing = harness.render();
  assert.equal(editing.footer.isSavingOrder, true);
  editing.footer.handleCancelOrderEditing();
  editing.footer.handleSaveOrder();
  assert.equal(harness.render().header.isOrderEditing, true);
  assert.equal(harness.layoutRequests.length, 1);
  harness.failLayout();
  editing = harness.render();
  assert.deepEqual(editing.schedule.stopsByDayId, draft);
  assert.equal(editing.footer.isOrderDirty, true);
  editing.footer.handleSaveOrder();
  assert.deepEqual(harness.layoutRequests[1], harness.layoutRequests[0]);
  harness.render().schedule.handleSelectDay(harness.input.route.days[1]);
  harness.render();
  const saved = structuredClone(harness.input.route);
  saved.days[0].stops = draft["day-1"];
  harness.completeLayout(saved);
  const finished = harness.render();
  assert.equal(finished.schedule.activeDay.id, "day-2");
  assert.deepEqual([...finished.schedule.expandedDayIds], ["day-2"]);
  assert.equal(finished.header.isOrderEditing, false);
});
