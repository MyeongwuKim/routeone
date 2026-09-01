/**
 * 용도:
 * 여행 시작 전에 iPhone 위치 권한을 확인하고 도착 알림 동기화 가능 여부를 판단한다.
 *
 * 동작 방식:
 * 네이티브 앱 정보를 제한 시간 안에 조회해 iOS 권한 상태를 구분하고,
 * 브라우저와 Android에서는 기존 시작 흐름을 그대로 사용하도록 반환한다.
 */
import { nativeBridge } from "@/native-bridge";

const LOCATION_PERMISSION_LOOKUP_TIMEOUT_MS = 3_000;

export type RouteStartLocationPermissionState =
  | "not-required"
  | "granted"
  | "denied"
  | "undetermined";

function withPermissionLookupTimeout<T>(request: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = globalThis.setTimeout(() => {
      reject(new Error("Native location permission lookup timed out"));
    }, LOCATION_PERMISSION_LOOKUP_TIMEOUT_MS);

    request.then(
      (result) => {
        globalThis.clearTimeout(timeoutId);
        resolve(result);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      }
    );
  });
}

export async function getRouteStartLocationPermissionState(): Promise<RouteStartLocationPermissionState> {
  if (!nativeBridge.runtime.isAvailable()) {
    return "not-required";
  }

  const appInfo = await withPermissionLookupTimeout(
    nativeBridge.appInfo.get()
  );

  if (appInfo.platform !== "ios") {
    return "not-required";
  }

  if (
    appInfo.locationPermissionStatus === "granted" &&
    appInfo.locationAccuracy !== "reduced"
  ) {
    return "granted";
  }

  if (
    appInfo.locationPermissionStatus === "granted" &&
    appInfo.locationAccuracy === "reduced"
  ) {
    return "denied";
  }

  if (appInfo.locationPermissionStatus === "denied") {
    return "denied";
  }

  if (appInfo.locationPermissionStatus === "undetermined") {
    return "undetermined";
  }

  throw new Error("Native location permission status is unavailable");
}

export async function canSyncRouteArrivalForCurrentPermission() {
  const permissionState = await getRouteStartLocationPermissionState();

  return (
    permissionState === "not-required" || permissionState === "granted"
  );
}

export async function canRequireRouteArrivalRegistration() {
  if (!nativeBridge.runtime.isAvailable()) {
    return false;
  }

  const appInfo = await withPermissionLookupTimeout(
    nativeBridge.appInfo.get()
  );

  if (appInfo.platform === "android") {
    return true;
  }

  if (appInfo.platform !== "ios") {
    return false;
  }

  if (
    appInfo.locationPermissionStatus === "denied" ||
    appInfo.locationPermissionStatus === "undetermined" ||
    appInfo.locationAccuracy === "reduced" ||
    appInfo.notificationPermissionStatus === "denied" ||
    appInfo.notificationPermissionStatus === "undetermined"
  ) {
    return false;
  }

  if (
    !appInfo.locationPermissionStatus ||
    appInfo.locationPermissionStatus === "unavailable" ||
    !appInfo.locationAccuracy ||
    appInfo.locationAccuracy === "unavailable" ||
    !appInfo.notificationPermissionStatus ||
    appInfo.notificationPermissionStatus === "unavailable"
  ) {
    throw new Error("Native route arrival permission status is unavailable");
  }

  return (
    appInfo.locationPermissionStatus === "granted" &&
    appInfo.locationAccuracy === "full" &&
    appInfo.notificationPermissionStatus === "granted"
  );
}

export async function shouldRequestRouteArrivalRegistrationForStart(
  startWithoutLocationPermission: boolean
) {
  if (
    startWithoutLocationPermission ||
    !nativeBridge.runtime.isAvailable()
  ) {
    return false;
  }

  const appInfo = await withPermissionLookupTimeout(
    nativeBridge.appInfo.get()
  );

  if (appInfo.platform !== "ios") {
    return true;
  }

  return !(
    appInfo.locationPermissionStatus === "denied" ||
    appInfo.locationAccuracy === "reduced" ||
    appInfo.notificationPermissionStatus === "denied"
  );
}
