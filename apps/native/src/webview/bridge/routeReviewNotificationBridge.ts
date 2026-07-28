import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { postNativeRouteReviewNotificationSyncResponse } from "./responses";
import type {
  NativeRouteReviewNotification,
  NativeRouteReviewNotificationSyncRequest,
  WebViewRef,
} from "./types";

type StoredRouteReviewNotification = {
  notificationIdentifier: string;
  signature: string;
  triggerAt?: string | null;
};

const ROUTE_REVIEW_NOTIFICATION_CHANNEL_ID = "route-review";
const ROUTE_REVIEW_SCHEDULE_STORAGE_KEY =
  "routeone:native-route-review-notification-schedule:v1";
const ROUTE_REVIEW_NOTIFIED_STORAGE_KEY =
  "routeone:native-route-review-notification-notified:v1";
const MAX_ROUTE_REVIEW_NOTIFICATION_COUNT = 48;
const NOTIFIED_HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 180;
let routeReviewNotificationSyncQueue = Promise.resolve();

async function ensureRouteReviewNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    ROUTE_REVIEW_NOTIFICATION_CHANNEL_ID,
    {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "루트 기록 안내",
      vibrationPattern: [0, 200, 150, 200],
    }
  );
}

async function readStoredSchedule() {
  const rawValue = await AsyncStorage.getItem(
    ROUTE_REVIEW_SCHEDULE_STORAGE_KEY
  );

  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(
      rawValue
    ) as Record<string, StoredRouteReviewNotification>;
  } catch {
    return {};
  }
}

async function readNotifiedHistory() {
  const rawValue = await AsyncStorage.getItem(
    ROUTE_REVIEW_NOTIFIED_STORAGE_KEY
  );

  if (!rawValue) {
    return {};
  }

  try {
    const history = JSON.parse(rawValue) as Record<string, number>;
    const oldestAllowedTimestamp = Date.now() - NOTIFIED_HISTORY_TTL_MS;

    return Object.fromEntries(
      Object.entries(history).filter(
        ([, timestamp]) =>
          Number.isFinite(timestamp) && timestamp >= oldestAllowedTimestamp
      )
    );
  } catch {
    return {};
  }
}

function getUniqueNotifications(
  notifications: NativeRouteReviewNotification[]
) {
  const notificationById = new Map<string, NativeRouteReviewNotification>();

  for (const notification of notifications) {
    if (
      !notification.id.trim() ||
      !notification.routeId.trim() ||
      !notification.routeTitle.trim() ||
      !notification.dayId.trim() ||
      !Number.isFinite(Date.parse(notification.correctionDeadlineAt))
    ) {
      continue;
    }

    if (notification.triggerAt) {
      const triggerTimestamp = Date.parse(notification.triggerAt);

      if (!Number.isFinite(triggerTimestamp) || triggerTimestamp <= Date.now()) {
        continue;
      }
    }

    notificationById.set(notification.id, notification);
  }

  return [...notificationById.values()]
    .sort((left, right) => {
      const leftTimestamp = left.triggerAt ? Date.parse(left.triggerAt) : 0;
      const rightTimestamp = right.triggerAt ? Date.parse(right.triggerAt) : 0;

      return leftTimestamp - rightTimestamp;
    })
    .slice(0, MAX_ROUTE_REVIEW_NOTIFICATION_COUNT);
}

function createNotificationSignature(
  notification: NativeRouteReviewNotification
) {
  return JSON.stringify(notification);
}

function getStoredTriggerTimestamp(
  notification: StoredRouteReviewNotification
) {
  const directTimestamp = notification.triggerAt
    ? Date.parse(notification.triggerAt)
    : Number.NaN;

  if (Number.isFinite(directTimestamp)) {
    return directTimestamp;
  }

  try {
    const storedNotification = JSON.parse(notification.signature) as {
      triggerAt?: unknown;
    };

    return typeof storedNotification.triggerAt === "string"
      ? Date.parse(storedNotification.triggerAt)
      : Number.NaN;
  } catch {
    return Number.NaN;
  }
}

function createNotificationContent(
  notification: NativeRouteReviewNotification
) {
  const title =
    notification.kind === "completed"
      ? `${notification.routeTitle} 여행을 마쳤어요`
      : notification.kind === "unstarted"
        ? `${notification.routeTitle} 일정이 끝났어요`
        : `${notification.routeTitle} 기록을 마무리해 보세요`;
  const body =
    notification.kind === "unstarted"
      ? "다녀오셨다면 7일 안에 여행 기록을 남겨보세요."
      : notification.kind === "incomplete"
        ? "아직 완료하지 않은 장소가 있어요. 7일 안에 기록을 마무리해 보세요."
        : "종료 후 7일 동안 방문 기록을 보정할 수 있어요.";

  return {
    title,
    body,
    data: {
      type: "route-review",
      notificationId: notification.id,
      routeId: notification.routeId,
      dayId: notification.dayId,
    },
  };
}

async function cancelStoredNotification(
  notification: StoredRouteReviewNotification | undefined
) {
  if (!notification?.notificationIdentifier) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(
    notification.notificationIdentifier
  ).catch(() => undefined);
}

async function syncRouteReviewNotifications(
  message: NativeRouteReviewNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  try {
    await ensureRouteReviewNotificationChannel();

    const notifications = getUniqueNotifications(message.notifications);
    const notificationById = new Map(
      notifications.map((notification) => [notification.id, notification])
    );
    const storedSchedule = await readStoredSchedule();
    const nextStoredSchedule = { ...storedSchedule };
    const notifiedHistory = await readNotifiedHistory();

    for (const [id, storedNotification] of Object.entries(storedSchedule)) {
      const nextNotification = notificationById.get(id);
      const nextSignature = nextNotification
        ? createNotificationSignature(nextNotification)
        : null;

      if (!nextSignature || nextSignature !== storedNotification.signature) {
        const storedTriggerTimestamp =
          getStoredTriggerTimestamp(storedNotification);

        if (
          nextNotification?.triggerAt == null &&
          Number.isFinite(storedTriggerTimestamp) &&
          storedTriggerTimestamp <= Date.now()
        ) {
          notifiedHistory[id] = Date.now();
        }

        await cancelStoredNotification(storedNotification);
        delete nextStoredSchedule[id];
      }
    }

    const notificationPermission = await Notifications.getPermissionsAsync();

    if (!notificationPermission.granted) {
      await Promise.all([
        AsyncStorage.setItem(
          ROUTE_REVIEW_SCHEDULE_STORAGE_KEY,
          JSON.stringify(nextStoredSchedule)
        ),
        AsyncStorage.setItem(
          ROUTE_REVIEW_NOTIFIED_STORAGE_KEY,
          JSON.stringify(notifiedHistory)
        ),
      ]);
      postNativeRouteReviewNotificationSyncResponse(webViewRef, message.id, {
        ok: true,
        scheduledCount: Object.keys(nextStoredSchedule).length,
        notificationStatus: notificationPermission.status,
      });
      return;
    }

    for (const notification of notifications) {
      const signature = createNotificationSignature(notification);

      if (!notification.triggerAt) {
        if (notifiedHistory[notification.id]) {
          continue;
        }

        await Notifications.scheduleNotificationAsync({
          content: createNotificationContent(notification),
          trigger: null,
        });
        notifiedHistory[notification.id] = Date.now();
        continue;
      }

      if (nextStoredSchedule[notification.id]?.signature === signature) {
        continue;
      }

      const notificationIdentifier =
        await Notifications.scheduleNotificationAsync({
          content: createNotificationContent(notification),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(notification.triggerAt),
            ...(Platform.OS === "android"
              ? { channelId: ROUTE_REVIEW_NOTIFICATION_CHANNEL_ID }
              : {}),
          },
        });

      nextStoredSchedule[notification.id] = {
        notificationIdentifier,
        signature,
        triggerAt: notification.triggerAt,
      };
    }

    await Promise.all([
      AsyncStorage.setItem(
        ROUTE_REVIEW_SCHEDULE_STORAGE_KEY,
        JSON.stringify(nextStoredSchedule)
      ),
      AsyncStorage.setItem(
        ROUTE_REVIEW_NOTIFIED_STORAGE_KEY,
        JSON.stringify(notifiedHistory)
      ),
    ]);

    postNativeRouteReviewNotificationSyncResponse(webViewRef, message.id, {
      ok: true,
      scheduledCount: Object.keys(nextStoredSchedule).length,
      notificationStatus: notificationPermission.status,
    });
  } catch (error) {
    postNativeRouteReviewNotificationSyncResponse(webViewRef, message.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Route review notification sync failed",
    });
  }
}

export function handleNativeRouteReviewNotificationSyncRequest(
  message: NativeRouteReviewNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  const nextSync = routeReviewNotificationSyncQueue.then(() =>
    syncRouteReviewNotifications(message, webViewRef)
  );

  routeReviewNotificationSyncQueue = nextSync.catch(() => undefined);
  return nextSync;
}
