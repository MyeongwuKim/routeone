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

type PushLocale = "ko" | "en";

const GANGWON_REGION_LABELS_EN: Record<string, string> = {
  "1": "Gangneung",
  "2": "Goseong",
  "3": "Donghae",
  "4": "Samcheok",
  "5": "Sokcho",
  "6": "Yanggu",
  "7": "Yangyang",
  "8": "Yeongwol",
  "9": "Wonju",
  "10": "Inje",
  "11": "Jeongseon",
  "12": "Cheorwon",
  "13": "Chuncheon",
  "14": "Taebaek",
  "15": "Pyeongchang",
  "16": "Hongcheon",
  "17": "Hwacheon",
  "18": "Hoengseong",
};

function getPushLocale(locale?: string | null): PushLocale {
  return locale?.trim().toLowerCase() === "en" ? "en" : "ko";
}

function formatEnglishRouteDate(dateLabel: string) {
  const [month, day] = dateLabel.split(".").map(Number);

  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return dateLabel;
  }

  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function localizeGeneratedRouteTitle(
  routeTitle: string,
  locale: PushLocale
) {
  if (locale !== "en") {
    return routeTitle;
  }

  if (routeTitle === "날짜 미정 일정") {
    return "Unscheduled trip";
  }

  const match = routeTitle.match(
    /^(\d{1,2}\.\d{1,2})(?:\s*~\s*(\d{1,2}\.\d{1,2}))?\s+일정$/
  );

  if (!match) {
    return routeTitle;
  }

  const startDate = formatEnglishRouteDate(match[1]);
  const endDate = match[2] ? formatEnglishRouteDate(match[2]) : null;
  const dateRange =
    endDate && endDate !== startDate
      ? `${startDate} – ${endDate}`
      : startDate;

  return `${dateRange} trip`;
}

function formatFestivalPeriod(
  startDate: string,
  endDate: string,
  locale: PushLocale
) {
  const formatDate = (dateKey: string) => {
    const date = new Date(`${dateKey}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return dateKey;
    }

    if (locale === "en") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
        timeZone: "UTC",
      });
    }

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    return `${date.getUTCMonth() + 1}.${date.getUTCDate()}(${weekdays[date.getUTCDay()]})`;
  };

  return startDate === endDate
    ? formatDate(startDate)
    : `${formatDate(startDate)}${locale === "en" ? " – " : "~"}${formatDate(endDate)}`;
}

function createFestivalBody(
  notification: UserNotification,
  locale: PushLocale,
  localizedTitleById: ReadonlyMap<string, string>
) {
  const visibleTitles = notification.festivalTitles
    .slice(0, 2)
    .map(
      (title, index) =>
        localizedTitleById.get(notification.festivalIds[index] ?? "") ?? title
    );
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
      festivalEndDates[index],
      locale
    )}`;
  });

  return `${visibleFestivalLabels.join(" · ")}${
    remainingCount > 0
      ? locale === "en"
        ? ` and ${remainingCount} more`
        : ` 외 ${remainingCount}개`
      : ""
  }`;
}

function createPushMessage(
  notification: UserNotification,
  device: PushDevice,
  locale: PushLocale,
  localizedFestivalTitleById: ReadonlyMap<string, string>
): ExpoPushMessage | null {
  if (notification.type === UserNotificationType.FESTIVAL_SUMMARY) {
    const festivalCount = notification.festivalTitles.length;
    const regionLabel =
      locale === "en"
        ? GANGWON_REGION_LABELS_EN[notification.regionCode ?? ""] ?? "Gangwon"
        : notification.regionLabel ?? "강원";
    const festivalLabel =
      locale === "en"
        ? `${festivalCount} festival${festivalCount === 1 ? "" : "s"}`
        : `축제 ${festivalCount}개`;
    const title =
      locale === "en"
        ? notification.festivalKind === "TODAY"
          ? `${festivalLabel} in ${regionLabel} today`
          : notification.festivalKind === "WEEKLY"
            ? `${festivalLabel} in ${regionLabel} this week`
            : notification.festivalKind === "MONTHLY"
              ? `${festivalLabel} in ${regionLabel} this month`
              : notification.festivalKind === "TRIP"
                ? `${festivalLabel} in ${regionLabel} on your travel day`
                : `[Test] ${festivalLabel} in ${regionLabel}`
        : notification.festivalKind === "TODAY"
          ? `오늘 ${regionLabel} ${festivalLabel}`
          : notification.festivalKind === "WEEKLY"
            ? `이번 주 ${regionLabel} ${festivalLabel}`
            : notification.festivalKind === "MONTHLY"
              ? `이번 달 ${regionLabel} ${festivalLabel}`
              : notification.festivalKind === "TRIP"
                ? `${regionLabel} 여행일 ${festivalLabel}`
                : `[테스트] ${regionLabel} ${festivalLabel}`;

    return {
      to: device.expoPushToken,
      sound: "default",
      title,
      body: createFestivalBody(
        notification,
        locale,
        localizedFestivalTitleById
      ),
      data: {
        type: "festival-summary",
        notificationId: notification.notificationKey,
        regionCode: notification.regionCode ?? "",
        dateKey: notification.dateKey ?? "",
      },
    };
  }

  if (notification.type === UserNotificationType.ROUTE_REVIEW) {
    const routeTitle = localizeGeneratedRouteTitle(
      notification.routeTitle ??
        (locale === "en" ? "Your trip" : "지난 루트"),
      locale
    );
    const isTestNotification =
      notification.notificationKey.startsWith("route-review:test:");
    const title =
      locale === "en"
        ? notification.routeReviewKind === "COMPLETED"
          ? `${routeTitle}—you made it!`
          : notification.routeReviewKind === "INCOMPLETE"
            ? `Finish your ${routeTitle} record`
            : `${routeTitle} has ended`
        : notification.routeReviewKind === "COMPLETED"
          ? `${routeTitle}, 무사히 잘 마쳤네요`
          : notification.routeReviewKind === "INCOMPLETE"
            ? `${routeTitle}가 마무리되지 않았어요`
            : `${routeTitle}를 다녀왔는지 알려주세요`;

    return {
      to: device.expoPushToken,
      sound: "default",
      title: `${isTestNotification ? (locale === "en" ? "[Test] " : "[테스트] ") : ""}${title}`,
      body:
        locale === "en"
          ? notification.routeReviewKind === "COMPLETED"
            ? "Update any missing details within 7 days, make a DAY card, or share your route."
            : "You can update visit records for 7 days after the trip ends."
          : notification.routeReviewKind === "COMPLETED"
            ? "빠진 기록은 7일 안에 보완할 수 있어요. DAY 카드를 만들거나 내 루트를 공유해 보세요."
            : "다녀온 루트에서 7일 동안 기록을 수정할 수 있어요.",
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
  const [settings, user] = await Promise.all([
    prisma.userNotificationSetting.findUnique({
      where: {
        userId: notification.userId,
      },
    }),
    prisma.user.findUnique({
      where: {
        id: notification.userId,
      },
      select: {
        locale: true,
      },
    }),
  ]);
  const locale = getPushLocale(user?.locale);
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
  const localizedFestivalTitles =
    locale === "en" &&
    notification.type === UserNotificationType.FESTIVAL_SUMMARY &&
    notification.festivalIds.length > 0
      ? await prisma.placeLocalization.findMany({
          where: {
            provider: "TOUR_API",
            locale: "en",
            externalId: {
              in: notification.festivalIds,
            },
          },
          select: {
            externalId: true,
            title: true,
          },
        })
      : [];
  const localizedFestivalTitleById = new Map(
    localizedFestivalTitles.map((festival) => [
      festival.externalId,
      festival.title,
    ])
  );
  const messages = devices
    .map((device) =>
      createPushMessage(
        notification,
        device,
        locale,
        localizedFestivalTitleById
      )
    )
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
