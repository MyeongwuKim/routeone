export type NativePermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export type NativeAppInfo = {
  platform: "ios" | "android" | "web" | "native" | string;
  appVersion?: string | null;
  buildNumber?: string | null;
  runtimeVersion?: string | null;
  osVersion?: string | null;
  bundleIdentifier?: string | null;
  webBundleVersion?: string | null;
  webBundleKind?: "embedded" | "installed" | "remote" | null;
  webBundleChannel?: string | null;
  appVariant?: string | null;
  locationPermissionStatus?: NativePermissionStatus | null;
  notificationPermissionStatus?: NativePermissionStatus | null;
  cameraPermissionStatus?: NativePermissionStatus | null;
};

export type NativePosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

export type NativeVisitPhotoSource = "camera" | "library";

export type NativePhotoUploadTarget = {
  uploadUrl: string;
  imageId: string;
  imageUrl: string;
  fileName: string;
  environment: string;
};

export type NativeVisitPhoto = {
  uri: string | null;
  dataUrl?: string | null;
  width: number | null;
  height: number | null;
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

export type NativePhotoUploadResult = {
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

export type NativeSaveImageOptions = {
  dataUrl: string;
  fileName: string;
  title?: string;
};

export type NativeSaveImageResult = {
  shared: boolean;
  uri?: string | null;
};

export type NativeArrivalNotificationPlace = {
  id: string;
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  dayIndex: number;
  stopId: string;
  title: string;
  lat: number;
  lng: number;
};

export type NativeArrivalNotificationSyncResult = {
  activeCount: number;
  backgroundLocationStatus: string;
  notificationStatus: string;
};

export type NativeDeliveredRouteArrivalNotification = {
  id: string;
  type: "route-arrival";
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  stopId: string;
  placeTitle: string;
  dateKey: string;
  deliveredAt: string;
};

export type NativePushTokenResult = {
  expoPushToken: string | null;
  platform: "ios" | "android" | "web" | "native" | string;
  appVariant: string;
  permissionStatus: NativePermissionStatus;
  reason:
    | "permission-not-granted"
    | "missing-project-id"
    | "unsupported-platform"
    | null;
};

export type NativeFestivalNotificationKind =
  | "today"
  | "weekly"
  | "monthly"
  | "trip"
  | "test";

export type NativeFestivalNotification = {
  id: string;
  kind: NativeFestivalNotificationKind;
  regionCode: string;
  regionLabel: string;
  dateKey: string;
  festivalIds: string[];
  festivalTitles: string[];
  festivalStartDates?: string[];
  festivalEndDates?: string[];
  triggerAt?: string | null;
};

export type NativeFestivalNotificationSyncResult = {
  scheduledCount: number;
  notificationStatus: string;
};

export type NativeRouteReviewNotificationKind =
  | "completed"
  | "incomplete"
  | "unstarted";

export type NativeRouteReviewNotification = {
  id: string;
  kind: NativeRouteReviewNotificationKind;
  routeId: string;
  routeTitle: string;
  dayId: string;
  triggerAt?: string | null;
  correctionDeadlineAt: string;
};

export type NativeRouteReviewNotificationSyncResult = {
  scheduledCount: number;
  notificationStatus: string;
};

export type NativeAuthSessionEndReason = "logout" | "expired";

export type NativeBridgeApi = {
  getAppInfo?: () => Promise<NativeAppInfo>;
  getCurrentPosition?: () => Promise<NativePosition>;
  takeVisitPhoto?: (options?: {
    source?: NativeVisitPhotoSource;
    uploadTarget?: NativePhotoUploadTarget;
  }) => Promise<NativeVisitPhoto>;
  uploadVisitPhoto?: (options: {
    photoUri: string;
    uploadTarget: NativePhotoUploadTarget;
  }) => Promise<NativePhotoUploadResult>;
  syncRouteArrivalNotifications?: (options: {
    places: NativeArrivalNotificationPlace[];
    radiusMeters?: number;
  }) => Promise<NativeArrivalNotificationSyncResult>;
  getDeliveredNotifications?: (options?: {
    acknowledgedIds?: string[];
  }) => Promise<NativeDeliveredRouteArrivalNotification[]>;
  getPushToken?: (options?: {
    requestPermission?: boolean;
  }) => Promise<NativePushTokenResult>;
  syncFestivalNotifications?: (options: {
    notifications: NativeFestivalNotification[];
  }) => Promise<NativeFestivalNotificationSyncResult>;
  syncRouteReviewNotifications?: (options: {
    notifications: NativeRouteReviewNotification[];
  }) => Promise<NativeRouteReviewNotificationSyncResult>;
  saveImage?: (
    options: NativeSaveImageOptions
  ) => Promise<NativeSaveImageResult>;
  openExternalUrl?: (url: string) => boolean;
};

export type ReactNativeWebViewApi = {
  postMessage(message: string): void;
};
