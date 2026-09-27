/** 웹에 주입된 직접 호출 API와 주고받는 앱 정보·위치·미디어·알림 데이터 계약을 정의한다. */
export type NativePermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export type NativeLocationAccuracy = "full" | "reduced" | "unavailable";

export type NativeAppInfo = {
  platform: "ios" | "android" | "web" | "native" | string;
  capabilities: string[];
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
  locationAccuracy?: NativeLocationAccuracy | null;
  notificationPermissionStatus?: NativePermissionStatus | null;
  cameraPermissionStatus?: NativePermissionStatus | null;
  photoLibraryPermissionStatus?: NativePermissionStatus | null;
};

export type NativePosition = {
  /** WGS84 위도 */
  lat: number;
  /** WGS84 경도 */
  lng: number;
  /** 네이티브 위치 측정의 수평 정확도(m). 제공되지 않으면 null */
  accuracyMeters: number | null;
  /** 위치가 측정된 Unix 밀리초 시각 */
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
  /** 경로 안에서 사용자에게 표시하는 1부터 시작하는 DAY 번호 */
  dayIndex: number;
  dayDateKey: string;
  stopId: string;
  title: string;
  lat: number;
  lng: number;
  /** 장소 도착으로 판정할 반경(m) */
  radiusMeters: number;
};

export type NativeArrivalNotificationSyncResult = {
  activeCount: number;
  pendingCount: number | null;
  registrationStatus:
    | "registered"
    | "delivered"
    | "inactive"
    | "unsupported";
  backgroundLocationStatus: string;
  notificationStatus: string;
};

export type NativeArrivalTestLocationResult = {
  active: boolean;
  stopId: string | null;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  withinRadius: boolean | null;
  notificationScheduled: boolean;
  backgroundNotificationStatus:
    | "registered"
    | "delivered"
    | "not-registered"
    | "unsupported"
    | null;
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
  /** 네이티브가 예약할 ISO 시각. null이면 즉시 알림 후보로 처리한다. */
  triggerAt?: string | null;
};

export type NativeFestivalNotificationSyncResult = {
  scheduledCount: number;
  notificationStatus: string;
};

/** 여행 종료 후 검토 알림에서 구분하는 완료, 미완료, 미시작 일정 상태 */
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
  /** 네이티브가 예약할 ISO 시각. 예약 시각이 없는 대상은 null */
  triggerAt?: string | null;
  /** 방문 기록 수정이 가능한 마지막 ISO 시각 */
  correctionDeadlineAt: string;
};

export type NativeRouteReviewNotificationSyncResult = {
  scheduledCount: number;
  notificationStatus: string;
};

export type NativeAuthSessionEndReason = "logout" | "expired";

/** 도착 알림 등록 과정에서 네이티브가 웹에 전달하는 대기, 등록, 위치 확인 단계 */
export type NativeArrivalNotificationProgress = "queued" | "registering" | "locating";

export type NativeBridgeApi = {
  getAppInfo?: () => Promise<NativeAppInfo>;
  getCurrentPosition?: (options?: {
    useRealPosition?: boolean;
    forceRefresh?: boolean;
  }) => Promise<NativePosition>;
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
    language?: "ko" | "en";
    checkCurrentPosition?: boolean;
    waitForCurrentPosition?: boolean;
    requestPermissions?: boolean;
    onProgress?: (stage: NativeArrivalNotificationProgress) => void;
  }) => Promise<NativeArrivalNotificationSyncResult>;
  setRouteArrivalTestLocation?: (options: {
    place: NativeArrivalNotificationPlace | null;
    position?: { lat: number; lng: number } | null;
    language?: "ko" | "en";
  }) => Promise<NativeArrivalTestLocationResult>;
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
