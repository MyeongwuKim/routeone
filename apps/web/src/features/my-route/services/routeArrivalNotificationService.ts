import {
  getRouteTitle,
  getTodayDateKey,
} from "../routeDisplay";
import type { MyRoute } from "../types";
import { getRouteArrivalMonitoringTarget } from "./routeArrivalNotificationTarget";
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
  todayKey = getTodayDateKey(),
  preferredRouteId?: string
): NativeArrivalNotificationPlace[] {
  const prioritizedRoutes = [...routes].sort((left, right) => {
    if (left.id === preferredRouteId && right.id === preferredRouteId) {
      return 0;
    }

    if (left.id === preferredRouteId) {
      return -1;
    }

    if (right.id === preferredRouteId) {
      return 1;
    }

    return (right.startedAt ?? "").localeCompare(left.startedAt ?? "");
  });

  return prioritizedRoutes.flatMap((route) => {
    if (!isStartedActiveRoute(route)) {
      return [];
    }

    const monitoringTarget = getRouteArrivalMonitoringTarget(route, todayKey);

    if (!monitoringTarget) {
      return [];
    }

    const { activeDestination, dayDateKey, routeDay } = monitoringTarget;

    return [
      {
        id: `${route.id}:${activeDestination.id}`,
        routeId: route.id,
        routeTitle: getRouteTitle(route),
        dayId: routeDay.id,
        dayIndex: routeDay.dayIndex,
        dayDateKey,
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
  language: AppLanguage,
  preferredRouteId?: string
) {
  try {
    const settings = await notificationApi.settings();
    const places = settings.notificationSettings.routeArrivalEnabled
      ? getNativeRouteArrivalNotificationPlaces(
          routes,
          getTodayDateKey(),
          preferredRouteId
        )
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
    throw error;
  }
}
