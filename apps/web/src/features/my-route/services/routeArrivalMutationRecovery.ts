/**
 * 용도:
 * 여행 시작·방문 완료 요청 오류가 확정 실패인지 결과 불명인지 구분하고,
 * 재조회한 일정에서 실제 서버 반영 여부를 확인한다.
 *
 * 동작 방식:
 * 요청 실행 전 거절되는 비재시도 4xx와 서버의 사용자 입력 오류는 확정 실패로 본다.
 * 내부 서버 오류, 타임아웃, 네트워크 오류와 알 수 없는 예외는 결과 불명으로 둔다.
 */
import { isGraphQLRequestError } from "@/lib/graphqlClient";
import { isVisitedStop } from "../routeDisplay";
import type { MyRoute } from "../types";
import type { RouteArrivalTransitionExpectation } from "./routeArrivalTransitionLock";

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

  if (!stop || isVisitedStop(stop) !== visited) {
    return null;
  }

  return route;
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
