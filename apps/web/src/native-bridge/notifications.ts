import { getNativeBridgeApi } from "./runtime";
import type {
  NativeArrivalNotificationPlace,
  NativeFestivalNotification,
  NativeRouteReviewNotification,
} from "./types";

export function syncNativeRouteArrivalNotifications({
  places,
  radiusMeters,
  language,
  checkCurrentPosition,
  requestPermissions,
}: {
  places: NativeArrivalNotificationPlace[];
  radiusMeters?: number;
  language?: "ko" | "en";
  checkCurrentPosition?: boolean;
  requestPermissions?: boolean;
}) {
  const syncNotifications =
    getNativeBridgeApi()?.syncRouteArrivalNotifications;

  return syncNotifications
    ? syncNotifications({
        places,
        radiusMeters,
        language,
        checkCurrentPosition,
        requestPermissions,
      })
    : null;
}

export function setNativeRouteArrivalTestLocation({
  place,
  position,
  language,
}: {
  place: NativeArrivalNotificationPlace | null;
  position?: { lat: number; lng: number } | null;
  language?: "ko" | "en";
}) {
  const setTestLocation = getNativeBridgeApi()?.setRouteArrivalTestLocation;

  return setTestLocation
    ? setTestLocation({ place, position, language })
    : null;
}

export function getNativeDeliveredNotifications(
  acknowledgedIds: string[] = []
) {
  return (
    getNativeBridgeApi()?.getDeliveredNotifications?.({
      acknowledgedIds,
    }) ?? null
  );
}

export function getNativePushToken(requestPermission = false) {
  return (
    getNativeBridgeApi()?.getPushToken?.({
      requestPermission,
    }) ?? null
  );
}

export function syncNativeFestivalNotifications(
  notifications: NativeFestivalNotification[]
) {
  const syncNotifications = getNativeBridgeApi()?.syncFestivalNotifications;

  return syncNotifications ? syncNotifications({ notifications }) : null;
}

export function syncNativeRouteReviewNotifications(
  notifications: NativeRouteReviewNotification[]
) {
  const syncNotifications =
    getNativeBridgeApi()?.syncRouteReviewNotifications;

  return syncNotifications ? syncNotifications({ notifications }) : null;
}
