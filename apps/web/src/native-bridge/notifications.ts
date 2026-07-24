import { getNativeBridgeApi } from "./runtime";
import type {
  NativeArrivalNotificationPlace,
  NativeFestivalNotification,
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

export function syncNativeFestivalNotifications(
  notifications: NativeFestivalNotification[]
) {
  const syncNotifications = getNativeBridgeApi()?.syncFestivalNotifications;

  return syncNotifications ? syncNotifications({ notifications }) : null;
}
