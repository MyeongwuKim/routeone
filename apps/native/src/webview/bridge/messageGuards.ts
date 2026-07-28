import type {
  NativeAppLanguageMessage,
  NativeAppInfoRequest,
  NativeAuthTokenMessage,
  NativeBridgeReadyMessage,
  NativeDeliveredNotificationHistoryRequest,
  NativeExternalUrlRequest,
  NativeFestivalNotification,
  NativeFestivalNotificationSyncRequest,
  NativeFetchRequest,
  NativeLocationRequest,
  NativePhotoUploadRequest,
  NativePhotoRequest,
  NativePushTokenRequest,
  NativeRouteArrivalNotificationPlace,
  NativeRouteArrivalNotificationSyncRequest,
  NativeRouteReviewNotification,
  NativeRouteReviewNotificationSyncRequest,
  NativeSaveImageRequest,
} from "./types";

const NATIVE_APP_LANGUAGES = new Set(["ko", "en"]);
const NATIVE_FESTIVAL_NOTIFICATION_KINDS = new Set([
  "today",
  "weekly",
  "monthly",
  "trip",
  "test",
]);
const NATIVE_ROUTE_REVIEW_NOTIFICATION_KINDS = new Set([
  "completed",
  "incomplete",
  "unstarted",
]);

export function isNativeAppInfoRequest(
  value: unknown
): value is NativeAppInfoRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeAppInfoRequest>;

  return (
    maybeRequest.type === "routeone:native-app-info" &&
    typeof maybeRequest.id === "string"
  );
}

export function isNativeFetchRequest(
  value: unknown
): value is NativeFetchRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeFetchRequest>;

  return (
    maybeRequest.type === "routeone:native-fetch" &&
    typeof maybeRequest.id === "string" &&
    typeof maybeRequest.url === "string"
  );
}

export function isNativeBridgeReadyMessage(
  value: unknown
): value is NativeBridgeReadyMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as Partial<NativeBridgeReadyMessage>;

  return maybeMessage.type === "routeone:native-bridge-ready";
}

export function isNativeAuthTokenMessage(
  value: unknown
): value is NativeAuthTokenMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as Partial<NativeAuthTokenMessage>;

  return maybeMessage.type === "routeone:native-auth-token";
}

export function isNativeAppLanguageMessage(
  value: unknown
): value is NativeAppLanguageMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as Partial<NativeAppLanguageMessage>;

  return (
    maybeMessage.type === "routeone:native-app-language" &&
    typeof maybeMessage.language === "string" &&
    NATIVE_APP_LANGUAGES.has(maybeMessage.language)
  );
}

export function isNativeLocationRequest(
  value: unknown
): value is NativeLocationRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeLocationRequest>;

  return (
    maybeRequest.type === "routeone:native-location-current" &&
    typeof maybeRequest.id === "string"
  );
}

export function isNativePhotoRequest(value: unknown): value is NativePhotoRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativePhotoRequest>;

  return (
    maybeRequest.type === "routeone:native-visit-photo" &&
    typeof maybeRequest.id === "string"
  );
}

export function isNativePhotoUploadRequest(
  value: unknown
): value is NativePhotoUploadRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativePhotoUploadRequest>;

  return (
    maybeRequest.type === "routeone:native-visit-photo-upload" &&
    typeof maybeRequest.id === "string" &&
    typeof maybeRequest.photoUri === "string" &&
    typeof maybeRequest.uploadTarget === "object" &&
    maybeRequest.uploadTarget !== null
  );
}

function isNativeRouteArrivalNotificationPlace(
  value: unknown
): value is NativeRouteArrivalNotificationPlace {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybePlace = value as Partial<NativeRouteArrivalNotificationPlace>;

  return (
    typeof maybePlace.id === "string" &&
    typeof maybePlace.routeId === "string" &&
    typeof maybePlace.dayId === "string" &&
    typeof maybePlace.dayIndex === "number" &&
    typeof maybePlace.stopId === "string" &&
    typeof maybePlace.title === "string" &&
    typeof maybePlace.lat === "number" &&
    Number.isFinite(maybePlace.lat) &&
    typeof maybePlace.lng === "number" &&
    Number.isFinite(maybePlace.lng)
  );
}

export function isNativeRouteArrivalNotificationSyncRequest(
  value: unknown
): value is NativeRouteArrivalNotificationSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest =
    value as Partial<NativeRouteArrivalNotificationSyncRequest>;

  return (
    maybeRequest.type ===
      "routeone:native-route-arrival-notifications-sync" &&
    typeof maybeRequest.id === "string" &&
    Array.isArray(maybeRequest.places) &&
    maybeRequest.places.every(isNativeRouteArrivalNotificationPlace)
  );
}

export function isNativeDeliveredNotificationHistoryRequest(
  value: unknown
): value is NativeDeliveredNotificationHistoryRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest =
    value as Partial<NativeDeliveredNotificationHistoryRequest>;

  return (
    maybeRequest.type === "routeone:native-delivered-notification-history" &&
    typeof maybeRequest.id === "string" &&
    (maybeRequest.acknowledgedIds == null ||
      (Array.isArray(maybeRequest.acknowledgedIds) &&
        maybeRequest.acknowledgedIds.length <= 120 &&
        maybeRequest.acknowledgedIds.every((id) => typeof id === "string")))
  );
}

export function isNativePushTokenRequest(
  value: unknown
): value is NativePushTokenRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativePushTokenRequest>;

  return (
    maybeRequest.type === "routeone:native-push-token" &&
    typeof maybeRequest.id === "string" &&
    (maybeRequest.requestPermission == null ||
      typeof maybeRequest.requestPermission === "boolean")
  );
}

function isNativeFestivalNotification(
  value: unknown
): value is NativeFestivalNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeNotification = value as Partial<NativeFestivalNotification>;

  return (
    typeof maybeNotification.id === "string" &&
    typeof maybeNotification.kind === "string" &&
    NATIVE_FESTIVAL_NOTIFICATION_KINDS.has(maybeNotification.kind) &&
    typeof maybeNotification.regionCode === "string" &&
    typeof maybeNotification.regionLabel === "string" &&
    typeof maybeNotification.dateKey === "string" &&
    Array.isArray(maybeNotification.festivalIds) &&
    maybeNotification.festivalIds.every((id) => typeof id === "string") &&
    Array.isArray(maybeNotification.festivalTitles) &&
    maybeNotification.festivalTitles.every(
      (title) => typeof title === "string"
    ) &&
    (maybeNotification.festivalStartDates == null ||
      (Array.isArray(maybeNotification.festivalStartDates) &&
        maybeNotification.festivalStartDates.every(
          (date) => typeof date === "string"
        ))) &&
    (maybeNotification.festivalEndDates == null ||
      (Array.isArray(maybeNotification.festivalEndDates) &&
        maybeNotification.festivalEndDates.every(
          (date) => typeof date === "string"
        ))) &&
    (maybeNotification.triggerAt == null ||
      typeof maybeNotification.triggerAt === "string")
  );
}

export function isNativeFestivalNotificationSyncRequest(
  value: unknown
): value is NativeFestivalNotificationSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest =
    value as Partial<NativeFestivalNotificationSyncRequest>;

  return (
    maybeRequest.type === "routeone:native-festival-notifications-sync" &&
    typeof maybeRequest.id === "string" &&
    Array.isArray(maybeRequest.notifications) &&
    maybeRequest.notifications.every(isNativeFestivalNotification)
  );
}

function isNativeRouteReviewNotification(
  value: unknown
): value is NativeRouteReviewNotification {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeNotification = value as Partial<NativeRouteReviewNotification>;

  return (
    typeof maybeNotification.id === "string" &&
    typeof maybeNotification.kind === "string" &&
    NATIVE_ROUTE_REVIEW_NOTIFICATION_KINDS.has(maybeNotification.kind) &&
    typeof maybeNotification.routeId === "string" &&
    typeof maybeNotification.routeTitle === "string" &&
    typeof maybeNotification.dayId === "string" &&
    typeof maybeNotification.correctionDeadlineAt === "string" &&
    (maybeNotification.triggerAt == null ||
      typeof maybeNotification.triggerAt === "string")
  );
}

export function isNativeRouteReviewNotificationSyncRequest(
  value: unknown
): value is NativeRouteReviewNotificationSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest =
    value as Partial<NativeRouteReviewNotificationSyncRequest>;

  return (
    maybeRequest.type === "routeone:native-route-review-notifications-sync" &&
    typeof maybeRequest.id === "string" &&
    Array.isArray(maybeRequest.notifications) &&
    maybeRequest.notifications.every(isNativeRouteReviewNotification)
  );
}

export function isNativeExternalUrlRequest(
  value: unknown
): value is NativeExternalUrlRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeExternalUrlRequest>;

  return (
    maybeRequest.type === "routeone:native-open-url" &&
    typeof maybeRequest.url === "string"
  );
}

export function isNativeSaveImageRequest(
  value: unknown
): value is NativeSaveImageRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeSaveImageRequest>;

  return (
    maybeRequest.type === "routeone:native-save-image" &&
    typeof maybeRequest.id === "string" &&
    typeof maybeRequest.dataUrl === "string" &&
    typeof maybeRequest.fileName === "string"
  );
}
