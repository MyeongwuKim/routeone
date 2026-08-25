import type { MyRoute } from "../types";
import {
  getNextRouteStop,
  getRouteDateKey,
  getSortedRouteDays,
} from "../routeDisplay";

export function getRouteArrivalMonitoringTarget(
  route: MyRoute,
  todayKey: string
) {
  const sortedRouteDays = getSortedRouteDays(route);
  const hasStartedRouteDay = sortedRouteDays.some((routeDay) => {
    const dayDateKey = getRouteDateKey(routeDay.date);
    return Boolean(dayDateKey && dayDateKey <= todayKey);
  });

  if (!hasStartedRouteDay) {
    return null;
  }

  for (const routeDay of sortedRouteDays) {
    const dayDateKey = getRouteDateKey(routeDay.date);

    if (!dayDateKey || dayDateKey < todayKey) {
      continue;
    }

    const activeDestination = getNextRouteStop(routeDay);

    if (activeDestination) {
      return {
        activeDestination,
        dayDateKey,
        routeDay,
      };
    }
  }

  return null;
}
