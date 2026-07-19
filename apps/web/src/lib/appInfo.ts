export type RouteOneAppInfo = {
  platform: "ios" | "android" | "web" | "native" | string;
  appVersion?: string | null;
  buildNumber?: string | null;
  runtimeVersion?: string | null;
  osVersion?: string | null;
  bundleIdentifier?: string | null;
  webBundleVersion?: string | null;
  webBundleKind?: "embedded" | "installed" | null;
  webBundleChannel?: string | null;
  appVariant?: string | null;
};

type RouteOneNativeBridge = {
  getAppInfo?: () => Promise<RouteOneAppInfo>;
};

function getRouteOneNativeBridge() {
  return (window as Window & { RouteOneNative?: RouteOneNativeBridge })
    .RouteOneNative;
}

export function isRouteOneNativeRuntime() {
  return Boolean(
    (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView ||
      getRouteOneNativeBridge()
  );
}

export async function getRouteOneAppInfo(): Promise<RouteOneAppInfo> {
  const nativeBridge = getRouteOneNativeBridge();

  if (nativeBridge?.getAppInfo) {
    return nativeBridge.getAppInfo();
  }

  if (isRouteOneNativeRuntime()) {
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
