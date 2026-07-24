import { Linking, Platform } from "react-native";
import type { NativeExternalUrlRequest } from "./types";

const WEBVIEW_BASE_ORIGIN = "https://routeone.native";
const LOCAL_WEB_BUNDLE_PATH = "/routeone-web-bundles/releases/";
const NAVER_MAP_SCHEME_PREFIX = "nmap://";
const ROUTEONE_APP_SETTINGS_SCHEME_PREFIX = "routeone-settings:";
const NAVER_MAP_WEB_DIRECTIONS_URL =
  "https://map.naver.com/p/directions/";

function isAllowedWebViewOrigin(url: URL, allowedOrigins: readonly string[]) {
  return (
    url.origin === WEBVIEW_BASE_ORIGIN || allowedOrigins.includes(url.origin)
  );
}

export function shouldKeepUrlInWebView(
  urlValue: string,
  allowedOrigins: readonly string[] = []
) {
  if (!urlValue) {
    return true;
  }

  if (
    urlValue === "about:blank" ||
    urlValue.startsWith("data:") ||
    urlValue.startsWith("blob:") ||
    urlValue.startsWith("javascript:")
  ) {
    return true;
  }

  try {
    const url = new URL(urlValue, WEBVIEW_BASE_ORIGIN);

    if (
      url.protocol === "file:" &&
      decodeURIComponent(url.pathname).includes(LOCAL_WEB_BUNDLE_PATH)
    ) {
      return true;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return isAllowedWebViewOrigin(url, allowedOrigins);
  } catch {
    return true;
  }
}

export async function openNativeExternalUrl(
  url: string,
  allowedOrigins: readonly string[] = []
) {
  if (!url || shouldKeepUrlInWebView(url, allowedOrigins)) {
    return;
  }

  if (url.startsWith(ROUTEONE_APP_SETTINGS_SCHEME_PREFIX)) {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn(
        "[routeone-native-bridge] failed to open app settings",
        error
      );
    }
    return;
  }

  if (url.startsWith(NAVER_MAP_SCHEME_PREFIX) && Platform.OS === "ios") {
    try {
      const canOpenNaverMap = await Linking.canOpenURL(url);
      await Linking.openURL(
        canOpenNaverMap ? url : NAVER_MAP_WEB_DIRECTIONS_URL
      );
    } catch (error) {
      console.warn(
        "[routeone-native-bridge] failed to open NAVER Map",
        error
      );
    }
    return;
  }

  try {
    await Linking.openURL(url);
  } catch (error) {
    if (url.startsWith(NAVER_MAP_SCHEME_PREFIX)) {
      try {
        await Linking.openURL(NAVER_MAP_WEB_DIRECTIONS_URL);
        return;
      } catch (fallbackError) {
        console.warn(
          "[routeone-native-bridge] failed to open NAVER Map web directions",
          fallbackError
        );
      }
    }

    console.warn(
      "[routeone-native-bridge] failed to open external url",
      error
    );
  }
}

export async function handleNativeExternalUrlRequest(
  message: NativeExternalUrlRequest
) {
  await openNativeExternalUrl(message.url);
}
