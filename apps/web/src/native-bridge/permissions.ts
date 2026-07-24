import { getNativeBridgeApi, isNativeRuntime } from "./runtime";

const APP_SETTINGS_URL = "routeone-settings://app";

export function openNativeAppSettings() {
  if (getNativeBridgeApi()?.openExternalUrl?.(APP_SETTINGS_URL)) {
    return true;
  }

  if (isNativeRuntime()) {
    window.location.href = APP_SETTINGS_URL;
    return true;
  }

  return false;
}
