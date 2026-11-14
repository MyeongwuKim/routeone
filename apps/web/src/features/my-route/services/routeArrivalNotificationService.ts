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
  type NativeArrivalNotificationProgress,
} from "@/native-bridge";
import { notificationApi } from "@/api/notificationApi";
import type { AppLanguage } from "@/stores/appLanguageStore";
import { resolvePlaceVerificationPolicy } from "@/lib/placeVerificationPolicy";

/** 방문 처리 전에 권한 요청이 필요했는지와 실패 시 사전 등록을 되돌려야 하는지를 호출부에 알린다. */
export type RouteArrivalVisitTransitionPreparation = {
  requestPermissions: boolean;
  rollbackRequired: boolean;
};

type RouteArrivalProgressHandler = (stage: NativeArrivalNotificationProgress) => void;

type RouteArrivalNotificationSyncOptions = {
  /** 비동기 준비를 마친 뒤 요청 세션이 여전히 유효한지 네이티브 호출 전에 확인한다. */
  assertCurrent?: () => void;

  onProgress?: RouteArrivalProgressHandler;

  routeArrivalEnabled?: boolean;
  /** 준비·서버 요청 대기 중 바뀐 알림 설정을 실제 기기 호출 직전에 다시 읽는다. */
  getRouteArrivalEnabled?: () => boolean | undefined;

  checkCurrentPosition?: boolean;

  waitForCurrentPosition?: boolean;

  requestPermissions?: boolean;

  requireConfirmedRegistration?: boolean;
};

/**
 * 방문 상태 전환 전에 도착 알림 준비가 실패한 원인과 오류 코드를 보관하는 오류 클래스다.
 */
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
        radiusMeters: resolvePlaceVerificationPolicy(activeDestination.place)
          .notificationRadiusMeters,
      },
    ];
  });
}

function syncNativeRouteArrivalNotificationPlaces(
  places: NativeArrivalNotificationPlace[],
  language: AppLanguage,
  options: {
    assertCurrent?: () => void;
    onProgress?: RouteArrivalProgressHandler;
    checkCurrentPosition?: boolean;
    waitForCurrentPosition?: boolean;
    requestPermissions?: boolean;
  } = {}
) {
  options.assertCurrent?.();
  return nativeBridge.notifications.syncRouteArrivals({
    places,
    // 구버전 네이티브 앱은 장소별 반경을 읽지 못하므로 현재 대상 반경을 함께 전달한다.
    radiusMeters: places[0]?.radiusMeters,
    language,
    onProgress: options.onProgress,
    checkCurrentPosition: options.checkCurrentPosition,
    waitForCurrentPosition: options.waitForCurrentPosition,
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
    options.assertCurrent?.();
    const routeArrivalEnabled =
      options.getRouteArrivalEnabled?.() ??
      options.routeArrivalEnabled ??
      (await notificationApi.settings()).notificationSettings
        .routeArrivalEnabled;
    options.assertCurrent?.();
    const currentlyEnabled = options.getRouteArrivalEnabled?.() ?? routeArrivalEnabled;
    let places = currentlyEnabled
      ? getNativeRouteArrivalNotificationPlaces(
          routes,
          getTodayDateKey(),
          preferredRouteId
        )
      : [];

    let result = await syncNativeRouteArrivalNotificationPlaces(
      places,
      language,
      {
        assertCurrent: options.assertCurrent,
        onProgress: options.onProgress,
        checkCurrentPosition: currentlyEnabled ? options.checkCurrentPosition : false,
        waitForCurrentPosition: currentlyEnabled ? options.waitForCurrentPosition : false,
        requestPermissions: currentlyEnabled ? options.requestPermissions : false,
      }
    );

    options.assertCurrent?.();
    // 이미 전달한 등록이 늦게 끝나도, 그사이 확인한 OFF를 마지막 기기 상태로 남긴다.
    if (places.length > 0 && options.getRouteArrivalEnabled?.() === false) {
      places = [];
      result = await syncNativeRouteArrivalNotificationPlaces([], language, {
        assertCurrent: options.assertCurrent,
        checkCurrentPosition: false,
        requestPermissions: false,
      });
      options.assertCurrent?.();
    }
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
    getRouteArrivalEnabled?: () => boolean | undefined;
    assertCurrent?: () => void;
    onProgress?: RouteArrivalProgressHandler;
  } = {}
): Promise<RouteArrivalVisitTransitionPreparation> {
  options.assertCurrent?.();
  if (!nativeBridge.runtime.isAvailable()) {
    return SKIPPED_VISIT_TRANSITION_PREPARATION;
  }

  let routeArrivalEnabled = options.getRouteArrivalEnabled?.() ?? options.routeArrivalEnabled;

  if (routeArrivalEnabled == null) {
    routeArrivalEnabled = (
      await notificationApi.settings()
    ).notificationSettings.routeArrivalEnabled;
  }

  options.assertCurrent?.();
  routeArrivalEnabled = options.getRouteArrivalEnabled?.() ?? routeArrivalEnabled;
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
  options.assertCurrent?.();
  if (options.getRouteArrivalEnabled?.() === false) {
    return SKIPPED_VISIT_TRANSITION_PREPARATION;
  }

  if (!shouldRequireRegistration) {
    let result: Awaited<
      ReturnType<typeof syncNativeRouteArrivalNotificationPlaces>
    >;

    try {
      result = await syncNativeRouteArrivalNotificationPlaces(
        places,
        language,
        {
          assertCurrent: options.assertCurrent,
          checkCurrentPosition: false,
          requestPermissions: false,
          onProgress: options.onProgress,
        }
      );
    } catch (error) {
      options.assertCurrent?.();
      if (options.getRouteArrivalEnabled?.() === false) return SKIPPED_VISIT_TRANSITION_PREPARATION;
      throw new RouteArrivalVisitTransitionPreparationError(
        language === "en"
          ? "The app could not save the next arrival alert target."
          : "앱이 다음 장소 도착 알림 대상을 저장하지 못했어요.",
        false,
        error
      );
    }

    options.assertCurrent?.();
    if (options.getRouteArrivalEnabled?.() === false) return SKIPPED_VISIT_TRANSITION_PREPARATION;
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
        assertCurrent: options.assertCurrent,
        onProgress: options.onProgress,
      }
    );
  } catch (error) {
    options.assertCurrent?.();
    if (options.getRouteArrivalEnabled?.() === false) return SKIPPED_VISIT_TRANSITION_PREPARATION;
    throw new RouteArrivalVisitTransitionPreparationError(
      language === "en"
        ? "The device could not prepare the next place arrival alert."
        : "기기가 다음 장소 도착 알림을 준비하지 못했어요.",
      true,
      error
    );
  }

  options.assertCurrent?.();
  if (options.getRouteArrivalEnabled?.() === false) return SKIPPED_VISIT_TRANSITION_PREPARATION;
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
