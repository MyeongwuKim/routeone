/**
 * 용도:
 * 여행 시작 전 미리보기와 오늘 등록할 장소 도착 알림 대상을 구성한다.
 *
 * 동작 방식:
 * 시작일을 기준으로 DAY 날짜를 맞추고, 오늘 DAY의 미완료 장소만
 * 일정 순서대로 반환한다. 미래 DAY는 조기 알림을 막기 위해 등록하지 않는다.
 */
import type { MyRoute } from "../types";
import {
  addDaysToDateKey,
  getRouteDateKey,
  getSortedRouteDays,
  getTodayDateKey,
  isVisitedStop,
} from "../routeDisplay";

export function createRouteArrivalStartPreview(
  route: MyRoute,
  startedAt: string,
  dayStartedAt: string
): MyRoute {
  const startDateKey = getRouteDateKey(startedAt) ?? getTodayDateKey();
  const sortedDays = getSortedRouteDays(route);
  const dateByDayId = new Map(
    sortedDays.map((routeDay, index) => [
      routeDay.id,
      addDaysToDateKey(startDateKey, index),
    ])
  );

  return {
    ...route,
    status: "ACTIVE",
    startedAt: dayStartedAt,
    completedAt: null,
    travelStartDate: startDateKey,
    travelEndDate: addDaysToDateKey(
      startDateKey,
      Math.max(0, sortedDays.length - 1)
    ),
    days: route.days.map((routeDay) => ({
      ...routeDay,
      date: dateByDayId.get(routeDay.id) ?? routeDay.date,
      ...(routeDay.dayIndex === 1 ? { startedAt: dayStartedAt } : {}),
    })),
  };
}

export function createRouteArrivalVisitPreview(
  route: MyRoute,
  stopId: string,
  visitedAt: string,
  visited = true
): MyRoute {
  const markVisited = (stop: MyRoute["stops"][number]) =>
    stop.id === stopId
      ? {
          ...stop,
          visitStatus: visited ? ("VISITED" as const) : ("PENDING" as const),
          visitedAt: visited ? visitedAt : null,
        }
      : stop;
  const days = route.days.map((routeDay) => ({
    ...routeDay,
    stops: routeDay.stops.map(markVisited),
  }));
  const dayStops = days.flatMap((routeDay) => routeDay.stops);
  const totalStopCount = dayStops.length;
  const completedStopCount = dayStops.filter(isVisitedStop).length;
  const isCompleted =
    totalStopCount > 0 && completedStopCount === totalStopCount;

  return {
    ...route,
    days,
    stops: route.stops.map(markVisited),
    totalStopCount,
    completedStopCount,
    status: isCompleted
      ? "COMPLETED"
      : route.status === "COMPLETED"
        ? "ACTIVE"
        : route.status,
    completedAt: isCompleted ? (route.completedAt ?? visitedAt) : null,
  };
}

export function getRouteArrivalMonitoringTargets(
  route: MyRoute,
  todayKey: string
) {
  return getSortedRouteDays(route).flatMap((routeDay) => {
    const dayDateKey = getRouteDateKey(routeDay.date);

    if (dayDateKey !== todayKey) {
      return [];
    }

    return [...routeDay.stops]
      .sort((left, right) => left.order - right.order)
      .filter((stop) => !isVisitedStop(stop))
      .map((activeDestination) => ({
        activeDestination,
        dayDateKey,
        routeDay,
      }));
  });
}

export function getRouteArrivalMonitoringTarget(
  route: MyRoute,
  todayKey: string
) {
  return getRouteArrivalMonitoringTargets(route, todayKey)[0] ?? null;
}
