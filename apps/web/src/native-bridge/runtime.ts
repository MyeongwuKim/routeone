
import type { NativeBridgeApi, ReactNativeWebViewApi } from "./types";

/** window.RouteOneNative에 주입된 직접 호출 API를 반환하며 SSR이나 미주입 환경에서는 undefined다. */
export function getNativeBridgeApi(): NativeBridgeApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.RouteOneNative;
}

/** React Native WebView의 postMessage API를 반환하며 SSR이나 일반 브라우저에서는 undefined다. */
export function getReactNativeWebViewApi():
  | ReactNativeWebViewApi
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.ReactNativeWebView;
}

/** 직접 호출 API 또는 React Native WebView 중 하나가 주입되어 있으면 네이티브 실행 환경으로 판정한다. */
export function isNativeRuntime() {
  return Boolean(getReactNativeWebViewApi() || getNativeBridgeApi());
}

/** 런타임 설정에서 네이티브 테스트 계정 모드가 명시적으로 활성화됐는지 확인한다. */
export function isNativeTestAccountMode() {
  return (
    typeof window !== "undefined" &&
    window.RouteOneRuntimeConfig?.testAccountMode === true
  );
}

/**
 * message를 JSON 문자열로 변환해 React Native WebView에 전달한다.
 * 직접 호출 API만 있거나 일반 웹이면 전송하지 않고 false를 반환한다.
 */
export function postNativeMessage(message: unknown) {
  const reactNativeWebView = getReactNativeWebViewApi();

  if (!reactNativeWebView) {
    return false;
  }

  reactNativeWebView.postMessage(JSON.stringify(message));
  return true;
}
