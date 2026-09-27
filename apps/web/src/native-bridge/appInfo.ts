
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

/**
 * 네이티브 브리지의 앱 버전·권한 정보를 조회하고 capabilities를 공백 없는 문자열 목록으로 정규화한다.
 * 브리지 API가 아직 없는 네이티브 환경은 platform이 native인 빈 정보를, 일반 웹은 빌드 환경 버전을 반환한다.
 */
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
