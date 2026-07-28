const NATIVE_APP_ACTIVE_EVENT = "routeone:native-app-active";
const NATIVE_NOTIFICATION_RECEIVED_EVENT =
  "routeone:native-notification-received";

export type NativeNotificationReceivedEvent = {
  notificationId: string | null;
  type: string | null;
};

export function subscribeNativeAppActive(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(NATIVE_APP_ACTIVE_EVENT, listener);

  return () => {
    window.removeEventListener(NATIVE_APP_ACTIVE_EVENT, listener);
  };
}

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
