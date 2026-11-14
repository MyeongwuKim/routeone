/**
 * 용도:
 * 여행 시작·방문 완료·건너뜀·DAY 마무리 요청 오류가 확정 실패인지 결과 불명인지 구분하고,
 * 재조회한 일정에서 실제 서버 반영 여부를 확인한다.
 *
 * 동작 방식:
 * 요청 실행 전 거절되는 비재시도 4xx와 서버의 사용자 입력 오류는 확정 실패로 본다.
 * 내부 서버 오류, 타임아웃, 네트워크 오류와 알 수 없는 예외는 결과 불명으로 둔다.
 */
import { isGraphQLRequestError } from "@/lib/graphqlClient";
import { isVisitedStop, isSkippedStop, isResolvedStop } from "../routeDisplay";
import type { MyRoute } from "../types";
import type { RouteArrivalTransitionExpectation } from "./routeArrivalTransitionLock";

/** 서버가 이전 방문 기록의 저장을 거절했으므로 재전송하지 않고 최신 목록을 확인한다. */
export function isRouteStopVisitConflict(error: unknown) {
  return isGraphQLRequestError(error) && error.status === 409 && error.code === "USER_FACING_ERROR";
}

export function isDefinitiveRouteMutationFailure(error: unknown) {
  if (!isGraphQLRequestError(error) || error.retryable) {
    return false;
  }

  if (error.code === "USER_FACING_ERROR") {
    return true;
  }

  return (
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  );
}

export function getConfirmedVisitedRoute(
  route: MyRoute | null | undefined,
  stopId: string
) {
  if (!route) {
    return null;
  }

  const stop =
    route.stops.find((candidateStop) => candidateStop.id === stopId) ??
    route.days
      .flatMap((routeDay) => routeDay.stops)
      .find((candidateStop) => candidateStop.id === stopId);

  return stop && isVisitedStop(stop) ? route : null;
}

export function getConfirmedRouteVisitState(
  route: MyRoute | null | undefined,
  stopId: string,
  visited: boolean
) {
  if (!route) {
    return null;
  }

  const stop =
    route.stops.find((candidateStop) => candidateStop.id === stopId) ??
    route.days
      .flatMap((routeDay) => routeDay.stops)
      .find((candidateStop) => candidateStop.id === stopId);

  if (!stop) return null;
  const isConfirmed = visited
    ? isVisitedStop(stop)
    : stop.visitStatus === "PENDING" && !isVisitedStop(stop);
  return isConfirmed ? route : null;
}

/** 건너뜀 적용은 SKIPPED, 되돌리기는 방문 기록 없는 PENDING 응답일 때만 저장 결과로 확정한다. */
export function getConfirmedRouteSkipState(
  route: MyRoute | null | undefined,
  stopId: string,
  skipped: boolean
) {
  if (!route) return null;
  const stop = route.stops.find((candidate) => candidate.id === stopId) ??
    route.days.flatMap((day) => day.stops).find((candidate) => candidate.id === stopId);
  if (!stop) return null;
  const isConfirmed = skipped
    ? isSkippedStop(stop)
    : stop.visitStatus === "PENDING" && !isVisitedStop(stop);
  return isConfirmed ? route : null;
}

/** 대상 DAY에 장소가 있고 모두 방문·건너뜀 상태일 때만 DAY 마무리 저장을 확정한다. */
export function getConfirmedFinishedRouteDay(route: MyRoute | null | undefined, dayId: string) {
  const day = route?.days.find((candidate) => candidate.id === dayId);
  return day && day.stops.length > 0 && day.stops.every(isResolvedStop) ? route : null;
}

export function getConfirmedStartedRoute(route: MyRoute | null | undefined) {
  return route && route.status !== "DRAFT" && route.startedAt ? route : null;
}

export function isRouteArrivalTransitionExpectationCommitted(
  expectation: RouteArrivalTransitionExpectation,
  route: MyRoute | null | undefined
) {
  if (expectation.kind === "unknown") {
    return false;
  }

  if (expectation.kind === "route-start") {
    return Boolean(getConfirmedStartedRoute(route));
  }
  if (expectation.kind === "stop-skip") {
    return Boolean(getConfirmedRouteSkipState(route, expectation.stopId, expectation.skipped));
  }
  if (expectation.kind === "day-finish") {
    return Boolean(getConfirmedFinishedRouteDay(route, expectation.dayId));
  }

  return Boolean(
    getConfirmedRouteVisitState(
      route,
      expectation.stopId,
      expectation.visited
    )
  );
}

export function getRouteArrivalTransitionPendingFingerprint(
  expectation: RouteArrivalTransitionExpectation,
  route: MyRoute | null | undefined
) {
  if (expectation.kind === "unknown") {
    return "unknown:missing";
  }

  if (!route) {
    return `${expectation.kind}:missing`;
  }

  if (expectation.kind === "route-start") {
    return [
      expectation.kind,
      route.updatedAt,
      route.status,
      route.startedAt ?? "",
    ].join(":");
  }
  if (expectation.kind === "day-finish") {
    const day = route.days.find((candidate) => candidate.id === expectation.dayId);
    return JSON.stringify([
      expectation.kind, expectation.dayId, route.updatedAt,
      day?.stops.map((stop) => [stop.id, stop.visitStatus, stop.visitedAt]) ?? null,
    ]);
  }

  const stop =
    route.stops.find((candidateStop) => candidateStop.id === expectation.stopId) ??
    route.days
      .flatMap((routeDay) => routeDay.stops)
      .find((candidateStop) => candidateStop.id === expectation.stopId);

  return [
    expectation.kind,
    expectation.stopId,
    route.updatedAt,
    stop?.visitStatus ?? "missing",
    stop?.visitedAt ?? "",
  ].join(":");
}
