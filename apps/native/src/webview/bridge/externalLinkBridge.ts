import { Linking } from "react-native";
import type { NativeExternalUrlRequest } from "./types";

const WEBVIEW_BASE_ORIGIN = "https://routeone.native";

export function shouldKeepUrlInWebView(urlValue: string) {
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

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return url.origin === WEBVIEW_BASE_ORIGIN;
  } catch {
    return true;
  }
}

export async function openNativeExternalUrl(url: string) {
  if (!url || shouldKeepUrlInWebView(url)) {
    return;
  }

  try {
    await Linking.openURL(url);
  } catch (error) {
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
