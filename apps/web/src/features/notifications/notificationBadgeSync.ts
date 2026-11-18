import { QueryObserver, type QueryClient } from "@tanstack/react-query";
import {
  notificationApi,
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  NOTIFICATION_INBOX_PAGE_SIZE,
} from "@/api/notificationApi";
import {
  AUTH_SESSION_CHANGE_EVENT,
  createAuthSessionRequest,
  getAuthToken,
} from "@/lib/authToken";
import { nativeBridge } from "@/native-bridge";

/**
 * 네이티브 로그인 중에는 모든 탭에서 알림함 첫 페이지를 구독해 아이콘 배지를 맞춘다.
 * 수신·복귀 때의 Query 갱신과 알림함 읽음 처리도 반영하며, 이전 세션의 늦은 조회는 무시한다.
 */
export function startNativeNotificationBadgeSync(queryClient: QueryClient) {
  if (!nativeBridge.runtime.isAvailable()) {
    return () => {};
  }

  let unsubscribe = () => {};
  let observedToken = getAuthToken();

  const observeSession = () => {
    unsubscribe();
    unsubscribe = () => {};

    const token = getAuthToken();
    // 이전 계정의 진행 중 조회와 캐시를 새 세션의 초기 결과로 재사용하지 않는다.
    void queryClient.cancelQueries({ queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY, exact: true });
    if (token !== observedToken) {
      queryClient.removeQueries({ queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY, exact: true });
    }
    observedToken = token;

    if (!token) {
      return;
    }

    const session = createAuthSessionRequest();
    const observer = new QueryObserver(queryClient, {
      queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
      queryFn: async () => {
        const result = await notificationApi.inbox({
          first: NOTIFICATION_INBOX_PAGE_SIZE,
          after: null,
        });
        session.assertCurrent();
        return result;
      },
      staleTime: 30_000,
      refetchInterval: 60_000,
    });
    const updateBadge = () => {
      const count = observer.getCurrentResult().data?.unreadNotificationCount;
      if (!session.isCurrent() || count === undefined) {
        return;
      }

      // OS 배지 권한이 복구된 경우에도 같은 개수를 다시 적용한다.
      nativeBridge.notifications.setBadgeCount(count);
    };

    unsubscribe = observer.subscribe(updateBadge);
    updateBadge();
  };

  window.addEventListener(AUTH_SESSION_CHANGE_EVENT, observeSession);
  window.addEventListener("storage", observeSession);
  observeSession();

  return () => {
    unsubscribe();
    window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, observeSession);
    window.removeEventListener("storage", observeSession);
  };
}
