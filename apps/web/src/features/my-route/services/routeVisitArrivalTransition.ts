import { routeApi } from "@/api/routeApi";
import { createAuthSessionRequest, type AuthSessionRequest } from "@/lib/authToken";
import { nativeBridge } from "@/native-bridge";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type {
  RouteVisitProgressOperation,
  RouteVisitProgressReporter,
} from "../hooks/useRouteVisitProgress";
import type { MyRoute } from "../types";
import {
  getConfirmedRouteVisitState,
  isDefinitiveRouteMutationFailure,
  isRouteStopVisitConflict,
} from "./routeArrivalMutationRecovery";
import {
  prepareRouteArrivalNotificationsForVisitTransition,
  RouteArrivalVisitTransitionPreparationError,
  syncRouteArrivalNotificationsAfterVisitChange,
  syncTodayRouteArrivalNotifications,
  type RouteArrivalVisitTransitionPreparation,
} from "./routeArrivalNotificationService";
import { createRouteArrivalVisitPreview } from "./routeArrivalNotificationTarget";
import {
  acquireRouteArrivalTransitionLock,
  getRouteArrivalTransitionResetVersion,
  markRouteArrivalTransitionRequestDispatched,
  markRouteArrivalTransitionUnresolved,
  resolveRouteArrivalTransition,
} from "./routeArrivalTransitionLock";

/** 목록과 알림 설정은 저장 중 바뀔 수 있어 각 동기화가 실행되는 시점에 읽는다. */
export type RouteVisitArrivalContext = {
  routeId: string;
  language: AppLanguage;
  getRoutes: () => MyRoute[] | undefined;
  getRouteArrivalEnabled: () => boolean | undefined;
};

type CreateRouteVisitArrivalTransitionOptions = RouteVisitArrivalContext & {
  session: AuthSessionRequest;
  route: MyRoute;
  routeId: string;
  stopId: string;
  visitedAt: string;
  nextVisited: boolean;
  operation: RouteVisitProgressOperation;
  beginProgress: (
    stopId: string,
    operation: RouteVisitProgressOperation
  ) => RouteVisitProgressReporter;
};

async function syncSavedRouteArrivalTarget(
  nextRoute: MyRoute,
  context: RouteVisitArrivalContext,
  session: AuthSessionRequest,
  preparation?: RouteArrivalVisitTransitionPreparation | null,
  progress?: RouteVisitProgressReporter
) {
  session.assertCurrent();
  const nextRoutes = context.getRoutes() ?? [nextRoute];

  try {
    const result = await syncRouteArrivalNotificationsAfterVisitChange(
      nextRoutes,
      context.language,
      nextRoute.id,
      {
        assertCurrent: session.assertCurrent,
        routeArrivalEnabled: context.getRouteArrivalEnabled(),
        requestPermissions: preparation?.requestPermissions,
        onProgress: progress?.onNativeProgress,
        requireConfirmedRegistration: preparation?.requestPermissions === true,
      }
    );

    session.assertCurrent();
    if (preparation?.rollbackRequired && result === null) {
      throw new Error("Native route arrival target sync did not respond");
    }

    return null;
  } catch (error) {
    session.assertCurrent();
    console.warn(
      "[route-arrival-notifications] updated route target sync failed",
      error instanceof Error ? error.message : error
    );
    return error;
  }
}

/** 사전 알림 전환이 없는 방문 저장도 확정 캐시를 기준으로 다음 도착 대상을 동기화한다. */
export function syncRouteVisitArrivalTarget(
  nextRoute: MyRoute,
  context: RouteVisitArrivalContext,
  session = createAuthSessionRequest()
) {
  return syncSavedRouteArrivalTarget(nextRoute, context, session);
}

/**
 * 방문 한 건의 알림 사전 등록, API 오류 복구, journal과 진행 잠금을 소유한다.
 * 낙관적 캐시 변경 전에 생성해 현재·다음 대상의 원본을 보존하고, 화면 반영과 최종 알림이
 * 모두 끝난 뒤 호출자가 finish를 실행한다. 결과 불명이나 최종 알림 실패의 journal은 남긴다.
 * 방문 충돌로 거절되면 재전송하지 않고 서버를 재조회해 최신 알림 대상을 복원한다.
 */
export function createRouteVisitArrivalTransition({
  route,
  routeId,
  stopId,
  visitedAt,
  nextVisited,
  operation,
  beginProgress,
  session,
  ...context
}: CreateRouteVisitArrivalTransitionOptions) {
  const cachedRoutes = context.getRoutes();
  const currentRoutes = cachedRoutes?.length ? cachedRoutes : [route];
  const currentRoute =
    currentRoutes.find((candidateRoute) => candidateRoute.id === routeId) ?? route;
  const nextRoute = createRouteArrivalVisitPreview(
    currentRoute,
    stopId,
    visitedAt,
    nextVisited
  );
  const nextRoutes = currentRoutes.map((candidateRoute) =>
    candidateRoute.id === routeId ? nextRoute : candidateRoute
  );
  let isApiOutcomeUnresolved = false;
  let journalGeneration: number | null = null;
  let preparation: RouteArrivalVisitTransitionPreparation | null = null;
  const lockResetVersion = getRouteArrivalTransitionResetVersion();
  const releaseLock = acquireRouteArrivalTransitionLock(routeId);
  const reporter = beginProgress(stopId, operation);
  // 네이티브가 늦게 전한 진행 단계도 요청을 시작한 세션에만 반영한다.
  const progress: RouteVisitProgressReporter = {
    setStage: (stage) => { if (session.isCurrent()) reporter.setStage(stage); },
    markSaved: () => { if (session.isCurrent()) reporter.markSaved(); },
    onNativeProgress: (stage) => { if (session.isCurrent()) reporter.onNativeProgress(stage); },
    finish: reporter.finish,
  };

  const resolveJournal = (routeId: string) => {
    if (!session.isCurrent() || journalGeneration === null) return;
    resolveRouteArrivalTransition(routeId, journalGeneration);
    journalGeneration = null;
  };
  const rollback = async (
    requestPermissions: boolean,
    context: RouteVisitArrivalContext,
    routes = currentRoutes
  ) => {
    session.assertCurrent();
    try {
      const result = await syncTodayRouteArrivalNotifications(
        routes,
        context.language,
        context.routeId,
        {
          assertCurrent: session.assertCurrent,
          routeArrivalEnabled: context.getRouteArrivalEnabled(),
          getRouteArrivalEnabled: context.getRouteArrivalEnabled,
          checkCurrentPosition: false,
          requestPermissions,
          requireConfirmedRegistration: requestPermissions,
        }
      );
      session.assertCurrent();
      return result !== null;
    } catch (error) {
      session.assertCurrent();
      console.warn(
        "[route-arrival-notifications] visit transition rollback failed",
        error instanceof Error ? error.message : error
      );
      return false;
    }
  };
  const prepare = async (context: RouteVisitArrivalContext) => {
    session.assertCurrent();
    const routeArrivalEnabled = context.getRouteArrivalEnabled();
    if (
      nativeBridge.runtime.isAvailable() &&
      routeArrivalEnabled !== false &&
      journalGeneration === null
    ) {
      const unresolvedTransition = markRouteArrivalTransitionUnresolved(context.routeId, {
        expectation: { kind: "stop-visit", stopId, visited: nextVisited },
      });
      journalGeneration = unresolvedTransition?.generation ?? null;
      if (journalGeneration === null) {
        throw new Error(
          context.language === "en"
            ? "The app could not safely save the arrival alert transition."
            : "도착 알림 전환 상태를 안전하게 저장하지 못했어요."
        );
      }
    }
    try {
      const prepared = await prepareRouteArrivalNotificationsForVisitTransition(
        currentRoutes,
        nextRoutes,
        context.language,
        context.routeId,
        { routeArrivalEnabled, onProgress: progress.onNativeProgress, assertCurrent: session.assertCurrent }
      );
      session.assertCurrent();
      if (!prepared.rollbackRequired) resolveJournal(context.routeId);
      return prepared;
    } catch (error) {
      session.assertCurrent();
      if (!(error instanceof RouteArrivalVisitTransitionPreparationError)) {
        resolveJournal(context.routeId);
        throw error;
      }
      const didRollback = await rollback(error.requestPermissions, context);
      if (didRollback) resolveJournal(context.routeId);
      throw error;
    }
  };
  const markRequestDispatched = (context: RouteVisitArrivalContext) => {
    session.assertCurrent();
    progress.setStage("saving");
    if (!session.isCurrent() || journalGeneration === null) return;
    const dispatchedTransition = markRouteArrivalTransitionRequestDispatched(
      context.routeId,
      journalGeneration
    );
    if (!dispatchedTransition) {
      throw new Error(
        context.language === "en"
          ? "The app could not safely update the arrival alert transition."
          : "도착 알림 전환 상태를 안전하게 갱신하지 못했어요."
      );
    }
  };
  const recover = async (error: unknown, context: RouteVisitArrivalContext) => {
    session.assertCurrent();
    progress.setStage("recovering");
    if (isRouteStopVisitConflict(error)) {
      // 충돌이면 이전 대상을 복원하지 않고 다른 요청이 확정한 서버 상태를 따른다.
      let latestRoutes: MyRoute[] | null = null;
      try {
        const latest = (await routeApi.routeById(context.routeId)).route;
        session.assertCurrent();
        if (latest) latestRoutes = currentRoutes.map(item => item.id === latest.id ? latest : item);
      } catch { session.assertCurrent(); }
      const didRollback = !preparation?.rollbackRequired || Boolean(latestRoutes &&
        await rollback(preparation.requestPermissions, context, latestRoutes));
      if (didRollback) resolveJournal(context.routeId);
      return null;
    }
    if (isDefinitiveRouteMutationFailure(error)) {
      const didRollback = preparation?.rollbackRequired
        ? await rollback(preparation.requestPermissions, context)
        : true;
      if (didRollback) resolveJournal(context.routeId);
      return null;
    }
    try {
      const result = await routeApi.routeById(context.routeId);
      session.assertCurrent();
      const recoveredRoute = getConfirmedRouteVisitState(
        result.route,
        stopId,
        nextVisited
      );
      if (recoveredRoute) return recoveredRoute;
    } catch (recoveryError) {
      session.assertCurrent();
      console.warn(
        "[route-arrival-notifications] visit result recovery failed",
        recoveryError instanceof Error ? recoveryError.message : recoveryError
      );
    }
    if (preparation?.rollbackRequired) isApiOutcomeUnresolved = true;
    return null;
  };

  return {
    get isApiOutcomeUnresolved() {
      return isApiOutcomeUnresolved;
    },
    /** 사전 등록과 전송 기록을 마친 뒤 API를 실행하고, 결과 불명은 재조회로 저장 여부를 확인한다. */
    async execute<T>(
      save: () => Promise<T>,
      fromRecoveredRoute: (route: MyRoute) => T,
      currentContext: RouteVisitArrivalContext
    ) {
      session.assertCurrent();
      preparation = await prepare(currentContext);
      session.assertCurrent();
      markRequestDispatched(currentContext);
      try {
        const result = await save();
        session.assertCurrent();
        return result;
      } catch (error) {
        session.assertCurrent();
        const recoveredRoute = await recover(error, currentContext);
        if (recoveredRoute) return fromRecoveredRoute(recoveredRoute);
        throw error;
      }
    },
    /** 서버 저장이 확인된 시점에 화면 진행 표시를 저장 완료로 바꾼다. */
    markSaved() {
      progress.markSaved();
    },
    /** 최신 렌더의 언어·캐시로 알림을 확정하며 성공한 경우에만 자신의 journal을 해제한다. */
    async syncSavedRoute(nextRoute: MyRoute, currentContext: RouteVisitArrivalContext) {
      const error = await syncSavedRouteArrivalTarget(
        nextRoute,
        currentContext,
        session,
        preparation,
        progress
      );
      session.assertCurrent();
      if (!error) resolveJournal(currentContext.routeId);
      return error;
    },
    /** 화면 반영·최종 동기화가 끝난 뒤 진행 표시와 실행 잠금만 해제한다. */
    finish() {
      // 로그아웃이 지운 잠금 자리에 새 세션이 만든 잠금을 이전 요청이 해제하지 않는다.
      if (lockResetVersion !== getRouteArrivalTransitionResetVersion()) return;
      progress.finish();
      releaseLock();
    },
  };
}

export type RouteVisitArrivalTransition = ReturnType<typeof createRouteVisitArrivalTransition>;
