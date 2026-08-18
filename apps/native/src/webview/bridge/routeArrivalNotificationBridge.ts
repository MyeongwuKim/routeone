import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  getIosRouteArrivalNotificationStatus,
  syncIosRouteArrivalNotifications,
} from "@/nativeModules/routeArrivalNotifications";
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
  syncedDateKey: string;
};

const ROUTE_ARRIVAL_GEOFENCE_TASK = "routeone-route-arrival-geofence";
const ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID = "route-arrivals";
const ROUTE_ARRIVAL_PLACES_STORAGE_KEY =
  "routeone:native-route-arrival-places:v1";
const ROUTE_ARRIVAL_NOTIFIED_STORAGE_KEY =
  "routeone:native-route-arrival-notified:v1";
const DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY =
  "routeone:native-delivered-notification-history:v1";
const MAX_GEOFENCE_REGION_COUNT = 1;
const MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT = 120;
const DELIVERED_NOTIFICATION_HISTORY_TTL_MS =
  1000 * 60 * 60 * 24 * 180;
const DEFAULT_GEOFENCE_RADIUS_METERS = 300;
const MIN_GEOFENCE_RADIUS_METERS = 300;
const MAX_GEOFENCE_RADIUS_METERS = 500;
const CURRENT_POSITION_MAX_AGE_MS = 1000 * 60;
const CURRENT_POSITION_TIMEOUT_MS = 6000;
const EARTH_RADIUS_METERS = 6_371_000;
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE = TRUTHY_ENV_VALUES.has(
  process.env.EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE
    ?.trim()
    .toLowerCase() ?? ""
);

let routeArrivalDeliveryQueue: Promise<void> = Promise.resolve();
let routeArrivalSyncQueue: Promise<void> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const notificationType = notification.request.content.data?.type;
    const isRouteArrivalNotification =
      notificationType === "route-arrival" ||
      notificationType === "route-arrival-test";

    return {
      shouldPlaySound: isRouteArrivalNotification,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
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

function getRouteArrivalNotificationId(
  place: NativeRouteArrivalNotificationPlace,
  dateKey: string
) {
  return `arrival:${place.routeId}:${place.stopId}:${dateKey}`;
}

async function getIosRegistrationSummary(
  places: NativeRouteArrivalNotificationPlace[]
) {
  const dateKey = getTodayDateKey();
  const expectedIdentifiers = places.map((place) =>
    getRouteArrivalNotificationId(place, dateKey)
  );
  const status = await getIosRouteArrivalNotificationStatus();
  const pendingIdentifiers = new Set(status.pendingIdentifiers);
  const deliveredIdentifiers = new Set(status.deliveredIdentifiers);
  const pendingCount = expectedIdentifiers.filter((identifier) =>
    pendingIdentifiers.has(identifier)
  ).length;
  const deliveredCount = expectedIdentifiers.filter((identifier) =>
    deliveredIdentifiers.has(identifier)
  ).length;

  return {
    pendingCount,
    registrationStatus:
      pendingCount > 0
        ? ("registered" as const)
        : deliveredCount > 0
          ? ("delivered" as const)
          : ("inactive" as const),
  };
}

async function getBackgroundNotificationStatus(
  place: NativeRouteArrivalNotificationPlace
) {
  if (Platform.OS === "ios") {
    const notificationId = getRouteArrivalNotificationId(
      place,
      getTodayDateKey()
    );
    const status = await getIosRouteArrivalNotificationStatus();

    if (status.pendingIdentifiers.includes(notificationId)) {
      return "registered" as const;
    }

    if (status.deliveredIdentifiers.includes(notificationId)) {
      return "delivered" as const;
    }

    return "not-registered" as const;
  }

  if (Platform.OS === "android") {
    const [hasStarted, placeByRegionId] = await Promise.all([
      Location.hasStartedGeofencingAsync(ROUTE_ARRIVAL_GEOFENCE_TASK),
      readStoredRouteArrivalPlaces(),
    ]);

    return hasStarted && placeByRegionId.has(getRouteArrivalRegionId(place))
      ? ("registered" as const)
      : ("not-registered" as const);
  }

  return "unsupported" as const;
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
    syncedDateKey: getTodayDateKey(),
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
      places
        .filter((place) => place.syncedDateKey === getTodayDateKey())
        .slice(0, MAX_GEOFENCE_REGION_COUNT)
        .map((place) => [getRouteArrivalRegionId(place), place] as const)
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

type PresentedRouteArrivalNotification = {
  nativeIdentifier: string;
  notification: NativeDeliveredRouteArrivalNotification | null;
  notificationId: string;
};

function getNotificationDataString(
  data: Record<string, unknown>,
  key: string
) {
  const value = data[key];
  return typeof value === "string" && value ? value : null;
}

async function readPresentedRouteArrivalNotifications(): Promise<
  PresentedRouteArrivalNotification[]
> {
  const presentedNotifications =
    await Notifications.getPresentedNotificationsAsync();

  return presentedNotifications.flatMap((notification) => {
    const routeArrivalNotification =
      parsePresentedRouteArrivalNotification(notification);

    return routeArrivalNotification ? [routeArrivalNotification] : [];
  });
}

function parsePresentedRouteArrivalNotification(
  presentedNotification: Notifications.Notification
): PresentedRouteArrivalNotification | null {
  const data = presentedNotification.request.content.data;

  if (!data || data.type !== "route-arrival") {
    return null;
  }

  const notificationId = getNotificationDataString(data, "notificationId");

  if (!notificationId) {
    return null;
  }

  const routeId = getNotificationDataString(data, "routeId");
  const dayId = getNotificationDataString(data, "dayId");
  const stopId = getNotificationDataString(data, "stopId");
  const placeTitle = getNotificationDataString(data, "placeTitle");
  const dateKey = getNotificationDataString(data, "dateKey");
  const deliveredTimestamp =
    presentedNotification.date < 1_000_000_000_000
      ? presentedNotification.date * 1000
      : presentedNotification.date;
  const deliveredAt = new Date(deliveredTimestamp);
  const notification =
    routeId &&
    dayId &&
    stopId &&
    placeTitle &&
    dateKey &&
    Number.isFinite(deliveredAt.getTime())
      ? {
          id: notificationId,
          type: "route-arrival" as const,
          routeId,
          routeTitle: getNotificationDataString(data, "routeTitle"),
          dayId,
          stopId,
          placeTitle,
          dateKey,
          deliveredAt: deliveredAt.toISOString(),
        }
      : null;

  return {
    nativeIdentifier: presentedNotification.request.identifier,
    notification,
    notificationId,
  };
}

function mergeDeliveredNotificationHistory(
  ...notificationGroups: NativeDeliveredRouteArrivalNotification[][]
) {
  const notificationById = new Map<
    string,
    NativeDeliveredRouteArrivalNotification
  >();

  for (const notifications of notificationGroups) {
    for (const notification of notifications) {
      const previousNotification = notificationById.get(notification.id);

      if (
        !previousNotification ||
        Date.parse(notification.deliveredAt) >=
          Date.parse(previousNotification.deliveredAt)
      ) {
        notificationById.set(notification.id, notification);
      }
    }
  }

  return [...notificationById.values()]
    .sort(
      (left, right) =>
        Date.parse(right.deliveredAt) - Date.parse(left.deliveredAt)
    )
    .slice(0, MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT);
}

async function writeDeliveredNotificationHistory(
  notifications: NativeDeliveredRouteArrivalNotification[]
) {
  await AsyncStorage.setItem(
    DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY,
    JSON.stringify(notifications)
  );
}

export async function recordDeliveredRouteArrivalNotification(
  notification: Notifications.Notification
) {
  const routeArrivalNotification =
    parsePresentedRouteArrivalNotification(notification)?.notification;

  if (!routeArrivalNotification) {
    return;
  }

  const history = await readDeliveredNotificationHistory();
  await writeDeliveredNotificationHistory(
    mergeDeliveredNotificationHistory(history, [routeArrivalNotification])
  );

  const regionId = `${routeArrivalNotification.routeId}:${routeArrivalNotification.stopId}`;
  const notifiedRegionDates = await readNotifiedRegionDates();

  if (notifiedRegionDates[regionId] !== routeArrivalNotification.dateKey) {
    notifiedRegionDates[regionId] = routeArrivalNotification.dateKey;
    await writeNotifiedRegionDates(notifiedRegionDates);
  }
}

async function appendDeliveredRouteArrivalNotification(
  place: StoredRouteArrivalPlace,
  dateKey: string
) {
  const notification: NativeDeliveredRouteArrivalNotification = {
    id: getRouteArrivalNotificationId(place, dateKey),
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

  await writeDeliveredNotificationHistory(nextHistory);
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

  if (Platform.OS === "ios") {
    return {
      backgroundLocationStatus: "system-managed",
      notificationStatus: notificationPermission.status,
    };
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
  const placeByRegionId = await readStoredRouteArrivalPlaces();
  const place = placeByRegionId.get(regionId);

  if (!place) {
    return;
  }

  await deliverRouteArrivalNotificationOnce(place, todayKey);
}

async function getCurrentRouteArrivalPosition(radiusMeters: number) {
  const lastKnownPosition = await Location.getLastKnownPositionAsync({
    maxAge: CURRENT_POSITION_MAX_AGE_MS,
    requiredAccuracy: radiusMeters,
  });

  if (lastKnownPosition) {
    return lastKnownPosition;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), CURRENT_POSITION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function reconcileCurrentRouteArrival(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number
) {
  const todayKey = getTodayDateKey();
  const notifiedRegionDates = await readNotifiedRegionDates();
  const presentedNotifications =
    await readPresentedRouteArrivalNotifications().catch(() => []);
  let didUpdateNotifiedDates = false;

  for (const place of places) {
    const regionId = getRouteArrivalRegionId(place);
    const notificationId = getRouteArrivalNotificationId(place, todayKey);

    if (
      presentedNotifications.some(
        (notification) => notification.notificationId === notificationId
      ) &&
      notifiedRegionDates[regionId] !== todayKey
    ) {
      notifiedRegionDates[regionId] = todayKey;
      didUpdateNotifiedDates = true;
    }
  }

  if (didUpdateNotifiedDates) {
    await writeNotifiedRegionDates(notifiedRegionDates);
  }

  const currentPosition = await getCurrentRouteArrivalPosition(radiusMeters);

  if (!currentPosition) {
    return;
  }

  const accuracyMeters = currentPosition.coords.accuracy;

  if (
    typeof accuracyMeters === "number" &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters > radiusMeters
  ) {
    return;
  }

  const currentCoordinates = {
    lat: currentPosition.coords.latitude,
    lng: currentPosition.coords.longitude,
  };
  const latestNotifiedRegionDates = await readNotifiedRegionDates();
  const nearestPlace = places
    .filter(
      (place) =>
        latestNotifiedRegionDates[getRouteArrivalRegionId(place)] !== todayKey
    )
    .map((place) => ({
      distanceMeters: calculateDistanceMeters(currentCoordinates, place),
      place,
    }))
    .filter(({ distanceMeters }) => distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)[0]
    ?.place;

  if (nearestPlace) {
    const notificationId = getRouteArrivalNotificationId(
      nearestPlace,
      todayKey
    );

    await Notifications.cancelScheduledNotificationAsync(notificationId).catch(
      () => undefined
    );
    await deliverRouteArrivalNotificationOnce(nearestPlace, todayKey);
  }
}

export async function reconcileStoredRouteArrivalNotifications() {
  const [locationPermission, notificationPermission, placeByRegionId] =
    await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
      readStoredRouteArrivalPlaces(),
    ]);

  if (
    locationPermission.status !== "granted" ||
    !notificationPermission.granted ||
    placeByRegionId.size === 0
  ) {
    return;
  }

  const places = [...placeByRegionId.values()].slice(
    0,
    MAX_GEOFENCE_REGION_COUNT
  );

  if (Platform.OS === "ios") {
    const dateKey = getTodayDateKey();

    await syncIosRouteArrivalNotifications(
      places.map((place) => ({
        identifier: getRouteArrivalNotificationId(place, dateKey),
        regionIdentifier: getRouteArrivalRegionId(place),
        title: place.notificationTitle,
        body: place.notificationBody,
        routeId: place.routeId,
        routeTitle: place.routeTitle ?? null,
        dayId: place.dayId,
        stopId: place.stopId,
        placeTitle: place.title,
        dateKey,
        latitude: place.lat,
        longitude: place.lng,
      })),
      DEFAULT_GEOFENCE_RADIUS_METERS
    );
  }

  await reconcileCurrentRouteArrival(
    places,
    DEFAULT_GEOFENCE_RADIUS_METERS
  );
}

async function deliverRouteArrivalNotification(
  place: StoredRouteArrivalPlace,
  dateKey: string,
  options: {
    notificationId?: string;
    notificationType?: "route-arrival" | "route-arrival-test";
    shouldRecordHistory?: boolean;
  } = {}
) {
  const notificationId =
    options.notificationId ?? getRouteArrivalNotificationId(place, dateKey);
  const notificationType = options.notificationType ?? "route-arrival";

  await ensureNotificationChannel(place.language);
  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: place.notificationTitle,
      body: place.notificationBody,
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.HIGH,
      data: {
        notificationId,
        routeId: place.routeId,
        routeTitle: place.routeTitle ?? null,
        dayId: place.dayId,
        stopId: place.stopId,
        placeTitle: place.title,
        dateKey,
        type: notificationType,
      },
    },
    trigger:
      Platform.OS === "android"
        ? { channelId: ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID }
        : null,
  });

  if (options.shouldRecordHistory !== false) {
    await appendDeliveredRouteArrivalNotification(place, dateKey).catch(
      () => undefined
    );
  }
}

async function deliverRouteArrivalNotificationOnce(
  place: StoredRouteArrivalPlace,
  dateKey: string
) {
  const regionId = getRouteArrivalRegionId(place);
  let didDeliver = false;
  const delivery = routeArrivalDeliveryQueue.then(async () => {
    const notifiedRegionDates = await readNotifiedRegionDates();

    if (notifiedRegionDates[regionId] === dateKey) {
      return;
    }

    await deliverRouteArrivalNotification(place, dateKey);
    notifiedRegionDates[regionId] = dateKey;
    await writeNotifiedRegionDates(notifiedRegionDates);
    didDeliver = true;
  });

  routeArrivalDeliveryQueue = delivery.catch(() => undefined);
  await delivery;

  return didDeliver;
}

if (
  Platform.OS === "android" &&
  !TaskManager.isTaskDefined(ROUTE_ARRIVAL_GEOFENCE_TASK)
) {
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

async function syncNativeRouteArrivalNotifications(
  message: NativeRouteArrivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  try {
    const places = getUniqueStoredPlaces(message.places, message.language);

    if (places.length === 0) {
      if (Platform.OS === "ios") {
        await stopRouteArrivalGeofencingIfStarted().catch(() => undefined);
        await syncIosRouteArrivalNotifications([], DEFAULT_GEOFENCE_RADIUS_METERS);
      } else {
        await stopRouteArrivalGeofencingIfStarted();
      }
      await AsyncStorage.removeItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY);
      postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
        ok: true,
        activeCount: 0,
        pendingCount: 0,
        registrationStatus: "inactive",
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

    let activeCount = places.length;
    let pendingCount: number | null = null;
    let registrationStatus:
      | "registered"
      | "delivered"
      | "inactive"
      | "unsupported" = "registered";

    if (Platform.OS === "ios") {
      await stopRouteArrivalGeofencingIfStarted().catch(() => undefined);
      const dateKey = getTodayDateKey();
      activeCount = await syncIosRouteArrivalNotifications(
        places.map((place) => ({
          identifier: getRouteArrivalNotificationId(place, dateKey),
          regionIdentifier: getRouteArrivalRegionId(place),
          title: place.notificationTitle,
          body: place.notificationBody,
          routeId: place.routeId,
          routeTitle: place.routeTitle ?? null,
          dayId: place.dayId,
          stopId: place.stopId,
          placeTitle: place.title,
          dateKey,
          latitude: place.lat,
          longitude: place.lng,
        })),
        radius
      );
    } else {
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
    }

    await reconcileCurrentRouteArrival(places, radius).catch(() => undefined);

    if (Platform.OS === "ios") {
      const registrationSummary = await getIosRegistrationSummary(places);
      pendingCount = registrationSummary.pendingCount;
      registrationStatus = registrationSummary.registrationStatus;
    }

    postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
      ok: true,
      activeCount,
      pendingCount,
      registrationStatus,
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

export function handleNativeRouteArrivalNotificationSyncRequest(
  message: NativeRouteArrivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  const syncRequest = routeArrivalSyncQueue.then(() =>
    syncNativeRouteArrivalNotifications(message, webViewRef)
  );

  routeArrivalSyncQueue = syncRequest.catch(() => undefined);
  return syncRequest;
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
        backgroundNotificationStatus: null,
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
    const backgroundNotificationStatus =
      await getBackgroundNotificationStatus(place);

    if (withinRadius) {
      await ensureRouteArrivalNotificationPermission(message.language);
      await deliverRouteArrivalNotification(place, getTodayDateKey(), {
        notificationId: `arrival-test:${place.routeId}:${place.stopId}:${Date.now()}`,
        notificationType: "route-arrival-test",
        shouldRecordHistory: false,
      });
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
      backgroundNotificationStatus,
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
    const presentedNotifications =
      await readPresentedRouteArrivalNotifications();

    await Promise.all(
      presentedNotifications
        .filter((notification) =>
          acknowledgedIds.has(notification.notificationId)
        )
        .map((notification) =>
          Notifications.dismissNotificationAsync(
            notification.nativeIdentifier
          )
        )
    );
    const notifications = mergeDeliveredNotificationHistory(
      history,
      presentedNotifications.flatMap((notification) =>
        notification.notification ? [notification.notification] : []
      )
    ).filter((notification) => !acknowledgedIds.has(notification.id));

    await writeDeliveredNotificationHistory(notifications);

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
