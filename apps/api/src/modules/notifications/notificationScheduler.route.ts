import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { normalizeAccountId, readBearerToken } from "../../lib/auth.js";
import { prisma } from "../../lib/prisma.js";
import {
  sendFestivalTestNotification,
  sendRouteReviewTestNotification,
} from "./notification.service.js";
import { runNotificationSchedulerOnce } from "./notificationScheduler.service.js";

type NotificationSchedulerMode =
  | "scheduled"
  | "festival-test"
  | "route-review-test";

type NotificationSchedulerBody = {
  accountId?: unknown;
  mode?: unknown;
};

function isSchedulerSecretEqual(candidate: string, expected: string) {
  const candidateBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);

  return (
    candidateBuffer.length === expectedBuffer.length &&
    timingSafeEqual(candidateBuffer, expectedBuffer)
  );
}

function readSchedulerMode(value: unknown): NotificationSchedulerMode | null {
  return value === "scheduled" ||
    value === "festival-test" ||
    value === "route-review-test"
    ? value
    : null;
}

async function getTestUser(accountIdValue: unknown) {
  const accountId =
    typeof accountIdValue === "string"
      ? normalizeAccountId(accountIdValue)
      : "";

  if (!accountId) {
    throw new Error("테스트할 RouteOne 계정 ID가 필요합니다.");
  }

  const user = await prisma.user.findFirst({
    where: {
      accountId,
    },
  });

  if (!user) {
    throw new Error(`테스트 계정을 찾지 못했습니다: ${accountId}`);
  }

  return user;
}

export function registerNotificationSchedulerRoutes(app: FastifyInstance) {
  app.post<{ Body: NotificationSchedulerBody }>(
    "/internal/notifications/run",
    async (request, reply) => {
      const expectedSecret =
        process.env.NOTIFICATION_SCHEDULER_SECRET?.trim() ?? "";
      const receivedSecret = readBearerToken(request.headers.authorization);

      if (!expectedSecret) {
        return reply.code(503).send({
          ok: false,
          error: "NOTIFICATION_SCHEDULER_SECRET이 설정되지 않았습니다.",
        });
      }

      if (
        !receivedSecret ||
        !isSchedulerSecretEqual(receivedSecret, expectedSecret)
      ) {
        return reply.code(401).send({
          ok: false,
          error: "알림 Scheduler 인증에 실패했습니다.",
        });
      }

      const mode = readSchedulerMode(request.body?.mode);

      if (!mode) {
        return reply.code(400).send({
          ok: false,
          error: "알림 실행 모드가 올바르지 않습니다.",
        });
      }

      const startedAt = new Date();

      if (mode === "scheduled") {
        await runNotificationSchedulerOnce(prisma, startedAt);
        return {
          ok: true,
          mode,
          startedAt: startedAt.toISOString(),
        };
      }

      try {
        const user = await getTestUser(request.body?.accountId);

        if (mode === "festival-test") {
          const result = await sendFestivalTestNotification(prisma, user);

          return {
            ok: true,
            mode,
            accountId: user.accountId,
            ...result,
          };
        }

        const pushDevice = await prisma.pushDevice.findFirst({
          where: {
            userId: user.id,
            enabled: true,
            sessionExpiresAt: {
              gt: new Date(),
            },
          },
          orderBy: {
            lastSeenAt: "desc",
          },
          select: {
            id: true,
          },
        });

        if (!pushDevice) {
          throw new Error("테스트 계정에 활성화된 푸시 기기가 없습니다.");
        }

        const result = await sendRouteReviewTestNotification(
          prisma,
          user,
          pushDevice.id
        );

        return {
          ok: true,
          mode,
          accountId: user.accountId,
          ...result,
        };
      } catch (error) {
        return reply.code(400).send({
          ok: false,
          mode,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  );
}
