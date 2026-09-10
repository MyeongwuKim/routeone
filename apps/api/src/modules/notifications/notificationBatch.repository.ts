/**
 * 용도:
 * 알림 동기화의 개별 upsert를 묶어 저장한다.
 *
 * 동작 방식:
 * 새 알림에는 스키마 기본값을 채우고, 기존 알림은 전달된 표시 정보만 바꾼다.
 * 읽음 여부와 푸시 전송 기록은 재동기화해도 유지한다.
 */
import type { Prisma } from "@prisma/client";
import { mongoId, mongoUpsert, runMongoUpdates } from "../../lib/mongoBatch.js";

const NOTIFICATION_DEFAULTS = {
  festivalIds: [], festivalTitles: [], festivalStartDates: [], festivalEndDates: [],
  pushTicketIds: [], pushAttemptCount: 0,
  festivalKind: null, regionCode: null, regionLabel: null, dateKey: null,
  routeReviewKind: null, routeId: null, routeTitle: null, dayId: null,
  routeDayIndex: null, routeStartAt: null, stopId: null, placeTitle: null,
  correctionDeadlineAt: null, readAt: null, pushStatus: null, pushClaimedAt: null,
  pushSentAt: null, pushError: null, nextPushAttemptAt: null, expiresAt: null,
} satisfies Partial<Prisma.UserNotificationUncheckedCreateInput>;

export async function upsertNotificationsBatch(
  transaction: Prisma.TransactionClient,
  notifications: {
    create: Prisma.UserNotificationUncheckedCreateInput;
    update: Record<string, unknown>;
  }[]
) {
  await runMongoUpdates(transaction, "UserNotification", notifications.map(({ create, update }) =>
    mongoUpsert({ userId: mongoId(create.userId), notificationKey: create.notificationKey },
      { ...NOTIFICATION_DEFAULTS, ...create }, update, ["userId", "routeId", "dayId", "stopId"])
  ));
}
