
import { getNativeBridgeApi, isNativeRuntime } from "./runtime";

const APP_SETTINGS_URL = "routeone-settings://app";

/**
 * 브리지의 외부 URL 열기를 우선 사용해 앱 설정 화면을 요청한다.
 * 브리지 API가 없는 네이티브 런타임은 커스텀 URL로 이동하며, 일반 웹에서는 false를 반환한다.
 */
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
