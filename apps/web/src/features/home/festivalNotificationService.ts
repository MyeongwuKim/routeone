import { GANGWON_REGIONS } from "@/data/gangwonRegions";
import type { MyRoute } from "@/features/my-route/types";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import {
  nativeBridge,
  type NativeFestivalNotification,
  type NativeFestivalNotificationKind,
} from "@/native-bridge";

type FestivalNotificationSyncOptions = {
  currentRegionCode: string | null;
  festivals: GangwonAttraction[];
  regionLabelByCode: Readonly<Record<string, string>>;
  routes: MyRoute[];
};

const FESTIVAL_NOTIFICATION_HORIZON_DAYS = 90;
const WEEKLY_DIGEST_COUNT = 13;
const MONTHLY_DIGEST_COUNT = 3;
const WEEKLY_DIGEST_HOUR = 9;
const MONTHLY_DIGEST_HOUR = 9;
const MONTHLY_DIGEST_MINUTE = 15;
const TRIP_NOTIFICATION_HOUR = 8;
const TRIP_NOTIFICATION_MINUTE = 30;
const FESTIVAL_NOTIFICATION_KIND_PRIORITY: Record<
  NativeFestivalNotificationKind,
  number
> = {
  trip: 4,
  today: 3,
  weekly: 2,
  monthly: 1,
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toYmd(dateKey: string) {
  return dateKey.replaceAll("-", "");
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function atLocalTime(date: Date, hour: number, minute = 0) {
  const nextDate = new Date(date);
  nextDate.setHours(hour, minute, 0, 0);
  return nextDate;
}

function getNextMonday(now: Date) {
  const daysUntilNextMonday = ((8 - now.getDay()) % 7) || 7;
  return atLocalTime(addDays(now, daysUntilNextMonday), WEEKLY_DIGEST_HOUR);
}

function getNextMonthStart(now: Date) {
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    MONTHLY_DIGEST_HOUR,
    MONTHLY_DIGEST_MINUTE,
    0,
    0
  );
}

function normalizeDateKey(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const dateKey = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
}

function getFestivalEndYmd(festival: GangwonAttraction) {
  return festival.eventEndDate || festival.eventStartDate;
}

function getFestivalsForRegionAndRange(
  festivals: GangwonAttraction[],
  regionCode: string,
  startDateKey: string,
  endDateKey: string
) {
  const startYmd = toYmd(startDateKey);
  const endYmd = toYmd(endDateKey);

  return festivals.filter(
    (festival) =>
      festival.tourApiSigunguCode === regionCode &&
      Boolean(festival.eventStartDate) &&
      festival.eventStartDate <= endYmd &&
      getFestivalEndYmd(festival) >= startYmd
  );
}

function createGroupedNotification({
  dateKey,
  festivals,
  id,
  kind,
  regionCode,
  regionLabel,
  triggerAt,
}: {
  dateKey: string;
  festivals: GangwonAttraction[];
  id: string;
  kind: NativeFestivalNotificationKind;
  regionCode: string;
  regionLabel: string;
  triggerAt: Date | null;
}): NativeFestivalNotification | null {
  const festivalById = new Map(
    festivals.map((festival) => [festival.id, festival])
  );
  const uniqueFestivals = [...festivalById.values()].sort((a, b) =>
    a.title.localeCompare(b.title, "ko")
  );

  if (uniqueFestivals.length === 0) {
    return null;
  }

  return {
    id,
    kind,
    regionCode,
    regionLabel,
    dateKey,
    festivalIds: uniqueFestivals.map((festival) => festival.id),
    festivalTitles: uniqueFestivals.map((festival) => festival.title),
    triggerAt: triggerAt?.toISOString() ?? null,
  };
}

function limitToOneNotificationPerDay(
  notifications: NativeFestivalNotification[]
) {
  const notificationByDeliveryDate = new Map<
    string,
    NativeFestivalNotification
  >();

  notifications.forEach((notification) => {
    const deliveryDateKey = notification.triggerAt
      ? toDateKey(new Date(notification.triggerAt))
      : toDateKey(new Date());
    const currentNotification =
      notificationByDeliveryDate.get(deliveryDateKey);

    if (
      !currentNotification ||
      FESTIVAL_NOTIFICATION_KIND_PRIORITY[notification.kind] >
        FESTIVAL_NOTIFICATION_KIND_PRIORITY[currentNotification.kind]
    ) {
      notificationByDeliveryDate.set(deliveryDateKey, notification);
    }
  });

  return [...notificationByDeliveryDate.values()];
}

function resolveRouteRegionCodes(route: MyRoute, stopRegionCodes: string[]) {
  const supportedRegionCodes = new Set<string>(
    GANGWON_REGIONS.map((region) => region.sigunguCode)
  );
  const regionCodes = new Set(
    [route.primaryRegionCode, ...stopRegionCodes].filter(
      (regionCode): regionCode is string =>
        Boolean(regionCode && supportedRegionCodes.has(regionCode))
    )
  );

  return [...regionCodes];
}

function getRouteDateRegions(routes: MyRoute[], todayKey: string, maxDateKey: string) {
  const regionCodesByDate = new Map<string, Set<string>>();

  const appendDateRegions = (dateKey: string, regionCodes: string[]) => {
    if (dateKey < todayKey || dateKey > maxDateKey) {
      return;
    }

    const currentRegionCodes =
      regionCodesByDate.get(dateKey) ?? new Set<string>();
    regionCodes.forEach((regionCode) => currentRegionCodes.add(regionCode));
    regionCodesByDate.set(dateKey, currentRegionCodes);
  };

  routes.forEach((route) => {
    if (route.status === "COMPLETED") {
      return;
    }

    const datedDays = route.days
      .map((day) => ({
        dateKey: normalizeDateKey(day.date),
        regionCodes: resolveRouteRegionCodes(
          route,
          day.stops
            .map((stop) => stop.place.regionCode)
            .filter((regionCode): regionCode is string => Boolean(regionCode))
        ),
      }))
      .filter(
        (
          day
        ): day is {
          dateKey: string;
          regionCodes: string[];
        } => Boolean(day.dateKey)
      );

    if (datedDays.length > 0) {
      datedDays.forEach((day) =>
        appendDateRegions(day.dateKey, day.regionCodes)
      );
      return;
    }

    const startDateKey = normalizeDateKey(route.travelStartDate);
    const endDateKey = normalizeDateKey(route.travelEndDate);
    const routeRegionCodes = resolveRouteRegionCodes(
      route,
      route.stops
        .map((stop) => stop.place.regionCode)
        .filter((regionCode): regionCode is string => Boolean(regionCode))
    );

    if (!startDateKey || !endDateKey || routeRegionCodes.length === 0) {
      return;
    }

    for (
      let cursor = new Date(`${startDateKey}T12:00:00`);
      toDateKey(cursor) <= endDateKey;
      cursor = addDays(cursor, 1)
    ) {
      appendDateRegions(toDateKey(cursor), routeRegionCodes);
    }
  });

  return regionCodesByDate;
}

function buildFestivalNotifications({
  currentRegionCode,
  festivals,
  regionLabelByCode,
  routes,
}: FestivalNotificationSyncOptions) {
  const now = new Date();
  const todayKey = toDateKey(now);
  const maxDateKey = toDateKey(
    addDays(now, FESTIVAL_NOTIFICATION_HORIZON_DAYS)
  );
  const notifications: NativeFestivalNotification[] = [];

  if (currentRegionCode) {
    const regionLabel =
      regionLabelByCode[currentRegionCode] ?? currentRegionCode;
    const todayNotification = createGroupedNotification({
      dateKey: todayKey,
      festivals: getFestivalsForRegionAndRange(
        festivals,
        currentRegionCode,
        todayKey,
        todayKey
      ),
      id: `festival:today:${currentRegionCode}:${todayKey}`,
      kind: "today",
      regionCode: currentRegionCode,
      regionLabel,
      triggerAt: null,
    });

    if (todayNotification) {
      notifications.push(todayNotification);
    }

    const firstWeeklyDigest = getNextMonday(now);

    for (let index = 0; index < WEEKLY_DIGEST_COUNT; index += 1) {
      const triggerAt = addDays(firstWeeklyDigest, index * 7);
      const startDateKey = toDateKey(triggerAt);

      if (startDateKey > maxDateKey) {
        break;
      }

      const endDateKey = toDateKey(addDays(triggerAt, 6));
      const notification = createGroupedNotification({
        dateKey: startDateKey,
        festivals: getFestivalsForRegionAndRange(
          festivals,
          currentRegionCode,
          startDateKey,
          endDateKey
        ),
        id: `festival:weekly:${currentRegionCode}:${startDateKey}`,
        kind: "weekly",
        regionCode: currentRegionCode,
        regionLabel,
        triggerAt,
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    const firstMonthlyDigest = getNextMonthStart(now);

    for (let index = 0; index < MONTHLY_DIGEST_COUNT; index += 1) {
      const triggerAt = new Date(
        firstMonthlyDigest.getFullYear(),
        firstMonthlyDigest.getMonth() + index,
        1,
        MONTHLY_DIGEST_HOUR,
        MONTHLY_DIGEST_MINUTE,
        0,
        0
      );
      const startDateKey = toDateKey(triggerAt);

      if (startDateKey > maxDateKey) {
        break;
      }

      const monthEnd = new Date(
        triggerAt.getFullYear(),
        triggerAt.getMonth() + 1,
        0,
        12
      );
      const notification = createGroupedNotification({
        dateKey: startDateKey,
        festivals: getFestivalsForRegionAndRange(
          festivals,
          currentRegionCode,
          startDateKey,
          toDateKey(monthEnd)
        ),
        id: `festival:monthly:${currentRegionCode}:${startDateKey}`,
        kind: "monthly",
        regionCode: currentRegionCode,
        regionLabel,
        triggerAt,
      });

      if (notification) {
        notifications.push(notification);
      }
    }
  }

  const routeDateRegions = getRouteDateRegions(routes, todayKey, maxDateKey);

  routeDateRegions.forEach((regionCodes, dateKey) => {
    regionCodes.forEach((regionCode) => {
      if (dateKey === todayKey && regionCode === currentRegionCode) {
        return;
      }

      const tripDate = new Date(`${dateKey}T12:00:00`);
      const scheduledAt = atLocalTime(
        tripDate,
        TRIP_NOTIFICATION_HOUR,
        TRIP_NOTIFICATION_MINUTE
      );
      const triggerAt = scheduledAt.getTime() > now.getTime() ? scheduledAt : null;
      const notification = createGroupedNotification({
        dateKey,
        festivals: getFestivalsForRegionAndRange(
          festivals,
          regionCode,
          dateKey,
          dateKey
        ),
        id: `festival:trip:${regionCode}:${dateKey}`,
        kind: "trip",
        regionCode,
        regionLabel: regionLabelByCode[regionCode] ?? regionCode,
        triggerAt,
      });

      if (notification) {
        notifications.push(notification);
      }
    });
  });

  return limitToOneNotificationPerDay(notifications);
}

export async function syncFestivalNotifications(
  options: FestivalNotificationSyncOptions
) {
  try {
    return await nativeBridge.notifications.syncFestivals(
      buildFestivalNotifications(options)
    );
  } catch (error) {
    console.warn(
      "[festival-notifications] sync failed",
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
