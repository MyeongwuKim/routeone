import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  postNativeDeliveredNotificationHistoryResponse,
  postNativeRouteArrivalNotificationSyncResponse,
  postNativeRouteArrivalTestLocationResponse,
} from "./responses";
import { setNativeRouteArrivalTestPosition } from "./locationBridge";
import type {
  NativeAppLanguage,
  NativeDeliveredNotificationHistoryRequest,
  NativeDeliveredRouteArrivalNotification,
  NativeRouteArrivalNotificationPlace,
  NativeRouteArrivalNotificationSyncRequest,
  NativeRouteArrivalTestLocationRequest,
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
  language: NativeAppLanguage;
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
const EARTH_RADIUS_METERS = 6_371_000;
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

function toRadians(degree: number) {
  return (degree * Math.PI) / 180;
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function createStoredRouteArrivalPlace(
  place: NativeRouteArrivalNotificationPlace,
  language: NativeAppLanguage
): StoredRouteArrivalPlace {
  return {
    ...place,
    language,
    notificationTitle:
      language === "en"
        ? `You've arrived at ${place.title}`
        : `${place.title}에 도착했어요`,
    notificationBody:
      language === "en"
        ? "Leave a verification photo."
        : "방문 인증 사진을 남겨보세요.",
  };
}

function getUniqueStoredPlaces(
  places: NativeRouteArrivalNotificationPlace[],
  language: NativeAppLanguage
) {
  const storedPlaceByRegionId = new Map<string, StoredRouteArrivalPlace>();

  for (const place of places) {
    if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      continue;
    }

    const regionId = getRouteArrivalRegionId(place);

    if (!storedPlaceByRegionId.has(regionId)) {
      storedPlaceByRegionId.set(
        regionId,
        createStoredRouteArrivalPlace(place, language)
      );
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

async function ensureNotificationChannel(language?: NativeAppLanguage) {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID,
    {
      importance: Notifications.AndroidImportance.HIGH,
      name: language === "en" ? "Place arrival alerts" : "장소 도착 알림",
      vibrationPattern: [0, 250, 250, 250],
    }
  );
}

async function ensureRouteArrivalNotificationPermission(
  language: NativeAppLanguage
) {
  await ensureNotificationChannel(language);

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
    throw new Error(
      language === "en"
        ? "Allow notifications to receive alerts near your destinations."
        : "알림 권한을 허용해야 장소 근처 알림을 받을 수 있어요."
    );
  }

  return notificationPermission;
}

async function ensureRouteArrivalPermissions(language: NativeAppLanguage) {
  const notificationPermission =
    await ensureRouteArrivalNotificationPermission(language);

  const foregroundLocationPermission =
    await Location.getForegroundPermissionsAsync();
  const nextForegroundLocationPermission =
    foregroundLocationPermission.status === "granted"
      ? foregroundLocationPermission
      : await Location.requestForegroundPermissionsAsync();

  if (nextForegroundLocationPermission.status !== "granted") {
    throw new Error(
      language === "en"
        ? "Allow location access to receive alerts near your destinations."
        : "위치 권한을 허용해야 장소 근처 알림을 받을 수 있어요."
    );
  }

  const backgroundLocationPermission =
    await Location.getBackgroundPermissionsAsync();
  const nextBackgroundLocationPermission =
    backgroundLocationPermission.status === "granted"
      ? backgroundLocationPermission
      : await Location.requestBackgroundPermissionsAsync();

  if (nextBackgroundLocationPermission.status !== "granted") {
    throw new Error(
      language === "en"
        ? "Allow background location access to receive nearby alerts when the app is closed."
        : "백그라운드 위치 권한을 허용해야 앱을 닫아도 장소 근처 알림을 받을 수 있어요."
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

async function scheduleRouteArrivalNotification(regionId: string) {
  const todayKey = getTodayDateKey();
  const notifiedRegionDates = await readNotifiedRegionDates();

  if (notifiedRegionDates[regionId] === todayKey) {
    return;
  }

  const placeByRegionId = await readStoredRouteArrivalPlaces();
  const place = placeByRegionId.get(regionId);

  if (!place) {
    return;
  }

  await deliverRouteArrivalNotification(place, todayKey);
  notifiedRegionDates[regionId] = todayKey;
  await writeNotifiedRegionDates(notifiedRegionDates);
}

async function deliverRouteArrivalNotification(
  place: StoredRouteArrivalPlace,
  dateKey: string
) {
  await ensureNotificationChannel(place.language);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: place.notificationTitle,
      body: place.notificationBody,
      data: {
        notificationId: `arrival:${place.routeId}:${place.stopId}:${dateKey}`,
        routeId: place.routeId,
        dayId: place.dayId,
        stopId: place.stopId,
        type: "route-arrival",
      },
    },
    trigger: null,
  });

  await appendDeliveredRouteArrivalNotification(place, dateKey).catch(
    () => undefined
  );
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
    const places = getUniqueStoredPlaces(message.places, message.language);

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

    const permissionStatus = await ensureRouteArrivalPermissions(
      message.language
    );
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

export async function handleNativeRouteArrivalTestLocationRequest(
  message: NativeRouteArrivalTestLocationRequest,
  webViewRef: WebViewRef
) {
  try {
    if (!ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE) {
      throw new Error(
        message.language === "en"
          ? "Arrival location testing is disabled in this build."
          : "이 빌드에서는 도착 위치 테스트를 사용할 수 없어요."
      );
    }

    if (!message.place) {
      setNativeRouteArrivalTestPosition(null);
      postNativeRouteArrivalTestLocationResponse(webViewRef, message.id, {
        ok: true,
        active: false,
        stopId: null,
        lat: null,
        lng: null,
        distanceMeters: null,
        withinRadius: null,
        notificationScheduled: false,
      });
      return;
    }

    const place = createStoredRouteArrivalPlace(
      message.place,
      message.language
    );
    const testPosition = message.position ?? {
      lat: place.lat,
      lng: place.lng,
    };
    const distanceMeters = calculateDistanceMeters(testPosition, place);
    const withinRadius =
      distanceMeters <= DEFAULT_GEOFENCE_RADIUS_METERS;

    if (withinRadius) {
      await ensureRouteArrivalNotificationPermission(message.language);
      await deliverRouteArrivalNotification(place, getTodayDateKey());
    }

    setNativeRouteArrivalTestPosition(testPosition);
    postNativeRouteArrivalTestLocationResponse(webViewRef, message.id, {
      ok: true,
      active: true,
      stopId: place.stopId,
      lat: testPosition.lat,
      lng: testPosition.lng,
      distanceMeters,
      withinRadius,
      notificationScheduled: withinRadius,
    });
  } catch (error) {
    postNativeRouteArrivalTestLocationResponse(webViewRef, message.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Route arrival location test failed",
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
