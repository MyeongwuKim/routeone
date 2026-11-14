import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import { NOTIFICATION_SETTINGS_QUERY_KEY } from "@/api/notificationApi";
import type { MyRoutesQuery, NotificationSettingsQuery, RouteByIdQuery } from "@/generated/graphql";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { nativeBridge } from "@/native-bridge";
import { MY_ROUTES_QUERY_KEY, MY_ROUTE_HISTORY_QUERY_KEY, upsertMyRouteCache } from "../myRouteCache";
import type { MyRoute } from "../types";
import { createRouteSkippingPreview, confirmsRouteSkipping, type RouteSkippingOperation } from "../models/routeSkipping";
import { isDefinitiveRouteMutationFailure, isRouteStopVisitConflict } from "../services/routeArrivalMutationRecovery";
import {
  acquireRouteArrivalTransitionLock, isRouteArrivalTransitionLocked,
  markRouteArrivalTransitionUnresolved, markRouteArrivalTransitionRequestDispatched,
  resolveRouteArrivalTransition,
} from "../services/routeArrivalTransitionLock";
import {
  prepareRouteArrivalNotificationsForVisitTransition,
  syncTodayRouteArrivalNotifications, syncRouteArrivalNotificationsAfterVisitChange,
  RouteArrivalVisitTransitionPreparationError,
  type RouteArrivalVisitTransitionPreparation,
} from "../services/routeArrivalNotificationService";

/**
 * 건너뛰기·DAY 마치기를 서버에 저장하고 방문 목록과 도착 알림을 같은 확정 상태로 맞춘다.
 * 응답 유실은 재조회로 확인하며, 확인할 수 없으면 기존·예상 알림 대상을 유지해 복구 작업에 맡긴다.
 * 방문 충돌은 재전송하지 않고 최신 서버 목록·알림을 확인하며, 조회 실패 시 journal을 보존한다.
 */
export function useRouteSkippingMutation({ route, blocked, onSuccess }: {
  route: MyRoute;
  blocked: boolean;
  onSuccess: (route: MyRoute) => void;
}) {
  const client = useQueryClient();
  const text = useUiText();
  const language = useAppLanguageStore((state) => state.language);
  const showToast = useUiToastStore((state) => state.showToast);
  const inFlight = useRef(false);

  const mutation = useMutation({
    onMutate: () => ({ authToken: getAuthToken() }),
    mutationFn: async (operation: RouteSkippingOperation) => {
      const authToken = getAuthToken();
      const release = acquireRouteArrivalTransitionLock(route.id);
      const cached = client.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY)?.myRoutes;
      let currentRoutes = cached?.length ? cached : [route];
      const currentRoute = currentRoutes.find((item) => item.id === route.id) ?? route;
      const nextRoutes = currentRoutes.map((item) => item.id === route.id ? createRouteSkippingPreview(currentRoute, operation) : item);
      const getRouteArrivalEnabled = () => client.getQueryData<NotificationSettingsQuery>(NOTIFICATION_SETTINGS_QUERY_KEY)?.notificationSettings.routeArrivalEnabled;
      const arrivalEnabled = getRouteArrivalEnabled();
      const assertCurrent = () => {
        if (getAuthToken() !== authToken) throw new Error(text.dayRoute.skipSaveFailed);
      };
      let generation: number | null = null;
      let preparation: RouteArrivalVisitTransitionPreparation | null = null;
      let wasDispatched = false;
      let wasSaved = false;
      const resolveJournal = () => {
        if (generation !== null) resolveRouteArrivalTransition(route.id, generation);
        generation = null;
      };
      const rollback = async () => {
        if (getAuthToken() !== authToken) {
          resolveJournal();
          return;
        }
        try {
          const result = await syncTodayRouteArrivalNotifications(currentRoutes, language, route.id, {
            routeArrivalEnabled: getRouteArrivalEnabled(), getRouteArrivalEnabled, assertCurrent, checkCurrentPosition: false,
            requestPermissions: preparation?.requestPermissions ?? false,
            requireConfirmedRegistration: preparation?.requestPermissions === true,
          });
          if (result !== null) resolveJournal();
        } catch { /* 알림 journal을 남겨 다음 서버 조회에서 복구한다. */ }
      };
      try {
        if (nativeBridge.runtime.isAvailable() && arrivalEnabled !== false) {
          generation = markRouteArrivalTransitionUnresolved(route.id, { expectation: operation })?.generation ?? null;
          if (generation === null) throw new Error(text.dayRoute.skipSaveFailed);
        }
        preparation = await prepareRouteArrivalNotificationsForVisitTransition(currentRoutes, nextRoutes, language, route.id, {
          routeArrivalEnabled: getRouteArrivalEnabled(), getRouteArrivalEnabled, assertCurrent,
        });
        if (getAuthToken() !== authToken) throw new Error(text.dayRoute.skipSaveFailed);
        if (generation !== null && !markRouteArrivalTransitionRequestDispatched(route.id, generation)) {
          throw new Error(text.dayRoute.skipSaveFailed);
        }
        let nextRoute: MyRoute;
        try {
          wasDispatched = true;
          nextRoute = operation.kind === "stop-skip"
            ? (await routeApi.setRouteStopSkipped(operation.stopId, operation.skipped)).setRouteStopSkipped
            : (await routeApi.finishRouteDay(operation.dayId)).finishRouteDay;
        } catch (error) {
          if (getAuthToken() !== authToken) {
            resolveJournal();
            throw error;
          }
          if (isDefinitiveRouteMutationFailure(error)) throw error;
          const reread = await routeApi.routeById(route.id).catch(() => null);
          if (!confirmsRouteSkipping(reread?.route, operation)) throw error;
          nextRoute = reread!.route!;
        }
        wasSaved = true;
        if (getAuthToken() !== authToken) {
          resolveJournal();
          return nextRoute;
        }
        await client.cancelQueries({ queryKey: MY_ROUTES_QUERY_KEY, exact: true });
        if (getAuthToken() !== authToken) {
          resolveJournal();
          return nextRoute;
        }
        client.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, (data) => upsertMyRouteCache(data, nextRoute));
        client.setQueryData<RouteByIdQuery>(["route-detail", route.id], (data) =>
          data?.route ? { ...data, route: { ...data.route, ...nextRoute } } : data);
        onSuccess(nextRoute);
        for (const key of [MY_ROUTE_HISTORY_QUERY_KEY, ["route-detail", route.id], ["shared-routes"], ["liked-shared-routes"], ["place-photos"], ["place-stay-summary"]]) {
          void client.invalidateQueries({ queryKey: key });
        }
        try {
          const routes = client.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY)?.myRoutes ?? [nextRoute];
          const synced = await syncRouteArrivalNotificationsAfterVisitChange(routes, language, route.id, {
            routeArrivalEnabled: getRouteArrivalEnabled(), getRouteArrivalEnabled, assertCurrent, requestPermissions: preparation.requestPermissions,
            requireConfirmedRegistration: preparation.requestPermissions,
          });
          if (preparation.rollbackRequired && synced === null) throw new Error("Arrival sync not confirmed");
          resolveJournal();
          showToast(operation.kind === "day-finish" ? text.dayRoute.dayFinishedToast : operation.skipped ? text.dayRoute.stopSkippedToast : text.dayRoute.stopSkipUndoneToast);
        } catch {
          showToast(text.dayRoute.skipArrivalSyncFailed, 4200);
        }
        return nextRoute;
      } catch (error) {
        let canRollback = true;
        if (!wasSaved && isRouteStopVisitConflict(error) && getAuthToken() === authToken) {
          const latest = (await routeApi.routeById(route.id).catch(() => null))?.route;
          assertCurrent();
          canRollback = Boolean(latest);
          if (latest) {
            currentRoutes = currentRoutes.map(item => item.id === latest.id ? latest : item);
            client.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, data => upsertMyRouteCache(data, latest));
          }
        }
        if (!wasSaved && (!wasDispatched || isDefinitiveRouteMutationFailure(error))) {
          if (error instanceof RouteArrivalVisitTransitionPreparationError) preparation = { rollbackRequired: true, requestPermissions: error.requestPermissions };
          if (canRollback && (generation !== null || preparation?.rollbackRequired)) await rollback();
        }
        throw error;
      } finally {
        release();
      }
    },
    onError: (error, _operation, context) => {
      if (context?.authToken !== getAuthToken()) return;
      if (isRouteStopVisitConflict(error)) {
        for (const key of [MY_ROUTES_QUERY_KEY, MY_ROUTE_HISTORY_QUERY_KEY, ["route-detail", route.id],
          ["shared-routes"], ["liked-shared-routes"], ["place-photos"], ["place-stay-summary"]]) {
          void client.invalidateQueries({ queryKey: key });
        }
      }
      showToast(isDefinitiveRouteMutationFailure(error) && error instanceof Error ? error.message : text.dayRoute.skipSaveUnconfirmed, 4200);
    },
  });

  /** 중복 누름과 방문 저장의 경합을 막고 서버 반영이 확인된 경우에만 true를 반환한다. */
  const run = async (operation: RouteSkippingOperation) => {
    if (inFlight.current || blocked || isRouteArrivalTransitionLocked()) {
      showToast(text.dayRoute.skipBusy);
      return false;
    }
    inFlight.current = true;
    try { await mutation.mutateAsync(operation); return true; }
    catch { return false; }
    finally { inFlight.current = false; }
  };

  /** 장소의 건너뜀 상태를 명시적으로 변경한다. 이미 방문한 장소 변경은 서버에서 거절한다. */
  const skipStop = (stopId: string, skipped: boolean) => run({ kind: "stop-skip", stopId, skipped });
  /** 선택한 DAY의 남은 미방문 장소만 건너뛰며 다른 날짜는 유지한다. */
  const finishDay = (dayId: string) => run({ kind: "day-finish", dayId });

  return {
    skipStop,
    finishDay,
    isFinishingDay: mutation.isPending && mutation.variables?.kind === "day-finish",
    savingStopId: mutation.isPending && mutation.variables?.kind === "stop-skip" ? mutation.variables.stopId : null,
    /** 화면 진행 표시는 별도 상태를 만들지 않고 현재 Mutation의 작업을 사용한다. */
    pendingOperation: mutation.isPending ? mutation.variables ?? null : null,
    /** 첫 렌더가 반영되기 전에도 닫기·중복 실행을 막는 현재 요청 여부다. */
    isInFlight: () => inFlight.current,
  };
}
