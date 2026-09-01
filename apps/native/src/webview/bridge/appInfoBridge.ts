import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";
import { NATIVE_CAPABILITIES } from "./nativeCapabilities";
import { postNativeAppInfoResponse } from "./responses";
import type {
  NativeAppInfoContext,
  NativeAppInfoRequest,
  NativeAppInfoResponse,
  NativePermissionStatus,
  NativeLocationAccuracy,
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

async function getLocationPermissionDetails(): Promise<{
  status: NativePermissionStatus;
  accuracy: NativeLocationAccuracy;
}> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    const accuracy =
      Platform.OS === "ios" && permission.ios?.accuracy === "reduced"
        ? "reduced"
        : Platform.OS === "ios" && permission.ios?.accuracy === "full"
          ? "full"
          : "unavailable";

    return {
      status: normalizePermissionStatus(permission.status, permission.granted),
      accuracy
    };
  } catch {
    return {
      status: "unavailable",
      accuracy: "unavailable"
    };
  }
}

async function getNotificationPermissionStatus(): Promise<NativePermissionStatus> {
  try {
    const permission = await Notifications.getPermissionsAsync();

    if (Platform.OS === "ios" && permission.ios?.allowsAlert === false) {
      return "denied";
    }

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

async function getPhotoLibraryPermissionStatus(): Promise<NativePermissionStatus> {
  try {
    const permission = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (permission.accessPrivileges === "limited") {
      return "granted";
    }

    return normalizePermissionStatus(permission.status, permission.granted);
  } catch {
    return "unavailable";
  }
}

async function createNativeAppInfo(
  context: NativeAppInfoContext
): Promise<NativeAppInfoResponse> {
  const [
    locationPermission,
    notificationPermissionStatus,
    cameraPermissionStatus,
    photoLibraryPermissionStatus
  ] =
    await Promise.all([
      getLocationPermissionDetails(),
      getNotificationPermissionStatus(),
      getCameraPermissionStatus(),
      getPhotoLibraryPermissionStatus()
    ]);

  return {
    ok: true,
    platform: Platform.OS,
    capabilities: [...NATIVE_CAPABILITIES],
    appVersion: WEB_BUNDLE_UPDATE_CONFIG.nativeVersion || null,
    buildNumber: getBuildNumber(),
    runtimeVersion: Constants.expoRuntimeVersion ?? null,
    osVersion: getOsVersion(),
    bundleIdentifier: getBundleIdentifier(),
    webBundleVersion: context.webBundleVersion,
    webBundleKind: context.webBundleKind,
    webBundleChannel: WEB_BUNDLE_UPDATE_CONFIG.channel,
    appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant,
    locationPermissionStatus: locationPermission.status,
    locationAccuracy: locationPermission.accuracy,
    notificationPermissionStatus,
    cameraPermissionStatus,
    photoLibraryPermissionStatus
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
