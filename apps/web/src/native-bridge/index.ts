import { getNativeAppInfo } from "./appInfo";
import { updateNativeAuthSession } from "./auth";
import {
  subscribeNativeAppActive,
  subscribeNativeNotificationReceived,
} from "./events";
import { postWebBundleReady, reportWebRuntimeError } from "./lifecycle";
import { getNativeCurrentPosition } from "./location";
import {
  saveNativeImage,
  takeNativeVisitPhoto,
  uploadNativeVisitPhoto,
} from "./media";
import {
  getNativeDeliveredNotifications,
  getNativePushToken,
  syncNativeFestivalNotifications,
  syncNativeRouteArrivalNotifications,
  syncNativeRouteReviewNotifications,
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
    getDelivered: getNativeDeliveredNotifications,
    getPushToken: getNativePushToken,
    syncRouteArrivals: syncNativeRouteArrivalNotifications,
    syncFestivals: syncNativeFestivalNotifications,
    syncRouteReviews: syncNativeRouteReviewNotifications,
  },
  events: {
    subscribeAppActive: subscribeNativeAppActive,
    subscribeNotificationReceived:
      subscribeNativeNotificationReceived,
  },
  lifecycle: {
    postWebBundleReady,
    reportRuntimeError: reportWebRuntimeError,
  },
} as const;

export { useNativeAppInfo } from "./useNativeAppInfo";
export type {
  NativeNotificationReceivedEvent,
} from "./events";
export type {
  NativeAppInfo,
  NativeArrivalNotificationPlace,
  NativeArrivalNotificationSyncResult,
  NativeAuthSessionEndReason,
  NativeBridgeApi,
  NativeDeliveredRouteArrivalNotification,
  NativeFestivalNotification,
  NativeFestivalNotificationKind,
  NativeFestivalNotificationSyncResult,
  NativeRouteReviewNotification,
  NativeRouteReviewNotificationKind,
  NativeRouteReviewNotificationSyncResult,
  NativePermissionStatus,
  NativePushTokenResult,
  NativePhotoUploadResult,
  NativePhotoUploadTarget,
  NativePosition,
  NativeSaveImageOptions,
  NativeSaveImageResult,
  NativeVisitPhoto,
  NativeVisitPhotoSource,
  ReactNativeWebViewApi,
} from "./types";
