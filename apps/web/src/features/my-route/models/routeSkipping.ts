import type { MyRoute, MyRouteStop } from "../types";
import { isResolvedStop, isSkippedStop, isVisitedStop } from "../routeDisplay";

export type RouteSkippingOperation =
  | { kind: "stop-skip"; stopId: string; skipped: boolean }
  | { kind: "day-finish"; dayId: string };

/** API 처리 전 현재·다음 도착 알림을 함께 준비하기 위한 예상 상태다. 방문 기록은 만들지 않는다. */
export function createRouteSkippingPreview(route: MyRoute, operation: RouteSkippingOperation): MyRoute {
  const update = (stop: MyRouteStop, dayId: string | null): MyRouteStop => {
    const affected = operation.kind === "stop-skip"
      ? stop.id === operation.stopId && !isVisitedStop(stop)
      : dayId === operation.dayId && !isResolvedStop(stop);
    if (!affected) return stop;
    const skipped = operation.kind === "day-finish" || operation.skipped;
    return {
      ...stop,
      visitStatus: skipped ? "SKIPPED" : "PENDING",
      visitedAt: null, verifiedAt: null, verificationStatus: "NONE",
      verificationPhotoImageId: null, verificationPhotoUrl: null,
      verificationPhotoPublicationConsent: false, verificationPhotoPublishedAt: null,
      verificationLat: null, verificationLng: null, verificationAccuracyMeters: null,
      checkedInAt: null, checkedOutAt: null, actualStayMinutes: null,
    };
  };
  const days = route.days.map((day) => ({ ...day, stops: day.stops.map((stop) => update(stop, day.id)) }));
  const stops = days.flatMap((day) => day.stops);
  const completed = stops.length > 0 && stops.every(isResolvedStop);
  return {
    ...route, days, stops,
    totalStopCount: stops.length,
    completedStopCount: stops.filter(isVisitedStop).length,
    status: completed ? "COMPLETED" : route.status === "COMPLETED" ? "ACTIVE" : route.status,
    completedAt: completed ? (route.completedAt ?? new Date().toISOString()) : null,
    ...(!completed && route.status === "COMPLETED" ? { visibility: "PRIVATE" as const, sharedAt: null } : {}),
  };
}

/** 재조회 결과가 요청한 상태인지 확인하며, 건너뜀과 미방문을 구분한다. */
export function confirmsRouteSkipping(route: MyRoute | null | undefined, operation: RouteSkippingOperation) {
  if (!route) return false;
  if (operation.kind === "day-finish") {
    const stops = route.days.find((day) => day.id === operation.dayId)?.stops;
    return Boolean(stops?.length && stops.every(isResolvedStop));
  }
  const stop = route.days.flatMap((day) => day.stops).find((item) => item.id === operation.stopId);
  return Boolean(stop && (operation.skipped ? isSkippedStop(stop) : stop.visitStatus === "PENDING" && !isVisitedStop(stop)));
}
