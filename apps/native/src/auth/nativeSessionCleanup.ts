/**
 * 용도:
 * 로그아웃·세션 만료·계정 전환 전에 이전 여행의 네이티브 위치 감시와
 * 인증 정보를 강제 종료에도 복구 가능한 순서로 정리한다.
 *
 * 동작 방식:
 * 정리 필요 표식 저장 → 장소 감시 해제 → 인증 정보 삭제 → 표식 제거 순서로
 * 처리한다. 도중에 앱이 종료되면 다음 부팅에서 남은 표식을 보고 다시 정리한다.
 */
import {
  clearNativeSessionCleanupPending,
  clearStoredNativeAuthToken,
  isNativeSessionCleanupPending,
  markNativeSessionCleanupPending
} from "@/auth/nativeAuthStorage";
import { clearNativeRouteArrivalNotificationsForSession } from "@/webview/bridge/routeArrivalNotificationBridge";

async function performNativeSessionCleanup() {
  await markNativeSessionCleanupPending();
  await clearNativeRouteArrivalNotificationsForSession();
  await clearStoredNativeAuthToken();
  await clearNativeSessionCleanupPending();
}

export function clearNativeSessionForAccountChange() {
  return performNativeSessionCleanup();
}

export async function reconcileNativeSessionCleanup(
  hasValidSession: boolean
) {
  const hasPendingCleanup = await isNativeSessionCleanupPending();

  if (hasValidSession && !hasPendingCleanup) {
    return false;
  }

  await performNativeSessionCleanup();
  return true;
}
