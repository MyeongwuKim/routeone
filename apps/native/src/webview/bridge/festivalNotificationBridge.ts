import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { postNativeFestivalNotificationSyncResponse } from "./responses";
import type {
  NativeFestivalNotification,
  NativeFestivalNotificationSyncRequest,
  WebViewRef,
} from "./types";

type StoredFestivalNotification = {
  notificationIdentifier: string;
  signature: string;
};

const FESTIVAL_NOTIFICATION_CHANNEL_ID = "festival-updates";
const FESTIVAL_SCHEDULE_STORAGE_KEY =
  "routeone:native-festival-notification-schedule:v1";
const FESTIVAL_NOTIFIED_STORAGE_KEY =
  "routeone:native-festival-notification-notified:v1";
const MAX_FESTIVAL_NOTIFICATION_COUNT = 48;
const NOTIFIED_HISTORY_TTL_MS = 1000 * 60 * 60 * 24 * 120;
const FESTIVAL_NOTIFICATION_KIND_PRIORITY = {
  trip: 4,
  today: 3,
  weekly: 2,
  monthly: 1,
} as const;
let festivalNotificationSyncQueue = Promise.resolve();

async function ensureFestivalNotificationChannel() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(
    FESTIVAL_NOTIFICATION_CHANNEL_ID,
    {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: "축제 소식",
      vibrationPattern: [0, 200, 150, 200],
    }
  );
}

async function readStoredSchedule() {
  const rawValue = await AsyncStorage.getItem(FESTIVAL_SCHEDULE_STORAGE_KEY);

  if (!rawValue) {
    return {};
  }

  try {
    return JSON.parse(rawValue) as Record<string, StoredFestivalNotification>;
  } catch {
    return {};
  }
}

async function readNotifiedHistory() {
  const rawValue = await AsyncStorage.getItem(FESTIVAL_NOTIFIED_STORAGE_KEY);

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
  notifications: NativeFestivalNotification[]
) {
  const notificationById = new Map<string, NativeFestivalNotification>();

  for (const notification of notifications) {
    if (
      !notification.id.trim() ||
      !notification.regionCode.trim() ||
      !notification.regionLabel.trim() ||
      notification.festivalTitles.length === 0
    ) {
      continue;
    }

    if (notification.triggerAt) {
      const triggerTimestamp = Date.parse(notification.triggerAt);

      if (!Number.isFinite(triggerTimestamp) || triggerTimestamp <= Date.now()) {
        continue;
      }
    }

    notificationById.set(notification.id, {
      ...notification,
      festivalIds: [...new Set(notification.festivalIds)],
      festivalTitles: [...new Set(notification.festivalTitles)],
    });
  }

  const notificationByDeliveryDate = new Map<
    string,
    NativeFestivalNotification
  >();

  notificationById.forEach((notification) => {
    const deliveryDate = notification.triggerAt
      ? new Date(notification.triggerAt)
      : new Date();
    const deliveryDateKey = [
      deliveryDate.getFullYear(),
      `${deliveryDate.getMonth() + 1}`.padStart(2, "0"),
      `${deliveryDate.getDate()}`.padStart(2, "0"),
    ].join("-");
    const currentNotification =
      notificationByDeliveryDate.get(deliveryDateKey);

    if (
      !currentNotification ||
      FESTIVAL_NOTIFICATION_KIND_PRIORITY[notification.kind] >
        FESTIVAL_NOTIFICATION_KIND_PRIORITY[currentNotification.kind]
    ) {
      notificationByDeliveryDate.set(deliveryDateKey, notification);
    }
  });

  return [...notificationByDeliveryDate.values()]
    .sort((a, b) => {
      const triggerA = a.triggerAt ? Date.parse(a.triggerAt) : 0;
      const triggerB = b.triggerAt ? Date.parse(b.triggerAt) : 0;
      return triggerA - triggerB;
    })
    .slice(0, MAX_FESTIVAL_NOTIFICATION_COUNT);
}

function createFestivalNotificationSignature(
  notification: NativeFestivalNotification
) {
  return JSON.stringify({
    kind: notification.kind,
    regionCode: notification.regionCode,
    regionLabel: notification.regionLabel,
    dateKey: notification.dateKey,
    festivalIds: notification.festivalIds,
    festivalTitles: notification.festivalTitles,
    triggerAt: notification.triggerAt ?? null,
  });
}

function createFestivalNotificationContent(
  notification: NativeFestivalNotification
) {
  const festivalCount = notification.festivalTitles.length;
  const visibleTitles = notification.festivalTitles.slice(0, 2).join(", ");
  const remainingCount = Math.max(0, festivalCount - 2);
  const body = remainingCount
    ? `${visibleTitles} 외 ${remainingCount}개`
    : visibleTitles;
  const titleByKind = {
    today: `오늘 ${notification.regionLabel} 축제 ${festivalCount}개`,
    weekly: `이번 주 ${notification.regionLabel} 축제 ${festivalCount}개`,
    monthly: `이번 달 ${notification.regionLabel} 축제 ${festivalCount}개`,
    trip: `${notification.regionLabel} 여행일 축제 ${festivalCount}개`,
  } as const;

  return {
    title: titleByKind[notification.kind],
    body,
    data: {
      type: "festival-summary",
      kind: notification.kind,
      regionCode: notification.regionCode,
      dateKey: notification.dateKey,
    },
  };
}

async function cancelStoredNotification(
  notification: StoredFestivalNotification | undefined
) {
  if (!notification?.notificationIdentifier) {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(
    notification.notificationIdentifier
  ).catch(() => undefined);
}

async function syncFestivalNotifications(
  message: NativeFestivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  try {
    await ensureFestivalNotificationChannel();

    const notifications = getUniqueNotifications(message.notifications);
    const notificationById = new Map(
      notifications.map((notification) => [notification.id, notification])
    );
    const storedSchedule = await readStoredSchedule();
    const nextStoredSchedule = { ...storedSchedule };

    for (const [id, storedNotification] of Object.entries(storedSchedule)) {
      const nextNotification = notificationById.get(id);
      const nextSignature = nextNotification
        ? createFestivalNotificationSignature(nextNotification)
        : null;

      if (!nextSignature || nextSignature !== storedNotification.signature) {
        await cancelStoredNotification(storedNotification);
        delete nextStoredSchedule[id];
      }
    }

    const notificationPermission = await Notifications.getPermissionsAsync();

    if (!notificationPermission.granted) {
      await AsyncStorage.setItem(
        FESTIVAL_SCHEDULE_STORAGE_KEY,
        JSON.stringify(nextStoredSchedule)
      );
      postNativeFestivalNotificationSyncResponse(webViewRef, message.id, {
        ok: true,
        scheduledCount: Object.keys(nextStoredSchedule).length,
        notificationStatus: notificationPermission.status,
      });
      return;
    }

    const notifiedHistory = await readNotifiedHistory();

    for (const notification of notifications) {
      const signature = createFestivalNotificationSignature(notification);

      if (!notification.triggerAt) {
        if (notifiedHistory[notification.id]) {
          continue;
        }

        await Notifications.scheduleNotificationAsync({
          content: createFestivalNotificationContent(notification),
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
          content: createFestivalNotificationContent(notification),
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(notification.triggerAt),
            ...(Platform.OS === "android"
              ? { channelId: FESTIVAL_NOTIFICATION_CHANNEL_ID }
              : {}),
          },
        });

      nextStoredSchedule[notification.id] = {
        notificationIdentifier,
        signature,
      };
    }

    await Promise.all([
      AsyncStorage.setItem(
        FESTIVAL_SCHEDULE_STORAGE_KEY,
        JSON.stringify(nextStoredSchedule)
      ),
      AsyncStorage.setItem(
        FESTIVAL_NOTIFIED_STORAGE_KEY,
        JSON.stringify(notifiedHistory)
      ),
    ]);

    postNativeFestivalNotificationSyncResponse(webViewRef, message.id, {
      ok: true,
      scheduledCount: Object.keys(nextStoredSchedule).length,
      notificationStatus: notificationPermission.status,
    });
  } catch (error) {
    postNativeFestivalNotificationSyncResponse(webViewRef, message.id, {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Festival notification sync failed",
    });
  }
}

export function handleNativeFestivalNotificationSyncRequest(
  message: NativeFestivalNotificationSyncRequest,
  webViewRef: WebViewRef
) {
  const nextSync = festivalNotificationSyncQueue.then(() =>
    syncFestivalNotifications(message, webViewRef)
  );

  festivalNotificationSyncQueue = nextSync.catch(() => undefined);
  return nextSync;
}
