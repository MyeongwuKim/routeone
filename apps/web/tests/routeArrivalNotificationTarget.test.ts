import assert from "node:assert/strict";
import test from "node:test";
import type {
  MyRoute,
  MyRouteDay,
  MyRouteStop,
} from "../src/features/my-route/types";
import { getRouteArrivalMonitoringTarget } from "../src/features/my-route/services/routeArrivalNotificationTarget";

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
  return { days } as MyRoute;
}

test("현재 DAY에서는 첫 미완료 장소 한 곳만 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1),
      createStop("day-1-stop-2", 2),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  const target = getRouteArrivalMonitoringTarget(route, TODAY_KEY);

  assert.equal(target?.routeDay.id, "day-1");
  assert.equal(target?.activeDestination.id, "day-1-stop-1");
});

test("장소 방문 완료 후 같은 DAY의 다음 장소를 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
      createStop("day-1-stop-2", 2),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  const target = getRouteArrivalMonitoringTarget(route, TODAY_KEY);

  assert.equal(target?.routeDay.id, "day-1");
  assert.equal(target?.activeDestination.id, "day-1-stop-2");
});

test("현재 DAY를 모두 완료하면 다음 DAY의 첫 장소를 미리 선택한다", () => {
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

  const target = getRouteArrivalMonitoringTarget(route, TODAY_KEY);

  assert.equal(target?.routeDay.id, "day-2");
  assert.equal(target?.dayDateKey, "2026-08-26");
  assert.equal(target?.activeDestination.id, "day-2-stop-1");
});

test("현재 날짜와 정확히 일치하는 DAY가 없어도 시작된 여행의 다음 DAY를 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, "2026-08-24", [
      createStop("day-1-stop-1", 1, true),
    ]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
    ]),
  ]);

  const target = getRouteArrivalMonitoringTarget(route, TODAY_KEY);

  assert.equal(target?.routeDay.id, "day-2");
  assert.equal(target?.activeDestination.id, "day-2-stop-1");
});

test("아직 시작일 전인 여행은 감시 대상을 등록하지 않는다", () => {
  const route = createRoute([
    createDay("day-1", 1, "2026-08-26", [
      createStop("day-1-stop-1", 1),
    ]),
  ]);

  assert.equal(getRouteArrivalMonitoringTarget(route, TODAY_KEY), null);
});

test("다음 날에는 이전 DAY의 미완료 장소를 건너뛰고 오늘 DAY를 선택한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [createStop("day-1-stop-1", 1)]),
    createDay("day-2", 2, "2026-08-26", [
      createStop("day-2-stop-1", 1),
      createStop("day-2-stop-2", 2),
    ]),
  ]);

  const target = getRouteArrivalMonitoringTarget(route, "2026-08-26");

  assert.equal(target?.routeDay.id, "day-2");
  assert.equal(target?.activeDestination.id, "day-2-stop-1");
});

test("남은 DAY와 장소가 없으면 감시 대상을 해제한다", () => {
  const route = createRoute([
    createDay("day-1", 1, TODAY_KEY, [
      createStop("day-1-stop-1", 1, true),
    ]),
  ]);

  assert.equal(getRouteArrivalMonitoringTarget(route, TODAY_KEY), null);
});
