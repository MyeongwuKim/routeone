import Constants from "expo-constants";
import { Platform } from "react-native";
import { WEB_BUNDLE_UPDATE_CONFIG } from "../../config/webBundleUpdateConfig";
import { postNativeAppInfoResponse } from "./responses";
import type {
  NativeAppInfoContext,
  NativeAppInfoRequest,
  NativeAppInfoResponse,
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

function createNativeAppInfo(
  context: NativeAppInfoContext
): NativeAppInfoResponse {
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
    appVariant: WEB_BUNDLE_UPDATE_CONFIG.appVariant
  };
}

export function handleNativeAppInfoRequest(
  request: NativeAppInfoRequest,
  webViewRef: WebViewRef,
  context: NativeAppInfoContext
) {
  postNativeAppInfoResponse(
    webViewRef,
    request.id,
    createNativeAppInfo(context)
  );
}
