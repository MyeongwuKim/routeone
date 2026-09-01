import type { MutableRefObject } from "react";
import type { ResolvedWebBundleKind } from "@/webBundle/webBundleTypes";
import type { NativeCapability } from "./nativeCapabilities";

export type WebViewRef = MutableRefObject<{
  injectJavaScript: (script: string) => void;
} | null>;

export type NativeFetchRequest = {
  type: "routeone:native-fetch";
  id: string;
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

export type NativeBridgeReadyMessage = {
  type: "routeone:native-bridge-ready";
  graphqlEndpoint?: string;
  appVariant?: string;
  webBundleChannel?: string;
  webBundleManifestUrl?: string | null;
  devVerificationBypass?: boolean;
  arrivalNotificationTestMode?: boolean;
};

export type NativeAuthTokenMessage = {
  type: "routeone:native-auth-token";
  sessionId: string;
  token?: string | null;
  expiresAt?: number | null;
  reason?: "logout" | "expired";
};

export type NativeAppLanguage = "ko" | "en";

export type NativeAppLanguageMessage = {
  type: "routeone:native-app-language";
  language: NativeAppLanguage;
};

export type NativeAppInfoRequest = {
  type: "routeone:native-app-info";
  id: string;
};

export type NativeAppInfoContext = {
  webBundleVersion: string | null;
  webBundleKind: ResolvedWebBundleKind;
};

export type NativePermissionStatus =
  | "granted"
  | "denied"
  | "undetermined"
  | "unavailable";

export type NativeLocationAccuracy = "full" | "reduced" | "unavailable";

export type NativeLocationRequest = {
  type: "routeone:native-location-current";
  id: string;
  useRealPosition?: boolean;
  forceRefresh?: boolean;
};

export type NativePhotoRequest = {
  type: "routeone:native-visit-photo";
  id: string;
  source?: "camera" | "library";
  uploadTarget?: NativePhotoUploadTarget;
};

export type NativePhotoUploadTarget = {
  uploadUrl?: string;
  imageId?: string;
  imageUrl?: string;
  fileName?: string;
  environment?: string;
};

export type NativePhotoUploadRequest = {
  type: "routeone:native-visit-photo-upload";
  id: string;
  photoUri: string;
  uploadTarget: NativePhotoUploadTarget;
};

export type NativeRouteArrivalNotificationPlace = {
  id: string;
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  dayIndex: number;
  dayDateKey: string;
  stopId: string;
  title: string;
  lat: number;
  lng: number;
};

export type NativeRouteArrivalNotificationSyncRequest = {
  type: "routeone:native-route-arrival-notifications-sync";
  id: string;
  sessionId: string;
  places: NativeRouteArrivalNotificationPlace[];
  radiusMeters?: number | null;
  language: NativeAppLanguage;
  checkCurrentPosition?: boolean | null;
  requestPermissions?: boolean | null;
};

export type NativeRouteArrivalTestLocationRequest = {
  type: "routeone:native-route-arrival-test-location";
  id: string;
  place: NativeRouteArrivalNotificationPlace | null;
  position?: {
    lat: number;
    lng: number;
  } | null;
  language: NativeAppLanguage;
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

export type NativeDeliveredNotificationHistoryRequest = {
  type: "routeone:native-delivered-notification-history";
  id: string;
  acknowledgedIds?: string[];
};

export type NativePushTokenRequest = {
  type: "routeone:native-push-token";
  id: string;
  requestPermission?: boolean;
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

export type NativeFestivalNotificationSyncRequest = {
  type: "routeone:native-festival-notifications-sync";
  id: string;
  notifications: NativeFestivalNotification[];
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

export type NativeRouteReviewNotificationSyncRequest = {
  type: "routeone:native-route-review-notifications-sync";
  id: string;
  notifications: NativeRouteReviewNotification[];
};

export type NativeExternalUrlRequest = {
  type: "routeone:native-open-url";
  url: string;
};

export type NativeSaveImageRequest = {
  type: "routeone:native-save-image";
  id: string;
  dataUrl: string;
  fileName: string;
  title?: string | null;
};

export type NativeFetchResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeFetchSuccessResponse = Extract<
  NativeFetchResponse,
  { ok: true }
>;

export type NativeLocationResponse =
  | {
      ok: true;
      lat: number;
      lng: number;
      accuracyMeters: number | null;
      timestamp: number;
    }
  | {
      ok: false;
      error: string;
    };

export type NativePhotoResponse =
  | {
      ok: true;
      uri: string | null;
      dataUrl?: string | null;
      width: number | null;
      height: number | null;
      uploadedImageId?: string | null;
      uploadedImageUrl?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativePhotoUploadResponse =
  | {
      ok: true;
      uploadedImageId?: string | null;
      uploadedImageUrl?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeRouteArrivalNotificationSyncResponse =
  | {
      ok: true;
      activeCount: number;
      pendingCount: number | null;
      registrationStatus:
        | "registered"
        | "delivered"
        | "inactive"
        | "unsupported";
      backgroundLocationStatus: string;
      notificationStatus: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeRouteArrivalTestLocationResponse =
  | {
      ok: true;
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
    }
  | {
      ok: false;
      error: string;
    };

export type NativeDeliveredNotificationHistoryResponse =
  | {
      ok: true;
      notifications: NativeDeliveredRouteArrivalNotification[];
    }
  | {
      ok: false;
      error: string;
    };

export type NativePushTokenResponse =
  | {
      ok: true;
      expoPushToken: string | null;
      platform: string;
      appVariant: string;
      permissionStatus: NativePermissionStatus;
      reason:
        | "permission-not-granted"
        | "missing-project-id"
        | "unsupported-platform"
        | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeFestivalNotificationSyncResponse =
  | {
      ok: true;
      scheduledCount: number;
      notificationStatus: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeRouteReviewNotificationSyncResponse =
  | {
      ok: true;
      scheduledCount: number;
      notificationStatus: string;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeSaveImageResponse =
  | {
      ok: true;
      shared: boolean;
      uri?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export type NativeAppInfoResponse = {
  ok: true;
  platform: string;
  capabilities: NativeCapability[];
  appVersion: string | null;
  buildNumber: string | null;
  runtimeVersion: string | null;
  osVersion: string | null;
  bundleIdentifier: string | null;
  webBundleVersion: string | null;
  webBundleKind: NativeAppInfoContext["webBundleKind"];
  webBundleChannel: string;
  appVariant: string;
  locationPermissionStatus: NativePermissionStatus;
  locationAccuracy: NativeLocationAccuracy;
  notificationPermissionStatus: NativePermissionStatus;
  cameraPermissionStatus: NativePermissionStatus;
  photoLibraryPermissionStatus: NativePermissionStatus;
};
