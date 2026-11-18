import type { PrismaClient } from "@prisma/client";
import { getUserNotificationCutoffAt } from "./notificationCleanup.service.js";

/** 알림함에 표시할 수 있는 최근 미확인 알림 수를 조회하며, 읽음 필드가 없는 이전 기록도 포함한다. */
export function countUnreadNotifications(
  prisma: Pick<PrismaClient, "userNotification">,
  userId: string,
  now = new Date()
) {
  return prisma.userNotification.count({
    where: {
      userId,
      OR: [
        { readAt: null },
        { readAt: { isSet: false } },
      ],
      availableAt: {
        gte: getUserNotificationCutoffAt(now),
        lte: now,
      },
    },
  });
}
