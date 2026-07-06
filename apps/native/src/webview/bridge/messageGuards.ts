import type {
  NativeBridgeReadyMessage,
  NativeAuthTokenMessage,
  NativeExternalUrlRequest,
  NativeFetchRequest,
  NativeLocationRequest,
  NativePhotoUploadRequest,
  NativePhotoRequest,
} from "./types";

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
