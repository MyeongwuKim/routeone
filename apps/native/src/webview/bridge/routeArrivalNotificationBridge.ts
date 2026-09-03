/**
 * 호출 위치: WebView 여행 일정 → 네이티브 도착 알림 브릿지
 *
 * 용도:
 * 웹에서 받은 당일 남은 장소를 저장하고 iOS 위치 알림과
 * Android 지오펜스를 등록·복구하며 수신 이력을 중복 없이 관리한다.
 *
 * 동작 방식:
 * 전체 desired 목록을 먼저 저장한 뒤 OS 등록 상태와 차이만 반영하고,
 * 권한 없이 시작하거나 빈 목록을 받을 때만 기존 모니터를 해제한다.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import {
  isNativeSessionCleanupPending,
  readStoredNativeAuthSession,
} from "@/auth/nativeAuthStorage";
import { prepareNativeCurrentPosition } from "@/location/nativeCurrentPosition";
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

type RouteArrivalLocationTaskData = {
  locations?: Location.LocationObject[];
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
const ROUTE_ARRIVAL_LOCATION_TASK = "routeone-route-arrival-location";
const ROUTE_ARRIVAL_NOTIFICATION_CHANNEL_ID = "route-arrivals";
const ROUTE_ARRIVAL_PLACES_STORAGE_KEY =
  "routeone:native-route-arrival-places:v1";
const ROUTE_ARRIVAL_NOTIFIED_STORAGE_KEY =
  "routeone:native-route-arrival-notified:v2";
const DELIVERED_NOTIFICATION_HISTORY_STORAGE_KEY =
  "routeone:native-delivered-notification-history:v1";
const MAX_IOS_GEOFENCE_REGION_COUNT = 20;
const MAX_DELIVERED_NOTIFICATION_HISTORY_COUNT = 120;
const DELIVERED_NOTIFICATION_HISTORY_TTL_MS =
  1000 * 60 * 60 * 24 * 180;
const DEFAULT_GEOFENCE_RADIUS_METERS = 300;
const MIN_GEOFENCE_RADIUS_METERS = 300;
const MAX_GEOFENCE_RADIUS_METERS = 500;
const ROUTE_ARRIVAL_LAST_KNOWN_MAX_AGE_MS = 15_000;
const ROUTE_ARRIVAL_LAST_KNOWN_REQUIRED_ACCURACY_METERS = 100;
const EARTH_RADIUS_METERS = 6_371_000;
const TRUTHY_ENV_VALUES = new Set(["1", "true", "yes", "on"]);
const ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE = TRUTHY_ENV_VALUES.has(
  process.env.EXPO_PUBLIC_ROUTEONE_ARRIVAL_NOTIFICATION_TEST_MODE
    ?.trim()
    .toLowerCase() ?? ""
);

let routeArrivalOperationQueue: Promise<void> = Promise.resolve();
let routeArrivalSyncQueue: Promise<void> = Promise.resolve();
let routeArrivalTestState: {
  stopId: string;
  withinRadius: boolean;
} | null = null;

type RouteArrivalPosition = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
};

type RouteArrivalPositionReconciliation =
  | "inside"
  | "outside"
  | "unverified";

class RouteArrivalCurrentPositionLookupError extends Error {
  readonly originalError: unknown;

  constructor(error: unknown) {
    super(
      error instanceof Error
        ? error.message
        : "Current route arrival position lookup failed"
    );
    this.name = "RouteArrivalCurrentPositionLookupError";
    this.originalError = error;
  }
}

export function resetNativeRouteArrivalTestState() {
  routeArrivalTestState = null;
}

function warnRouteArrivalError(context: string, error: unknown) {
  console.warn(`[route-arrival-notifications] ${context}`, error);
}

// Keep receipt persistence, inbox dismissal and registration in the same queue.
function enqueueRouteArrivalOperation<T>(operation: () => Promise<T>) {
  const request = routeArrivalOperationQueue.then(operation);
  routeArrivalOperationQueue = request.then(
    () => undefined,
    () => undefined
  );

  return request;
}

function enqueueRouteArrivalSync<T>(operation: () => Promise<T>) {
  const request = routeArrivalSyncQueue.then(operation);
  routeArrivalSyncQueue = request.then(
    () => undefined,
    () => undefined
  );

  return request;
}

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

function getRouteArrivalDateKey(place: NativeRouteArrivalNotificationPlace) {
  return /^\d{4}-\d{2}-\d{2}$/.test(place.dayDateKey)
    ? place.dayDateKey
    : getTodayDateKey();
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

function assertSupportedRouteArrivalPlaceCount(
  placeCount: number,
  language: NativeAppLanguage = "ko"
) {
  if (
    Platform.OS !== "ios" ||
    placeCount <= MAX_IOS_GEOFENCE_REGION_COUNT
  ) {
    return;
  }

  throw new Error(
    language === "en"
      ? `iPhone can monitor up to ${MAX_IOS_GEOFENCE_REGION_COUNT} destination alerts at once.`
      : `iPhone에서는 장소 도착 알림을 한 번에 최대 ${MAX_IOS_GEOFENCE_REGION_COUNT}개까지 등록할 수 있어요.`
  );
}

async function getIosRegistrationSummary(
  places: NativeRouteArrivalNotificationPlace[]
) {
  const expectedIdentifiers = places.map((place) =>
    getRouteArrivalNotificationId(place, getRouteArrivalDateKey(place))
  );
  const [status, notifiedRegionDates] = await Promise.all([
    getIosRouteArrivalNotificationStatus(),
    readNotifiedRegionDates(),
  ]);
  const pendingIdentifiers = new Set(status.pendingIdentifiers);
  const deliveredIdentifiers = new Set([
    ...status.deliveredIdentifiers,
    ...(status.handledIdentifiers ?? []),
  ]);
  for (const place of places) {
    const dateKey = getRouteArrivalDateKey(place);
    if (notifiedRegionDates[getRouteArrivalRegionId(place)] === dateKey) {
      deliveredIdentifiers.add(getRouteArrivalNotificationId(place, dateKey));
    }
  }
  const pendingCount = expectedIdentifiers.filter((identifier) =>
    pendingIdentifiers.has(identifier) && !deliveredIdentifiers.has(identifier)
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
    const notifiedRegionDates = await readNotifiedRegionDates();
    if (
      notifiedRegionDates[getRouteArrivalRegionId(place)] ===
      getRouteArrivalDateKey(place)
    ) {
      return "delivered" as const;
    }

    const notificationId = getRouteArrivalNotificationId(
      place,
      getRouteArrivalDateKey(place)
    );
    const status = await getIosRouteArrivalNotificationStatus();

    if (
      status.deliveredIdentifiers.includes(notificationId) ||
      status.handledIdentifiers?.includes(notificationId)
    ) {
      return "delivered" as const;
    }

    if (status.pendingIdentifiers.includes(notificationId)) {
      return "registered" as const;
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

  const storedPlaces = [...storedPlaceByRegionId.values()];
  assertSupportedRouteArrivalPlaceCount(storedPlaces.length, language);
  return storedPlaces;
}

async function readStoredRouteArrivalPlaces() {
  const rawPlaces = await AsyncStorage.getItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY);

  if (!rawPlaces) {
    return new Map<string, StoredRouteArrivalPlace>();
  }

  let places: StoredRouteArrivalPlace[];

  try {
    const parsedPlaces = JSON.parse(rawPlaces) as unknown;
    if (!Array.isArray(parsedPlaces)) {
      return new Map<string, StoredRouteArrivalPlace>();
    }
    places = parsedPlaces as StoredRouteArrivalPlace[];
  } catch {
    return new Map<string, StoredRouteArrivalPlace>();
  }

  const todayKey = getTodayDateKey();
  const placeByRegionId = new Map(
    places
      .filter((place) => getRouteArrivalDateKey(place) >= todayKey)
      .map((place) => [getRouteArrivalRegionId(place), place] as const)
  );
  assertSupportedRouteArrivalPlaceCount(
    placeByRegionId.size,
    placeByRegionId.values().next().value?.language ?? "ko"
  );
  return placeByRegionId;
}

function haveSameRouteArrivalTargets(
  currentPlaces: StoredRouteArrivalPlace[],
  nextPlaces: StoredRouteArrivalPlace[]
) {
  if (currentPlaces.length !== nextPlaces.length) {
    return false;
  }

  return currentPlaces.every((currentPlace, index) => {
    const nextPlace = nextPlaces[index];

    return (
      nextPlace !== undefined &&
      getRouteArrivalRegionId(currentPlace) ===
        getRouteArrivalRegionId(nextPlace) &&
      getRouteArrivalDateKey(currentPlace) ===
        getRouteArrivalDateKey(nextPlace)
    );
  });
}

function persistDesiredRouteArrivalPlaces(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number,
  options: {
    clearExistingMonitors?: boolean;
  } = {}
) {
  return enqueueRouteArrivalOperation(async () => {
    const previousRawPlaces = await AsyncStorage.getItem(
      ROUTE_ARRIVAL_PLACES_STORAGE_KEY
    );
    const previousPlaces = [...(await readStoredRouteArrivalPlaces()).values()];

    await AsyncStorage.setItem(
      ROUTE_ARRIVAL_PLACES_STORAGE_KEY,
      JSON.stringify(places)
    );

    const targetsChanged = !haveSameRouteArrivalTargets(previousPlaces, places);
    const shouldClearExistingMonitors =
      options.clearExistingMonitors === true;

    if (!targetsChanged && !shouldClearExistingMonitors) {
      return;
    }

    try {
      if (Platform.OS === "ios") {
        // A normal desired-set update is diffed by the Swift module so pending
        // destinations that are still wanted never lose their OS registration.
        if (shouldClearExistingMonitors) {
          await syncIosRouteArrivalNotifications([], radiusMeters);
        }
      } else if (Platform.OS === "android") {
        await stopRouteArrivalLocationTrackingIfStarted();
        await stopRouteArrivalGeofencingIfStarted();
      }
    } catch (error) {
      await (previousRawPlaces === null
        ? AsyncStorage.removeItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY)
        : AsyncStorage.setItem(
            ROUTE_ARRIVAL_PLACES_STORAGE_KEY,
            previousRawPlaces
          )
      ).catch((rollbackError) =>
        warnRouteArrivalError(
          "desired target rollback after monitor reset failure failed",
          rollbackError
        )
      );
      throw error;
    }
  });
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

async function rememberDeliveredRouteArrivalNotifications(
  notifications: Pick<
    NativeDeliveredRouteArrivalNotification,
    "routeId" | "stopId" | "dateKey"
  >[]
) {
  const notifiedRegionDates = await readNotifiedRegionDates();
  let didUpdate = false;

  for (const notification of notifications) {
    const regionId = `${notification.routeId}:${notification.stopId}`;
    if ((notifiedRegionDates[regionId] ?? "") < notification.dateKey) {
      notifiedRegionDates[regionId] = notification.dateKey;
      didUpdate = true;
    }
  }

  if (didUpdate) {
    await writeNotifiedRegionDates(notifiedRegionDates);
  }

  return notifiedRegionDates;
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

export function recordDeliveredRouteArrivalNotification(
  notification: Notifications.Notification
) {
  return enqueueRouteArrivalOperation(async () => {
    const routeArrivalNotification =
      parsePresentedRouteArrivalNotification(notification)?.notification;

    if (!routeArrivalNotification) {
      return;
    }

    await rememberDeliveredRouteArrivalNotifications([routeArrivalNotification]);
    const history = await readDeliveredNotificationHistory();
    await writeDeliveredNotificationHistory(
      mergeDeliveredNotificationHistory(history, [routeArrivalNotification])
    );
  });
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
  const hasCurrentAlertPermission =
    currentNotificationPermission.granted &&
    (Platform.OS !== "ios" ||
      currentNotificationPermission.ios?.allowsAlert !== false);
  const notificationPermission = hasCurrentAlertPermission
    ? currentNotificationPermission
    : await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: false,
          allowSound: true,
        },
      });
  const hasAlertPermission =
    notificationPermission.granted &&
    (Platform.OS !== "ios" ||
      notificationPermission.ios?.allowsAlert !== false);

  if (!hasAlertPermission) {
    throw new Error(
      language === "en"
        ? "Enable notification alerts in iPhone Settings to receive destination alerts."
        : "iPhone 설정에서 알림 배너를 켜야 장소 근처 알림을 받을 수 있어요."
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

  if (
    Platform.OS === "ios" &&
    nextForegroundLocationPermission.ios?.accuracy === "reduced"
  ) {
    throw new Error(
      language === "en"
        ? "Enable Precise Location in iPhone Settings for 300 m arrival alerts."
        : "300m 도착 알림을 받으려면 iPhone 설정에서 정확한 위치를 켜 주세요."
    );
  }

  if (Platform.OS === "ios") {
    // UNLocationNotificationTrigger is monitored by iOS after registration and
    // only requires When In Use authorization. Requiring Always here prevents
    // the system-managed alert from being registered for otherwise valid users.
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

async function stopRouteArrivalLocationTrackingIfStarted() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    ROUTE_ARRIVAL_LOCATION_TASK
  );

  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(ROUTE_ARRIVAL_LOCATION_TASK);
  }
}

async function startRouteArrivalLocationTracking(
  language: NativeAppLanguage
) {
  if (Platform.OS !== "android") {
    return;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(
    ROUTE_ARRIVAL_LOCATION_TASK
  );

  if (hasStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(ROUTE_ARRIVAL_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 50,
    timeInterval: 60_000,
    deferredUpdatesDistance: 50,
    deferredUpdatesInterval: 60_000,
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.OtherNavigation,
    foregroundService: {
      notificationTitle:
        language === "en"
          ? "RouteOne arrival alerts are active"
          : "RouteOne 장소 도착 알림 사용 중",
      notificationBody:
        language === "en"
          ? "Checking your location near the next destination."
          : "다음 장소 근처인지 위치를 확인하고 있어요.",
      notificationColor: "#0f766e",
      killServiceOnDestroy: false,
    },
  });
}

async function scheduleRouteArrivalNotification(regionId: string) {
  const todayKey = getTodayDateKey();
  const placeByRegionId = await readStoredRouteArrivalPlaces();
  const place = placeByRegionId.get(regionId);

  if (!place || getRouteArrivalDateKey(place) !== todayKey) {
    return;
  }

  await deliverRouteArrivalNotificationOnce(
    place,
    getRouteArrivalDateKey(place)
  );
}

async function getCurrentRouteArrivalPosition() {
  let currentPosition: Awaited<
    ReturnType<typeof prepareNativeCurrentPosition>
  >;

  try {
    currentPosition = await prepareNativeCurrentPosition({
      requestPermission: false,
      forceRefresh: true,
    });
  } catch (error) {
    throw new RouteArrivalCurrentPositionLookupError(error);
  }

  return {
    coords: {
      latitude: currentPosition.lat,
      longitude: currentPosition.lng,
      accuracy: currentPosition.accuracyMeters,
    },
  } satisfies RouteArrivalPosition;
}

async function getLastKnownRouteArrivalPosition() {
  try {
    const lastKnownPosition = await Location.getLastKnownPositionAsync({
      maxAge: ROUTE_ARRIVAL_LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy:
        ROUTE_ARRIVAL_LAST_KNOWN_REQUIRED_ACCURACY_METERS,
    });

    if (!lastKnownPosition) {
      return null;
    }

    const positionAgeMs = Date.now() - lastKnownPosition.timestamp;
    const accuracyMeters = lastKnownPosition.coords.accuracy;

    if (
      !Number.isFinite(lastKnownPosition.timestamp) ||
      positionAgeMs < 0 ||
      positionAgeMs > ROUTE_ARRIVAL_LAST_KNOWN_MAX_AGE_MS ||
      typeof accuracyMeters !== "number" ||
      !Number.isFinite(accuracyMeters) ||
      accuracyMeters < 0 ||
      accuracyMeters > ROUTE_ARRIVAL_LAST_KNOWN_REQUIRED_ACCURACY_METERS ||
      !Number.isFinite(lastKnownPosition.coords.latitude) ||
      !Number.isFinite(lastKnownPosition.coords.longitude)
    ) {
      return null;
    }

    return {
      coords: {
        latitude: lastKnownPosition.coords.latitude,
        longitude: lastKnownPosition.coords.longitude,
        accuracy: accuracyMeters,
      },
    } satisfies RouteArrivalPosition;
  } catch (error) {
    warnRouteArrivalError("last-known position lookup failed", error);
    return null;
  }
}

async function reconcilePresentedRouteArrivalNotifications(
  places: StoredRouteArrivalPlace[]
) {
  const [history, presentedNotifications, iosStatus] = await Promise.all([
    readDeliveredNotificationHistory(),
    readPresentedRouteArrivalNotifications(),
    Platform.OS === "ios"
      ? getIosRouteArrivalNotificationStatus()
      : Promise.resolve(null),
  ]);
  const deliveredIds = new Set([
    ...history.map((notification) => notification.id),
    ...presentedNotifications.map((notification) => notification.notificationId),
    ...(iosStatus?.deliveredIdentifiers ?? []),
    ...(iosStatus?.handledIdentifiers ?? []),
  ]);

  // A one-shot alert can be consumed while JS is not running and then dismissed.
  // Keep its native no-repeat marker, without inventing an inbox delivery time.
  const handledPlaces = places.filter((place) =>
    deliveredIds.has(
      getRouteArrivalNotificationId(place, getRouteArrivalDateKey(place))
    )
  );
  const notifiedRegionDates = await rememberDeliveredRouteArrivalNotifications(
    handledPlaces.map((place) => ({
      routeId: place.routeId,
      stopId: place.stopId,
      dateKey: getRouteArrivalDateKey(place),
    }))
  );

  // The persisted summary keeps the latest date. An exact handled ID still wins
  // when a route is moved to an earlier date or the device clock moves back.
  for (const place of handledPlaces) {
    notifiedRegionDates[getRouteArrivalRegionId(place)] =
      getRouteArrivalDateKey(place);
  }

  return notifiedRegionDates;
}

function syncIosRouteArrivalPlaces(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number
) {
  return enqueueRouteArrivalOperation(async () => {
    const notifiedRegionDates =
      await reconcilePresentedRouteArrivalNotifications(places);
    const unnotifiedPlaces = places.filter(
      (place) =>
        notifiedRegionDates[getRouteArrivalRegionId(place)] !==
        getRouteArrivalDateKey(place)
    );
    const activeCount = await syncIosRouteArrivalNotifications(
      unnotifiedPlaces.map((place) => ({
        identifier: getRouteArrivalNotificationId(
          place,
          getRouteArrivalDateKey(place)
        ),
        regionIdentifier: getRouteArrivalRegionId(place),
        title: place.notificationTitle,
        body: place.notificationBody,
        routeId: place.routeId,
        routeTitle: place.routeTitle ?? null,
        dayId: place.dayId,
        stopId: place.stopId,
        placeTitle: place.title,
        dateKey: getRouteArrivalDateKey(place),
        latitude: place.lat,
        longitude: place.lng,
      })),
      radiusMeters
    );

    return activeCount + places.length - unnotifiedPlaces.length;
  });
}

async function reconcileRouteArrivalAtPosition(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number,
  currentPosition: RouteArrivalPosition
): Promise<RouteArrivalPositionReconciliation> {
  const todayKey = getTodayDateKey();

  const accuracyMeters = currentPosition.coords.accuracy;

  if (
    typeof accuracyMeters !== "number" ||
    !Number.isFinite(accuracyMeters) ||
    accuracyMeters < 0 ||
    accuracyMeters > radiusMeters ||
    !Number.isFinite(currentPosition.coords.latitude) ||
    !Number.isFinite(currentPosition.coords.longitude)
  ) {
    return "unverified";
  }

  const currentCoordinates = {
    lat: currentPosition.coords.latitude,
    lng: currentPosition.coords.longitude,
  };
  const latestNotifiedRegionDates = await readNotifiedRegionDates();
  const nearestPlace = places
    .filter((place) => getRouteArrivalDateKey(place) === todayKey)
    .map((place) => ({
      distanceMeters: calculateDistanceMeters(currentCoordinates, place),
      place,
    }))
    .filter(({ distanceMeters }) => distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters)[0]
    ?.place;

  if (nearestPlace) {
    if (
      latestNotifiedRegionDates[getRouteArrivalRegionId(nearestPlace)] !==
      todayKey
    ) {
      await deliverRouteArrivalNotificationOnce(nearestPlace, todayKey);
    }
    return "inside";
  }

  return "outside";
}

async function reconcilePresentedRouteArrivalState(
  places: StoredRouteArrivalPlace[]
) {
  await enqueueRouteArrivalOperation(() =>
    reconcilePresentedRouteArrivalNotifications(places)
  );
}

async function reconcileLastKnownRouteArrival(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number
) {
  await reconcilePresentedRouteArrivalState(places);
  const lastKnownPosition = await getLastKnownRouteArrivalPosition();

  return lastKnownPosition
    ? reconcileRouteArrivalAtPosition(
        places,
        radiusMeters,
        lastKnownPosition
      )
    : null;
}

async function reconcileFreshRouteArrival(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number
) {
  // Do not hold the operation queue while a fresh GPS request is pending.
  const currentPosition = await getCurrentRouteArrivalPosition();
  const expectedDateByRegionId = new Map(
    places.map((place) => [
      getRouteArrivalRegionId(place),
      getRouteArrivalDateKey(place),
    ])
  );
  const latestPlaceByRegionId = await readStoredRouteArrivalPlaces();
  const currentPlaces = [...latestPlaceByRegionId.values()].filter(
    (place) =>
      expectedDateByRegionId.get(getRouteArrivalRegionId(place)) ===
      getRouteArrivalDateKey(place)
  );

  if (currentPlaces.length === 0) {
    return "unverified" as const;
  }

  return reconcileRouteArrivalAtPosition(
    currentPlaces,
    radiusMeters,
    currentPosition
  );
}

async function reconcileKnownRouteArrivalPosition(
  places: StoredRouteArrivalPlace[],
  radiusMeters: number,
  currentPosition: RouteArrivalPosition
) {
  await reconcilePresentedRouteArrivalState(places);
  await reconcileRouteArrivalAtPosition(
    places,
    radiusMeters,
    currentPosition
  );
}

async function reconcileStoredRouteArrivalNotificationsInternal() {
  const [
    locationPermission,
    backgroundLocationPermission,
    notificationPermission,
    placeByRegionId,
  ] =
    await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
      Notifications.getPermissionsAsync(),
      readStoredRouteArrivalPlaces(),
    ]);

  if (
    locationPermission.status !== "granted" ||
    (Platform.OS === "ios" &&
      locationPermission.ios?.accuracy === "reduced") ||
    (Platform.OS === "android" &&
      backgroundLocationPermission.status !== "granted") ||
    !notificationPermission.granted ||
    (Platform.OS === "ios" &&
      notificationPermission.ios?.allowsAlert === false) ||
    placeByRegionId.size === 0
  ) {
    await stopRouteArrivalLocationTrackingIfStarted().catch(() => undefined);

    if (Platform.OS === "ios") {
      await syncIosRouteArrivalNotifications(
        [],
        DEFAULT_GEOFENCE_RADIUS_METERS
      ).catch(() => undefined);
    }

    return;
  }

  const places = [...placeByRegionId.values()];

  if (Platform.OS === "ios") {
    await syncIosRouteArrivalPlaces(places, DEFAULT_GEOFENCE_RADIUS_METERS);
    await stopRouteArrivalLocationTrackingIfStarted().catch(() => undefined);
  } else {
    await Location.startGeofencingAsync(
      ROUTE_ARRIVAL_GEOFENCE_TASK,
      places.map((place) => ({
        identifier: getRouteArrivalRegionId(place),
        latitude: place.lat,
        longitude: place.lng,
        notifyOnEnter: true,
        notifyOnExit: false,
        radius: DEFAULT_GEOFENCE_RADIUS_METERS,
      }))
    );

    const hasStartedGeofencing = await Location.hasStartedGeofencingAsync(
      ROUTE_ARRIVAL_GEOFENCE_TASK
    );

    if (!hasStartedGeofencing) {
      throw new Error("Stored route arrival geofence registration failed");
    }

    await startRouteArrivalLocationTracking(places[0]?.language ?? "ko");
  }

  const lastKnownPositionReconciliation =
    await reconcileLastKnownRouteArrival(
    places,
    DEFAULT_GEOFENCE_RADIUS_METERS
  );

  if (lastKnownPositionReconciliation !== "inside") {
    let freshPositionReconciliation: RouteArrivalPositionReconciliation;

    try {
      freshPositionReconciliation = await reconcileFreshRouteArrival(
        places,
        DEFAULT_GEOFENCE_RADIUS_METERS
      );
    } catch (error) {
      if (Platform.OS === "ios") {
        throw error;
      }

      warnRouteArrivalError(
        "stored target fresh position reconcile failed",
        error
      );
      return;
    }

    if (
      Platform.OS === "ios" &&
      freshPositionReconciliation === "unverified"
    ) {
      throw new Error(
        places[0]?.language === "en"
          ? "The device could not verify its current position accurately enough."
          : "현재 위치 정확도가 충분하지 않아요."
      );
    }
  }
}

export function reconcileStoredRouteArrivalNotifications() {
  return enqueueRouteArrivalSync(
    reconcileStoredRouteArrivalNotificationsInternal
  ).catch((error) => {
    warnRouteArrivalError("stored targets reconcile failed", error);
    throw error;
  });
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

  if (options.shouldRecordHistory !== false && Platform.OS === "android") {
    await appendDeliveredRouteArrivalNotification(place, dateKey).catch(
      (error) =>
        warnRouteArrivalError(
          "delivered notification history write failed",
          error
        )
    );
  }
}

function deliverRouteArrivalNotificationOnce(
  place: StoredRouteArrivalPlace,
  dateKey: string
) {
  return enqueueRouteArrivalOperation(async () => {
    const regionId = getRouteArrivalRegionId(place);
    const activePlace = (await readStoredRouteArrivalPlaces()).get(regionId);

    if (!activePlace || getRouteArrivalDateKey(activePlace) !== dateKey) {
      return false;
    }

    // The system may deliver an iOS location alert while the GPS lookup is pending.
    const notifiedRegionDates =
      Platform.OS === "ios"
        ? await reconcilePresentedRouteArrivalNotifications([activePlace])
        : await readNotifiedRegionDates();

    if (notifiedRegionDates[regionId] === dateKey) {
      return false;
    }

    await deliverRouteArrivalNotification(activePlace, dateKey);
    // Persist successful scheduling on iOS too, before a delayed receipt callback.
    notifiedRegionDates[regionId] = dateKey;
    await writeNotifiedRegionDates(notifiedRegionDates);
    return true;
  });
}

if (
  Platform.OS === "android" &&
  !TaskManager.isTaskDefined(ROUTE_ARRIVAL_GEOFENCE_TASK)
) {
  TaskManager.defineTask(
    ROUTE_ARRIVAL_GEOFENCE_TASK,
    async ({ data, error }: RouteArrivalTaskBody) => {
      if (error) {
        warnRouteArrivalError("geofence task failed", error);
        return;
      }

      if (!data) {
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

      await scheduleRouteArrivalNotification(regionId).catch((taskError) =>
        warnRouteArrivalError("geofence arrival delivery failed", taskError)
      );
    }
  );
}

if (!TaskManager.isTaskDefined(ROUTE_ARRIVAL_LOCATION_TASK)) {
  TaskManager.defineTask(
    ROUTE_ARRIVAL_LOCATION_TASK,
    async ({ data, error }: RouteArrivalTaskBody) => {
      if (error) {
        warnRouteArrivalError("background location task failed", error);
        return;
      }

      if (!data) {
        return;
      }

      try {
        const payload = data as RouteArrivalLocationTaskData;
        const currentPosition = payload.locations?.at(-1);
        const placeByRegionId = await readStoredRouteArrivalPlaces();
        const places = [...placeByRegionId.values()];

        if (places.length === 0) {
          await stopRouteArrivalLocationTrackingIfStarted();
          return;
        }

        if (!currentPosition) {
          return;
        }

        await reconcileKnownRouteArrivalPosition(
          places,
          DEFAULT_GEOFENCE_RADIUS_METERS,
          currentPosition
        );
      } catch (taskError) {
        warnRouteArrivalError(
          "background location reconcile failed",
          taskError
        );
      }
    }
  );
}

async function clearNativeRouteArrivalNotificationTargets() {
  // Persist an empty desired set before touching OS registrations. If the
  // process is terminated during the following clear, the next launch sees
  // the tombstone and retries the clear instead of re-arming an old target.
  await enqueueRouteArrivalOperation(() =>
    AsyncStorage.setItem(
      ROUTE_ARRIVAL_PLACES_STORAGE_KEY,
      JSON.stringify([])
    )
  );
  await stopRouteArrivalLocationTrackingIfStarted().catch(() => undefined);

  if (Platform.OS === "ios") {
    await stopRouteArrivalGeofencingIfStarted().catch(() => undefined);
    await enqueueRouteArrivalOperation(() =>
      syncIosRouteArrivalNotifications([], DEFAULT_GEOFENCE_RADIUS_METERS)
    );
  } else {
    await stopRouteArrivalGeofencingIfStarted();
  }
  await enqueueRouteArrivalOperation(() =>
    AsyncStorage.removeItem(ROUTE_ARRIVAL_PLACES_STORAGE_KEY)
  ).catch((error) =>
    warnRouteArrivalError(
      "empty desired target tombstone cleanup failed",
      error
    )
  );
}

export function clearNativeRouteArrivalNotificationsForSession() {
  return enqueueRouteArrivalSync(
    clearNativeRouteArrivalNotificationTargets
  );
}

async function syncNativeRouteArrivalNotifications(
  message: NativeRouteArrivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  try {
    const [storedAuthSession, hasPendingSessionCleanup] =
      await Promise.all([
        readStoredNativeAuthSession(),
        isNativeSessionCleanupPending(),
      ]);

    if (
      hasPendingSessionCleanup ||
      !storedAuthSession.token ||
      storedAuthSession.sessionId !== message.sessionId
    ) {
      throw new Error(
        message.language === "en"
          ? "The login session changed before the arrival alert was registered."
          : "로그인 세션이 변경되어 장소 도착 알림을 등록하지 않았어요."
      );
    }

    const places = getUniqueStoredPlaces(message.places, message.language);

    if (places.length === 0) {
      await clearNativeRouteArrivalNotificationTargets();
      console.log(
        "[route-arrival-notifications] sync complete",
        JSON.stringify({
          activeCount: 0,
          pendingCount: 0,
          registrationStatus: "inactive",
          targets: [],
        })
      );
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

    // Persist the desired target before permission prompts or OS registration.
    // A force-quit during either step can then recover the intended target.
    const radius = clampGeofenceRadiusMeters(message.radiusMeters);
    const shouldRequestPermissions = message.requestPermissions !== false;
    await persistDesiredRouteArrivalPlaces(places, radius, {
      clearExistingMonitors: !shouldRequestPermissions,
    });

    if (!shouldRequestPermissions) {
      console.log(
        "[route-arrival-notifications] targets stored without registration",
        JSON.stringify({
          targets: places.map((place) => ({
            dateKey: getRouteArrivalDateKey(place),
            dayIndex: place.dayIndex,
            stopId: place.stopId,
            title: place.title,
          })),
        })
      );
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

    let activeCount = places.length;
    let pendingCount: number | null = null;
    let registrationStatus:
      | "registered"
      | "delivered"
      | "inactive"
      | "unsupported" = "registered";
    const shouldCheckCurrentPosition =
      message.checkCurrentPosition !== false;
    let lastKnownPositionReconciliation:
      | RouteArrivalPositionReconciliation
      | null = null;

    if (Platform.OS === "ios") {
      await stopRouteArrivalGeofencingIfStarted().catch(() => undefined);
      activeCount = await syncIosRouteArrivalPlaces(places, radius);
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

      const hasStarted = await Location.hasStartedGeofencingAsync(
        ROUTE_ARRIVAL_GEOFENCE_TASK
      );

      if (!hasStarted) {
        throw new Error(
          message.language === "en"
            ? "The device did not register the place arrival alert. Keep the app open and try again."
            : "기기가 장소 도착 알림을 등록하지 못했어요. 앱을 연 상태에서 다시 시도해 주세요."
        );
      }
    }

    if (Platform.OS === "ios") {
      await stopRouteArrivalLocationTrackingIfStarted().catch(() => undefined);
    } else {
      await startRouteArrivalLocationTracking(message.language);
    }

    if (Platform.OS === "ios") {
      const registrationSummary = await getIosRegistrationSummary(places);
      pendingCount = registrationSummary.pendingCount;
      registrationStatus = registrationSummary.registrationStatus;
    }

    if (shouldCheckCurrentPosition) {
      try {
        lastKnownPositionReconciliation =
          await reconcileLastKnownRouteArrival(places, radius);

        // A location trigger only reacts to an entry transition. When the
        // request is registered while the user is already inside the region,
        // try a fresh position so the alert can be delivered immediately.
        // This is an optimization after OS registration, so a temporary GPS
        // failure must not turn a valid registration into a sync failure.
        if (lastKnownPositionReconciliation !== "inside") {
          const freshPositionReconciliation =
            await reconcileFreshRouteArrival(places, radius);

          if (freshPositionReconciliation === "unverified") {
            warnRouteArrivalError(
              "current position reconciliation deferred",
              new Error(
                message.language === "en"
                  ? "The device could not verify its current position accurately enough."
                  : "현재 위치 정확도가 충분하지 않아요."
              )
            );
          }
        }
      } catch (error) {
        if (!(error instanceof RouteArrivalCurrentPositionLookupError)) {
          throw error;
        }

        warnRouteArrivalError(
          "current position reconciliation deferred",
          error.originalError
        );
      }
    }

    console.log(
      "[route-arrival-notifications] sync complete",
      JSON.stringify({
        activeCount,
        pendingCount,
        registrationStatus,
        targets: places.map((place) => ({
          dateKey: getRouteArrivalDateKey(place),
          dayIndex: place.dayIndex,
          stopId: place.stopId,
          title: place.title,
        })),
      })
    );

    postNativeRouteArrivalNotificationSyncResponse(webViewRef, message.id, {
      ok: true,
      activeCount,
      pendingCount,
      registrationStatus,
      ...permissionStatus,
    });
  } catch (error) {
    warnRouteArrivalError("sync failed", error);
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
  console.log(
    "[route-arrival-notifications] sync request queued",
    JSON.stringify({
      placeCount: message.places.length,
      targets: message.places.map((place) => ({
        dateKey: getRouteArrivalDateKey(place),
        dayIndex: place.dayIndex,
        stopId: place.stopId,
      })),
    })
  );

  return enqueueRouteArrivalSync(() =>
    syncNativeRouteArrivalNotifications(message, webViewRef)
  );
}

export async function handleNativeRouteArrivalTestLocationRequest(
  message: NativeRouteArrivalTestLocationRequest,
  webViewRef: WebViewRef,
  locationTestModeEnabled = false
) {
  try {
    if (
      !ROUTE_ARRIVAL_NOTIFICATION_TEST_MODE &&
      !locationTestModeEnabled
    ) {
      throw new Error(
        message.language === "en"
          ? "Arrival location testing is disabled in this build."
          : "이 빌드에서는 도착 위치 테스트를 사용할 수 없어요."
      );
    }

    if (!message.place) {
      const testPosition = message.position ?? null;

      setNativeRouteArrivalTestPosition(testPosition);
      resetNativeRouteArrivalTestState();
      postNativeRouteArrivalTestLocationResponse(webViewRef, message.id, {
        ok: true,
        active: testPosition !== null,
        stopId: null,
        lat: testPosition?.lat ?? null,
        lng: testPosition?.lng ?? null,
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
    const didEnterArrivalRadius =
      withinRadius &&
      (routeArrivalTestState?.stopId !== place.stopId ||
        routeArrivalTestState.withinRadius === false);
    const backgroundNotificationStatus =
      await getBackgroundNotificationStatus(place);

    if (didEnterArrivalRadius) {
      await ensureRouteArrivalNotificationPermission(message.language);
      await deliverRouteArrivalNotification(place, getTodayDateKey(), {
        notificationId: `arrival-test:${place.routeId}:${place.stopId}:${Date.now()}`,
        notificationType: "route-arrival-test",
        shouldRecordHistory: false,
      });
    }

    routeArrivalTestState = {
      stopId: place.stopId,
      withinRadius,
    };
    setNativeRouteArrivalTestPosition(testPosition);
    postNativeRouteArrivalTestLocationResponse(webViewRef, message.id, {
      ok: true,
      active: true,
      stopId: place.stopId,
      lat: testPosition.lat,
      lng: testPosition.lng,
      distanceMeters,
      withinRadius,
      notificationScheduled: didEnterArrivalRadius,
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

async function syncNativeDeliveredNotificationHistory(
  message: NativeDeliveredNotificationHistoryRequest,
  webViewRef: WebViewRef
) {
  try {
    const acknowledgedIds = new Set(message.acknowledgedIds ?? []);
    const history = await readDeliveredNotificationHistory();
    const presentedNotifications =
      await readPresentedRouteArrivalNotifications();
    const deliveredNotifications = mergeDeliveredNotificationHistory(
      history,
      presentedNotifications.flatMap((notification) =>
        notification.notification ? [notification.notification] : []
      )
    );

    // Notification Center is a visible list, not a durable delivery ledger.
    // Save deduplication state before acknowledging and dismissing its entries.
    await rememberDeliveredRouteArrivalNotifications(deliveredNotifications);

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
    const notifications = deliveredNotifications.filter(
      (notification) => !acknowledgedIds.has(notification.id)
    );

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

export function handleNativeDeliveredNotificationHistoryRequest(
  message: NativeDeliveredNotificationHistoryRequest,
  webViewRef: WebViewRef
) {
  return enqueueRouteArrivalOperation(() =>
    syncNativeDeliveredNotificationHistory(message, webViewRef)
  );
}
