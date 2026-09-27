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
  email?: unknown;
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

/**
 * 수동 알림 테스트 대상을 일반 가입자의 accountId 또는 OAuth 가입자의 email로 조회한다.
 * 두 식별자를 동시에 전달하면 서로 다른 사용자를 가리킬 수 있으므로 요청을 거부한다.
 */
async function getTestUser({
  accountId: accountIdValue,
  email: emailValue,
}: NotificationSchedulerBody) {
  const accountId =
    typeof accountIdValue === "string"
      ? normalizeAccountId(accountIdValue)
      : "";
  const email =
    typeof emailValue === "string" ? emailValue.trim().toLowerCase() : "";

  if (accountId && email) {
    throw new Error("테스트 계정의 accountId와 email 중 하나만 입력해 주세요.");
  }

  if (!accountId && !email) {
    throw new Error("테스트할 RouteOne 계정 ID 또는 이메일이 필요합니다.");
  }

  const user = await prisma.user.findFirst({
    where: accountId ? { accountId } : { email },
  });

  if (!user) {
    throw new Error(`테스트 계정을 찾지 못했습니다: ${accountId || email}`);
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
        const user = await getTestUser(request.body ?? {});

        if (mode === "festival-test") {
          const result = await sendFestivalTestNotification(prisma, user);

          return {
            ok: true,
            mode,
            accountId: user.accountId,
            email: user.email,
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
          email: user.email,
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
