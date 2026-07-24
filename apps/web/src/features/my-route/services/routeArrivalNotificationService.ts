import {
  getNextRouteStop,
  getTodayDateKey,
  getTodayRouteDay,
} from "../routeDisplay";
import type { MyRoute } from "../types";
import {
  nativeBridge,
  type NativeArrivalNotificationPlace,
} from "@/native-bridge";

const ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS = 100;

function isStartedActiveRoute(route: MyRoute) {
  return route.status === "ACTIVE" && Boolean(route.startedAt);
}

function getNativeRouteArrivalNotificationPlaces(
  routes: MyRoute[],
  todayKey = getTodayDateKey()
): NativeArrivalNotificationPlace[] {
  return routes.flatMap((route) => {
    if (!isStartedActiveRoute(route)) {
      return [];
    }

    const todayRouteDay = getTodayRouteDay(route, todayKey);

    if (!todayRouteDay) {
      return [];
    }

    const nextStop = getNextRouteStop(todayRouteDay);

    if (!nextStop) {
      return [];
    }

    return [
      {
        id: `${route.id}:${nextStop.id}`,
        routeId: route.id,
        routeTitle: null,
        dayId: todayRouteDay.id,
        dayIndex: todayRouteDay.dayIndex,
        stopId: nextStop.id,
        title: nextStop.place.title,
        lat: nextStop.place.lat,
        lng: nextStop.place.lng,
      },
    ];
  });
}

export async function syncTodayRouteArrivalNotifications(routes: MyRoute[]) {
  const places = getNativeRouteArrivalNotificationPlaces(routes);

  try {
    return await nativeBridge.notifications.syncRouteArrivals({
      places,
      radiusMeters: ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS,
    });
  } catch (error) {
    console.warn(
      "[route-arrival-notifications] sync failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
