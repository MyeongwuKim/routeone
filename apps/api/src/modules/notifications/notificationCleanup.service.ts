import type { PrismaClient } from "@prisma/client";

export const DEFAULT_USER_NOTIFICATION_RETENTION_DAYS = 180;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type NotificationCleanupOptions = {
  now?: Date;
  retentionDays?: number;
};

export type NotificationCleanupResult = {
  cutoffAt: Date;
  deletedCount: number;
  retentionDays: number;
};

function validateRetentionDays(retentionDays: number) {
  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) {
    throw new Error("Notification retention days must be a positive integer.");
  }
}

export function getUserNotificationCutoffAt(
  now: Date = new Date(),
  retentionDays = DEFAULT_USER_NOTIFICATION_RETENTION_DAYS
) {
  if (Number.isNaN(now.getTime())) {
    throw new Error("Notification cleanup time is invalid.");
  }

  validateRetentionDays(retentionDays);

  return new Date(
    now.getTime() - retentionDays * MILLISECONDS_PER_DAY
  );
}

export async function cleanupUserNotifications(
  prisma: Pick<PrismaClient, "userNotification">,
  options: NotificationCleanupOptions = {}
): Promise<NotificationCleanupResult> {
  const now = options.now ?? new Date();
  const retentionDays =
    options.retentionDays ?? DEFAULT_USER_NOTIFICATION_RETENTION_DAYS;
  const cutoffAt = getUserNotificationCutoffAt(now, retentionDays);
  const result = await prisma.userNotification.deleteMany({
    where: {
      availableAt: {
        lt: cutoffAt,
      },
    },
  });

  return {
    cutoffAt,
    deletedCount: result.count,
    retentionDays,
  };
}
