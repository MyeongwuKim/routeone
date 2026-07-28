import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../../config/webBundleUpdateConfig";
import { postNativePushTokenResponse } from "./responses";
import type {
  NativePermissionStatus,
  NativePushTokenRequest,
  WebViewRef
} from "./types";

function normalizePermissionStatus(
  status: string,
  granted: boolean
): NativePermissionStatus {
  if (granted || status === "granted") {
    return "granted";
  }

  if (status === "denied") {
    return "denied";
  }

  if (status === "undetermined") {
    return "undetermined";
  }

  return "unavailable";
}

function getEasProjectId() {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: unknown } }
    | undefined;
  const configuredProjectId = extra?.eas?.projectId;

  if (
    typeof configuredProjectId === "string" &&
    configuredProjectId.trim()
  ) {
    return configuredProjectId.trim();
  }

  return Constants.easConfig?.projectId?.trim() || null;
}

export async function handleNativePushTokenRequest(
  request: NativePushTokenRequest,
  webViewRef: WebViewRef
) {
  try {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      postNativePushTokenResponse(webViewRef, request.id, {
        ok: true,
        expoPushToken: null,
        platform: Platform.OS,
        appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
        permissionStatus: "unavailable",
        reason: "unsupported-platform"
      });
      return;
    }

    let permission = await Notifications.getPermissionsAsync();

    if (
      !permission.granted &&
      permission.status === "undetermined" &&
      request.requestPermission
    ) {
      permission = await Notifications.requestPermissionsAsync();
    }

    const permissionStatus = normalizePermissionStatus(
      permission.status,
      permission.granted
    );

    if (!permission.granted) {
      postNativePushTokenResponse(webViewRef, request.id, {
        ok: true,
        expoPushToken: null,
        platform: Platform.OS,
        appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
        permissionStatus,
        reason: "permission-not-granted"
      });
      return;
    }

    const projectId = getEasProjectId();

    if (!projectId) {
      postNativePushTokenResponse(webViewRef, request.id, {
        ok: true,
        expoPushToken: null,
        platform: Platform.OS,
        appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
        permissionStatus,
        reason: "missing-project-id"
      });
      return;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId
    });

    postNativePushTokenResponse(webViewRef, request.id, {
      ok: true,
      expoPushToken: token.data,
      platform: Platform.OS,
      appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
      permissionStatus,
      reason: null
    });
  } catch (error) {
    postNativePushTokenResponse(webViewRef, request.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "푸시 토큰을 확인하지 못했습니다."
    });
  }
}
