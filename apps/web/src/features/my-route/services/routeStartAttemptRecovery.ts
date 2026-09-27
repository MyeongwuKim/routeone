/**
 * 용도:
 * 중단된 여행 시작 시도와 서버 일정 상태를 비교해 다음 복구 동작을 결정한다.
 *
 * 동작 방식:
 * 시작 상태는 즉시 복구 완료로 판단하고, 미시작 상태는 동일한 서버 snapshot이
 * 두 번 확인된 경우에만 사용자 재시작이 필요한 상태로 확정한다.
 */
import type { MyRoute } from "../types";
import {
  getConfirmedStartedRoute,
  getRouteArrivalTransitionPendingFingerprint,
} from "./routeArrivalMutationRecovery";
import type { RouteStartAttempt } from "./routeStartAttemptJournal";

/**
 * started는 서버에서 시작을 확인한 상태, restart-required는 같은 미시작 결과가 반복돼 재시작이 필요한 상태다.
 * observe는 아직 확정하지 않고 다음 조회와 비교할 서버 상태 지문을 반환하는 상태다.
 */
export type RouteStartAttemptRecoveryDecision =
  | { kind: "started" }
  | { kind: "restart-required" }
  | { kind: "observe"; pendingFingerprint: string };

export function getRouteStartAttemptRecoveryDecision(
  attempt: RouteStartAttempt,
  route: MyRoute | null | undefined
): RouteStartAttemptRecoveryDecision {
  if (getConfirmedStartedRoute(route)) {
    return { kind: "started" };
  }

  const pendingFingerprint =
    getRouteArrivalTransitionPendingFingerprint(
      { kind: "route-start" },
      route
    );

  if (
    attempt.pendingFingerprint === pendingFingerprint &&
    attempt.stablePendingReadCount >= 1
  ) {
    return { kind: "restart-required" };
  }

  return {
    kind: "observe",
    pendingFingerprint,
  };
}
