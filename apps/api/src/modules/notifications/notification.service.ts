import { randomUUID } from "node:crypto";
import {
  FestivalNotificationKind,
  Prisma,
  RouteReviewNotificationKind,
  RouteStatus,
  UserNotificationPushStatus,
  UserNotificationType,
  VisitStatus,
  type PrismaClient,
  type User,
} from "@prisma/client";
import {
  fetchGangwonFestivalSource,
  hasFestivalCoordinates,
} from "./festivalSource.service.js";
import { getUserNotificationCutoffAt } from "./notificationCleanup.service.js";
import { GANGWON_REGION_BY_CODE } from "./notificationSettings.service.js";
import { deliverPendingNotifications } from "./pushDelivery.service.js";

export type FestivalNotificationSyncInput = {
  notificationKey: string;
  kind: FestivalNotificationKind;
  regionCode: string;
  regionLabel: string;
  dateKey: string;
  festivalIds: string[];
  festivalTitles: string[];
  festivalStartDates?: string[] | null;
  festivalEndDates?: string[] | null;
  triggerAt?: Date | null;
};

export type RouteArrivalNotificationSyncInput = {
  routeId: string;
  routeTitle?: string | null;
  dayId: string;
  stopId: string;
  placeTitle: string;
  dateKey: string;
  deliveredAt: Date;
};

export type RouteReviewNotificationSyncInput = {
  notificationKey: string;
  kind: RouteReviewNotificationKind;
  routeId: string;
  routeTitle: string;
  dayId: string;
  triggerAt?: Date | null;
  correctionDeadlineAt: Date;
};

const MAX_NOTIFICATION_SYNC_COUNT = 48;
const MAX_ARRIVAL_NOTIFICATION_SYNC_COUNT = 120;
const MAX_NOTIFICATION_LIST_COUNT = 60;
const DEFAULT_NOTIFICATION_LIST_COUNT = 30;
const MAX_FESTIVAL_COUNT_PER_NOTIFICATION = 100;
const MAX_FUTURE_TIMESTAMP_OFFSET_MS = 1000 * 60 * 5;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONGO_OBJECT_ID_PATTERN = /^[0-9a-f]{24}$/i;
const MAX_NOTIFICATION_CURSOR_LENGTH = 512;
const KST_OFFSET_MS = 1000 * 60 * 60 * 9;
const ROUTE_CORRECTION_GRACE_DAYS = 7;
const ROUTE_REVIEW_TEST_COOLDOWN_MS = 10_000;

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function normalizeRequiredText(
  value: string,
  fieldName: string,
  maxLength: number
) {
  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${fieldName} 값이 올바르지 않습니다.`);
  }

  return normalized;
}

function normalizeFestivalNotification(
  input: FestivalNotificationSyncInput,
  now: Date
) {
  const notificationKey = normalizeRequiredText(
    input.notificationKey,
    "알림 키",
    220
  );
  const regionCode = normalizeRequiredText(input.regionCode, "지역 코드", 40);
  const regionLabel = normalizeRequiredText(input.regionLabel, "지역명", 80);
  const dateKey = normalizeRequiredText(input.dateKey, "알림 날짜", 10);

  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("알림 날짜 값이 올바르지 않습니다.");
  }

  if (
    input.festivalIds.length === 0 ||
    input.festivalIds.length !== input.festivalTitles.length ||
    input.festivalIds.length > MAX_FESTIVAL_COUNT_PER_NOTIFICATION
  ) {
    throw new Error("축제 알림 목록이 올바르지 않습니다.");
  }

  const festivalStartDates = input.festivalStartDates ?? [];
  const festivalEndDates = input.festivalEndDates ?? [];
  const hasFestivalPeriods =
    festivalStartDates.length > 0 || festivalEndDates.length > 0;

  if (
    hasFestivalPeriods &&
    (festivalStartDates.length !== input.festivalIds.length ||
      festivalEndDates.length !== input.festivalIds.length)
  ) {
    throw new Error("축제 기간 목록이 올바르지 않습니다.");
  }

  const festivalById = new Map<
    string,
    {
      title: string;
      startDate: string;
      endDate: string;
    }
  >();

  input.festivalIds.forEach((festivalId, index) => {
    const normalizedId = normalizeRequiredText(
      festivalId,
      "축제 ID",
      220
    );
    const normalizedTitle = normalizeRequiredText(
      input.festivalTitles[index] ?? "",
      "축제명",
      240
    );
    const normalizedStartDate = hasFestivalPeriods
      ? normalizeRequiredText(
          festivalStartDates[index] ?? "",
          "축제 시작일",
          10
        )
      : "";
    const normalizedEndDate = hasFestivalPeriods
      ? normalizeRequiredText(
          festivalEndDates[index] ?? "",
          "축제 종료일",
          10
        )
      : "";

    if (
      hasFestivalPeriods &&
      (!DATE_KEY_PATTERN.test(normalizedStartDate) ||
        !DATE_KEY_PATTERN.test(normalizedEndDate) ||
        normalizedStartDate > normalizedEndDate)
    ) {
      throw new Error("축제 기간 값이 올바르지 않습니다.");
    }

    if (!festivalById.has(normalizedId)) {
      festivalById.set(normalizedId, {
        title: normalizedTitle,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
      });
    }
  });

  const festivalEntries = [...festivalById.entries()];
  const triggerAt = input.triggerAt ?? null;

  if (triggerAt && Number.isNaN(triggerAt.getTime())) {
    throw new Error("알림 예약 시간이 올바르지 않습니다.");
  }

  return {
    notificationKey,
    kind: input.kind,
    regionCode,
    regionLabel,
    dateKey,
    festivalIds: festivalEntries.map(([festivalId]) => festivalId),
    festivalTitles: festivalEntries.map(
      ([, festival]) => festival.title
    ),
    festivalStartDates: hasFestivalPeriods
      ? festivalEntries.map(([, festival]) => festival.startDate)
      : [],
    festivalEndDates: hasFestivalPeriods
      ? festivalEntries.map(([, festival]) => festival.endDate)
      : [],
    availableAt: triggerAt ?? now,
    shouldUpdateAvailableAt: Boolean(triggerAt),
  };
}

function normalizeDate(value: Date, fieldName: string) {
  if (Number.isNaN(value.getTime())) {
    throw new Error(`${fieldName} 값이 올바르지 않습니다.`);
  }

  return value;
}

function normalizeOptionalText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim() ?? "";

  if (normalized.length > maxLength) {
    throw new Error("알림 텍스트 값이 올바르지 않습니다.");
  }

  return normalized || null;
}

function normalizeRouteArrivalNotification(
  input: RouteArrivalNotificationSyncInput,
  now: Date
) {
  const routeId = normalizeRequiredText(input.routeId, "루트 ID", 80);
  const dayId = normalizeRequiredText(input.dayId, "DAY ID", 80);
  const stopId = normalizeRequiredText(input.stopId, "장소 ID", 80);
  const dateKey = normalizeRequiredText(input.dateKey, "도착 날짜", 10);
  const deliveredAt = normalizeDate(input.deliveredAt, "도착 알림 시간");

  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error("도착 날짜 값이 올바르지 않습니다.");
  }

  if (
    deliveredAt.getTime() >
    now.getTime() + MAX_FUTURE_TIMESTAMP_OFFSET_MS
  ) {
    throw new Error("도착 알림 시간이 올바르지 않습니다.");
  }

  return {
    notificationKey: `arrival:${routeId}:${stopId}:${dateKey}`,
    routeId,
    routeTitle: normalizeOptionalText(input.routeTitle, 160),
    dayId,
    stopId,
    placeTitle: normalizeRequiredText(input.placeTitle, "장소명", 240),
    deliveredAt,
  };
}

function normalizeRouteReviewNotification(
  input: RouteReviewNotificationSyncInput,
  now: Date
) {
  const triggerAt = input.triggerAt ?? null;
  const correctionDeadlineAt = normalizeDate(
    input.correctionDeadlineAt,
    "기록 보정 기한"
  );

  if (triggerAt) {
    normalizeDate(triggerAt, "루트 알림 예약 시간");
  }

  return {
    notificationKey: normalizeRequiredText(
      input.notificationKey,
      "알림 키",
      220
    ),
    kind: input.kind,
    routeId: normalizeRequiredText(input.routeId, "루트 ID", 80),
    routeTitle: normalizeRequiredText(input.routeTitle, "루트명", 160),
    dayId: normalizeRequiredText(input.dayId, "DAY ID", 80),
    availableAt: triggerAt ?? now,
    correctionDeadlineAt,
    shouldUpdateAvailableAt: Boolean(triggerAt),
  };
}

function normalizeListLimit(limit?: number | null) {
  if (!Number.isFinite(limit)) {
    return DEFAULT_NOTIFICATION_LIST_COUNT;
  }

  return Math.max(
    1,
    Math.min(MAX_NOTIFICATION_LIST_COUNT, Math.floor(limit ?? 0))
  );
}

type NotificationInboxCursor = {
  availableAt: Date;
  id: string;
};

function encodeNotificationInboxCursor(cursor: NotificationInboxCursor) {
  return Buffer.from(
    JSON.stringify({
      v: 1,
      at: cursor.availableAt.toISOString(),
      id: cursor.id,
    }),
    "utf8"
  ).toString("base64url");
}

function decodeNotificationInboxCursor(value: string) {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > MAX_NOTIFICATION_CURSOR_LENGTH
  ) {
    throw new Error("알림 목록 커서가 올바르지 않습니다.");
  }

  try {
    const payload = JSON.parse(
      Buffer.from(normalized, "base64url").toString("utf8")
    ) as {
      v?: unknown;
      at?: unknown;
      id?: unknown;
    };
    const availableAt =
      typeof payload.at === "string" ? new Date(payload.at) : null;
    const id = typeof payload.id === "string" ? payload.id : "";

    if (
      payload.v !== 1 ||
      !availableAt ||
      Number.isNaN(availableAt.getTime()) ||
      availableAt.toISOString() !== payload.at ||
      !MONGO_OBJECT_ID_PATTERN.test(id)
    ) {
      throw new Error("Invalid notification cursor payload.");
    }

    return {
      availableAt,
      id,
    } satisfies NotificationInboxCursor;
  } catch {
    throw new Error("알림 목록 커서가 올바르지 않습니다.");
  }
}

function toKstDateKey(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function formatFestivalDateKey(ymd: string) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function addDateKeyDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function atKst(dateKey: string, hour: number, minute = 0) {
  const hourText = String(hour).padStart(2, "0");
  const minuteText = String(minute).padStart(2, "0");
  return new Date(`${dateKey}T${hourText}:${minuteText}:00+09:00`);
}

function getFestivalTestCandidates(
  festivals: Awaited<ReturnType<typeof fetchGangwonFestivalSource>>,
  regionCode: string,
  todayKey: string,
  rangeEndKey: string
) {
  const todayYmd = todayKey.replaceAll("-", "");
  const rangeEndYmd = rangeEndKey.replaceAll("-", "");

  return festivals
    .filter(
      (festival) =>
        festival.regionCode === regionCode &&
        festival.startYmd <= rangeEndYmd &&
        festival.endYmd >= todayYmd &&
        hasFestivalCoordinates(festival)
    )
    .sort((left, right) => left.startYmd.localeCompare(right.startYmd))
    .slice(0, 10);
}

export async function sendFestivalTestNotification(
  prisma: PrismaClient,
  user: User
) {
  const settings = await prisma.userNotificationSetting.findUnique({
    where: {
      userId: user.id,
    },
  });
  const regionCodes = settings?.festivalEnabled
    ? settings.festivalRegionCodes.filter(
        (regionCode) =>
          regionCode in GANGWON_REGION_BY_CODE
      )
    : [];

  if (regionCodes.length === 0) {
    throw new Error("축제 알림을 받을 지역을 먼저 선택해 주세요.");
  }

  const now = new Date();
  const todayKey = toKstDateKey(now);
  const rangeEndKey = addDateKeyDays(todayKey, 6);
  let festivals: Awaited<
    ReturnType<typeof fetchGangwonFestivalSource>
  >;

  try {
    festivals = await fetchGangwonFestivalSource(now);
  } catch (error) {
    console.warn(
      "[notification-test] festival lookup failed",
      error instanceof Error ? error.message : error
    );
    throw new Error("실제 축제 정보를 불러오지 못했어요.");
  }

  const festivalById = new Map<
    string,
    ReturnType<typeof getFestivalTestCandidates>[number]
  >();

  for (const regionCode of regionCodes) {
    getFestivalTestCandidates(
      festivals,
      regionCode,
      todayKey,
      rangeEndKey
    ).forEach((festival) => festivalById.set(festival.id, festival));
  }

  const matchingFestivals = [...festivalById.values()]
    .sort(
      (left, right) =>
        left.startYmd.localeCompare(right.startYmd) ||
        left.title.localeCompare(right.title, "ko")
    )
    .slice(0, MAX_FESTIVAL_COUNT_PER_NOTIFICATION);

  if (matchingFestivals.length === 0) {
    throw new Error(
      "선택한 지역에 오늘부터 7일 안에 열리는 축제가 없어요."
    );
  }

  const matchingRegionCodes = [
    ...new Set(matchingFestivals.map((festival) => festival.regionCode)),
  ];
  const notification = await prisma.userNotification.create({
    data: {
      userId: user.id,
      notificationKey: `festival:test:${Date.now()}:${randomUUID()}`,
      type: UserNotificationType.FESTIVAL_SUMMARY,
      festivalKind: FestivalNotificationKind.TEST,
      regionCode:
        matchingRegionCodes.length === 1
          ? matchingRegionCodes[0]
          : "MULTIPLE",
      regionLabel: matchingRegionCodes
        .map(
          (regionCode) =>
            GANGWON_REGION_BY_CODE[
              regionCode as keyof typeof GANGWON_REGION_BY_CODE
            ]
        )
        .join(", "),
      dateKey: todayKey,
      festivalIds: matchingFestivals.map((festival) => festival.id),
      festivalTitles: matchingFestivals.map((festival) => festival.title),
      festivalStartDates: matchingFestivals.map((festival) =>
        formatFestivalDateKey(festival.startYmd)
      ),
      festivalEndDates: matchingFestivals.map((festival) =>
        formatFestivalDateKey(festival.endYmd)
      ),
      availableAt: now,
      expiresAt: new Date(now.getTime() + 1000 * 60 * 60),
      pushStatus: UserNotificationPushStatus.PENDING,
      nextPushAttemptAt: now,
    },
  });

  await deliverPendingNotifications(
    prisma,
    now,
    [notification.id]
  );

  const deliveredNotifications =
    await prisma.userNotification.findMany({
    where: {
      id: {
        in: [notification.id],
      },
    },
  });
  const sentNotifications = deliveredNotifications.filter(
    (notification) =>
      notification.pushStatus === UserNotificationPushStatus.SENT
  );
  const pushErrors = deliveredNotifications
    .map((notification) => notification.pushError)
    .filter((pushError): pushError is string => Boolean(pushError));

  return {
    notificationKey: notification.notificationKey,
    pushStatus:
      sentNotifications.length === 1
        ? UserNotificationPushStatus.SENT
        : UserNotificationPushStatus.FAILED,
    pushError:
      pushErrors.length > 0
        ? [...new Set(pushErrors)].join(" | ")
        : sentNotifications.length === 1
          ? null
          : "일부 축제 알림을 보내지 못했어요.",
  };
}

function formatRouteDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function getRouteTitle(startDate: Date | null, endDate: Date) {
  const startDateKey = startDate
    ? startDate.toISOString().slice(0, 10)
    : null;
  const endDateKey = endDate.toISOString().slice(0, 10);

  if (!startDateKey) {
    return "날짜 미정 일정";
  }

  const startLabel = formatRouteDate(startDateKey);
  const endLabel = formatRouteDate(endDateKey);

  return startLabel === endLabel
    ? `${startLabel} 일정`
    : `${startLabel} ~ ${endLabel} 일정`;
}

export async function sendRouteReviewTestNotification(
  prisma: PrismaClient,
  user: User,
  pushDeviceId: string
) {
  const now = new Date();
  const normalizedPushDeviceId = normalizeRequiredText(
    pushDeviceId,
    "푸시 기기 ID",
    24
  );

  if (!MONGO_OBJECT_ID_PATTERN.test(normalizedPushDeviceId)) {
    throw new Error("푸시 기기 ID가 올바르지 않습니다.");
  }

  const pushDevice = await prisma.pushDevice.findFirst({
    where: {
      id: normalizedPushDeviceId,
      userId: user.id,
      enabled: true,
      sessionExpiresAt: {
        gt: now,
      },
    },
    select: {
      id: true,
    },
  });

  if (!pushDevice) {
    throw new Error("현재 기기의 푸시 정보를 찾지 못했어요.");
  }

  const routes = await prisma.route.findMany({
    where: {
      ownerId: user.id,
      status: RouteStatus.COMPLETED,
      completedAt: {
        not: null,
      },
      travelEndDate: {
        not: null,
      },
      totalStopCount: {
        gt: 0,
      },
    },
    include: {
      days: {
        orderBy: {
          dayIndex: "asc",
        },
        include: {
          stops: {
            select: {
              visitStatus: true,
            },
          },
        },
      },
    },
    orderBy: [
      {
        completedAt: "desc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });
  let candidate:
    | {
        route: (typeof routes)[number];
        travelEndDate: Date;
        dayId: string;
      }
    | undefined;

  for (const route of routes) {
    if (!route.travelEndDate) {
      continue;
    }

    const daysWithStops = route.days.filter(
      (day) => day.stops.length > 0
    );
    const incompleteDay = daysWithStops.find((day) =>
      day.stops.some(
        (stop) => stop.visitStatus !== VisitStatus.VISITED
      )
    );
    const reviewDay = incompleteDay ?? daysWithStops.at(-1);

    if (reviewDay) {
      candidate = {
        route,
        travelEndDate: route.travelEndDate,
        dayId: reviewDay.id,
      };
      break;
    }
  }

  if (!candidate) {
    throw new Error("완료되고 장소가 포함된 루트가 없어요.");
  }

  const {
    route,
    travelEndDate,
    dayId,
  } = candidate;
  const correctionDeadlineAt = new Date(
    now.getTime() + 1000 * 60 * 60 * 24 * ROUTE_CORRECTION_GRACE_DAYS
  );
  const notificationKey = `route-review:test:${route.id}:${Math.floor(
    now.getTime() / ROUTE_REVIEW_TEST_COOLDOWN_MS
  )}`;
  const existingNotification =
    await prisma.userNotification.findUnique({
      where: {
        userId_notificationKey: {
          userId: user.id,
          notificationKey,
        },
      },
      select: {
        id: true,
      },
    });

  if (existingNotification) {
    throw new Error("테스트 알림은 10초 후에 다시 보내 주세요.");
  }

  let notification;

  try {
    notification = await prisma.userNotification.create({
      data: {
        userId: user.id,
        notificationKey,
        type: UserNotificationType.ROUTE_REVIEW,
        routeReviewKind: RouteReviewNotificationKind.COMPLETED,
        routeId: route.id,
        routeTitle: getRouteTitle(
          route.travelStartDate,
          travelEndDate
        ),
        dayId,
        correctionDeadlineAt,
        availableAt: now,
        expiresAt: correctionDeadlineAt,
        pushStatus: UserNotificationPushStatus.PENDING,
        nextPushAttemptAt: now,
      },
    });
  } catch (error) {
    const duplicatedNotification =
      await prisma.userNotification.findUnique({
        where: {
          userId_notificationKey: {
            userId: user.id,
            notificationKey,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicatedNotification) {
      throw new Error("테스트 알림은 10초 후에 다시 보내 주세요.");
    }

    throw error;
  }

  try {
    await deliverPendingNotifications(
      prisma,
      now,
      [notification.id],
      pushDevice.id
    );
  } catch (error) {
    await prisma.userNotification.deleteMany({
      where: {
        id: notification.id,
        userId: user.id,
        notificationKey: notification.notificationKey,
      },
    });
    throw error;
  }

  const deliveredNotification =
    await prisma.userNotification.findUnique({
      where: {
        id: notification.id,
      },
    });

  if (!deliveredNotification) {
    throw new Error("루트 종료 테스트 알림 결과를 확인하지 못했어요.");
  }

  const result = {
    notificationKey: deliveredNotification.notificationKey,
    pushStatus:
      deliveredNotification.pushStatus ??
      UserNotificationPushStatus.FAILED,
    pushError: deliveredNotification.pushError,
    routeId: route.id,
    dayId,
  };

  if (
    deliveredNotification.pushStatus !==
    UserNotificationPushStatus.SENT
  ) {
    await prisma.userNotification.delete({
      where: {
        id: deliveredNotification.id,
      },
    });
  }

  return result;
}

export async function syncFestivalNotificationInbox(
  prisma: PrismaClient,
  user: User,
  inputs: FestivalNotificationSyncInput[]
) {
  if (inputs.length > MAX_NOTIFICATION_SYNC_COUNT) {
    throw new Error("한 번에 동기화할 수 있는 알림 수를 초과했습니다.");
  }

  const now = new Date();
  const notificationByKey = new Map(
    inputs.map((input) => {
      const notification = normalizeFestivalNotification(input, now);
      return [notification.notificationKey, notification] as const;
    })
  );
  const notifications = [...notificationByKey.values()];
  const notificationKeys = notifications.map(
    (notification) => notification.notificationKey
  );
  const oldestAllowedAt = getUserNotificationCutoffAt(now);

  await prisma.$transaction(async (transaction) => {
    for (const notification of notifications) {
      await transaction.userNotification.upsert({
        where: {
          userId_notificationKey: {
            userId: user.id,
            notificationKey: notification.notificationKey,
          },
        },
        create: {
          userId: user.id,
          notificationKey: notification.notificationKey,
          type: UserNotificationType.FESTIVAL_SUMMARY,
          festivalKind: notification.kind,
          regionCode: notification.regionCode,
          regionLabel: notification.regionLabel,
          dateKey: notification.dateKey,
          festivalIds: notification.festivalIds,
          festivalTitles: notification.festivalTitles,
          festivalStartDates: notification.festivalStartDates,
          festivalEndDates: notification.festivalEndDates,
          availableAt: notification.availableAt,
        },
        update: {
          festivalKind: notification.kind,
          regionCode: notification.regionCode,
          regionLabel: notification.regionLabel,
          dateKey: notification.dateKey,
          festivalIds: notification.festivalIds,
          festivalTitles: notification.festivalTitles,
          festivalStartDates: notification.festivalStartDates,
          festivalEndDates: notification.festivalEndDates,
          ...(notification.shouldUpdateAvailableAt
            ? {
                availableAt: notification.availableAt,
              }
            : {}),
        },
      });
    }

    await transaction.userNotification.deleteMany({
      where: {
        userId: user.id,
        OR: [
          {
            availableAt: {
              lt: oldestAllowedAt,
            },
          },
          {
            type: UserNotificationType.FESTIVAL_SUMMARY,
            availableAt: {
              gt: now,
            },
            ...(notificationKeys.length > 0
              ? {
                  notificationKey: {
                    notIn: notificationKeys,
                  },
                }
              : {}),
          },
        ],
      },
    });
  });

  return {
    syncedCount: notifications.length,
  };
}

export async function syncRouteArrivalNotificationInbox(
  prisma: PrismaClient,
  user: User,
  inputs: RouteArrivalNotificationSyncInput[]
) {
  if (inputs.length > MAX_ARRIVAL_NOTIFICATION_SYNC_COUNT) {
    throw new Error("한 번에 동기화할 수 있는 도착 알림 수를 초과했습니다.");
  }

  const now = new Date();
  const oldestAllowedAt = getUserNotificationCutoffAt(now);
  const notificationByKey = new Map(
    inputs.map((input) => {
      const notification = normalizeRouteArrivalNotification(input, now);
      return [notification.notificationKey, notification] as const;
    })
  );
  const candidates = [...notificationByKey.values()].filter(
    (notification) => notification.deliveredAt >= oldestAllowedAt
  );
  const routeIds = [...new Set(candidates.map((item) => item.routeId))];
  const stopIds = [...new Set(candidates.map((item) => item.stopId))];
  const [ownedRoutes, routeStops] = await Promise.all([
    prisma.route.findMany({
      where: {
        id: {
          in: routeIds,
        },
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    }),
    prisma.routeStop.findMany({
      where: {
        id: {
          in: stopIds,
        },
      },
      select: {
        id: true,
        routeId: true,
        dayId: true,
        place: true,
      },
    }),
  ]);
  const ownedRouteIds = new Set(ownedRoutes.map((route) => route.id));
  const stopById = new Map(routeStops.map((stop) => [stop.id, stop]));
  const notifications = candidates.filter((notification) => {
    const stop = stopById.get(notification.stopId);

    return (
      ownedRouteIds.has(notification.routeId) &&
      stop?.routeId === notification.routeId &&
      stop.dayId === notification.dayId
    );
  });

  for (const notification of notifications) {
    const stop = stopById.get(notification.stopId);
    const createData = {
      userId: user.id,
      notificationKey: notification.notificationKey,
      type: UserNotificationType.ROUTE_ARRIVAL,
      routeId: notification.routeId,
      routeTitle: notification.routeTitle,
      dayId: notification.dayId,
      stopId: notification.stopId,
      placeTitle: stop?.place.title ?? notification.placeTitle,
      availableAt: notification.deliveredAt,
    };
    const updateData = {
      routeTitle: notification.routeTitle,
      placeTitle: stop?.place.title ?? notification.placeTitle,
    };

    try {
      await prisma.userNotification.upsert({
        where: {
          userId_notificationKey: {
            userId: user.id,
            notificationKey: notification.notificationKey,
          },
        },
        create: createData,
        update: updateData,
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      await prisma.userNotification.update({
        where: {
          userId_notificationKey: {
            userId: user.id,
            notificationKey: notification.notificationKey,
          },
        },
        data: updateData,
      });
    }
  }

  return {
    syncedCount: notifications.length,
    notificationKeys: notifications.map(
      (notification) => notification.notificationKey
    ),
  };
}

export async function syncRouteReviewNotificationInbox(
  prisma: PrismaClient,
  user: User,
  inputs: RouteReviewNotificationSyncInput[]
) {
  if (inputs.length > MAX_NOTIFICATION_SYNC_COUNT) {
    throw new Error("한 번에 동기화할 수 있는 루트 알림 수를 초과했습니다.");
  }

  const now = new Date();
  const notificationByKey = new Map(
    inputs.map((input) => {
      const notification = normalizeRouteReviewNotification(input, now);
      return [notification.notificationKey, notification] as const;
    })
  );
  const candidates = [...notificationByKey.values()];
  const routeIds = [...new Set(candidates.map((item) => item.routeId))];
  const dayIds = [...new Set(candidates.map((item) => item.dayId))];
  const [ownedRoutes, routeDays] = await Promise.all([
    prisma.route.findMany({
      where: {
        id: {
          in: routeIds,
        },
        ownerId: user.id,
      },
      select: {
        id: true,
      },
    }),
    prisma.routeDay.findMany({
      where: {
        id: {
          in: dayIds,
        },
      },
      select: {
        id: true,
        routeId: true,
      },
    }),
  ]);
  const ownedRouteIds = new Set(ownedRoutes.map((route) => route.id));
  const dayById = new Map(routeDays.map((day) => [day.id, day]));
  const notifications = candidates.filter(
    (notification) =>
      ownedRouteIds.has(notification.routeId) &&
      dayById.get(notification.dayId)?.routeId === notification.routeId
  );
  const notificationKeys = notifications.map(
    (notification) => notification.notificationKey
  );
  const futureNotifications = await prisma.userNotification.findMany({
    where: {
      userId: user.id,
      type: UserNotificationType.ROUTE_REVIEW,
      notificationKey: {
        in: notificationKeys,
      },
      availableAt: {
        gt: now,
      },
    },
    select: {
      notificationKey: true,
    },
  });
  const futureNotificationKeys = new Set(
    futureNotifications.map((notification) => notification.notificationKey)
  );

  await prisma.$transaction(async (transaction) => {
    for (const notification of notifications) {
      await transaction.userNotification.upsert({
        where: {
          userId_notificationKey: {
            userId: user.id,
            notificationKey: notification.notificationKey,
          },
        },
        create: {
          userId: user.id,
          notificationKey: notification.notificationKey,
          type: UserNotificationType.ROUTE_REVIEW,
          routeReviewKind: notification.kind,
          routeId: notification.routeId,
          routeTitle: notification.routeTitle,
          dayId: notification.dayId,
          correctionDeadlineAt: notification.correctionDeadlineAt,
          availableAt: notification.availableAt,
        },
        update: {
          routeReviewKind: notification.kind,
          routeTitle: notification.routeTitle,
          correctionDeadlineAt: notification.correctionDeadlineAt,
          ...(notification.shouldUpdateAvailableAt ||
            futureNotificationKeys.has(notification.notificationKey)
            ? {
                availableAt: notification.availableAt,
              }
            : {}),
        },
      });
    }

    await transaction.userNotification.deleteMany({
      where: {
        userId: user.id,
        type: UserNotificationType.ROUTE_REVIEW,
        availableAt: {
          gt: now,
        },
        ...(notificationKeys.length > 0
          ? {
              notificationKey: {
                notIn: notificationKeys,
              },
            }
          : {}),
      },
    });
  });

  return {
    syncedCount: notifications.length,
  };
}

export async function getNotificationInbox(
  prisma: PrismaClient,
  user: User,
  first?: number | null,
  after?: string | null
) {
  const now = new Date();
  const oldestAllowedAt = getUserNotificationCutoffAt(now);
  const pageSize = normalizeListLimit(first);
  const cursor =
    after == null ? null : decodeNotificationInboxCursor(after);
  const notifications = await prisma.userNotification.findMany({
    where: {
      userId: user.id,
      availableAt: {
        gte: oldestAllowedAt,
        lte: now,
      },
      ...(cursor
        ? {
            OR: [
              {
                availableAt: {
                  lt: cursor.availableAt,
                },
              },
              {
                availableAt: cursor.availableAt,
                id: {
                  lt: cursor.id,
                },
              },
            ],
          }
        : {}),
    },
    orderBy: [
      {
        availableAt: "desc",
      },
      {
        id: "desc",
      },
    ],
    take: pageSize + 1,
  });
  const hasNextPage = notifications.length > pageSize;
  const items = hasNextPage
    ? notifications.slice(0, pageSize)
    : notifications;
  const lastItem = items.at(-1);

  return {
    items,
    pageInfo: {
      hasNextPage,
      endCursor: lastItem
        ? encodeNotificationInboxCursor({
            availableAt: lastItem.availableAt,
            id: lastItem.id,
          })
        : null,
    },
  };
}

export function getUnreadNotificationCount(
  prisma: PrismaClient,
  user: User
) {
  const now = new Date();

  return prisma.userNotification.count({
    where: {
      userId: user.id,
      OR: [
        {
          readAt: null,
        },
        {
          readAt: {
            isSet: false,
          },
        },
      ],
      availableAt: {
        gte: getUserNotificationCutoffAt(now),
        lte: now,
      },
    },
  });
}

export async function markNotificationInboxRead(
  prisma: PrismaClient,
  user: User,
  notificationIds?: string[] | null
) {
  const now = new Date();
  const ids = notificationIds
    ? [...new Set(notificationIds.map((id) => id.trim()).filter(Boolean))]
    : null;

  if (notificationIds && ids?.length === 0) {
    return {
      updatedCount: 0,
    };
  }

  const result = await prisma.userNotification.updateMany({
    where: {
      userId: user.id,
      OR: [
        {
          readAt: null,
        },
        {
          readAt: {
            isSet: false,
          },
        },
      ],
      availableAt: {
        gte: getUserNotificationCutoffAt(now),
        lte: now,
      },
      ...(ids
        ? {
            id: {
              in: ids,
            },
          }
        : {}),
    },
    data: {
      readAt: now,
    },
  });

  return {
    updatedCount: result.count,
  };
}
