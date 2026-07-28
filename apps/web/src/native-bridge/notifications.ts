import { getNativeBridgeApi } from "./runtime";
import type {
  NativeArrivalNotificationPlace,
  NativeFestivalNotification,
  NativeRouteReviewNotification,
} from "./types";

export function syncNativeRouteArrivalNotifications({
  places,
  radiusMeters,
}: {
  places: NativeArrivalNotificationPlace[];
  radiusMeters?: number;
}) {
  const syncNotifications =
    getNativeBridgeApi()?.syncRouteArrivalNotifications;

  return syncNotifications
    ? syncNotifications({
        places,
        radiusMeters,
      })
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
