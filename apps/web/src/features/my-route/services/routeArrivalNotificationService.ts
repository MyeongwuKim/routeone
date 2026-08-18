import {
  getNextRouteStop,
  getRouteTitle,
  getTodayDateKey,
  getTodayRouteDay,
} from "../routeDisplay";
import type { MyRoute } from "../types";
import {
  nativeBridge,
  type NativeArrivalNotificationPlace,
} from "@/native-bridge";
import { notificationApi } from "@/api/notificationApi";
import type { AppLanguage } from "@/stores/appLanguageStore";

const ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS = 300;

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

    const activeDestination = getNextRouteStop(todayRouteDay);

    if (!activeDestination) {
      return [];
    }

    return [
      {
        id: `${route.id}:${activeDestination.id}`,
        routeId: route.id,
        routeTitle: getRouteTitle(route),
        dayId: todayRouteDay.id,
        dayIndex: todayRouteDay.dayIndex,
        stopId: activeDestination.id,
        title: activeDestination.place.title,
        lat: activeDestination.place.lat,
        lng: activeDestination.place.lng,
      },
    ];
  });
}

export async function syncTodayRouteArrivalNotifications(
  routes: MyRoute[],
  language: AppLanguage
) {
  try {
    const settings = await notificationApi.settings();
    const places = settings.notificationSettings.routeArrivalEnabled
      ? getNativeRouteArrivalNotificationPlaces(routes)
      : [];

    return await nativeBridge.notifications.syncRouteArrivals({
      places,
      radiusMeters: ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS,
      language,
    });
  } catch (error) {
    console.warn(
      "[route-arrival-notifications] sync failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
