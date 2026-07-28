import {
  FestivalNotificationKind,
  RouteReviewNotificationKind,
  RouteStatus,
  UserNotificationPushStatus,
  UserNotificationType,
  VisitStatus,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import {
  fetchGangwonFestivalSource,
  filterFestivalsForRegionAndRange,
  hasFestivalCoordinates,
  type FestivalSourceRecord,
} from "./festivalSource.service.js";
import { GANGWON_REGION_BY_CODE } from "./notificationSettings.service.js";
import { deliverPendingNotifications } from "./pushDelivery.service.js";

const KST_OFFSET_MS = 1000 * 60 * 60 * 9;
const ROUTE_CORRECTION_GRACE_DAYS = 7;
const SUPPORTED_REGION_CODES = new Set(
  Object.keys(GANGWON_REGION_BY_CODE)
);

function toDateKey(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function toStoredDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatFestivalDateKey(ymd: string) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

function atKst(dateKey: string, hour: number, minute = 0) {
  const hourText = String(hour).padStart(2, "0");
  const minuteText = String(minute).padStart(2, "0");
  return new Date(`${dateKey}T${hourText}:${minuteText}:00+09:00`);
}

function getDayOfWeek(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function getWeekRange(todayKey: string) {
  const dayOfWeek = getDayOfWeek(todayKey);
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const startDateKey = addDays(todayKey, -daysSinceMonday);

  return {
    startDateKey,
    endDateKey: addDays(startDateKey, 6),
  };
}

function formatRouteDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}.${Number(day)}`;
}

function getRouteTitle(startDate: Date | null, endDate: Date | null) {
  if (!startDate) {
    return "날짜 미정 일정";
  }

  const startDateKey = toStoredDateKey(startDate);
  const endDateKey = endDate ? toStoredDateKey(endDate) : startDateKey;
  const startLabel = formatRouteDate(startDateKey);
  const endLabel = formatRouteDate(endDateKey);

  return startLabel === endLabel
    ? `${startLabel} 일정`
    : `${startLabel} ~ ${endLabel} 일정`;
}

async function upsertPendingNotification(
  prisma: PrismaClient,
  input: Prisma.UserNotificationUncheckedCreateInput
) {
  const existing = await prisma.userNotification.findUnique({
    where: {
      userId_notificationKey: {
        userId: input.userId,
        notificationKey: input.notificationKey,
      },
    },
  });

  if (!existing) {
    try {
      return await prisma.userNotification.create({
        data: input,
      });
    } catch {
      return prisma.userNotification.findUnique({
        where: {
          userId_notificationKey: {
            userId: input.userId,
            notificationKey: input.notificationKey,
          },
        },
      });
    }
  }

  if (existing.pushStatus === null) {
    return prisma.userNotification.update({
      where: {
        id: existing.id,
      },
      data: {
        pushStatus: UserNotificationPushStatus.PENDING,
        expiresAt: input.expiresAt,
      },
    });
  }

  return existing;
}

async function createRouteReviewNotifications(
  prisma: PrismaClient,
  now: Date
) {
  const todayKey = toDateKey(now);
  const oldestEndDate = new Date(
    `${addDays(todayKey, -ROUTE_CORRECTION_GRACE_DAYS - 1)}T00:00:00.000Z`
  );
  const routes = await prisma.route.findMany({
    where: {
      travelEndDate: {
        not: null,
        gte: oldestEndDate,
        lte: now,
      },
      totalStopCount: {
        gt: 0,
      },
      owner: {
        notificationSetting: {
          is: {
            routeReviewEnabled: true,
          },
        },
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
  });

  for (const route of routes) {
    if (!route.travelEndDate || route.days.length === 0) {
      continue;
    }

    const endDateKey = toStoredDateKey(route.travelEndDate);
    const reviewAt = atKst(addDays(endDateKey, 1), 9);
    const expiresAt = atKst(
      addDays(endDateKey, ROUTE_CORRECTION_GRACE_DAYS),
      23,
      59
    );

    if (reviewAt > now || expiresAt <= now) {
      continue;
    }

    const incompleteDay = route.days.find((day) =>
      day.stops.some((stop) => stop.visitStatus !== VisitStatus.VISITED)
    );
    const reviewDay = incompleteDay ?? route.days.at(-1);

    if (!reviewDay) {
      continue;
    }

    const kind =
      route.status === RouteStatus.COMPLETED
        ? RouteReviewNotificationKind.COMPLETED
        : route.startedAt
          ? RouteReviewNotificationKind.INCOMPLETE
          : RouteReviewNotificationKind.UNSTARTED;

    await upsertPendingNotification(prisma, {
      userId: route.ownerId,
      notificationKey: `route-review:${route.id}:${endDateKey}`,
      type: UserNotificationType.ROUTE_REVIEW,
      routeReviewKind: kind,
      routeId: route.id,
      routeTitle: getRouteTitle(
        route.travelStartDate,
        route.travelEndDate
      ),
      dayId: reviewDay.id,
      correctionDeadlineAt: expiresAt,
      availableAt: reviewAt,
      expiresAt,
      pushStatus: UserNotificationPushStatus.PENDING,
    });
  }
}

async function createFestivalNotification(
  prisma: PrismaClient,
  {
    dateKey,
    endDateKey,
    expiresAt,
    festivals,
    kind,
    notificationKey,
    regionCode,
    triggerAt,
    userId,
  }: {
    dateKey: string;
    endDateKey: string;
    expiresAt: Date;
    festivals: FestivalSourceRecord[];
    kind: FestivalNotificationKind;
    notificationKey: string;
    regionCode: string;
    triggerAt: Date;
    userId: string;
  }
) {
  const matchingFestivals = filterFestivalsForRegionAndRange(
    festivals,
    regionCode,
    dateKey,
    endDateKey
  ).filter(hasFestivalCoordinates);

  if (matchingFestivals.length === 0) {
    return;
  }

  await upsertPendingNotification(prisma, {
    userId,
    notificationKey,
    type: UserNotificationType.FESTIVAL_SUMMARY,
    festivalKind: kind,
    regionCode,
    regionLabel:
      GANGWON_REGION_BY_CODE[
        regionCode as keyof typeof GANGWON_REGION_BY_CODE
      ],
    dateKey,
    festivalIds: matchingFestivals.map((festival) => festival.id),
    festivalTitles: matchingFestivals.map((festival) => festival.title),
    festivalStartDates: matchingFestivals.map((festival) =>
      formatFestivalDateKey(festival.startYmd)
    ),
    festivalEndDates: matchingFestivals.map((festival) =>
      formatFestivalDateKey(festival.endYmd)
    ),
    availableAt: triggerAt,
    expiresAt,
    pushStatus: UserNotificationPushStatus.PENDING,
  });
}

async function createFestivalNotifications(
  prisma: PrismaClient,
  now: Date
) {
  const todayKey = toDateKey(now);
  const settings = await prisma.userNotificationSetting.findMany({
    where: {
      festivalEnabled: true,
    },
  });

  if (settings.length === 0) {
    return;
  }

  let festivals: FestivalSourceRecord[];

  try {
    festivals = await fetchGangwonFestivalSource(now);
  } catch (error) {
    console.warn(
      "[notification-scheduler] festival lookup skipped",
      error instanceof Error ? error.message : error
    );
    return;
  }

  const week = getWeekRange(todayKey);
  const weeklyAt = atKst(week.startDateKey, 9);
  const weeklyRangeEndKey = addDays(todayKey, 6);

  for (const setting of settings) {
    for (const regionCode of setting.festivalRegionCodes) {
      if (!SUPPORTED_REGION_CODES.has(regionCode)) {
        continue;
      }

      if (weeklyAt <= now) {
        await createFestivalNotification(prisma, {
          userId: setting.userId,
          notificationKey: `festival:weekly:${week.startDateKey}:${regionCode}`,
          kind: FestivalNotificationKind.WEEKLY,
          regionCode,
          dateKey: todayKey,
          endDateKey: weeklyRangeEndKey,
          triggerAt: weeklyAt,
          expiresAt: atKst(weeklyRangeEndKey, 23, 59),
          festivals,
        });
      }
    }
  }

  const tripAt = atKst(todayKey, 8, 30);

  if (tripAt > now) {
    return;
  }

  const routeDays = await prisma.routeDay.findMany({
    where: {
      date: {
        gte: new Date(`${todayKey}T00:00:00.000Z`),
        lt: new Date(`${addDays(todayKey, 1)}T00:00:00.000Z`),
      },
      route: {
        status: {
          not: RouteStatus.COMPLETED,
        },
        owner: {
          notificationSetting: {
            is: {
              festivalEnabled: true,
            },
          },
        },
      },
    },
    include: {
      route: {
        select: {
          id: true,
          ownerId: true,
          primaryRegionCode: true,
        },
      },
      stops: {
        select: {
          place: true,
        },
      },
    },
  });

  for (const routeDay of routeDays) {
    const regionCodes = new Set(
      [
        routeDay.route.primaryRegionCode,
        ...routeDay.stops.map((stop) => stop.place.regionCode),
      ].filter(
        (regionCode): regionCode is string =>
          Boolean(regionCode && SUPPORTED_REGION_CODES.has(regionCode))
      )
    );

    for (const regionCode of regionCodes) {
      await createFestivalNotification(prisma, {
        userId: routeDay.route.ownerId,
        notificationKey: `festival:trip:${routeDay.route.id}:${routeDay.id}:${regionCode}`,
        kind: FestivalNotificationKind.TRIP,
        regionCode,
        dateKey: todayKey,
        endDateKey: todayKey,
        triggerAt: tripAt,
        expiresAt: atKst(todayKey, 23, 59),
        festivals,
      });
    }
  }
}

export async function runNotificationSchedulerOnce(
  prisma: PrismaClient,
  now = new Date()
) {
  await prisma.userNotification.updateMany({
    where: {
      festivalKind: FestivalNotificationKind.MONTHLY,
      pushStatus: {
        in: [
          UserNotificationPushStatus.PENDING,
          UserNotificationPushStatus.FAILED,
        ],
      },
    },
    data: {
      pushStatus: UserNotificationPushStatus.CANCELED,
      nextPushAttemptAt: null,
      pushError: "월간 축제 알림이 주간 알림으로 통합되었습니다.",
    },
  });

  await createRouteReviewNotifications(prisma, now);
  await createFestivalNotifications(prisma, now);
  await deliverPendingNotifications(prisma, now);

  await prisma.userNotification.updateMany({
    where: {
      pushStatus: {
        in: [
          UserNotificationPushStatus.PENDING,
          UserNotificationPushStatus.FAILED,
        ],
      },
      expiresAt: {
        lte: now,
      },
    },
    data: {
      pushStatus: UserNotificationPushStatus.CANCELED,
      nextPushAttemptAt: null,
      pushError: "알림 발송 가능 기간이 지났습니다.",
    },
  });
}

export function startNotificationScheduler(prisma: PrismaClient) {
  const parsedInterval = Number(
    process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS
  );
  const intervalMs = Number.isFinite(parsedInterval)
    ? Math.max(15_000, parsedInterval)
    : 60_000;
  let isRunning = false;

  const run = async () => {
    if (isRunning) {
      return;
    }

    isRunning = true;
    try {
      await runNotificationSchedulerOnce(prisma);
    } catch (error) {
      console.error("[notification-scheduler] run failed", error);
    } finally {
      isRunning = false;
    }
  };

  void run();
  const intervalId = setInterval(() => void run(), intervalMs);
  intervalId.unref();

  return () => clearInterval(intervalId);
}
