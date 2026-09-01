/**
 * 용도:
 * 로그인된 네이티브 앱에서 진행 중인 여행과 iOS 장소 도착 알림 상태를 맞춘다.
 *
 * 동작 방식:
 * 앱 실행과 포그라운드 복귀 시 최신 일정·알림 설정을 조회하고,
 * 위치 권한이 준비되어 있으면 현재 도착 알림 대상을 네이티브에 동기화한다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_SETTINGS_QUERY_KEY,
} from "@/api/notificationApi";
import { routeApi } from "@/api/routeApi";
import { useLocalizedMyRoutes } from "../hooks/useLocalizedMyRoutes";
import { MY_ROUTES_QUERY_KEY } from "../myRouteCache";
import { syncTodayRouteArrivalNotifications } from "../services/routeArrivalNotificationService";
import {
  canRequireRouteArrivalRegistration,
  canSyncRouteArrivalForCurrentPermission,
} from "../services/routeStartLocationPermissionService";
import {
  deferRouteArrivalTransitionReconciliation,
  getRouteArrivalTransitionReconciliationDelayMs,
  getUnresolvedRouteArrivalTransitions,
  hasActiveRouteArrivalTransition,
  isRouteArrivalTransitionLocked,
  recordRouteArrivalTransitionPendingObservation,
  resolveRouteArrivalTransition,
  subscribeRouteArrivalTransitionLock,
} from "../services/routeArrivalTransitionLock";
import {
  getRouteArrivalTransitionPendingFingerprint,
  isRouteArrivalTransitionExpectationCommitted,
} from "../services/routeArrivalMutationRecovery";
import { getAuthToken } from "@/lib/authToken";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";

function RouteArrivalNotificationCoordinator() {
  const { pathname } = useLocation();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const [transitionRevision, setTransitionRevision] = useState(0);
  const isEnabled =
    Boolean(pathname && getAuthToken()) && nativeBridge.runtime.isAvailable();
  const routesQuery = useQuery({
    queryKey: MY_ROUTES_QUERY_KEY,
    queryFn: () => routeApi.myRoutes(),
    enabled: isEnabled,
  });
  const notificationSettingsQuery = useQuery({
    queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
    queryFn: () => notificationApi.settings(),
    enabled: isEnabled,
    staleTime: 60_000,
    retry: false,
  });
  const refetchRoutes = routesQuery.refetch;
  const refetchNotificationSettings = notificationSettingsQuery.refetch;
  const sourceRoutes = useMemo(
    () => routesQuery.data?.myRoutes ?? [],
    [routesQuery.data]
  );
  const {
    routes: localizedRoutes,
    isLoading: isLocalizationLoading,
  } = useLocalizedMyRoutes(sourceRoutes);
  const refreshRouteArrivalState = useCallback(
    () =>
      Promise.all([
        refetchRoutes(),
        refetchNotificationSettings(),
      ]),
    [refetchNotificationSettings, refetchRoutes]
  );

  useEffect(
    () =>
      subscribeRouteArrivalTransitionLock(() => {
        setTransitionRevision((currentRevision) => currentRevision + 1);
      }),
    []
  );

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const requestRouteArrivalRefresh = () => {
      void refreshRouteArrivalState();
      setTransitionRevision((currentRevision) => currentRevision + 1);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestRouteArrivalRefresh();
      }
    };

    const unsubscribeAppActive =
      nativeBridge.events.subscribeAppActive(requestRouteArrivalRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", requestRouteArrivalRefresh);

    return () => {
      unsubscribeAppActive();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      window.removeEventListener("online", requestRouteArrivalRefresh);
    };
  }, [isEnabled, refreshRouteArrivalState]);

  useEffect(() => {
    if (!isEnabled) {
      return;
    }

    const unresolvedTransitions =
      getUnresolvedRouteArrivalTransitions();

    if (unresolvedTransitions.length === 0) {
      return;
    }

    const reconciliationDelayMs =
      getRouteArrivalTransitionReconciliationDelayMs();

    if (reconciliationDelayMs === null) {
      return;
    }

    if (reconciliationDelayMs > 0) {
      const timeoutId = window.setTimeout(() => {
        setTransitionRevision((currentRevision) => currentRevision + 1);
      }, reconciliationDelayMs);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (hasActiveRouteArrivalTransition()) {
      return;
    }

    let isActive = true;
    let transitionsToRetry = unresolvedTransitions;

    void (async () => {
      const [routesResult, settingsResult] =
        await refreshRouteArrivalState();

      if (!isActive || hasActiveRouteArrivalTransition()) {
        return;
      }

      if (
        routesResult.isError ||
        !routesResult.data ||
        settingsResult.isError ||
        !settingsResult.data
      ) {
        transitionsToRetry.forEach((transition) => {
          deferRouteArrivalTransitionReconciliation(
            transition.routeId,
            transition.generation
          );
        });
        return;
      }

      const currentTransitions = getUnresolvedRouteArrivalTransitions();

      if (
        currentTransitions.length === 0 ||
        (getRouteArrivalTransitionReconciliationDelayMs() ?? 0) > 0
      ) {
        return;
      }

      transitionsToRetry = currentTransitions;
      const routeById = new Map(
        routesResult.data.myRoutes.map((route) => [route.id, route])
      );
      let needsAnotherStableRead = false;

      currentTransitions.forEach((transition) => {
        const currentRoute = routeById.get(transition.routeId);

        if (
          isRouteArrivalTransitionExpectationCommitted(
            transition.expectation,
            currentRoute
          )
        ) {
          return;
        }

        const pendingFingerprint =
          getRouteArrivalTransitionPendingFingerprint(
            transition.expectation,
            currentRoute
          );

        if (
          transition.pendingFingerprint === pendingFingerprint &&
          transition.stablePendingReadCount >= 1
        ) {
          return;
        }

        needsAnotherStableRead = true;
        recordRouteArrivalTransitionPendingObservation(
          transition.routeId,
          transition.generation,
          pendingFingerprint
        );
      });

      if (needsAnotherStableRead || !isActive) {
        return;
      }

      const shouldRequireRegistration =
        await canRequireRouteArrivalRegistration();

      if (!isActive || hasActiveRouteArrivalTransition()) {
        return;
      }

      const syncResult = await syncTodayRouteArrivalNotifications(
        routesResult.data.myRoutes,
        appLanguage,
        undefined,
        {
          routeArrivalEnabled:
            settingsResult.data.notificationSettings.routeArrivalEnabled,
          checkCurrentPosition: shouldRequireRegistration,
          requestPermissions: shouldRequireRegistration,
          requireConfirmedRegistration: shouldRequireRegistration,
        }
      );

      if (!shouldRequireRegistration && syncResult === null) {
        throw new Error(
          "Native route arrival target storage did not respond"
        );
      }

      if (!isActive || hasActiveRouteArrivalTransition()) {
        return;
      }

      currentTransitions.forEach((transition) => {
        resolveRouteArrivalTransition(
          transition.routeId,
          transition.generation
        );
      });
    })().catch((error) => {
      transitionsToRetry.forEach((transition) => {
        deferRouteArrivalTransitionReconciliation(
          transition.routeId,
          transition.generation
        );
      });
      console.warn(
        "[route-arrival-notifications] unresolved transition reconciliation failed",
        error instanceof Error ? error.message : error
      );
    });

    return () => {
      isActive = false;
    };
  }, [
    appLanguage,
    isEnabled,
    refreshRouteArrivalState,
    transitionRevision,
  ]);

  useEffect(() => {
    if (
      !isEnabled ||
      routesQuery.isLoading ||
      routesQuery.isFetching ||
      routesQuery.isError ||
      notificationSettingsQuery.isLoading ||
      notificationSettingsQuery.isFetching ||
      notificationSettingsQuery.isError ||
      isLocalizationLoading ||
      isRouteArrivalTransitionLocked()
    ) {
      return;
    }

    let isActive = true;

    void (async () => {
      if (
        !(await canSyncRouteArrivalForCurrentPermission()) ||
        !isActive ||
        isRouteArrivalTransitionLocked()
      ) {
        return;
      }

      await syncTodayRouteArrivalNotifications(
        localizedRoutes,
        appLanguage,
        undefined,
        {
          routeArrivalEnabled:
            notificationSettingsQuery.data?.notificationSettings
              .routeArrivalEnabled,
        }
      );
    })().catch((error) => {
      console.warn(
        "[route-arrival-notifications] global sync failed",
        error instanceof Error ? error.message : error
      );
    });

    return () => {
      isActive = false;
    };
  }, [
    appLanguage,
    isEnabled,
    isLocalizationLoading,
    localizedRoutes,
    notificationSettingsQuery.data?.notificationSettings.routeArrivalEnabled,
    notificationSettingsQuery.isError,
    notificationSettingsQuery.isFetching,
    notificationSettingsQuery.isLoading,
    routesQuery.isError,
    routesQuery.isFetching,
    routesQuery.isLoading,
    transitionRevision,
  ]);

  return null;
}

export default RouteArrivalNotificationCoordinator;
