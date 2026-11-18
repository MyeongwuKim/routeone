import * as Notifications from "expo-notifications";
import {
  enqueueNativeAuthSessionOperation,
  isNativeSessionCleanupPending,
  readStoredNativeAuthSession,
} from "@/auth/nativeAuthStorage";
import type { NativeNotificationBadgeMessage } from "./types";

/** 앱 아이콘의 미확인 개수를 설정한다. 권한·런처 미지원이나 OS 오류는 인증 정리를 막지 않는다. */
export async function setNativeNotificationBadgeCount(count: number) {
  try {
    return await Notifications.setBadgeCountAsync(count);
  } catch {
    console.warn("[notification-badge] badge update failed");
    return false;
  }
}

/** 로그인·로그아웃과 같은 큐에서 현재 세션의 배지만 갱신해 이전 계정의 늦은 메시지를 무시한다. */
export function handleNativeNotificationBadgeMessage(
  message: NativeNotificationBadgeMessage
) {
  return enqueueNativeAuthSessionOperation(async () => {
    const [session, cleanupPending] = await Promise.all([
      readStoredNativeAuthSession(),
      isNativeSessionCleanupPending(),
    ]);

    if (cleanupPending || !session.token || session.sessionId !== message.sessionId) {
      return;
    }

    await setNativeNotificationBadgeCount(message.count);
  });
}
