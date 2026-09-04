import { requireOptionalNativeModule } from "expo";

export type IosRouteArrivalNotification = {
  identifier: string;
  regionIdentifier: string;
  title: string;
  body: string;
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  stopId: string;
  placeTitle: string;
  dateKey: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

export type IosRouteArrivalNotificationStatus = {
  pendingIdentifiers: string[];
  deliveredIdentifiers: string[];
  // Older native builds only expose the currently visible delivery list.
  // Handled IDs survive dismissal and are not a delivery timestamp/history.
  handledIdentifiers?: string[];
};

type RouteArrivalNotificationsNativeModule = {
  syncAsync: (
    notifications: IosRouteArrivalNotification[],
    radiusMeters: number
  ) => Promise<number>;
  getStatusAsync: () => Promise<IosRouteArrivalNotificationStatus>;
};

const nativeModule =
  requireOptionalNativeModule<RouteArrivalNotificationsNativeModule>(
    "RouteArrivalNotifications"
  );

export async function syncIosRouteArrivalNotifications(
  notifications: IosRouteArrivalNotification[],
  radiusMeters: number
) {
  if (!nativeModule) {
    throw new Error(
      "iOS 장소 도착 알림 모듈이 설치되지 않았어요. 네이티브 앱을 다시 빌드해 주세요."
    );
  }

  return nativeModule.syncAsync(notifications, radiusMeters);
}

export async function getIosRouteArrivalNotificationStatus() {
  if (!nativeModule) {
    throw new Error(
      "iOS 장소 도착 알림 모듈이 설치되지 않았어요. 네이티브 앱을 다시 빌드해 주세요."
    );
  }

  return nativeModule.getStatusAsync();
}
