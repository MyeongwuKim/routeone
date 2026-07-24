import { getNativeAppInfo } from "./appInfo";
import { updateNativeAuthSession } from "./auth";
import { subscribeNativeAppActive } from "./events";
import { postWebBundleReady, reportWebRuntimeError } from "./lifecycle";
import { getNativeCurrentPosition } from "./location";
import {
  saveNativeImage,
  takeNativeVisitPhoto,
  uploadNativeVisitPhoto,
} from "./media";
import {
  syncNativeFestivalNotifications,
  syncNativeRouteArrivalNotifications,
} from "./notifications";
import { openNativeAppSettings } from "./permissions";
import { isNativeRuntime } from "./runtime";

export const nativeBridge = {
  runtime: {
    isAvailable: isNativeRuntime,
  },
  appInfo: {
    get: getNativeAppInfo,
  },
  permissions: {
    openSettings: openNativeAppSettings,
  },
  auth: {
    updateSession: updateNativeAuthSession,
  },
  location: {
    getCurrentPosition: getNativeCurrentPosition,
  },
  media: {
    takeVisitPhoto: takeNativeVisitPhoto,
    uploadVisitPhoto: uploadNativeVisitPhoto,
    saveImage: saveNativeImage,
  },
  notifications: {
    syncRouteArrivals: syncNativeRouteArrivalNotifications,
    syncFestivals: syncNativeFestivalNotifications,
  },
  events: {
    subscribeAppActive: subscribeNativeAppActive,
  },
  lifecycle: {
    postWebBundleReady,
    reportRuntimeError: reportWebRuntimeError,
  },
} as const;

export { useNativeAppInfo } from "./useNativeAppInfo";
export type {
  NativeAppInfo,
  NativeArrivalNotificationPlace,
  NativeArrivalNotificationSyncResult,
  NativeAuthSessionEndReason,
  NativeBridgeApi,
  NativeFestivalNotification,
  NativeFestivalNotificationKind,
  NativeFestivalNotificationSyncResult,
  NativePermissionStatus,
  NativePhotoUploadResult,
  NativePhotoUploadTarget,
  NativePosition,
  NativeSaveImageOptions,
  NativeSaveImageResult,
  NativeVisitPhoto,
  NativeVisitPhotoSource,
  ReactNativeWebViewApi,
} from "./types";
