import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import {
  cleanupUserNotifications,
  DEFAULT_USER_NOTIFICATION_RETENTION_DAYS,
} from "../modules/notifications/notificationCleanup.service.js";

function readRetentionDays() {
  const rawValue = process.env.USER_NOTIFICATION_RETENTION_DAYS?.trim();

  if (!rawValue) {
    return DEFAULT_USER_NOTIFICATION_RETENTION_DAYS;
  }

  const retentionDays = Number(rawValue);

  if (!Number.isSafeInteger(retentionDays) || retentionDays < 1) {
    throw new Error(
      "USER_NOTIFICATION_RETENTION_DAYS must be a positive integer."
    );
  }

  return retentionDays;
}

async function run() {
  const startedAt = new Date();
  const result = await cleanupUserNotifications(prisma, {
    now: startedAt,
    retentionDays: readRetentionDays(),
  });

  console.log(
    JSON.stringify({
      event: "user-notification-cleanup.completed",
      startedAt: startedAt.toISOString(),
      cutoffAt: result.cutoffAt.toISOString(),
      retentionDays: result.retentionDays,
      deletedCount: result.deletedCount,
    })
  );
}

try {
  await run();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "user-notification-cleanup.failed",
      message: error instanceof Error ? error.message : String(error),
    })
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
