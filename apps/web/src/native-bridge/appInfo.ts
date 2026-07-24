import { getNativeBridgeApi, isNativeRuntime } from "./runtime";
import type { NativeAppInfo } from "./types";

export async function getNativeAppInfo(): Promise<NativeAppInfo> {
  const getAppInfo = getNativeBridgeApi()?.getAppInfo;

  if (getAppInfo) {
    return getAppInfo();
  }

  if (isNativeRuntime()) {
    return {
      platform: "native",
      appVersion: null,
      buildNumber: null,
      webBundleVersion: null,
      webBundleKind: null,
    };
  }

  return {
    platform: "web",
    appVersion: import.meta.env.VITE_APP_VERSION ?? null,
    buildNumber: null,
    webBundleVersion: import.meta.env.VITE_APP_VERSION ?? null,
    webBundleKind: null,
  };
}
