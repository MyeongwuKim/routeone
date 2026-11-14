import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

let server;
let display;
let cache;
let arrival;
let recovery;
let travel;
let poster;
let sharedCardModel;
let MyRouteCard;
let SharedRouteCard;
const today = "2026-11-13";
const completedAt = `${today}T03:00:00.000Z`;
const values = new Map();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

before(async () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } });
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  display = await server.ssrLoadModule("/src/features/my-route/routeDisplay.ts");
  cache = await server.ssrLoadModule("/src/features/my-route/myRouteCache.ts");
  arrival = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalNotificationTarget.ts");
  recovery = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalMutationRecovery.ts");
  travel = await server.ssrLoadModule("/src/features/my-route/hooks/useDayRouteTravelSegments.ts");
  poster = await server.ssrLoadModule("/src/features/my-route/routeCompletionPoster.ts");
  sharedCardModel = await server.ssrLoadModule("/src/features/shared-route/sharedRouteCardModel.ts");
  ({ default: MyRouteCard } = await server.ssrLoadModule("/src/features/my-route/components/MyRouteCard.tsx"));
  ({ default: SharedRouteCard } = await server.ssrLoadModule("/src/features/shared-route/components/SharedRouteCard.tsx"));
});

after(async () => {
  await server?.close();
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
});

function routeWithStatuses(statuses = ["VISITED", "SKIPPED", "PENDING"]) {
  const stops = statuses.map((visitStatus, index) => ({
    id: `stop-${index + 1}`, order: index + 1, visitStatus,
    visitedAt: visitStatus === "VISITED" ? completedAt : null,
    stayMinutes: 60, travelMinutesFromPrevious: 8,
    checkedInAt: null, checkedOutAt: null, actualStayMinutes: visitStatus === "VISITED" ? 60 : null,
    verificationStatus: "NONE", verifiedAt: null, verificationPhotoUrl: null,
    place: { title: `장소 ${index + 1}`, address: "테스트 주소", lat: 37.76 + index * 0.01, lng: 128.9, imageUrl: null, regionCode: "1", categoryLabel: "관광지" },
  }));
  return {
    id: "skip-route", status: "ACTIVE", totalStopCount: stops.length,
    visibility: "PRIVATE", sharedAt: null, shareTags: [], isMine: false,
    likeCount: 0, saveCount: 0, primaryRegionCode: "1", primaryRegionLabelKey: "32:1",
    owner: { id: "owner", name: "여행자", nickname: "여행자", profileImageUrl: null },
    completedStopCount: statuses.filter((status) => status === "VISITED").length,
    startedAt: `${today}T01:00:00.000Z`, completedAt: null,
    tripDays: 1, travelStartDate: today, travelEndDate: today,
    startLocation: { lat: 37.75, lng: 128.9 }, dailyStartMinutes: 540,
    stops, days: [{ id: "day-1", dayIndex: 1, date: today, startedAt: `${today}T01:00:00.000Z`, startLocation: null, stops }],
  };
}

test("건너뜀은 이전 visitedAt이 남아 있어도 방문이 아니며 방문 수와 진행률을 구분한다", () => {
  const route = routeWithStatuses();
  const skipped = route.stops[1];
  skipped.visitedAt = completedAt;
  assert.equal(display.isVisitedStop(skipped), false);
  assert.equal(display.isSkippedStop(skipped), true);
  assert.equal(display.isResolvedStop(skipped), true);
  assert.equal(display.getDayCompletedStopCount(route.days[0]), 1);
  assert.equal(display.getDaySkippedStopCount(route.days[0]), 1);
  assert.equal(display.getDayResolvedStopCount(route.days[0]), 2);
  assert.equal(display.getDayProgressPercent(route.days[0]), 67);
  assert.equal(display.getRouteProgressPercent(route), 67);
  assert.equal(display.getCurrentRouteStop(route.days[0]).id, "stop-3");
});

test("건너뛴 장소와 완료 장소는 현재 도착 알림 대상에서 제외하고 원래 순서를 보존한다", () => {
  const route = routeWithStatuses(["SKIPPED", "PENDING", "VISITED", "PENDING"]);
  const original = structuredClone(route);
  assert.deepEqual(arrival.getRouteArrivalMonitoringTargets(route, today).map(({ activeDestination }) => activeDestination.id), ["stop-2", "stop-4"]);
  assert.equal(display.getCurrentRouteStop(route.days[0]).id, "stop-2");
  assert.deepEqual(route, original);
});

test("낙관 방문 캐시는 남은 장소와 건너뜀을 모두 처리하면 방문 수를 늘리지 않고 완료한다", () => {
  const route = routeWithStatuses();
  const original = structuredClone(route);
  const next = cache.optimisticVisitRouteStopCache({ data: { myRoutes: [route] }, routeId: route.id, stopId: "stop-3", visited: true, visitedAt: completedAt }).myRoutes[0];
  assert.equal(next.status, "COMPLETED");
  assert.equal(next.totalStopCount, 3);
  assert.equal(next.completedStopCount, 2);
  assert.equal(display.getRouteProgressPercent(next), 100);
  assert.equal(next.stops[1].visitStatus, "SKIPPED");
  const undone = cache.optimisticVisitRouteStopCache({ data: { myRoutes: [next] }, routeId: next.id, stopId: "stop-3", visited: false, visitedAt: completedAt }).myRoutes[0];
  assert.equal(undone.status, "ACTIVE");
  assert.equal(undone.completedStopCount, 1);
  assert.equal(display.getRouteProgressPercent(undone), 67);
  assert.deepEqual(route, original);
});

test("방문 미리보기와 결과 확인은 건너뜀을 방문 완료나 방문 취소 성공으로 오판하지 않는다", () => {
  const route = routeWithStatuses();
  const preview = arrival.createRouteArrivalVisitPreview(route, "stop-3", completedAt);
  assert.equal(preview.status, "COMPLETED");
  assert.equal(preview.completedStopCount, 2);
  assert.equal(recovery.getConfirmedRouteVisitState(route, "stop-2", false), null);
  assert.equal(recovery.getConfirmedRouteVisitState(route, "stop-2", true), null);
});

test("건너뛴 중간 장소를 통과하는 이동은 이전 장소 저장값을 재사용하지 않고 새 구간을 조회한다", () => {
  const route = routeWithStatuses();
  const requests = travel.createDayRouteTravelSegmentRequests({ days: route.days, activeDayId: "day-1", orderedStops: route.stops, routeStartLocation: route.startLocation });
  assert.deepEqual(requests.map(({ from, to }) => [from, to]), [
    [route.startLocation, route.stops[0].place],
    [route.stops[0].place, route.stops[2].place],
  ]);
});

test("방문·건너뜀으로 끝난 DAY 포스터는 방문한 곳만 담고 건너뜀뿐인 DAY는 만들지 않는다", () => {
  const route = routeWithStatuses(["VISITED", "SKIPPED"]);
  route.stops[0].verificationPhotoUrl = "https://example.test/visited.jpg";
  route.stops[1].verificationPhotoUrl = "https://example.test/skipped.jpg";
  route.stops[1].visitedAt = completedAt;
  const stats = poster.getRouteCompletionPosterStats(route);
  assert.equal(stats.canCreate, true);
  assert.equal(stats.completedStopCount, 1);
  assert.equal(stats.photoVerifiedStopCount, 1);
  const emptyStats = poster.getRouteCompletionPosterStats(routeWithStatuses(["SKIPPED"]));
  assert.equal(emptyStats.canCreate, false);
  assert.equal(emptyStats.completedStopCount, 0);
});

test("공유 카드의 장소 칩은 건너뛴 곳을 방문한 장소 목록에 포함하지 않는다", () => {
  const route = routeWithStatuses(["VISITED", "SKIPPED"]);
  assert.deepEqual(sharedCardModel.getDisplayPlaceOptions(route).map((option) => option.name), ["장소 1"]);
});

test("내 기록·공유 카드는 방문과 건너뜀 수를 나누고 건너뛴 장소를 방문 칩으로 그리지 않는다", () => {
  const route = { ...routeWithStatuses(["VISITED", "SKIPPED"]), status: "COMPLETED" };
  route.stops[1].visitedAt = completedAt;
  const history = renderToStaticMarkup(createElement(MyRouteCard, { route, variant: "history", onSelectDay() {} }));
  assert.ok(history.includes("방문 1곳 · 건너뜀 1곳"));
  assert.ok(history.includes("장소 1"));
  assert.equal(history.includes("장소 2"), false);
  const shared = renderToStaticMarkup(createElement(SharedRouteCard, { route, isLiked: false, onToggleLike() {} }));
  assert.ok(shared.includes("방문 1곳 · 건너뜀 1곳"));
  assert.ok(shared.includes("width:100%"));
  assert.equal(shared.includes("장소 2"), false);
});

test("건너뜀·되돌리기·DAY 마무리 결과는 명시 상태로만 확정한다", () => {
  const route = routeWithStatuses(["VISITED", "SKIPPED"]);
  assert.equal(recovery.getConfirmedRouteSkipState(route, "stop-2", true), route);
  assert.equal(recovery.getConfirmedRouteSkipState(route, "stop-2", false), null);
  assert.equal(recovery.getConfirmedRouteSkipState(route, "stop-1", false), null);
  assert.equal(recovery.getConfirmedFinishedRouteDay(route, "day-1"), route);
  assert.equal(recovery.getConfirmedFinishedRouteDay(routeWithStatuses(), "day-1"), null);
  assert.equal(recovery.getConfirmedFinishedRouteDay(routeWithStatuses([]), "day-1"), null);
  assert.equal(recovery.isRouteArrivalTransitionExpectationCommitted({ kind: "stop-skip", stopId: "stop-2", skipped: true }, route), true);
  assert.equal(recovery.isRouteArrivalTransitionExpectationCommitted({ kind: "day-finish", dayId: "day-1" }, route), true);
  const before = recovery.getRouteArrivalTransitionPendingFingerprint({ kind: "day-finish", dayId: "day-1" }, route);
  const after = recovery.getRouteArrivalTransitionPendingFingerprint({ kind: "day-finish", dayId: "day-1" }, routeWithStatuses());
  assert.notEqual(before, after);
});

test("전환 journal은 건너뜀·DAY 마무리 기대 상태를 재실행 후에도 복원한다", async () => {
  const key = "routeone:route-arrival-transition-journal:v1";
  const transition = (routeId, generation, expectation) => ({ routeId, generation, expectation, readyAt: 1, pendingFingerprint: null, stablePendingReadCount: 0 });
  values.set(key, JSON.stringify([
    transition(" route-skip ", 1, { kind: "stop-skip", stopId: " stop-2 ", skipped: true }),
    transition("route-finish", 2, { kind: "day-finish", dayId: " day-1 " }),
  ]));
  const journal = await server.ssrLoadModule("/src/features/my-route/services/routeArrivalTransitionLock.ts?skip-journal");
  assert.deepEqual(journal.getUnresolvedRouteArrivalTransitions().map(({ routeId, expectation }) => ({ routeId, expectation })), [
    { routeId: "route-skip", expectation: { kind: "stop-skip", stopId: "stop-2", skipped: true } },
    { routeId: "route-finish", expectation: { kind: "day-finish", dayId: "day-1" } },
  ]);
  journal.clearRouteArrivalTransitions();
});

test("잘못된 건너뜀·DAY 마무리 journal은 완료로 간주하지 않고 복구 잠금을 유지한다", async () => {
  const key = "routeone:route-arrival-transition-journal:v1";
  for (const [index, expectation] of [
    { kind: "stop-skip", stopId: "stop-2", skipped: "true" },
    { kind: "day-finish", dayId: " " },
  ].entries()) {
    values.set(key, JSON.stringify([{ routeId: "invalid-route", generation: 1, expectation, readyAt: 1, pendingFingerprint: null, stablePendingReadCount: 0 }]));
    const journal = await server.ssrLoadModule(`/src/features/my-route/services/routeArrivalTransitionLock.ts?invalid-skip-${index}`);
    const [unresolved] = journal.getUnresolvedRouteArrivalTransitions();
    assert.equal(unresolved.expectation.kind, "unknown");
    assert.equal(journal.isRouteArrivalTransitionLocked(), true);
    journal.clearRouteArrivalTransitions();
  }
});
