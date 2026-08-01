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

    const refreshNotificationInbox = () => {
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATION_INBOX_QUERY_KEY,
      });
    };
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

          refreshNotificationInbox();
        }
      );
    const unsubscribeAppActive =
      nativeBridge.events.subscribeAppActive(refreshNotificationInbox);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotificationInbox();
      }
    };

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      unsubscribeNotificationReceived();
      unsubscribeAppActive();
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
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

    const syncDeliveredNotifications = () => {
      if (syncPromise) {
        return syncPromise;
      }

      syncPromise = (async () => {
        const notifications =
          await nativeBridge.notifications.getDelivered();

        if (!isActive || !notifications?.length) {
          return;
        }

        const result = await notificationApi.syncRouteArrivalInbox(
          notifications.map((notification) => ({
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

        if (isActive) {
          await queryClient.invalidateQueries({
            queryKey: NOTIFICATION_INBOX_QUERY_KEY,
          });
        }
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
    const unsubscribeAppActive =
      nativeBridge.events.subscribeAppActive(syncDeliveredNotifications);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;
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
