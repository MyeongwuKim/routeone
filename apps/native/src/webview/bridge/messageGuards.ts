import type {
  NativeAppInfoRequest,
  NativeBridgeReadyMessage,
  NativeAuthTokenMessage,
  NativeExternalUrlRequest,
  NativeFetchRequest,
  NativeLocationRequest,
  NativePhotoUploadRequest,
  NativePhotoRequest,
  NativeRouteArrivalNotificationPlace,
  NativeRouteArrivalNotificationSyncRequest,
  NativeSaveImageRequest,
} from "./types";

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
