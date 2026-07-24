import type { WebViewMessageEvent } from "react-native-webview";
import { handleNativeAppInfoRequest } from "./appInfoBridge";
import { handleNativeAuthTokenMessage } from "./authTokenBridge";
import { handleNativeExternalUrlRequest } from "./externalLinkBridge";
import { handleNativeFetchRequest, NATIVE_GRAPHQL_ENDPOINT } from "./fetchBridge";
import { handleNativeFestivalNotificationSyncRequest } from "./festivalNotificationBridge";
import { ROUTEONE_WEBVIEW_BRIDGE_SCRIPT } from "./injectedScript";
import { handleNativeLocationRequest } from "./locationBridge";
import {
  isNativeAppInfoRequest,
  isNativeAuthTokenMessage,
  isNativeBridgeReadyMessage,
  isNativeExternalUrlRequest,
  isNativeFestivalNotificationSyncRequest,
  isNativeFetchRequest,
  isNativeLocationRequest,
  isNativePhotoUploadRequest,
  isNativePhotoRequest,
  isNativeRouteArrivalNotificationSyncRequest,
  isNativeSaveImageRequest,
} from "./messageGuards";
import { handleNativeRouteArrivalNotificationSyncRequest } from "./routeArrivalNotificationBridge";
import { handleNativeSaveImageRequest } from "./saveImageBridge";
import type { NativeAppInfoContext, WebViewRef } from "./types";
import {
  handleNativePhotoRequest,
  handleNativePhotoUploadRequest,
} from "./visitPhotoBridge";

export { ROUTEONE_WEBVIEW_BRIDGE_SCRIPT };

type NativeBridgeHandlers = {
  onAuthSessionChange?: (session: {
    token: string | null;
    expiresAt: number | null;
    reason: "logout" | "expired" | null;
  }) => void;
};

export async function handleNativeBridgeMessage(
  event: WebViewMessageEvent,
  webViewRef: WebViewRef,
  appInfoContext: NativeAppInfoContext,
  handlers: NativeBridgeHandlers = {}
) {
  let message: unknown;

  try {
    message = JSON.parse(event.nativeEvent.data);
  } catch {
    return;
  }

  if (isNativeBridgeReadyMessage(message)) {
    console.log(
      `[routeone-native-bridge] ready graphql=${message.graphqlEndpoint ?? "/graphql"} target=${NATIVE_GRAPHQL_ENDPOINT} variant=${message.appVariant ?? "dev"} webBundleChannel=${message.webBundleChannel ?? "dev"} manifest=${message.webBundleManifestUrl ?? "none"}`
    );
    return;
  }

  if (isNativeAuthTokenMessage(message)) {
    const session = await handleNativeAuthTokenMessage(message);
    handlers.onAuthSessionChange?.(session);
    return;
  }

  if (isNativeAppInfoRequest(message)) {
    await handleNativeAppInfoRequest(message, webViewRef, appInfoContext);
    return;
  }

  if (isNativeLocationRequest(message)) {
    await handleNativeLocationRequest(message, webViewRef);
    return;
  }

  if (isNativePhotoRequest(message)) {
    await handleNativePhotoRequest(message, webViewRef);
    return;
  }

  if (isNativePhotoUploadRequest(message)) {
    await handleNativePhotoUploadRequest(message, webViewRef);
    return;
  }

  if (isNativeRouteArrivalNotificationSyncRequest(message)) {
    await handleNativeRouteArrivalNotificationSyncRequest(message, webViewRef);
    return;
  }

  if (isNativeFestivalNotificationSyncRequest(message)) {
    await handleNativeFestivalNotificationSyncRequest(message, webViewRef);
    return;
  }

  if (isNativeSaveImageRequest(message)) {
    await handleNativeSaveImageRequest(message, webViewRef);
    return;
  }

  if (isNativeExternalUrlRequest(message)) {
    await handleNativeExternalUrlRequest(message);
    return;
  }

  if (isNativeFetchRequest(message)) {
    await handleNativeFetchRequest(message, webViewRef);
  }
}
