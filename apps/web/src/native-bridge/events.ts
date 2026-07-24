const NATIVE_APP_ACTIVE_EVENT = "routeone:native-app-active";

export function subscribeNativeAppActive(listener: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener(NATIVE_APP_ACTIVE_EVENT, listener);

  return () => {
    window.removeEventListener(NATIVE_APP_ACTIVE_EVENT, listener);
  };
}
