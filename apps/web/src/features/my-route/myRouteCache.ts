import type { MyRoutesQuery } from "@/generated/graphql";
import {
  addDaysToDateKey,
  getRouteDateKey,
  isVisitedStop,
} from "./routeDisplay";
import type { MyRoute, MyRouteStop } from "./types";

export const MY_ROUTES_QUERY_KEY = ["my-routes"] as const;

function getRouteStopCounts(route: MyRoute) {
  const stops = route.days.flatMap((day) => day.stops);

  return {
    totalStopCount: stops.length,
    completedStopCount: stops.filter(isVisitedStop).length,
  };
}

function refreshRouteCounts(route: MyRoute): MyRoute {
  const { totalStopCount, completedStopCount } = getRouteStopCounts(route);
  const isCompleted =
    totalStopCount > 0 && totalStopCount === completedStopCount;
  const nextStatus = isCompleted
    ? "COMPLETED"
    : route.status === "COMPLETED"
      ? "ACTIVE"
      : route.status;
  const now = new Date().toISOString();
  const nextStartedAt =
    route.startedAt ?? (completedStopCount > 0 ? now : null);

  return {
    ...route,
    status: nextStatus,
    totalStopCount,
    completedStopCount,
    startedAt: nextStartedAt,
    completedAt: isCompleted ? (route.completedAt ?? now) : null,
    stops: route.days.flatMap((day) => day.stops),
  };
}

function updateRoute(
  data: MyRoutesQuery | undefined,
  routeId: string,
  updater: (route: MyRoute) => MyRoute
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    myRoutes: data.myRoutes.map((route) =>
      route.id === routeId ? updater(route) : route
    ),
  };
}

export function upsertMyRouteCache(
  data: MyRoutesQuery | undefined,
  nextRoute: MyRoute
) {
  if (!data) {
    return {
      myRoutes: [nextRoute],
    };
  }

  const hasRoute = data.myRoutes.some((route) => route.id === nextRoute.id);

  return {
    ...data,
    myRoutes: hasRoute
      ? data.myRoutes.map((route) =>
          route.id === nextRoute.id ? nextRoute : route
        )
      : [nextRoute, ...data.myRoutes],
  };
}

export function removeMyRouteCache(
  data: MyRoutesQuery | undefined,
  routeId: string
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    myRoutes: data.myRoutes.filter((route) => route.id !== routeId),
  };
}

export function optimisticReorderRouteStopsCache({
  data,
  routeId,
  dayId,
  stopIds,
}: {
  data: MyRoutesQuery | undefined;
  routeId: string;
  dayId: string;
  stopIds: string[];
}) {
  return updateRoute(data, routeId, (route) => {
    const nextDays = route.days.map((day) => {
      if (day.id !== dayId) {
        return day;
      }

      const stopById = new Map(day.stops.map((stop) => [stop.id, stop]));
      const nextStops = stopIds
        .map((stopId, index) => {
          const stop = stopById.get(stopId);
          return stop ? { ...stop, order: index + 1 } : null;
        })
        .filter((stop): stop is MyRouteStop => Boolean(stop));

      if (nextStops.length !== day.stops.length) {
        return day;
      }

      return {
        ...day,
        stops: nextStops,
      };
    });

    return refreshRouteCounts({
      ...route,
      days: nextDays,
    });
  });
}

export function optimisticVisitRouteStopCache({
  data,
  routeId,
  stopId,
  visited,
  visitedAt,
}: {
  data: MyRoutesQuery | undefined;
  routeId: string;
  stopId: string;
  visited: boolean;
  visitedAt: string;
}) {
  return updateRoute(data, routeId, (route) => {
    const nextVisitStatus: MyRouteStop["visitStatus"] = visited
      ? "VISITED"
      : "PENDING";
    const nextDays = route.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop): MyRouteStop =>
        stop.id === stopId
          ? {
              ...stop,
              visitStatus: nextVisitStatus,
              visitedAt: visited ? visitedAt : null,
            }
          : stop
      ),
    }));

    return refreshRouteCounts({
      ...route,
      days: nextDays,
    });
  });
}

export function optimisticDeleteRouteDayCache({
  data,
  routeId,
  dayId,
}: {
  data: MyRoutesQuery | undefined;
  routeId: string;
  dayId: string;
}) {
  return updateRoute(data, routeId, (route) => {
    if (route.days.length <= 1) {
      return route;
    }

    const startDateKey = getRouteDateKey(route.travelStartDate);
    const nextDays = route.days
      .filter((day) => day.id !== dayId)
      .map((day, index) => ({
        ...day,
        dayIndex: index + 1,
        date: startDateKey ? addDaysToDateKey(startDateKey, index) : day.date,
      }));
    const tripDays = nextDays.length;
    const travelEndDate = startDateKey
      ? addDaysToDateKey(startDateKey, tripDays - 1)
      : (nextDays.at(-1)?.date ?? route.travelEndDate);

    return refreshRouteCounts({
      ...route,
      tripDays,
      travelEndDate,
      days: nextDays,
      status: route.status === "COMPLETED" ? "ACTIVE" : route.status,
    });
  });
}
