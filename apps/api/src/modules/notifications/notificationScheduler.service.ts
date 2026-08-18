import {
  FestivalNotificationKind,
  RouteReviewNotificationKind,
  RouteStatus,
  UserNotificationPushStatus,
  UserNotificationType,
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
const DAY_MS = 1000 * 60 * 60 * 24;
const ROUTE_START_REMINDER_MS = 1000 * 60 * 60;
const ROUTE_START_OVERDUE_DELAY_MS = 1000 * 60 * 30;
const ROUTE_START_LOOKAHEAD_DAYS = 2;
const ROUTE_CORRECTION_GRACE_DAYS = 7;
const ROUTE_REVIEW_DELAY_MS = DAY_MS;
const NOTIFICATION_WINDOW_START_HOUR = 9;
const NOTIFICATION_WINDOW_END_HOUR = 21;
const MULTIPLE_REGION_CODE = "MULTIPLE";
const MAX_FESTIVALS_PER_NOTIFICATION = 100;
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

function getKstParts(date: Date) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);

  return {
    dateKey: shifted.toISOString().slice(0, 10),
    hour: shifted.getUTCHours(),
  };
}

function isNotificationDeliveryWindow(date: Date) {
  const { hour } = getKstParts(date);

  return (
    hour >= NOTIFICATION_WINDOW_START_HOUR &&
    hour < NOTIFICATION_WINDOW_END_HOUR
  );
}

function moveIntoNotificationDeliveryWindow(date: Date) {
  const { dateKey, hour } = getKstParts(date);

  if (hour < NOTIFICATION_WINDOW_START_HOUR) {
    return atKst(dateKey, NOTIFICATION_WINDOW_START_HOUR);
  }

  if (hour >= NOTIFICATION_WINDOW_END_HOUR) {
    return atKst(addDays(dateKey, 1), NOTIFICATION_WINDOW_START_HOUR);
  }

  return date;
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

type RouteStartNotificationInput = {
  userId: string;
  routeId: string;
  routeTitle: string;
  dayId: string;
  dayIndex: number;
  kind: "UPCOMING" | "OVERDUE";
  routeStartAt: Date;
  availableAt: Date;
  expiresAt: Date;
};

async function upsertRouteStartNotification(
  prisma: PrismaClient,
  input: RouteStartNotificationInput
) {
  const notificationKey =
    input.kind === "OVERDUE"
      ? `route-start-overdue:${input.routeId}:${input.dayId}`
      : `route-start:${input.routeId}:${input.dayId}`;
  const existing = await prisma.userNotification.findUnique({
    where: {
      userId_notificationKey: {
        userId: input.userId,
        notificationKey,
      },
    },
  });

  if (!existing) {
    try {
      await prisma.userNotification.create({
        data: {
          userId: input.userId,
          notificationKey,
          type: UserNotificationType.ROUTE_START,
          routeId: input.routeId,
          routeTitle: input.routeTitle,
          dayId: input.dayId,
          routeDayIndex: input.dayIndex,
          routeStartAt: input.routeStartAt,
          availableAt: input.availableAt,
          expiresAt: input.expiresAt,
          pushStatus: UserNotificationPushStatus.PENDING,
        },
      });
    } catch (error) {
      const duplicatedNotification =
        await prisma.userNotification.findUnique({
          where: {
            userId_notificationKey: {
              userId: input.userId,
              notificationKey,
            },
          },
          select: {
            id: true,
          },
        });

      if (!duplicatedNotification) {
        throw error;
      }
    }

    return notificationKey;
  }

  if (
    existing.pushStatus === UserNotificationPushStatus.SENT ||
    existing.pushStatus === UserNotificationPushStatus.SENDING
  ) {
    return notificationKey;
  }

  const hasScheduleChanged =
    existing.routeStartAt?.getTime() !== input.routeStartAt.getTime() ||
    existing.availableAt.getTime() !== input.availableAt.getTime() ||
    existing.expiresAt?.getTime() !== input.expiresAt.getTime() ||
    existing.routeDayIndex !== input.dayIndex ||
    existing.routeTitle !== input.routeTitle;

  if (
    !hasScheduleChanged &&
    existing.pushStatus !== UserNotificationPushStatus.CANCELED
  ) {
    return notificationKey;
  }

  await prisma.userNotification.update({
    where: {
      id: existing.id,
    },
    data: {
      routeTitle: input.routeTitle,
      routeDayIndex: input.dayIndex,
      routeStartAt: input.routeStartAt,
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
      pushStatus: UserNotificationPushStatus.PENDING,
      pushAttemptCount: 0,
      pushClaimedAt: null,
      pushSentAt: null,
      pushTicketIds: [],
      pushError: null,
      nextPushAttemptAt: null,
    },
  });

  return notificationKey;
}

async function createRouteStartNotifications(
  prisma: PrismaClient,
  now: Date
) {
  const todayKey = toDateKey(now);
  const horizonEndKey = addDays(todayKey, ROUTE_START_LOOKAHEAD_DAYS);
  const horizonEndAt = atKst(horizonEndKey, 0);
  const routeDays = await prisma.routeDay.findMany({
    where: {
      date: {
        gte: new Date(`${todayKey}T00:00:00.000Z`),
        lt: new Date(`${horizonEndKey}T00:00:00.000Z`),
      },
      stops: {
        some: {},
      },
      route: {
        status: {
          not: RouteStatus.COMPLETED,
        },
        OR: [
          {
            dailyStartMinutes: {
              not: null,
            },
          },
          {
            days: {
              some: {
                plannedStartMinutes: {
                  not: null,
                },
              },
            },
          },
        ],
        owner: {
          pushDevices: {
            some: {
              enabled: true,
              sessionExpiresAt: {
                gt: now,
              },
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
          travelStartDate: true,
          travelEndDate: true,
          dailyStartMinutes: true,
          scheduleEndMinutes: true,
          startedAt: true,
          owner: {
            select: {
              notificationSetting: {
                select: {
                  routeStartEnabled: true,
                },
              },
            },
          },
        },
      },
      stops: {
        select: {
          visitStatus: true,
          checkedInAt: true,
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  });
  const activeNotificationKeys: string[] = [];

  for (const routeDay of routeDays) {
    const { route } = routeDay;
    const dailyStartMinutes =
      routeDay.plannedStartMinutes ?? route.dailyStartMinutes;
    const hasDayActivity = routeDay.stops.some(
      (stop) => stop.visitStatus === "VISITED" || Boolean(stop.checkedInAt)
    );

    if (
      !routeDay.date ||
      typeof dailyStartMinutes !== "number" ||
      hasDayActivity ||
      Boolean(routeDay.startedAt) ||
      route.owner.notificationSetting?.routeStartEnabled === false
    ) {
      continue;
    }

    const dateKey = toStoredDateKey(routeDay.date);
    const routeStartAt = atKst(
      dateKey,
      Math.floor(dailyStartMinutes / 60),
      dailyStartMinutes % 60
    );

    const routeTitle = getRouteTitle(
      route.travelStartDate,
      route.travelEndDate
    );

    if (routeStartAt > now) {
      const notificationKey = await upsertRouteStartNotification(prisma, {
        userId: route.ownerId,
        routeId: route.id,
        routeTitle,
        dayId: routeDay.id,
        dayIndex: routeDay.dayIndex,
        kind: "UPCOMING",
        routeStartAt,
        availableAt: new Date(
          routeStartAt.getTime() - ROUTE_START_REMINDER_MS
        ),
        expiresAt: routeStartAt,
      });
      activeNotificationKeys.push(notificationKey);
      continue;
    }

    const overdueAvailableAt = new Date(
      routeStartAt.getTime() + ROUTE_START_OVERDUE_DELAY_MS
    );
    const scheduleEndMinutes = route.scheduleEndMinutes;
    const overdueExpiresAt =
      typeof scheduleEndMinutes === "number"
        ? atKst(
            dateKey,
            Math.floor(scheduleEndMinutes / 60),
            scheduleEndMinutes % 60
          )
        : atKst(addDays(dateKey, 1), 0);

    if (overdueAvailableAt > now || overdueExpiresAt <= now) {
      continue;
    }

    const notificationKey = await upsertRouteStartNotification(prisma, {
      userId: route.ownerId,
      routeId: route.id,
      routeTitle,
      dayId: routeDay.id,
      dayIndex: routeDay.dayIndex,
      kind: "OVERDUE",
      routeStartAt,
      availableAt: overdueAvailableAt,
      expiresAt: overdueExpiresAt,
    });
    activeNotificationKeys.push(notificationKey);
  }

  await prisma.userNotification.deleteMany({
    where: {
      type: UserNotificationType.ROUTE_START,
      pushStatus: {
        in: [
          UserNotificationPushStatus.PENDING,
          UserNotificationPushStatus.FAILED,
          UserNotificationPushStatus.CANCELED,
        ],
      },
      routeStartAt: {
        lt: horizonEndAt,
      },
      ...(activeNotificationKeys.length > 0
        ? {
            notificationKey: {
              notIn: activeNotificationKeys,
            },
          }
        : {}),
    },
  });
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
      completedAt: {
        not: null,
        lte: now,
      },
      status: RouteStatus.COMPLETED,
      totalStopCount: {
        gt: 0,
      },
      owner: {
        notificationSetting: {
          is: {
            routeReviewEnabled: true,
          },
        },
        pushDevices: {
          some: {
            enabled: true,
            sessionExpiresAt: {
              gt: now,
            },
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
              id: true,
            },
          },
        },
      },
    },
  });

  const routeIds = routes.map((route) => route.id);
  const existingRouteReviews = routeIds.length
    ? await prisma.userNotification.findMany({
        where: {
          type: UserNotificationType.ROUTE_REVIEW,
          routeId: {
            in: routeIds,
          },
          NOT: {
            notificationKey: {
              startsWith: "route-review:test:",
            },
          },
        },
        select: {
          routeId: true,
        },
      })
    : [];
  const reviewedRouteIds = new Set(
    existingRouteReviews
      .map((notification) => notification.routeId)
      .filter((routeId): routeId is string => Boolean(routeId))
  );

  for (const route of routes) {
    if (
      !route.travelEndDate ||
      !route.completedAt ||
      route.days.length === 0 ||
      reviewedRouteIds.has(route.id)
    ) {
      continue;
    }

    const endDateKey = toStoredDateKey(route.travelEndDate);
    const reviewAt = moveIntoNotificationDeliveryWindow(
      new Date(route.completedAt.getTime() + ROUTE_REVIEW_DELAY_MS)
    );
    const expiresAt = atKst(
      addDays(endDateKey, ROUTE_CORRECTION_GRACE_DAYS),
      23,
      59
    );

    if (reviewAt >= expiresAt || expiresAt <= now) {
      continue;
    }

    const reviewDay = route.days
      .filter((day) => day.stops.length > 0)
      .at(-1);

    if (!reviewDay) {
      continue;
    }

    await upsertPendingNotification(prisma, {
      userId: route.ownerId,
      notificationKey: `route-review:${route.id}`,
      type: UserNotificationType.ROUTE_REVIEW,
      routeReviewKind: RouteReviewNotificationKind.COMPLETED,
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

async function upsertDailyFestivalNotification(
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
    } catch (error) {
      const duplicatedNotification =
        await prisma.userNotification.findUnique({
          where: {
            userId_notificationKey: {
              userId: input.userId,
              notificationKey: input.notificationKey,
            },
          },
        });

      if (!duplicatedNotification) {
        throw error;
      }

      return upsertDailyFestivalNotification(prisma, input);
    }
  }

  if (
    existing.pushStatus === UserNotificationPushStatus.SENT ||
    existing.pushStatus === UserNotificationPushStatus.SENDING
  ) {
    return existing;
  }

  return prisma.userNotification.update({
    where: {
      id: existing.id,
    },
    data: {
      festivalKind: input.festivalKind,
      regionCode: input.regionCode,
      regionLabel: input.regionLabel,
      dateKey: input.dateKey,
      festivalIds: input.festivalIds,
      festivalTitles: input.festivalTitles,
      festivalStartDates: input.festivalStartDates,
      festivalEndDates: input.festivalEndDates,
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
      pushStatus: UserNotificationPushStatus.PENDING,
      nextPushAttemptAt: null,
      pushError: null,
    },
  });
}

type FestivalEvaluationTarget = {
  evaluationKey: string;
  settingId: string;
  userId: string;
  selectedRegionCodes: string[];
  tripRegionCodes: string[];
};

function getMatchingFestivals(
  festivals: FestivalSourceRecord[],
  regionCodes: string[],
  dateKey: string,
  endDateKey: string
) {
  const festivalById = new Map<string, FestivalSourceRecord>();

  for (const regionCode of regionCodes) {
    filterFestivalsForRegionAndRange(
      festivals,
      regionCode,
      dateKey,
      endDateKey
    )
      .filter(hasFestivalCoordinates)
      .forEach((festival) => festivalById.set(festival.id, festival));
  }

  return [...festivalById.values()];
}

async function createFestivalNotifications(
  prisma: PrismaClient,
  now: Date
) {
  if (!isNotificationDeliveryWindow(now)) {
    return;
  }

  const todayKey = toDateKey(now);
  const dailyAt = atKst(todayKey, NOTIFICATION_WINDOW_START_HOUR);

  if (dailyAt > now) {
    return;
  }

  const settings = await prisma.userNotificationSetting.findMany({
    where: {
      festivalEnabled: true,
      user: {
        pushDevices: {
          some: {
            enabled: true,
            sessionExpiresAt: {
              gt: now,
            },
          },
        },
      },
    },
  });

  if (settings.length === 0) {
    return;
  }

  const selectedRangeEndKey = addDays(todayKey, 6);
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
  const tripRegionsByUser = new Map<
    string,
    { regionCodes: Set<string>; signatureParts: string[] }
  >();

  for (const routeDay of routeDays) {
    const regionCodes = [
      ...new Set(
        [
          routeDay.route.primaryRegionCode,
          ...routeDay.stops.map((stop) => stop.place.regionCode),
        ].filter(
          (regionCode): regionCode is string =>
            Boolean(regionCode && SUPPORTED_REGION_CODES.has(regionCode))
        )
      ),
    ].sort();

    if (regionCodes.length === 0) {
      continue;
    }

    const target = tripRegionsByUser.get(routeDay.route.ownerId) ?? {
      regionCodes: new Set<string>(),
      signatureParts: [],
    };
    regionCodes.forEach((regionCode) => target.regionCodes.add(regionCode));
    target.signatureParts.push(`${routeDay.id}:${regionCodes.join(",")}`);
    tripRegionsByUser.set(routeDay.route.ownerId, target);
  }

  const targets: FestivalEvaluationTarget[] = [];
  const settingsWithoutTargets: Array<{
    evaluationKey: string;
    settingId: string;
  }> = [];

  for (const setting of settings) {
    const selectedRegionCodes = setting.festivalRegionCodes
      .filter((regionCode) => SUPPORTED_REGION_CODES.has(regionCode))
      .sort();
    const tripTarget = tripRegionsByUser.get(setting.userId);
    const tripRegionCodes = [...(tripTarget?.regionCodes ?? [])].sort();
    const evaluationKey = [
      `date:${todayKey}`,
      `regions:${selectedRegionCodes.join(",")}`,
      `trips:${(tripTarget?.signatureParts ?? []).sort().join(";")}`,
    ].join("|");

    if (setting.festivalLastEvaluationKey === evaluationKey) {
      continue;
    }

    if (selectedRegionCodes.length === 0 && tripRegionCodes.length === 0) {
      settingsWithoutTargets.push({
        settingId: setting.id,
        evaluationKey,
      });
      continue;
    }

    targets.push({
      settingId: setting.id,
      userId: setting.userId,
      evaluationKey,
      selectedRegionCodes,
      tripRegionCodes,
    });
  }

  await Promise.all(
    settingsWithoutTargets.map(({ settingId, evaluationKey }) =>
      prisma.userNotificationSetting.update({
        where: {
          id: settingId,
        },
        data: {
          festivalLastEvaluationKey: evaluationKey,
        },
      })
    )
  );

  if (targets.length === 0) {
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

  for (const target of targets) {
    const selectedFestivals = getMatchingFestivals(
      festivals,
      target.selectedRegionCodes,
      todayKey,
      selectedRangeEndKey
    );
    const tripFestivals = getMatchingFestivals(
      festivals,
      target.tripRegionCodes,
      todayKey,
      todayKey
    );
    const festivalById = new Map<string, FestivalSourceRecord>();
    [...selectedFestivals, ...tripFestivals].forEach((festival) =>
      festivalById.set(festival.id, festival)
    );
    const matchingFestivals = [...festivalById.values()]
      .sort(
        (left, right) =>
          left.startYmd.localeCompare(right.startYmd) ||
          left.title.localeCompare(right.title, "ko")
      )
      .slice(0, MAX_FESTIVALS_PER_NOTIFICATION);

    if (matchingFestivals.length > 0) {
      const matchingRegionCodes = [
        ...new Set(matchingFestivals.map((festival) => festival.regionCode)),
      ];
      const hasTripFestival = tripFestivals.length > 0;
      const kind = hasTripFestival
        ? FestivalNotificationKind.TRIP
        : FestivalNotificationKind.WEEKLY;
      const regionLabels = matchingRegionCodes.map(
        (regionCode) =>
          GANGWON_REGION_BY_CODE[
            regionCode as keyof typeof GANGWON_REGION_BY_CODE
          ]
      );

      await upsertDailyFestivalNotification(prisma, {
        userId: target.userId,
        notificationKey: `festival:daily:${todayKey}`,
        type: UserNotificationType.FESTIVAL_SUMMARY,
        festivalKind: kind,
        regionCode:
          matchingRegionCodes.length === 1
            ? matchingRegionCodes[0]
            : MULTIPLE_REGION_CODE,
        regionLabel: regionLabels.join(", "),
        dateKey: todayKey,
        festivalIds: matchingFestivals.map((festival) => festival.id),
        festivalTitles: matchingFestivals.map((festival) => festival.title),
        festivalStartDates: matchingFestivals.map((festival) =>
          formatFestivalDateKey(festival.startYmd)
        ),
        festivalEndDates: matchingFestivals.map((festival) =>
          formatFestivalDateKey(festival.endYmd)
        ),
        availableAt: dailyAt,
        expiresAt: atKst(
          kind === FestivalNotificationKind.TRIP
            ? todayKey
            : selectedRangeEndKey,
          23,
          59
        ),
        pushStatus: UserNotificationPushStatus.PENDING,
      });
    }

    await prisma.userNotificationSetting.update({
      where: {
        id: target.settingId,
      },
      data: {
        festivalLastEvaluationKey: target.evaluationKey,
      },
    });
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

  await createRouteStartNotifications(prisma, now);
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
