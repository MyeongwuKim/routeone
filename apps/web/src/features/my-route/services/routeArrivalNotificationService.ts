/**
 * 용도:
 * 진행 중인 여행의 오늘 첫 미완료 장소를 네이티브 도착 알림과 동기화한다.
 *
 * 요청 흐름:
 * 일반 동기화에서는 현재 대상 하나만 유지한다. 방문 완료 직전에는
 * 현재·다음 대상을 함께 사전 등록해 API 처리 도중에도 감시가 끊기지 않게 한다.
 */
import { getRouteTitle, getTodayDateKey } from "../routeDisplay";
import type { MyRoute } from "../types";
import {
  createRouteArrivalStartPreview,
  getRouteArrivalMonitoringTarget,
} from "./routeArrivalNotificationTarget";
import { canRequireRouteArrivalRegistration } from "./routeStartLocationPermissionService";
import {
  nativeBridge,
  type NativeArrivalNotificationPlace,
} from "@/native-bridge";
import { notificationApi } from "@/api/notificationApi";
import type { AppLanguage } from "@/stores/appLanguageStore";

const ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS = 300;

export type RouteArrivalVisitTransitionPreparation = {
  requestPermissions: boolean;
  rollbackRequired: boolean;
};

type RouteArrivalNotificationSyncOptions = {
  routeArrivalEnabled?: boolean;
  checkCurrentPosition?: boolean;
  requestPermissions?: boolean;
  requireConfirmedRegistration?: boolean;
};

export class RouteArrivalVisitTransitionPreparationError extends Error {
  readonly requestPermissions: boolean;
  readonly originalError: unknown;

  constructor(
    message: string,
    requestPermissions: boolean,
    originalError?: unknown
  ) {
    super(message);
    this.name = "RouteArrivalVisitTransitionPreparationError";
    this.requestPermissions = requestPermissions;
    this.originalError = originalError;
  }
}

const SKIPPED_VISIT_TRANSITION_PREPARATION: RouteArrivalVisitTransitionPreparation = {
  requestPermissions: false,
  rollbackRequired: false,
};

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

function syncNativeRouteArrivalNotificationPlaces(
  places: NativeArrivalNotificationPlace[],
  language: AppLanguage,
  options: {
    checkCurrentPosition?: boolean;
    requestPermissions?: boolean;
  } = {}
) {
  return nativeBridge.notifications.syncRouteArrivals({
    places,
    radiusMeters: ROUTE_ARRIVAL_NOTIFICATION_RADIUS_METERS,
    language,
    checkCurrentPosition: options.checkCurrentPosition,
    requestPermissions: options.requestPermissions,
  });
}

function hasConfirmedRouteArrivalRegistration(
  result: Awaited<
    ReturnType<typeof nativeBridge.notifications.syncRouteArrivals>
  >,
  requestedPlaceCount: number
) {
  if (!result || result.activeCount !== requestedPlaceCount) {
    return false;
  }

  if (requestedPlaceCount === 0) {
    return result.registrationStatus === "inactive";
  }

  return (
    result.registrationStatus === "registered" ||
    result.registrationStatus === "delivered"
  );
}

function mergeRouteArrivalNotificationPlaces(
  currentPlaces: NativeArrivalNotificationPlace[],
  nextPlaces: NativeArrivalNotificationPlace[]
) {
  const placeById = new Map<string, NativeArrivalNotificationPlace>();

  for (const place of [...currentPlaces, ...nextPlaces]) {
    const targetId = `${place.routeId}:${place.stopId}`;

    if (!placeById.has(targetId)) {
      placeById.set(targetId, place);
    }
  }

  return [...placeById.values()];
}

export async function syncTodayRouteArrivalNotifications(
  routes: MyRoute[],
  language: AppLanguage,
  preferredRouteId?: string,
  options: RouteArrivalNotificationSyncOptions = {}
) {
  try {
    const routeArrivalEnabled =
      options.routeArrivalEnabled ??
      (await notificationApi.settings()).notificationSettings
        .routeArrivalEnabled;
    const places = routeArrivalEnabled
      ? getNativeRouteArrivalNotificationPlaces(
          routes,
          getTodayDateKey(),
          preferredRouteId
        )
      : [];

    const result = await syncNativeRouteArrivalNotificationPlaces(
      places,
      language,
      {
        checkCurrentPosition: options.checkCurrentPosition,
        requestPermissions: options.requestPermissions,
      }
    );

    if (
      options.requireConfirmedRegistration &&
      !hasConfirmedRouteArrivalRegistration(result, places.length)
    ) {
      throw new Error(
        language === "en"
          ? "The device did not confirm the place arrival alert update."
          : "기기가 장소 도착 알림 갱신을 확인하지 못했어요."
      );
    }

    return result;
  } catch (error) {
    console.warn(
      "[route-arrival-notifications] sync failed",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

export function syncRouteArrivalNotificationsAfterVisitChange(
  routes: MyRoute[],
  language: AppLanguage,
  preferredRouteId: string,
  options: Omit<
    RouteArrivalNotificationSyncOptions,
    "checkCurrentPosition"
  > = {}
) {
  return syncTodayRouteArrivalNotifications(
    routes,
    language,
    preferredRouteId,
    {
      ...options,
      // 등록 시점에 이미 다음 장소 반경 안이면 OS 진입 이벤트가 없으므로
      // 현재 위치를 확인해 즉시 도착 알림을 보낸다.
      checkCurrentPosition: true,
    }
  );
}

export async function prepareRouteArrivalNotificationsForVisitTransition(
  currentRoutes: MyRoute[],
  nextRoutes: MyRoute[],
  language: AppLanguage,
  preferredRouteId: string,
  options: {
    routeArrivalEnabled?: boolean;
  } = {}
): Promise<RouteArrivalVisitTransitionPreparation> {
  if (!nativeBridge.runtime.isAvailable()) {
    return SKIPPED_VISIT_TRANSITION_PREPARATION;
  }

  let routeArrivalEnabled = options.routeArrivalEnabled;

  if (routeArrivalEnabled == null) {
    routeArrivalEnabled = (
      await notificationApi.settings()
    ).notificationSettings.routeArrivalEnabled;
  }

  if (!routeArrivalEnabled) {
    return SKIPPED_VISIT_TRANSITION_PREPARATION;
  }

  const todayKey = getTodayDateKey();
  const places = mergeRouteArrivalNotificationPlaces(
    getNativeRouteArrivalNotificationPlaces(
      currentRoutes,
      todayKey,
      preferredRouteId
    ),
    getNativeRouteArrivalNotificationPlaces(
      nextRoutes,
      todayKey,
      preferredRouteId
    )
  );
  const shouldRequireRegistration =
    await canRequireRouteArrivalRegistration();

  if (!shouldRequireRegistration) {
    let result: Awaited<
      ReturnType<typeof syncNativeRouteArrivalNotificationPlaces>
    >;

    try {
      result = await syncNativeRouteArrivalNotificationPlaces(
        places,
        language,
        {
          checkCurrentPosition: false,
          requestPermissions: false,
        }
      );
    } catch (error) {
      throw new RouteArrivalVisitTransitionPreparationError(
        language === "en"
          ? "The app could not save the next arrival alert target."
          : "앱이 다음 장소 도착 알림 대상을 저장하지 못했어요.",
        false,
        error
      );
    }

    if (result === null) {
      throw new RouteArrivalVisitTransitionPreparationError(
        language === "en"
          ? "The app did not confirm the next arrival alert target was saved."
          : "앱이 다음 장소 도착 알림 대상 저장을 확인하지 못했어요.",
        false
      );
    }

    return {
      requestPermissions: false,
      rollbackRequired: true,
    };
  }

  let result: Awaited<
    ReturnType<typeof syncNativeRouteArrivalNotificationPlaces>
  >;

  try {
    result = await syncNativeRouteArrivalNotificationPlaces(
      places,
      language,
      {
        checkCurrentPosition: false,
      }
    );
  } catch (error) {
    throw new RouteArrivalVisitTransitionPreparationError(
      language === "en"
        ? "The device could not prepare the next place arrival alert."
        : "기기가 다음 장소 도착 알림을 준비하지 못했어요.",
      true,
      error
    );
  }

  if (!hasConfirmedRouteArrivalRegistration(result, places.length)) {
    throw new RouteArrivalVisitTransitionPreparationError(
      language === "en"
        ? "The device did not prepare the next place arrival alert."
        : "기기가 다음 장소 도착 알림을 준비하지 못했어요.",
      true
    );
  }

  return {
    requestPermissions: true,
    rollbackRequired: true,
  };
}

export async function prepareRouteArrivalNotificationsForStart(
  routes: MyRoute[],
  route: MyRoute,
  startedAt: string,
  dayStartedAt: string,
  language: AppLanguage,
  routeArrivalEnabled: boolean,
  options: {
    requestPermissions?: boolean;
    requireConfirmedRegistration?: boolean;
  } = {}
) {
  const previewRoute = createRouteArrivalStartPreview(
    route,
    startedAt,
    dayStartedAt
  );
  const hasRoute = routes.some((candidateRoute) => candidateRoute.id === route.id);
  const nextRoutes = hasRoute
    ? routes.map((candidateRoute) =>
        candidateRoute.id === route.id ? previewRoute : candidateRoute
      )
    : [...routes, previewRoute];

  if (!nativeBridge.runtime.isAvailable()) {
    return null;
  }

  const requestedPlaceCount = routeArrivalEnabled
    ? getNativeRouteArrivalNotificationPlaces(
        nextRoutes,
        getTodayDateKey(),
        route.id
      ).length
    : 0;

  const result = await syncTodayRouteArrivalNotifications(
    nextRoutes,
    language,
    route.id,
    {
      routeArrivalEnabled,
      checkCurrentPosition: false,
      requestPermissions: options.requestPermissions,
    }
  );
  const hasConfirmedRegistration = hasConfirmedRouteArrivalRegistration(
    result,
    requestedPlaceCount
  );

  if (
    routeArrivalEnabled &&
    requestedPlaceCount > 0 &&
    (options.requireConfirmedRegistration ?? true) &&
    !hasConfirmedRegistration
  ) {
    throw new Error(
      language === "en"
        ? "The device did not register the place arrival alert."
      : "기기가 장소 도착 알림을 등록하지 못했어요."
    );
  }

  if (routeArrivalEnabled && requestedPlaceCount > 0 && result === null) {
    throw new Error(
      language === "en"
        ? "The app did not confirm the place arrival alert target was saved."
        : "앱이 장소 도착 알림 대상 저장을 확인하지 못했어요."
    );
  }

  return result;
}
