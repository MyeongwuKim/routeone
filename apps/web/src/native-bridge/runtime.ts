import type { NativeBridgeApi, ReactNativeWebViewApi } from "./types";

export function getNativeBridgeApi(): NativeBridgeApi | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.RouteOneNative;
}

export function getReactNativeWebViewApi():
  | ReactNativeWebViewApi
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.ReactNativeWebView;
}

export function isNativeRuntime() {
  return Boolean(getReactNativeWebViewApi() || getNativeBridgeApi());
}

export function postNativeMessage(message: unknown) {
  const reactNativeWebView = getReactNativeWebViewApi();

  if (!reactNativeWebView) {
    return false;
  }

  reactNativeWebView.postMessage(JSON.stringify(message));
  return true;
}
