import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  postNativeDeliveredNotificationHistoryResponse,
  postNativeRouteArrivalNotificationSyncResponse,
} from "./responses";
import type {
  NativeDeliveredNotificationHistoryRequest,
  NativeDeliveredRouteArrivalNotification,
  NativeRouteArrivalNotificationPlace,
  NativeRouteArrivalNotificationSyncRequest,
  WebViewRef,
} from "./types";

type RouteArrivalGeofenceTaskData = {
  eventType?: Location.GeofencingEventType;
  region?: {
    identifier?: string | null;
  } | null;
};

type RouteArrivalTaskBody = {
  data?: unknown;
  error?: unknown;
};

type StoredRouteArrivalPlace = NativeRouteArrivalNotificationPlace & {
  notificationTitle: string;
  notificationBody: string;
};

const ROUTE_ARRIVAL_GEOFENCE_TASK = "routeone-route-arrival-geofence";
const ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID = "route-arrivals";
const ROUTE_ARRIVAL_PLACES_STORAGE_KEY =
  "routeone:native-route-arrival-places:v1";
const ROUTE_ARRIVAL_NOTIFIED_STORAGE_KEY =
  "routeone:native-route-arrival-notified:v1";
const DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY =
  "routeone:native-delivered-notification-history:v1";
const MAX_GEOFENCE_REGION_COUNT = 20;
const MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT = 120;
const DELIVERED_NOTIFICATION_HISTORY_TTL_MS =
  1000 * 60 * 60 * 24 * 180;
const DEFAULT_GEOFENCE_RADIUS_METERS = 100;
const MIN_GEOFENCE_RADIUS_METERS = 100;
const MAX_GEOFENCE_RADIUS_METERS = 500;
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE = TRUTHY_ENV_VALUES.has(
  process.env.EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE
    ?.trim()
    .toLowerCase() ?? ""
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function clampGeofenceRadiusMeters(value?: number | null) {
  if (!Number.isFinite(value)) {
    return DEFAULT_GEOFENCE_RADIUS_METERS;
  }

  return Math.max(
    MIN_GEOFENCE_RADIUS_METERS,
    Math.min(MAX_GEOFENCE_RADIUS_METERS, Math.round(value ?? 0))
  );
}

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRouteArrivalRegionId(place: NativeRouteArrivalNotificationPlace) {
  return `${place.routeId}:${place.stopId}`;
}

function createStoredRouteArrivalPlace(
  place: NativeRouteArrivalNotificationPlace
): StoredRouteArrivalPlace {
  return {
    ...place,
    notificationTitle: `${place.title} 근처예요`,
    notificationBody: "인증 사진을 남겨봐요.",
  };
}

function getUniqueStoredPlaces(
  places: NativeRouteArrivalNotificationPlace[]
) {
  const storedPlaceByRegionId = new Map<string, StoredRouteArrivalPlace>();

  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      continue;
    }

    const regionId = getRouteArrivalRegionId(place);

    if (!storedPlaceByRegionId.has(regionId)) {
      storedPlaceByRegionId.set(regionId, createStoredRouteArrivalPlace(place));
    }
  }

  return [...storedPlaceByRegionId.values()].slice(0, MAX_GEOFENCE_REGION_COUNT);
}

async function readStoredRouteArrivalPlaces() {
  const rawPlaces = await AsyncStorage.getItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY);

  if (!rawPlaces) {
    return new Map<string, StoredRouteArrivalPlace>();
  }

  try {
    const places = JSON.parse(rawPlaces) as StoredRouteArrivalPlace[];
    return new Map(
      places.map((place) => [getRouteArrivalRegionId(place), place] as const)
    );
  } catch {
    return new Map<string, StoredRouteArrivalPlace>();
  }
}

async function readNotifiedRegionDates() {
  const rawNotified = await AsyncStorage.getItem(
    ROUTE_ARRIVAL_NOTIFIED_STORAGE_KEY
  );

  if (!rawNotified) {
    return {};
  }

  try {
    return JSON.parse(rawNotified) as Record<string, string>;
  } catch {
    return {};
  }
}

async function writeNotifiedRegionDates(value: Record<string, string>) {
  await AsyncStorage.setItem(
    ROUTE_ARRIVAL_NOTIFIED_STORAGE_KEY,
    JSON.stringify(value)
  );
}

async function readDeliveredNotificationHistory() {
  const rawHistory = await AsyncStorage.getItem(
    DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY
  );

  if (!rawHistory) {
    return [];
  }

  try {
    const oldestAllowedTimestamp =
      Date.now() - DELIVERED_NOTIFICATION_HISTORY_TTL_MS;
    const notifications = JSON.parse(
      rawHistory
    ) as NativeDeliveredRouteArrivalNotification[];

    return notifications
      .filter((notification) => {
        const deliveredTimestamp = Date.parse(notification.deliveredAt);

        return (
          notification.type === "route-arrival" &&
          Boolean(
            notification.id &&
              notification.routeId &&
              notification.dayId &&
              notification.stopId &&
              notification.placeTitle &&
              notification.dateKey
          ) &&
          Number.isFinite(deliveredTimestamp) &&
          deliveredTimestamp >= oldestAllowedTimestamp
        );
      })
      .sort(
        (left, right) =>
          Date.parse(right.deliveredAt) - Date.parse(left.deliveredAt)
      )
      .slice(0, MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT);
  } catch {
    return [];
  }
}

async function appendDeliveredRouteArrivalNotification(
  place: StoredRouteArrivalPlace,
  dateKey: string
) {
  const notification: NativeDeliveredRouteArrivalNotification = {
    id: `arrival:${place.routeId}:${place.stopId}:${dateKey}`,
    type: "route-arrival",
    routeId: place.routeId,
    routeTitle: place.routeTitle ?? null,
    dayId: place.dayId,
    stopId: place.stopId,
    placeTitle: place.title,
    dateKey,
    deliveredAt: new Date().toISOString(),
  };
  const history = await readDeliveredNotificationHistory();
  const nextHistory = [
    notification,
    ...history.filter((item) => item.id !== notification.id),
  ].slice(0, MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT);

  await AsyncStorage.setItem(
    DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY,
    JSON.stringify(nextHistory)
  );
}

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID,
    {
      importance: Notifications.AndroidImportance.HIGH,
      name: "장소 도착 알림",
      vibrationPattern: [0, 250, 250, 250],
    }
  );
}

async function ensureRouteArrivalPermissions() {
  await ensureNotificationChannel();

  const currentNotificationPermission =
    await Notifications.getPermissionsAsync();
  const notificationPermission = currentNotificationPermission.granted
    ? currentNotificationPermission
    : await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      });

  if (!notificationPermission.granted) {
    throw new Error("알림 권한을 허용해야 장소 근처 알림을 받을 수 있어요.");
  }

  const foregroundLocationPermission =
    await Location.getForegroundPermissionsAsync();
  const nextForegroundLocationPermission =
    foregroundLocationPermission.status === "granted"
      ? foregroundLocationPermission
      : await Location.requestForegroundPermissionsAsync();

  if (nextForegroundLocationPermission.status !== "granted") {
    throw new Error("위치 권한을 허용해야 장소 근처 알림을 받을 수 있어요.");
  }

  const backgroundLocationPermission =
    await Location.getBackgroundPermissionsAsync();
  const nextBackgroundLocationPermission =
    backgroundLocationPermission.status === "granted"
      ? backgroundLocationPermission
      : await Location.requestBackgroundPermissionsAsync();

  if (nextBackgroundLocationPermission.status !== "granted") {
    throw new Error(
      "백그라운드 위치 권한을 허용해야 앱을 닫아도 장소 근처 알림을 받을 수 있어요."
    );
  }

  return {
    backgroundLocationStatus: nextBackgroundLocationPermission.status,
    notificationStatus: notificationPermission.status,
  };
}

async function stopRouteArrivalGeofencingIfStarted() {
  const hasStarted = await Location.hasStartedGeofencingAsync(
    ROUTE_ARRIVAL_GEOFENCE_TASK
  );

  if (hasStarted) {
    await Location.stopGeofencingAsync(ROUTE_ARRIVAL_GEOFENCE_TASK);
  }
}

async function scheduleRouteArrivalNotification(
  regionId: string,
  options: { force?: boolean } = {}
) {
  const todayKey = getTodayDateKey();
  const notifiedRegionDates = await readNotifiedRegionDates();

  if (!options.force && notifiedRegionDates[regionId] === todayKey) {
    return;
  }

  const placeByRegionId = await readStoredRouteArrivalPlaces();
  const place = placeByRegionId.get(regionId);

  if (!place) {
    return;
  }

  await ensureNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: place.notificationTitle,
      body: place.notificationBody,
      data: {
        notificationId: `arrival:${place.routeId}:${place.stopId}:${todayKey}`,
        routeId: place.routeId,
        dayId: place.dayId,
        stopId: place.stopId,
        type: "route-arrival",
      },
    },
    trigger: null,
  });

  await appendDeliveredRouteArrivalNotification(place, todayKey).catch(
    () => undefined
  );
  notifiedRegionDates[regionId] = todayKey;
  await writeNotifiedRegionDates(notifiedRegionDates);
}

if (!TaskManager.isTaskDefined(ROUTE_ARRIVAL_GEOFENCE_TASK)) {
  TaskManager.defineTask(
    ROUTE_ARRIVAL_GEOFENCE_TASK,
    async ({ data, error }: RouteArrivalTaskBody) => {
      if (error || !data) {
        return;
      }

      const payload = data as RouteArrivalGeofenceTaskData;
      const regionId = payload.region?.identifier;

      if (
        payload.eventType !== Location.GeofencingEventType.Enter ||
        !regionId
      ) {
        return;
      }

      await scheduleRouteArrivalNotification(regionId).catch(() => undefined);
    }
  );
}

export async function handleNativeRouteArrivalNotificationSyncRequest(
  message: NativeRouteArrivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  try {
    const places = getUniqueStoredPlaces(message.places);

    if (places.length === 0) {
      await stopRouteArrivalGeofencingIfStarted();
      await AsyncStorage.removeItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY);
      postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
        ok: true,
        activeCount: 0,
        backgroundLocationStatus: "unused",
        notificationStatus: "unused",
      });
      return;
    }

    const permissionStatus = await ensureRouteArrivalPermissions();
    const radius = clampGeofenceRadiusMeters(message.radiusMeters);

    await AsyncStorage.setItem(
      ROUTE_ARRIVAL_PLACES_STORAGE_KEY,
      JSON.stringify(places)
    );
    await Location.startGeofencingAsync(
      ROUTE_ARRIVAL_GEOFENCE_TASK,
      places.map((place) => ({
        identifier: getRouteArrivalRegionId(place),
        latitude: place.lat,
        longitude: place.lng,
        notifyOnEnter: true,
        notifyOnExit: false,
        radius,
      }))
    );

    if (ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE) {
      await scheduleRouteArrivalNotification(getRouteArrivalRegionId(places[0]), {
        force: true,
      });
    }

    postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
      ok: true,
      activeCount: places.length,
      ...permissionStatus,
    });
  } catch (error) {
    postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Route arrival notification sync failed",
    });
  }
}

export async function handleNativeDeliveredNotificationHistoryRequest(
  message: NativeDeliveredNotificationHistoryRequest,
  webViewRef: WebViewRef
) {
  try {
    const acknowledgedIds = new Set(message.acknowledgedIds ?? []);
    const history = await readDeliveredNotificationHistory();
    const notifications = history.filter(
      (notification) => !acknowledgedIds.has(notification.id)
    );

    if (notifications.length !== history.length) {
      await AsyncStorage.setItem(
        DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY,
        JSON.stringify(notifications)
      );
    }

    postNativeDeliveredNotificationHistoryResponse(webViewRef, message.id, {
      ok: true,
      notifications,
    });
  } catch (error) {
    postNativeDeliveredNotificationHistoryResponse(webViewRef, message.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Delivered notification history lookup failed",
    });
  }
}
