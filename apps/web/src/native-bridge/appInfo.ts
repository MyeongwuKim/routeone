import { getNativeBridgeApi, isNativeRuntime } from "./runtime";
import type { NativeAppInfo } from "./types";

function normalizeCapabilities(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((capability): capability is string => typeof capability === "string")
    .map((capability) => capability.trim())
    .filter(Boolean);
}

export async function getNativeAppInfo(): Promise<NativeAppInfo> {
  const getAppInfo = getNativeBridgeApi()?.getAppInfo;

  if (getAppInfo) {
    const appInfo = await getAppInfo();

    return {
      ...appInfo,
      capabilities: normalizeCapabilities(appInfo.capabilities),
    };
  }

  if (isNativeRuntime()) {
    return {
      platform: "native",
      capabilities: [],
      appVersion: null,
      buildNumber: null,
      webBundleVersion: null,
      webBundleKind: null,
    };
  }

  return {
    platform: "web",
    capabilities: [],
    appVersion: import.meta.env.VITE_APP_VERSION ?? null,
    buildNumber: null,
    webBundleVersion: import.meta.env.VITE_APP_VERSION ?? null,
    webBundleKind: null,
  };
}
