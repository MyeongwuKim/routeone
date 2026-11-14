import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import ts from "typescript";

let server;
let display;
let formatting;
let verificationPolicy;
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
  formatting = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteFormatting.ts");
  verificationPolicy = await server.ssrLoadModule("/src/lib/placeVerificationPolicy.ts");
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  text = getUiText("ko");
});
after(async () => { await server?.close(); });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createRoute() {
  const today = display.getTodayDateKey();
  const days = [1, 2].map((dayIndex) => ({
    id: `day-${dayIndex}`, dayIndex, date: today,
    stops: [1, 2].map((order) => ({
      id: `day-${dayIndex}-stop-${order}`, order, visitStatus: "PENDING", visitedAt: null,
      place: { title: `장소 ${dayIndex}-${order}`, lat: 37.5 + order / 100, lng: 127.5, categoryName: "해변" },
    })),
  }));
  return {
    id: "gps-route", days, isMine: true, startedAt: `${today}T00:00:00.000Z`,
    travelStartDate: today, travelEndDate: display.addDaysToDateKey(today, 1),
  };
}

const selectedPosition = { lat: 37.55, lng: 127.55 };
const realPosition = { lat: 37.6, lng: 127.6 };
function nativeResult(position = selectedPosition, patch = {}) {
  return {
    ...position, active: true, stopId: "native-stop", distanceMeters: 10,
    withinRadius: true, notificationScheduled: false,
    backgroundNotificationStatus: "registered", ...patch,
  };
}

// React의 저장 공간과 렌더만 대체하고 자격 판정·대상 선택·비동기 명령은 실제 훅을 실행한다.
function createHarness(overrides = {}) {
  const input = { route: createRoute(), ...overrides };
  const environment = { isAuthenticated: true, user: { id: "owner", role: "OWNER" }, testAccountMode: false, nativeAvailable: true, language: "ko" };
  const nativeCalls = [];
  const positionCalls = [];
  const toasts = [];
  const io = {
    setLocation: async () => nativeResult(),
    readPosition: async () => realPosition,
  };
  const slots = [];
  let cursor = 0;
  let mounted = true;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = {
        value: typeof initial === "function" ? initial() : initial,
        set(value) {
          if (mounted) slots[index].value = typeof value === "function" ? value(slots[index].value) : value;
        },
      };
      return [slots[index].value, slots[index].set];
    },
    useRef(initial) {
      const index = cursor++;
      slots[index] ??= { current: initial };
      return slots[index];
    },
    useMemo(factory, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        slots[index] = { value: factory(), dependencies };
      }
      return slots[index].value;
    },
  };
  const select = (value) => (selector) => selector(value);
  const modules = {
    react,
    "@/components/account/useAccountUser": { useAccountUser: () => ({ user: environment.user }) },
    "@/hooks/useAuthSession": { useAuthSession: () => ({ isAuthenticated: environment.isAuthenticated }) },
    "@/lib/placeVerificationPolicy": verificationPolicy,
    "@/lib/uiText": { useUiText: () => text },
    "@/native-bridge": { nativeBridge: {
      runtime: { isAvailable: () => environment.nativeAvailable },
      notifications: { setRouteArrivalTestLocation: (payload) => { nativeCalls.push(payload); return io.setLocation(payload); } },
    } },
    "@/stores/appLanguageStore": (selector) => selector({ language: environment.language }),
    "@/stores/currentPositionStore": { useCurrentPositionStore: select({
      applyPosition: (position) => positionCalls.push({ kind: "apply", position }),
      clearPosition: () => positionCalls.push({ kind: "clear" }),
      requestCurrentPosition: (options) => { positionCalls.push({ kind: "read", options }); return io.readPosition(options); },
    }) },
    "@/stores/uiToastStore": { useUiToastStore: select({ showToast: (message) => toasts.push(message) }) },
    "../routeDisplay": display,
    "../services/visitPhotoService": { isTestAccountModeEnabled: () => environment.testAccountMode },
    "../utils/dayRouteFormatting": formatting,
  };
  modules["@/stores/appLanguageStore"] = { useAppLanguageStore: modules["@/stores/appLanguageStore"] };
  const source = readFileSync(new URL("../src/features/my-route/hooks/useDayRouteGpsTest.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  new Function("require", "exports", compiled.outputText)((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected GPS hook import: ${specifier}`);
    return modules[specifier];
  }, exports);
  return {
    input, environment, io, nativeCalls, positionCalls, toasts,
    target(dayIndex = 0, stopIndex = 0) { return { routeDay: input.route.days[dayIndex], stop: input.route.days[dayIndex].stops[stopIndex] }; },
    render(patch = {}) {
      assert.equal(mounted, true);
      Object.assign(input, patch);
      cursor = 0;
      return exports.useDayRouteGpsTest(input);
    },
    unmount() { mounted = false; },
  };
}

test("GPS 테스트 자격은 읽기·소급·소유권·시작·로그인·역할·네이티브 조건을 모두 적용한다", async (t) => {
  const cases = [
    ["소유자", {}, {}, true],
    ["검토자", {}, { user: { role: "REVIEWER" } }, true],
    ["테스트 계정 모드", {}, { user: { role: "USER" }, testAccountMode: true }, true],
    ["일반 계정", {}, { user: { role: "USER" } }, false],
    ["사용자 없음", {}, { user: null }, false],
    ["비로그인", {}, { isAuthenticated: false, testAccountMode: true }, false],
    ["네이티브 없음", {}, { nativeAvailable: false }, false],
    ["읽기 전용", { isReadOnly: true }, {}, false],
    ["소급 완료", { visitCompletionMode: "retrospective" }, {}, false],
    ["다른 소유자", { isMine: false }, {}, false],
    ["시작 전", { startedAt: null }, {}, false],
  ];
  for (const [label, options, environment, enabled] of cases) {
    await t.test(label, async () => {
      const h = createHarness({ isReadOnly: options.isReadOnly, visitCompletionMode: options.visitCompletionMode });
      if (Object.hasOwn(options, "isMine")) h.input.route.isMine = options.isMine;
      if (Object.hasOwn(options, "startedAt")) h.input.route.startedAt = options.startedAt;
      Object.assign(h.environment, environment);
      const view = h.render();
      assert.equal(view.isGpsTestEnabled, enabled);
      assert.equal(Boolean(view.indoorTestTarget), enabled);
      if (!enabled) {
        view.openIndoorTest();
        assert.equal(h.render().gpsTestTarget, null);
        assert.equal(await view.handleApplyGpsTestLocation(h.target(), selectedPosition), null);
        assert.equal(await view.handleClearGpsTestLocation(), null);
        assert.deepEqual(h.nativeCalls, []);
        assert.deepEqual(h.toasts, []);
      }
    });
  }
});

test("실내 테스트는 DAY·방문 순서상 첫 미방문을 고르고 건너뜀도 포함한다", () => {
  const h = createHarness();
  const firstDay = h.input.route.days[0];
  firstDay.stops[0].visitStatus = "VISITED";
  firstDay.stops[1].visitStatus = "SKIPPED";
  firstDay.stops[1].visitedAt = "2026-01-01T00:00:00.000Z";
  firstDay.stops.reverse();
  h.input.route.days.reverse();
  const view = h.render();
  assert.equal(view.indoorTestTarget.routeDay.id, "day-1");
  assert.equal(view.indoorTestTarget.stop.id, "day-1-stop-2");
  view.openIndoorTest();
  assert.equal(h.render().gpsTestTarget, view.indoorTestTarget);
  const completed = structuredClone(h.input.route);
  completed.days.forEach((day) => day.stops.forEach((stop) => { stop.visitStatus = "VISITED"; }));
  const allVisited = h.render({ route: completed });
  assert.equal(allVisited.indoorTestTarget, null);
  allVisited.setGpsTestTarget(null);
  allVisited.openIndoorTest();
  assert.equal(h.render().gpsTestTarget, null);
});

test("적용은 실제 정책·현지화·날짜로 네이티브 payload를 만들고 반환 좌표를 공용 위치에 반영한다", async () => {
  const h = createHarness();
  const target = h.target();
  target.routeDay.date = null;
  h.environment.language = "en";
  const response = nativeResult({ lat: 37.7, lng: 127.7 });
  h.io.setLocation = async () => response;
  const startedAt = Date.now();
  const result = await h.render().handleApplyGpsTestLocation(target, selectedPosition);
  assert.equal(result, response);
  assert.deepEqual(h.nativeCalls, [{
    place: {
      id: `gps-route:${target.stop.id}`, routeId: "gps-route",
      routeTitle: formatting.getLocalizedRouteTitle(h.input.route, text),
      dayId: target.routeDay.id, dayIndex: 1, dayDateKey: display.getTodayDateKey(),
      stopId: target.stop.id, title: target.stop.place.title,
      lat: target.stop.place.lat, lng: target.stop.place.lng,
      radiusMeters: 500,
    }, position: selectedPosition, language: "en",
  }]);
  const applied = h.positionCalls[0].position;
  assert.deepEqual({ ...applied, timestamp: 0 }, { lat: 37.7, lng: 127.7, accuracyMeters: 1, timestamp: 0 });
  assert.ok(applied.timestamp >= startedAt && applied.timestamp <= Date.now());
  assert.equal(h.render().gpsTestLocationStopId, target.stop.id);
  assert.deepEqual(h.render().gpsTestLocation, { lat: 37.7, lng: 127.7 });
  assert.equal(h.render().isGpsTestApplying, false);
});

test("적용 성공 안내는 알림 예약·이전 예약·반경·토스트 옵션을 구분한다", async () => {
  const h = createHarness();
  const cases = [
    [{ notificationScheduled: true }, {}, text.dayRoute.gpsTestAppliedWithNotification],
    [{ withinRadius: false }, { notificationWasScheduledEarlier: true }, text.dayRoute.gpsTestAppliedWithNotification],
    [{ withinRadius: true }, {}, text.dayRoute.gpsTestAppliedInsideWithoutNotification],
    [{ withinRadius: false }, {}, text.dayRoute.gpsTestAppliedWithoutNotification],
    [{ notificationScheduled: true }, { showSuccessToast: false }, null],
  ];
  for (const [response, options, expected] of cases) {
    h.io.setLocation = async () => nativeResult(selectedPosition, response);
    h.toasts.length = 0;
    await h.render().handleApplyGpsTestLocation(h.target(), selectedPosition, options);
    assert.deepEqual(h.toasts, expected ? [expected] : []);
  }
});

test("테스트 대상을 바꾸거나 닫고 자격이 바뀌어도 적용 좌표와 장소는 유지한다", async () => {
  const h = createHarness();
  await h.render().handleApplyGpsTestLocation(h.target(), selectedPosition);
  const firstStopId = h.target().stop.id;
  h.render().setGpsTestTarget(h.target(1, 1));
  assert.deepEqual(h.render().gpsTestLocation, selectedPosition);
  assert.equal(h.render().gpsTestLocationStopId, firstStopId);
  h.render().setGpsTestTarget(null);
  h.environment.isAuthenticated = false;
  let view = h.render({ route: { ...h.input.route, id: "another-route" } });
  assert.equal(view.isGpsTestEnabled, false);
  assert.equal(view.gpsTestTarget, null);
  assert.deepEqual(view.gpsTestLocation, selectedPosition);
  assert.equal(view.gpsTestLocationStopId, firstStopId);
  h.environment.isAuthenticated = true;
  view = h.render();
  assert.equal(view.isGpsTestEnabled, true);
  assert.deepEqual(view.gpsTestLocation, selectedPosition);
});

test("네이티브 기능이 없으면 busy 상태를 만들지 않고 다음 요청을 허용한다", async () => {
  const h = createHarness();
  h.io.setLocation = () => null;
  const view = h.render();
  assert.equal(await view.handleApplyGpsTestLocation(h.target(), selectedPosition), null);
  assert.equal(await view.handleClearGpsTestLocation(), null);
  assert.equal(h.render().isGpsTestApplying, false);
  assert.deepEqual(h.positionCalls, []);
  assert.deepEqual(h.toasts, [text.dayRoute.gpsTestUnavailable, text.dayRoute.gpsTestUnavailable]);
  h.io.setLocation = async () => nativeResult();
  assert.ok(await view.handleApplyGpsTestLocation(h.target(), selectedPosition));
});

test("렌더 전의 연속 적용·복귀는 같은 ref로 막고 완료 후 다시 허용한다", async () => {
  const h = createHarness();
  const pending = deferred();
  h.io.setLocation = () => pending.promise;
  const view = h.render();
  const applying = view.handleApplyGpsTestLocation(h.target(), selectedPosition);
  assert.equal(view.isGpsTestApplying, false);
  assert.equal(h.render().isGpsTestApplying, true);
  assert.equal(await view.handleApplyGpsTestLocation(h.target(1), realPosition), null);
  assert.equal(await view.handleClearGpsTestLocation(), null);
  assert.equal(h.nativeCalls.length, 1);
  pending.resolve(nativeResult());
  await applying;
  assert.equal(h.render().isGpsTestApplying, false);
  h.io.setLocation = async () => nativeResult(realPosition);
  await view.handleApplyGpsTestLocation(h.target(1), realPosition);
  assert.equal(h.nativeCalls.length, 2);
});

test("진행 중 대상·권한·route가 바뀌어도 시작한 적용 응답은 원래 장소에 반영한다", async () => {
  const h = createHarness();
  const pending = deferred();
  h.io.setLocation = () => pending.promise;
  const target = h.target();
  const applying = h.render().handleApplyGpsTestLocation(target, selectedPosition);
  const nextTarget = h.target(1);
  h.render().setGpsTestTarget(nextTarget);
  h.environment.user = { role: "USER" };
  h.render({ route: { ...h.input.route, id: "next-route" } });
  pending.resolve(nativeResult());
  await applying;
  const finished = h.render();
  assert.equal(finished.isGpsTestEnabled, false);
  assert.equal(finished.isGpsTestApplying, false);
  assert.equal(finished.gpsTestTarget, nextTarget);
  assert.equal(finished.gpsTestLocationStopId, target.stop.id);
  assert.deepEqual(finished.gpsTestLocation, selectedPosition);
  assert.equal(h.positionCalls[0].kind, "apply");
});

test("반환 콜백은 생성된 렌더의 자격 판정을 유지하고 새 렌더에 최신 판정을 제공한다", async () => {
  const h = createHarness();
  const enabledView = h.render();
  h.environment.isAuthenticated = false;
  const disabledView = h.render();
  assert.equal(await disabledView.handleApplyGpsTestLocation(h.target(), selectedPosition), null);
  assert.ok(await enabledView.handleApplyGpsTestLocation(h.target(), selectedPosition));
  h.environment.isAuthenticated = true;
  assert.equal(await disabledView.handleClearGpsTestLocation(), null);
  assert.equal(h.render().isGpsTestEnabled, true);
  assert.equal(h.nativeCalls.length, 1);
});

test("적용 실패·잘못된 좌표는 기존 적용 좌표를 유지하고 busy를 해제한다", async () => {
  const h = createHarness();
  await h.render().handleApplyGpsTestLocation(h.target(), selectedPosition);
  const cases = [
    [() => Promise.reject(new Error("native failed")), "native failed"],
    [() => Promise.reject("unknown failure"), text.dayRoute.gpsTestMoveFailed],
    [async () => nativeResult({ lat: null, lng: 127.6 }), text.dayRoute.gpsTestMoveFailed],
    [async () => nativeResult({ lat: 37.6, lng: null }), text.dayRoute.gpsTestMoveFailed],
  ];
  for (const [setLocation, message] of cases) {
    h.io.setLocation = setLocation;
    assert.equal(await h.render().handleApplyGpsTestLocation(h.target(1), realPosition), null);
    const view = h.render();
    assert.equal(view.isGpsTestApplying, false);
    assert.deepEqual(view.gpsTestLocation, selectedPosition);
    assert.equal(view.gpsTestLocationStopId, h.target().stop.id);
    assert.equal(h.toasts.at(-1), message);
  }
  assert.equal(h.positionCalls.length, 1);
});

test("복귀는 네이티브 해제 뒤 가상 좌표를 비우고 실제 GPS 조회 완료까지 busy를 유지한다", async () => {
  const h = createHarness();
  await h.render().handleApplyGpsTestLocation(h.target(), selectedPosition);
  h.render().setGpsTestTarget(h.target());
  const nativeClear = deferred();
  const realRead = deferred();
  h.io.setLocation = () => nativeClear.promise;
  h.io.readPosition = () => realRead.promise;
  const clearing = h.render().handleClearGpsTestLocation();
  assert.deepEqual(h.nativeCalls.at(-1), { place: null, language: "ko" });
  assert.deepEqual(h.render().gpsTestLocation, selectedPosition);
  const clearResponse = nativeResult({ lat: null, lng: null }, { active: false, stopId: null });
  nativeClear.resolve(clearResponse);
  await Promise.resolve();
  const restoring = h.render();
  assert.equal(restoring.isGpsTestApplying, true);
  assert.equal(restoring.gpsTestLocation, null);
  assert.equal(restoring.gpsTestLocationStopId, null);
  assert.deepEqual(h.positionCalls.slice(-2), [{ kind: "clear" }, { kind: "read", options: { forceRefresh: true } }]);
  assert.equal(await restoring.handleClearGpsTestLocation(), null);
  assert.equal(await restoring.handleApplyGpsTestLocation(h.target(), selectedPosition), null);
  realRead.resolve(realPosition);
  assert.deepEqual(await clearing, { ...clearResponse, ...realPosition });
  const finished = h.render();
  assert.equal(finished.isGpsTestApplying, false);
  assert.equal(finished.gpsTestTarget.stop.id, h.target().stop.id);
  assert.equal(finished.gpsTestLocation, null);
  assert.equal(h.toasts.at(-1), text.dayRoute.gpsTestCleared);
});

test("네이티브 복귀 실패는 가상 좌표를 유지하고 실제 GPS 실패는 이미 해제한 좌표를 복원하지 않는다", async () => {
  const h = createHarness();
  await h.render().handleApplyGpsTestLocation(h.target(), selectedPosition);
  h.io.setLocation = async () => { throw new Error("clear failed"); };
  assert.equal(await h.render().handleClearGpsTestLocation(), null);
  assert.deepEqual(h.render().gpsTestLocation, selectedPosition);
  assert.equal(h.positionCalls.length, 1);
  assert.equal(h.toasts.at(-1), "clear failed");
  h.io.setLocation = async () => nativeResult(null, { active: false });
  h.io.readPosition = async () => { throw new Error("real GPS failed"); };
  assert.equal(await h.render().handleClearGpsTestLocation(), null);
  assert.equal(h.render().gpsTestLocation, null);
  assert.equal(h.render().gpsTestLocationStopId, null);
  assert.equal(h.render().isGpsTestApplying, false);
  assert.equal(h.toasts.at(-1), "real GPS failed");
  h.io.readPosition = async () => { throw "unknown failure"; };
  assert.equal(await h.render().handleClearGpsTestLocation(), null);
  assert.equal(h.toasts.at(-1), text.dayRoute.gpsTestMoveFailed);
});

test("네이티브 명령의 동기 예외는 busy 설정 전 그대로 전파한다", async () => {
  const h = createHarness();
  h.io.setLocation = () => { throw new Error("synchronous bridge failure"); };
  const view = h.render();
  await assert.rejects(view.handleApplyGpsTestLocation(h.target(), selectedPosition), /synchronous bridge failure/);
  await assert.rejects(view.handleClearGpsTestLocation(), /synchronous bridge failure/);
  assert.equal(h.render().isGpsTestApplying, false);
  assert.deepEqual(h.toasts, []);
});

test("언마운트는 시작한 네이티브 요청이나 성공한 공용 위치 반영을 취소하지 않는다", async () => {
  const h = createHarness();
  const pending = deferred();
  h.io.setLocation = () => pending.promise;
  const applying = h.render().handleApplyGpsTestLocation(h.target(), selectedPosition);
  h.unmount();
  pending.resolve(nativeResult());
  assert.ok(await applying);
  assert.equal(h.nativeCalls.length, 1);
  assert.equal(h.positionCalls[0].kind, "apply");
  assert.equal(h.toasts.at(-1), text.dayRoute.gpsTestAppliedInsideWithoutNotification);
});
