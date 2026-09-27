
const NATIVE_APP_ACTIVE_EVENT = "routeone:native-app-active";
const NATIVE_NOTIFICATION_RECEIVED_EVENT =
  "routeone:native-notification-received";

export type NativeNotificationReceivedEvent = {
  /** 네이티브가 전달한 알림 ID. 문자열이 아니거나 없으면 null */
  notificationId: string | null;
  /** 일정·축제 등 네이티브 알림 종류. 문자열이 아니거나 없으면 null */
  type: string | null;
};

/** 네이티브 앱이 활성화됐다는 window 이벤트를 구독하고 반환 함수에서 같은 리스너를 해제한다. */
export function subscribeNativeAppActive(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(NATIVE_APP_ACTIVE_EVENT, listener);

  return () => {
    window.removeEventListener(NATIVE_APP_ACTIVE_EVENT, listener);
  };
}

/**
 * 네이티브 알림 수신 이벤트의 detail에서 notificationId와 type만 문자열로 정규화해 listener에 전달한다.
 * 브라우저가 아닌 환경에서는 아무 작업도 하지 않는 해제 함수를 반환한다.
 */
export function subscribeNativeNotificationReceived(
  listener: (event: NativeNotificationReceivedEvent) => void
) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleNotificationReceived = (event: Event) => {
    const detail =
      event instanceof CustomEvent &&
      event.detail &&
      typeof event.detail === "object"
        ? (event.detail as Record<string, unknown>)
        : {};

    listener({
      notificationId:
        typeof detail.notificationId === "string"
          ? detail.notificationId
          : null,
      type: typeof detail.type === "string" ? detail.type : null,
    });
  };

  window.addEventListener(
    NATIVE_NOTIFICATION_RECEIVED_EVENT,
    handleNotificationReceived
  );

  return () => {
    window.removeEventListener(
      NATIVE_NOTIFICATION_RECEIVED_EVENT,
      handleNotificationReceived
    );
  };
}
