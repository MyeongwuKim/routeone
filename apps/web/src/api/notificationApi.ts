
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

/**
 * 알림함·설정 조회와 변경, 푸시 기기 등록, 네이티브 예약 알림의 서버 동기화 요청을 제공한다.
 * unregisterPushDevice의 authToken은 로그아웃 정리가 끝날 때까지 같은 인증 세션을 사용하도록 명시할 수 있다.
 */
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
  unregisterPushDevice(expoPushToken: string, authToken?: string | null) {
    return requestGraphQL(
      UnregisterPushDeviceDocument,
      {
        expoPushToken,
      },
      { authToken }
    );
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
