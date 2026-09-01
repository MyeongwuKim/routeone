import assert from "node:assert/strict";
import test from "node:test";
import type {
  MyRoute,
  MyRouteDay,
  MyRouteStop,
} from "../src/features/my-route/types";
import {
  createRouteArrivalStartPreview,
  createRouteArrivalVisitPreview,
  getRouteArrivalMonitoringTarget,
  getRouteArrivalMonitoringTargets,
} from "../src/features/my-route/services/routeArrivalNotificationTarget";

const TODAY_KEY = "2026-08-25";

function createStop(
  id: string,
  order: number,
  visited = false
): MyRouteStop {
  return {
    id,
    order,
    visitStatus: visited ? "VISITED" : "PENDING",
    visitedAt: visited ? `${TODAY_KEY}T01:00:00.000Z` : null,
  } as MyRouteStop;
}

function createDay(
  id: string,
  dayIndex: number,
  date: string,
  stops: MyRouteStop[]
): MyRouteDay {
  return {
    id,
    dayIndex,
    date,
    stops,
  } as MyRouteDay;
}

function createRoute(days: MyRouteDay[]) {
  return {
    days,
    stops: days.flatMap((routeDay) => routeDay.stops),
    status: "ACTIVE",
  } as MyRoute;
}

function getTargetStopIds(route: MyRoute, todayKey = TODAY_KEY) {
  return getRouteArrivalMonitoringTargets(route, todayKey).map(
    ({ activeDestination }) => activeDestination.id
  );
}

test("오늘 DAY의 미완료 장소를 order 순서로 모두 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-3", 3),
      createStop("day-1-stop-2", 2),
      createStop("day-1-stop-1", 1),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), [
    "day-1-stop-1",
    "day-1-stop-2",
    "day-1-stop-3",
  ]);
});

test("완료한 장소는 제외하고 같은 DAY의 남은 장소를 모두 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
      createStop("day-1-stop-2", 2),
      createStop("day-1-stop-3", 3),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), [
    "day-1-stop-2",
    "day-1-stop-3",
  ]);
});

test("visitStatus가 PENDING이어도 visitedAt이 있으면 완료 장소로 제외한다", () => {
  const completedByVisitedAt = createStop("day-1-stop-1", 1);
  completedByVisitedAt.visitedAt = `${TODAY_KEY}T01:00:00.000Z`;
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      completedByVisitedAt,
      createStop("day-1-stop-2", 2),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), ["day-1-stop-2"]);
});

test("단일 대상 호환 함수는 오늘 남은 첫 장소를 반환한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-2", 2),
      createStop("day-1-stop-1", 1),
    ]),
  ]);

  assert.equal(
    getRouteArrivalMonitoringTarget(route, TODAY_KEY)?.activeDestination.id,
    "day-1-stop-1"
  );
});

test("방문 완료 예상 루트는 현재 장소를 완료하고 다음 장소를 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1),
      createStop("day-1-stop-2", 2),
    ]),
  ]);
  const preview = createRouteArrivalVisitPreview(
    route,
    "day-1-stop-1",
    `${TODAY_KEY}T02:00:00.000Z`
  );

  assert.equal(
    getRouteArrivalMonitoringTarget(route, TODAY_KEY)?.activeDestination.id,
    "day-1-stop-1"
  );
  assert.equal(
    getRouteArrivalMonitoringTarget(preview, TODAY_KEY)?.activeDestination.id,
    "day-1-stop-2"
  );
});

test("방문 완료 취소 예상 루트는 취소한 장소를 다시 현재 대상으로 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
      createStop("day-1-stop-2", 2),
    ]),
  ]);
  const preview = createRouteArrivalVisitPreview(
    route,
    "day-1-stop-1",
    `${TODAY_KEY}T02:00:00.000Z`,
    false
  );

  assert.equal(
    getRouteArrivalMonitoringTarget(preview, TODAY_KEY)?.activeDestination.id,
    "day-1-stop-1"
  );
  assert.equal(
    preview.days[0]?.stops[0]?.visitStatus,
    "PENDING"
  );
  assert.equal(preview.days[0]?.stops[0]?.visitedAt, null);
});

test("오늘 DAY를 모두 완료해도 미래 DAY 장소는 미리 선택하지 않는다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
      createStop("day-1-stop-2", 2, true),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
      createStop("day-2-stop-2", 2),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), []);
  assert.equal(getRouteArrivalMonitoringTarget(route, TODAY_KEY), null);
});

test("오늘과 일치하는 DAY가 없으면 미래 DAY를 선택하지 않는다", () => {
  const route = createRoute([
    createDay("day-1", 1, "2026-08-24", [
      createStop("day-1-stop-1", 1, true),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), []);
});

test("아직 시작일 전인 여행은 감시 대상을 등록하지 않는다", () => {
  const route = createRoute([
    createDay("day-1", 1, "2026-08-26", [
      createStop("day-1-stop-1", 1),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), []);
});

test("다음 날에는 이전 DAY의 미완료 장소를 건너뛰고 오늘 DAY 전체를 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [createStop("day-1-stop-1", 1)]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
      createStop("day-2-stop-2", 2),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route, "2026-08-26"), [
    "day-2-stop-1",
    "day-2-stop-2",
  ]);
});

test("남은 DAY와 장소가 없으면 감시 대상을 해제한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
    ]),
  ]);

  assert.deepEqual(getTargetStopIds(route), []);
});

test("여행 시작 전 네이티브 등록용 미리보기는 시작일 기준으로 DAY 날짜를 맞춘다", () => {
  const dayStartedAt = `${TODAY_KEY}T01:30:00.000Z`;
  const route = createRoute([
    createDay("day-2", 2, "2026-09-11", [createStop("day-2-stop-1", 1)]),
    createDay("day-1", 1, "2026-09-10", [createStop("day-1-stop-1", 1)]),
  ]);

  const preview = createRouteArrivalStartPreview(
    route,
    TODAY_KEY,
    dayStartedAt
  );

  assert.equal(preview.status, "ACTIVE");
  assert.equal(preview.startedAt, dayStartedAt);
  assert.equal(preview.travelStartDate, TODAY_KEY);
  assert.equal(preview.travelEndDate, "2026-08-26");
  assert.equal(
    preview.days.find((routeDay) => routeDay.id === "day-1")?.date,
    TODAY_KEY
  );
  assert.equal(
    preview.days.find((routeDay) => routeDay.id === "day-2")?.date,
    "2026-08-26"
  );
});

test("여행 시작 전 미리보기에서도 오늘 장소 전체를 감시 대상으로 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, "2026-09-10", [
      createStop("day-1-stop-1", 1),
      createStop("day-1-stop-2", 2),
    ]),
  ]);
  const preview = createRouteArrivalStartPreview(
    route,
    TODAY_KEY,
    `${TODAY_KEY}T01:30:00.000Z`
  );

  assert.deepEqual(getTargetStopIds(preview), [
    "day-1-stop-1",
    "day-1-stop-2",
  ]);
});
