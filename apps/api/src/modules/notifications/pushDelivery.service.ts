import {
  UserNotificationPushStatus,
  UserNotificationType,
  type PrismaClient,
  type PushDevice,
  type UserNotification,
} from "@prisma/client";

type ExpoPushTicket = {
  status?: unknown;
  id?: unknown;
  message?: unknown;
  details?: {
    error?: unknown;
  };
};

type ExpoPushMessage = {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data: Record<string, string>;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_PUSH_ATTEMPTS = 24;
const PUSH_CLAIM_TIMEOUT_MS = 1000 * 60 * 10;
const NO_DEVICE_RETRY_MS = 1000 * 60 * 60;
const MAX_RETRY_DELAY_MS = 1000 * 60 * 60 * 6;

function formatFestivalPeriod(startDate: string, endDate: string) {
  const formatDate = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return dateKey;
    }

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}(${weekdays[date.getUTCDay()]})`;
  };

  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)}~${formatDate(endDate)}`;
}

function createFestivalBody(notification: UserNotification) {
  const visibleTitles = notification.festivalTitles.slice(0, 2);
  const remainingCount =
    notification.festivalTitles.length - visibleTitles.length;
  const festivalStartDates = notification.festivalStartDates ?? [];
  const festivalEndDates = notification.festivalEndDates ?? [];
  const hasFestivalPeriods =
    festivalStartDates.length === notification.festivalTitles.length &&
    festivalEndDates.length === notification.festivalTitles.length;
  const visibleFestivalLabels = visibleTitles.map((title, index) => {
    if (!hasFestivalPeriods) {
      return title;
    }

    return `${title} ${formatFestivalPeriod(
      festivalStartDates[index],
      festivalEndDates[index]
    )}`;
  });

  return `${visibleFestivalLabels.join(" · ")}${
    remainingCount > 0 ? ` 외 ${remainingCount}개` : ""
  }`;
}

function createPushMessage(
  notification: UserNotification,
  device: PushDevice
): ExpoPushMessage | null {
  if (notification.type === UserNotificationType.FESTIVAL_SUMMARY) {
    const isTestNotification =
      notification.notificationKey.startsWith("festival:test:");

    return {
      to: device.expoPushToken,
      sound: "default",
      title: `${isTestNotification ? "[테스트] " : ""}${notification.regionLabel ?? "강원"} 축제 ${notification.festivalTitles.length}개`,
      body: createFestivalBody(notification),
      data: {
        type: "festival-summary",
        notificationId: notification.notificationKey,
        regionCode: notification.regionCode ?? "",
        dateKey: notification.dateKey ?? "",
      },
    };
  }

  if (notification.type === UserNotificationType.ROUTE_REVIEW) {
    const routeTitle = notification.routeTitle ?? "지난 루트";
    const isTestNotification =
      notification.notificationKey.startsWith("route-review:test:");
    const title =
      notification.routeReviewKind === "COMPLETED"
        ? `${routeTitle} 기록을 확인해 보세요`
        : notification.routeReviewKind === "INCOMPLETE"
          ? `${routeTitle}가 마무리되지 않았어요`
          : `${routeTitle}를 다녀왔는지 알려주세요`;

    return {
      to: device.expoPushToken,
      sound: "default",
      title: `${isTestNotification ? "[테스트] " : ""}${title}`,
      body: "다녀온 루트에서 7일 동안 기록을 수정할 수 있어요.",
      data: {
        type: "route-review",
        notificationId: notification.notificationKey,
        routeId: notification.routeId ?? "",
        dayId: notification.dayId ?? "",
      },
    };
  }

  return null;
}

function getRetryAt(now: Date, attemptCount: number, hasDevice: boolean) {
  if (!hasDevice) {
    return new Date(now.getTime() + NO_DEVICE_RETRY_MS);
  }

  const retryDelay = Math.min(
    MAX_RETRY_DELAY_MS,
    1000 * 60 * 5 * 2 ** Math.max(0, attemptCount - 1)
  );
  return new Date(now.getTime() + retryDelay);
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Encoding": "gzip, deflate",
    "Content-Type": "application/json",
  };
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Expo push request failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    data?: ExpoPushTicket | ExpoPushTicket[];
  };

  return Array.isArray(payload.data)
    ? payload.data
    : payload.data
      ? [payload.data]
      : [];
}

async function deliverClaimedNotification(
  prisma: PrismaClient,
  notification: UserNotification,
  now: Date,
  pushDeviceId?: string
) {
  const settings = await prisma.userNotificationSetting.findUnique({
    where: {
      userId: notification.userId,
    },
  });
  const isFestivalTestNotification =
    notification.type === UserNotificationType.FESTIVAL_SUMMARY &&
    notification.notificationKey.startsWith("festival:test:");
  const isRouteReviewTestNotification =
    notification.type === UserNotificationType.ROUTE_REVIEW &&
    notification.notificationKey.startsWith("route-review:test:");
  const isDisabled =
    (notification.type === UserNotificationType.FESTIVAL_SUMMARY &&
      !isFestivalTestNotification &&
      (!settings?.festivalEnabled ||
        (notification.festivalKind !== "TRIP" &&
          (!notification.regionCode ||
            !settings.festivalRegionCodes.includes(
              notification.regionCode
            ))))) ||
    (notification.type === UserNotificationType.ROUTE_REVIEW &&
      !isRouteReviewTestNotification &&
      !settings?.routeReviewEnabled);

  if (isDisabled) {
    await prisma.userNotification.update({
      where: {
        id: notification.id,
      },
      data: {
        pushStatus: UserNotificationPushStatus.CANCELED,
        pushError: "사용자가 해당 알림을 끄거나 지역을 변경했습니다.",
        nextPushAttemptAt: null,
      },
    });
    return;
  }

  const devices = await prisma.pushDevice.findMany({
    where: {
      userId: notification.userId,
      enabled: true,
      ...(pushDeviceId
        ? {
            id: pushDeviceId,
          }
        : {}),
    },
  });
  const messages = devices
    .map((device) => createPushMessage(notification, device))
    .filter((message): message is ExpoPushMessage => Boolean(message));

  if (messages.length === 0) {
    await prisma.userNotification.update({
      where: {
        id: notification.id,
      },
      data: {
        pushStatus: UserNotificationPushStatus.FAILED,
        pushError: "등록된 푸시 기기가 없습니다.",
        nextPushAttemptAt: getRetryAt(
          now,
          notification.pushAttemptCount,
          false
        ),
      },
    });
    return;
  }

  try {
    const tickets = await sendExpoPushMessages(messages);
    const ticketIds: string[] = [];
    let acceptedCount = 0;
    const errors: string[] = [];

    for (const [index, ticket] of tickets.entries()) {
      if (ticket.status === "ok") {
        acceptedCount += 1;
        if (typeof ticket.id === "string") {
          ticketIds.push(ticket.id);
        }
        continue;
      }

      const errorCode =
        typeof ticket.details?.error === "string"
          ? ticket.details.error
          : null;
      const message =
        typeof ticket.message === "string"
          ? ticket.message
          : errorCode ?? "Expo push rejected";
      errors.push(message);

      if (errorCode === "DeviceNotRegistered") {
        const device = devices[index];
        if (device) {
          await prisma.pushDevice.update({
            where: {
              id: device.id,
            },
            data: {
              enabled: false,
              disabledAt: now,
            },
          });
        }
      }
    }

    if (acceptedCount > 0) {
      await prisma.userNotification.update({
        where: {
          id: notification.id,
        },
        data: {
          pushStatus: UserNotificationPushStatus.SENT,
          pushSentAt: now,
          pushTicketIds: ticketIds,
          pushError: errors.length ? errors.join(" | ").slice(0, 1000) : null,
          nextPushAttemptAt: null,
        },
      });
      return;
    }

    throw new Error(errors.join(" | ") || "Expo push was not accepted.");
  } catch (error) {
    await prisma.userNotification.update({
      where: {
        id: notification.id,
      },
      data: {
        pushStatus: UserNotificationPushStatus.FAILED,
        pushError:
          error instanceof Error
            ? error.message.slice(0, 1000)
            : "Expo push failed.",
        nextPushAttemptAt: getRetryAt(
          now,
          notification.pushAttemptCount,
          true
        ),
      },
    });
  }
}

export async function deliverPendingNotifications(
  prisma: PrismaClient,
  now = new Date(),
  notificationIds?: string[],
  pushDeviceId?: string
) {
  const targetNotificationIds = notificationIds
    ? [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))]
    : null;

  if (pushDeviceId && targetNotificationIds?.length !== 1) {
    throw new Error("단일 기기 푸시에는 알림 ID가 정확히 1개 필요합니다.");
  }

  if (notificationIds && targetNotificationIds?.length === 0) {
    return;
  }

  const staleClaimedAt = new Date(now.getTime() - PUSH_CLAIM_TIMEOUT_MS);
  const excludeTestNotifications = targetNotificationIds
    ? {}
    : {
        NOT: [
          {
            notificationKey: {
              startsWith: "festival:test:",
            },
          },
          {
            notificationKey: {
              startsWith: "route-review:test:",
            },
          },
        ],
      };
  await prisma.userNotification.updateMany({
    where: {
      ...excludeTestNotifications,
      ...(targetNotificationIds
        ? {
            id: {
              in: targetNotificationIds,
            },
          }
        : {}),
      pushStatus: UserNotificationPushStatus.SENDING,
      pushClaimedAt: {
        lt: staleClaimedAt,
      },
    },
    data: {
      pushStatus: UserNotificationPushStatus.FAILED,
      nextPushAttemptAt: now,
      pushError: "이전 푸시 전송 작업을 다시 시도합니다.",
    },
  });

  const candidates = await prisma.userNotification.findMany({
    where: {
      ...excludeTestNotifications,
      ...(targetNotificationIds
        ? {
            id: {
              in: targetNotificationIds,
            },
          }
        : {}),
      pushStatus: {
        in: [
          UserNotificationPushStatus.PENDING,
          UserNotificationPushStatus.FAILED,
        ],
      },
      availableAt: {
        lte: now,
      },
      OR: [
        {
          nextPushAttemptAt: null,
        },
        {
          nextPushAttemptAt: {
            isSet: false,
          },
        },
        {
          nextPushAttemptAt: {
            lte: now,
          },
        },
      ],
      AND: [
        {
          OR: [
            {
              expiresAt: null,
            },
            {
              expiresAt: {
                isSet: false,
              },
            },
            {
              expiresAt: {
                gt: now,
              },
            },
          ],
        },
      ],
      pushAttemptCount: {
        lt: MAX_PUSH_ATTEMPTS,
      },
    },
    orderBy: {
      availableAt: "asc",
    },
    take: 100,
  });

  for (const candidate of candidates) {
    const claimed = await prisma.userNotification.updateMany({
      where: {
        id: candidate.id,
        pushStatus: candidate.pushStatus,
        pushAttemptCount: candidate.pushAttemptCount,
      },
      data: {
        pushStatus: UserNotificationPushStatus.SENDING,
        pushClaimedAt: now,
        pushAttemptCount: {
          increment: 1,
        },
      },
    });

    if (claimed.count !== 1) {
      continue;
    }

    await deliverClaimedNotification(
      prisma,
      {
        ...candidate,
        pushStatus: UserNotificationPushStatus.SENDING,
        pushAttemptCount: candidate.pushAttemptCount + 1,
        pushClaimedAt: now,
      },
      now,
      pushDeviceId
    );
  }
}
