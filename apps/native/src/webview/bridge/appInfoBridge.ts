import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../../config/webBundleUpdateConfig";
import { postNativeAppInfoResponse } from "./responses";
import type {
  NativeAppInfoContext,
  NativeAppInfoRequest,
  NativeAppInfoResponse,
  NativePermissionStatus,
  WebViewRef
} from "./types";

function getBuildNumber() {
  if (Platform.OS === "ios") {
    return Constants.expoConfig?.ios?.buildNumber?.toString() ?? null;
  }

  if (Platform.OS === "android") {
    return Constants.expoConfig?.android?.versionCode?.toString() ?? null;
  }

  return null;
}

function getBundleIdentifier() {
  if (Platform.OS === "ios") {
    return Constants.expoConfig?.ios?.bundleIdentifier ?? null;
  }

  if (Platform.OS === "android") {
    return Constants.expoConfig?.android?.package ?? null;
  }

  return null;
}

function getOsVersion() {
  if (Platform.OS === "android") {
    return Platform.constants.Release;
  }

  return Platform.Version === undefined ? null : String(Platform.Version);
}

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

async function getLocationPermissionStatus(): Promise<NativePermissionStatus> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    return normalizePermissionStatus(permission.status, permission.granted);
  } catch {
    return "unavailable";
  }
}

async function getNotificationPermissionStatus(): Promise<NativePermissionStatus> {
  try {
    const permission = await Notifications.getPermissionsAsync();
    return normalizePermissionStatus(permission.status, permission.granted);
  } catch {
    return "unavailable";
  }
}

async function getCameraPermissionStatus(): Promise<NativePermissionStatus> {
  try {
    const permission = await ImagePicker.getCameraPermissionsAsync();
    return normalizePermissionStatus(permission.status, permission.granted);
  } catch {
    return "unavailable";
  }
}

async function createNativeAppInfo(
  context: NativeAppInfoContext
): Promise<NativeAppInfoResponse> {
  const [
    locationPermissionStatus,
    notificationPermissionStatus,
    cameraPermissionStatus
  ] =
    await Promise.all([
      getLocationPermissionStatus(),
      getNotificationPermissionStatus(),
      getCameraPermissionStatus()
    ]);

  return {
    ok: true,
    platform: Platform.OS,
    appVersion: WEB_BUNDLE_UPDATE_CONFIG.nativeVersion || null,
    buildNumber: getBuildNumber(),
    runtimeVersion: Constants.expoRuntimeVersion ?? null,
    osVersion: getOsVersion(),
    bundleIdentifier: getBundleIdentifier(),
    webBundleVersion: context.webBundleVersion,
    webBundleKind: context.webBundleKind,
    webBundleChannel: WEB_BUNDLE_UPDATE_CONFIG.channel,
    appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
    locationPermissionStatus,
    notificationPermissionStatus,
    cameraPermissionStatus
  };
}

export async function handleNativeAppInfoRequest(
  request: NativeAppInfoRequest,
  webViewRef: WebViewRef,
  context: NativeAppInfoContext
) {
  postNativeAppInfoResponse(
    webViewRef,
    request.id,
    await createNativeAppInfo(context)
  );
}
