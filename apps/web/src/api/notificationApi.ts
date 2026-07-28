import {
  MarkNotificationInboxReadDocument,
  NotificationInboxDocument,
  NotificationSettingsDocument,
  RegisterPushDeviceDocument,
  SendFestivalTestNotificationDocument,
  SendRouteReviewTestNotificationDocument,
  SyncFestivalNotificationInboxDocument,
  SyncRouteArrivalNotificationInboxDocument,
  SyncRouteReviewNotificationInboxDocument,
  UpdateNotificationSettingsDocument,
  UnregisterPushDeviceDocument,
  type FestivalNotificationSyncInput,
  type NotificationInboxQueryVariables,
  type RegisterPushDeviceInput,
  type RouteArrivalNotificationSyncInput,
  type RouteReviewNotificationSyncInput,
  type UpdateNotificationSettingsInput,
} from "@/generated/graphql";
import { requestGraphQL } from "@/lib/graphqlClient";

export type NotificationInboxPageParam = string | null;

export const NOTIFICATION_INBOX_PAGE_SIZE = 20;
export const NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY = [
  "notification-inbox",
] as const;
export const NOTIFICATION_INBOX_INFINITE_QUERY_KEY = [
  ...NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  "infinite",
] as const;
export const NOTIFICATION_INBOX_QUERY_KEY =
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY;
export const NOTIFICATION_SETTINGS_QUERY_KEY = [
  "notification-settings",
] as const;

export const notificationApi = {
  inbox(variables: NotificationInboxQueryVariables) {
    return requestGraphQL(NotificationInboxDocument, variables);
  },
  settings() {
    return requestGraphQL(NotificationSettingsDocument);
  },
  updateSettings(input: UpdateNotificationSettingsInput) {
    return requestGraphQL(UpdateNotificationSettingsDocument, {
      input,
    });
  },
  registerPushDevice(input: RegisterPushDeviceInput) {
    return requestGraphQL(RegisterPushDeviceDocument, {
      input,
    });
  },
  unregisterPushDevice(expoPushToken: string) {
    return requestGraphQL(UnregisterPushDeviceDocument, {
      expoPushToken,
    });
  },
  syncFestivalInbox(notifications: FestivalNotificationSyncInput[]) {
    return requestGraphQL(SyncFestivalNotificationInboxDocument, {
      notifications,
    });
  },
  syncRouteArrivalInbox(notifications: RouteArrivalNotificationSyncInput[]) {
    return requestGraphQL(SyncRouteArrivalNotificationInboxDocument, {
      notifications,
    });
  },
  syncRouteReviewInbox(notifications: RouteReviewNotificationSyncInput[]) {
    return requestGraphQL(SyncRouteReviewNotificationInboxDocument, {
      notifications,
    });
  },
  markRead(ids?: string[]) {
    return requestGraphQL(MarkNotificationInboxReadDocument, {
      ids,
    });
  },
  sendFestivalTest() {
    return requestGraphQL(SendFestivalTestNotificationDocument);
  },
  sendRouteReviewTest(pushDeviceId: string) {
    return requestGraphQL(SendRouteReviewTestNotificationDocument, {
      pushDeviceId,
    });
  },
};
