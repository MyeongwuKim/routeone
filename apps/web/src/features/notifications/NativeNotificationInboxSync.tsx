/**
 * 용도:
 * 네이티브에서 수신한 알림과 서버 알림함의 미확인 개수를 맞춘다.
 *
 * 동작 방식:
 * 수신 즉시 배지를 먼저 반영하고, 네이티브 도착 기록을 서버에 저장한 뒤
 * 알림함을 다시 조회해 탭 이동 중 배지가 이전 값으로 되돌아가지 않게 한다.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_INBOX_QUERY_KEY,
  NOTIFICATION_SETTINGS_QUERY_KEY,
} from "@/api/notificationApi";
import type { NotificationInboxQuery } from "@/generated/graphql";
import { getAuthToken } from "@/lib/authToken";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";

function NativeNotificationInboxSync() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const optimisticallyCountedNotificationIdsRef = useRef(
    new Set<string>()
  );

  useEffect(() => {
    if (!getAuthToken() || !nativeBridge.runtime.isAvailable()) {
      return;
    }

    const unsubscribeNotificationReceived =
      nativeBridge.events.subscribeNotificationReceived(
        ({ notificationId }) => {
          if (
            notificationId &&
            !optimisticallyCountedNotificationIdsRef.current.has(
              notificationId
            )
          ) {
            optimisticallyCountedNotificationIdsRef.current.add(
              notificationId
            );
            queryClient.setQueryData<NotificationInboxQuery>(
              NOTIFICATION_INBOX_QUERY_KEY,
              (currentData) => {
                if (
                  !currentData ||
                  currentData.notificationInbox.items.some(
                    (notification) =>
                      notification.notificationKey === notificationId
                  )
                ) {
                  return currentData;
                }

                return {
                  ...currentData,
                  unreadNotificationCount:
                    currentData.unreadNotificationCount + 1,
                };
              }
            );
          }
        }
      );

    return () => {
      unsubscribeNotificationReceived();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!getAuthToken() || !nativeBridge.runtime.isAvailable()) {
      return;
    }

    let isActive = true;

    void Promise.allSettled([
      nativeBridge.notifications.syncFestivals([]),
      nativeBridge.notifications.syncRouteReviews([]),
    ]);

    const syncPushDevice = () => {
      void nativeBridge.notifications
        .getPushToken(false)
        ?.then(async (pushToken) => {
          if (
            !isActive ||
            !pushToken.expoPushToken ||
            (pushToken.platform !== "ios" &&
              pushToken.platform !== "android")
          ) {
            return;
          }

          await notificationApi.registerPushDevice({
            expoPushToken: pushToken.expoPushToken,
            platform:
              pushToken.platform === "ios" ? "IOS" : "ANDROID",
            appVariant: pushToken.appVariant,
            locale: appLanguage,
          });

          if (isActive) {
            await queryClient.invalidateQueries({
              queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
            });
          }
        })
        .catch((error) => {
          console.warn(
            "[push-device] token registration failed",
            error instanceof Error ? error.message : error
          );
        });
    };

    syncPushDevice();
    const unsubscribeAppActive =
      nativeBridge.events.subscribeAppActive(syncPushDevice);

    return () => {
      isActive = false;
      unsubscribeAppActive();
    };
  }, [appLanguage, location.pathname, queryClient]);

  useEffect(() => {
    if (!getAuthToken() || !nativeBridge.runtime.isAvailable()) {
      return;
    }

    let isActive = true;
    let syncPromise: Promise<void> | null = null;
    let shouldSyncAgain = false;

    const syncDeliveredNotifications = () => {
      if (syncPromise) {
        shouldSyncAgain = true;
        return syncPromise;
      }

      syncPromise = (async () => {
        do {
          shouldSyncAgain = false;
          const notifications =
            await nativeBridge.notifications.getDelivered();

          if (!isActive) {
            return;
          }

          if (notifications?.length) {
            const result = await notificationApi.syncRouteArrivalInbox(
              notifications.map((notification) => ({
                notificationKey: notification.id,
                routeId: notification.routeId,
                routeTitle: notification.routeTitle ?? null,
                dayId: notification.dayId,
                stopId: notification.stopId,
                placeTitle: notification.placeTitle,
                dateKey: notification.dateKey,
                deliveredAt: notification.deliveredAt,
              }))
            );
            const syncedNotificationKeys = new Set(
              result.syncRouteArrivalNotificationInbox.notificationKeys
            );
            await nativeBridge.notifications.getDelivered(
              notifications
                .filter((notification) =>
                  syncedNotificationKeys.has(notification.id)
                )
                .map((notification) => notification.id)
            );
          }

          if (isActive) {
            await queryClient.invalidateQueries({
              queryKey: NOTIFICATION_INBOX_QUERY_KEY,
            });
          }
        } while (isActive && shouldSyncAgain);
      })()
        .catch((error) => {
          console.warn(
            "[notification-inbox] native history sync failed",
            error instanceof Error ? error.message : error
          );
        })
        .finally(() => {
          syncPromise = null;
        });

      return syncPromise;
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncDeliveredNotifications();
      }
    };

    void syncDeliveredNotifications();
    const unsubscribeNotificationReceived =
      nativeBridge.events.subscribeNotificationReceived(() => {
        void syncDeliveredNotifications();
      });
    const unsubscribeAppActive =
      nativeBridge.events.subscribeAppActive(syncDeliveredNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
      unsubscribeNotificationReceived();
      unsubscribeAppActive();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [location.pathname, queryClient]);

  return null;
}

export default NativeNotificationInboxSync;
