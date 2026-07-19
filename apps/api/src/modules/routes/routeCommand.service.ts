import type { PrismaClient, User } from "@prisma/client";
import {
  addDays,
  assertRouteOwner,
  buildRouteShareTags,
  getPlaceDuplicateKeys,
  normalizePlaceSnapshot,
  nullableString,
  refreshRouteProgress,
} from "./route.shared.js";
import type {
  AppendRouteDaysInput,
  CloneRouteInput,
  CreateRouteInput,
  CreateRouteStopInput,
  ReorderRouteStopsInput,
  RouteStartLocationInput,
  StartRouteInput,
  UpdateRouteStopStayMinutesInput,
} from "./route.types.js";
import { syncPlaceStayStatForRouteStopChange } from "./routeVisit.service.js";

function clampTripDays(value: number) {
  return Math.max(1, Math.min(30, Math.round(value || 1)));
}

function normalizeRouteStopDayIndex(
  value: number | null | undefined,
  tripDays: number
) {
  const dayIndex = Number.isFinite(value) ? Math.round(value ?? 1) : 1;
  return Math.max(1, Math.min(tripDays, dayIndex));
}

function normalizeRouteStopDayInputs(
  tripDays: number,
  stops: CreateRouteStopInput[]
) {
  const requestedTripDays = clampTripDays(tripDays);
  const normalizedStops = stops.map((stop) => ({
    ...stop,
    dayIndex: normalizeRouteStopDayIndex(stop.dayIndex, requestedTripDays),
  }));

  if (normalizedStops.length === 0) {
    return {
      tripDays: 1,
      stops: normalizedStops,
    };
  }

  const usedDayIndexes = [
    ...new Set(normalizedStops.map((stop) => stop.dayIndex)),
  ].sort((left, right) => left - right);
  const compactDayIndexByOriginal = new Map(
    usedDayIndexes.map((dayIndex, index) => [dayIndex, index + 1] as const)
  );

  return {
    tripDays: usedDayIndexes.length,
    stops: normalizedStops.map((stop) => ({
      ...stop,
      dayIndex: compactDayIndexByOriginal.get(stop.dayIndex) ?? 1,
    })),
  };
}

function assertValidDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new Error("시작 날짜가 올바르지 않습니다.");
  }
}

async function assertNoRouteDateConflict(
  prisma: PrismaClient,
  ownerId: string,
  travelStartDate: Date | null,
  travelEndDate: Date | null,
  excludeRouteId?: string
) {
  if (!travelStartDate || !travelEndDate) {
    return;
  }

  const existingRoute = await prisma.route.findFirst({
    where: {
      ownerId,
      status: {
        in: ["DRAFT", "ACTIVE"],
      },
      travelStartDate: {
        lte: travelEndDate,
      },
      travelEndDate: {
        gte: travelStartDate,
      },
      ...(excludeRouteId
        ? {
            id: {
              not: excludeRouteId,
            },
          }
        : {}),
    },
  });

  if (existingRoute) {
    throw new Error(
      "이미 해당 기간에 저장된 일정이 있어요. 기존 일정을 정리한 뒤 다시 만들어 주세요."
    );
  }
}

function normalizeDayMinutes(value?: number | null) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const minutes = Math.round(value ?? 0);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
}

function assertNoDuplicateRouteStops(stops: CreateRouteStopInput[]) {
  const usedKeys = new Set<string>();

  for (const stop of stops) {
    const duplicateKeys = getPlaceDuplicateKeys(stop.place);
    const duplicatedKey = duplicateKeys.find((key) => usedKeys.has(key));

    if (duplicatedKey) {
      throw new Error("같은 장소는 루트에 한 번만 추가할 수 있어요.");
    }

    duplicateKeys.forEach((key) => usedKeys.add(key));
  }
}

function normalizeRouteStartLocation(
  startLocation?: RouteStartLocationInput | null
) {
  if (!startLocation) {
    return null;
  }

  if (
    !Number.isFinite(startLocation.lat) ||
    !Number.isFinite(startLocation.lng)
  ) {
    throw new Error("출발 위치 좌표가 올바르지 않습니다.");
  }

  return {
    lat: startLocation.lat,
    lng: startLocation.lng,
  };
}

function normalizeTravelMinutes(value?: number | null) {
  if (value == null) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.max(0, Math.min(24 * 60, Math.round(value)));
}

async function createRouteDays(
  prisma: PrismaClient,
  routeId: string,
  tripDays: number,
  travelStartDate?: Date | null
) {
  const days = [];

  for (let dayIndex = 1; dayIndex <= tripDays; dayIndex += 1) {
    days.push(
      await prisma.routeDay.create({
        data: {
          routeId,
          dayIndex,
          date: travelStartDate ? addDays(travelStartDate, dayIndex - 1) : null,
        },
      })
    );
  }

  return days;
}

export async function createRoute(
  prisma: PrismaClient,
  owner: User,
  input: CreateRouteInput
) {
  const normalizedRouteStops = normalizeRouteStopDayInputs(
    input.tripDays,
    input.stops ?? []
  );
  const tripDays = normalizedRouteStops.tripDays;
  const stopInputs = normalizedRouteStops.stops;
  assertNoDuplicateRouteStops(stopInputs);
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    travelStartDate
      ? addDays(travelStartDate, tripDays - 1)
      : (input.travelEndDate ?? null);
  const startLocation = normalizeRouteStartLocation(input.startLocation);
  await assertNoRouteDateConflict(
    prisma,
    owner.id,
    travelStartDate,
    travelEndDate
  );
  const route = await prisma.route.create({
    data: {
      ownerId: owner.id,
      countryCode: nullableString(input.countryCode) ?? "KR",
      primaryRegionCode: nullableString(input.primaryRegionCode),
      primaryRegionLabelKey: nullableString(input.primaryRegionLabelKey),
      tripDays,
      travelStartDate,
      travelEndDate,
      dailyStartMinutes: normalizeDayMinutes(input.dailyStartMinutes),
      scheduleEndMinutes: normalizeDayMinutes(input.scheduleEndMinutes),
      startLocation,
      status: stopInputs.length > 0 ? "ACTIVE" : "DRAFT",
      totalStopCount: stopInputs.length,
    },
  });
  const days = await createRouteDays(prisma, route.id, tripDays, travelStartDate);
  const dayIdByIndex = new Map(days.map((day) => [day.dayIndex, day.id]));

  for (const [index, stop] of stopInputs.entries()) {
    const dayIndex = Math.max(1, Math.min(tripDays, stop.dayIndex ?? 1));

    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        dayId: dayIdByIndex.get(dayIndex),
        order: stop.order ?? index + 1,
        place: normalizePlaceSnapshot(stop.place),
        stayMinutes: stop.stayMinutes ?? null,
        travelMinutesFromPrevious: normalizeTravelMinutes(
          stop.travelMinutesFromPrevious
        ),
        memo: nullableString(stop.memo),
      },
    });
  }

  return refreshRouteProgress(prisma, route.id);
}

export async function appendRouteDays(
  prisma: PrismaClient,
  user: User,
  input: AppendRouteDaysInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  const normalizedRouteStops = normalizeRouteStopDayInputs(
    input.tripDays,
    input.stops ?? []
  );
  const tripDays = normalizedRouteStops.tripDays;
  const stopInputs = normalizedRouteStops.stops;
  assertNoDuplicateRouteStops(stopInputs);

  if (stopInputs.length === 0) {
    throw new Error("추가할 장소가 없습니다.");
  }

  const existingDayCount = await prisma.routeDay.count({
    where: {
      routeId: route.id,
    },
  });
  const baseDayIndex = Math.max(route.tripDays, existingDayCount);
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    travelStartDate
      ? addDays(travelStartDate, tripDays - 1)
      : (input.travelEndDate ?? null);
  const startLocation = normalizeRouteStartLocation(input.startLocation);

  if (
    route.travelEndDate &&
    travelStartDate &&
    travelStartDate <= route.travelEndDate
  ) {
    throw new Error("추가할 DAY는 기존 일정 마지막 날짜 이후로 선택해 주세요.");
  }

  await assertNoRouteDateConflict(
    prisma,
    user.id,
    travelStartDate,
    travelEndDate,
    route.id
  );

  const newDays = [];

  for (let offset = 0; offset < tripDays; offset += 1) {
    newDays.push(
      await prisma.routeDay.create({
        data: {
          routeId: route.id,
          dayIndex: baseDayIndex + offset + 1,
          date: travelStartDate ? addDays(travelStartDate, offset) : null,
        },
      })
    );
  }

  const dayIdByRelativeIndex = new Map(
    newDays.map((day, index) => [index + 1, day.id])
  );

  for (const [index, stop] of stopInputs.entries()) {
    const relativeDayIndex = Math.max(1, Math.min(tripDays, stop.dayIndex ?? 1));

    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        dayId: dayIdByRelativeIndex.get(relativeDayIndex),
        order: stop.order ?? index + 1,
        place: normalizePlaceSnapshot(stop.place),
        stayMinutes: stop.stayMinutes ?? null,
        travelMinutesFromPrevious: normalizeTravelMinutes(
          stop.travelMinutesFromPrevious
        ),
        memo: nullableString(stop.memo),
      },
    });
  }

  await prisma.route.update({
    where: {
      id: route.id,
    },
    data: {
      tripDays: baseDayIndex + tripDays,
      travelEndDate: travelEndDate ?? route.travelEndDate,
      dailyStartMinutes:
        normalizeDayMinutes(input.dailyStartMinutes) ?? route.dailyStartMinutes,
      scheduleEndMinutes:
        normalizeDayMinutes(input.scheduleEndMinutes) ?? route.scheduleEndMinutes,
      startLocation: route.startLocation ?? startLocation,
      status: "ACTIVE",
    },
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function startRoute(
  prisma: PrismaClient,
  user: User,
  input: StartRouteInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  assertValidDate(input.startedAt);

  if (route.status === "COMPLETED") {
    throw new Error("이미 완료된 일정은 다시 시작할 수 없어요.");
  }

  const routeDays = await prisma.routeDay.findMany({
    where: {
      routeId: route.id,
    },
    orderBy: {
      dayIndex: "asc",
    },
  });
  const tripDays = Math.max(1, routeDays.length || route.tripDays);
  const travelStartDate = input.startedAt;
  const travelEndDate = addDays(travelStartDate, tripDays - 1);

  await assertNoRouteDateConflict(
    prisma,
    user.id,
    travelStartDate,
    travelEndDate,
    route.id
  );

  await Promise.all(
    routeDays.map((day, index) =>
      prisma.routeDay.update({
        where: {
          id: day.id,
        },
        data: {
          date: addDays(travelStartDate, index),
        },
      })
    )
  );

  await prisma.route.update({
    where: {
      id: route.id,
    },
    data: {
      tripDays,
      travelStartDate,
      travelEndDate,
      status: "ACTIVE",
      startedAt: travelStartDate,
      completedAt: null,
    },
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function updateRouteStopStayMinutes(
  prisma: PrismaClient,
  user: User,
  input: UpdateRouteStopStayMinutesInput
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: input.stopId,
    },
  });

  if (!stop) {
    throw new Error("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);

  const stayMinutes = Math.max(10, Math.min(480, Math.round(input.stayMinutes)));

  await prisma.routeStop.update({
    where: {
      id: stop.id,
    },
    data: {
      stayMinutes,
    },
  });

  const refreshedRoute = await refreshRouteProgress(prisma, stop.routeId);

  if (route.visibility === "PUBLIC") {
    const routeStops = await prisma.routeStop.findMany({
      where: {
        routeId: route.id,
      },
      orderBy: {
        order: "asc",
      },
    });

    return prisma.route.update({
      where: {
        id: route.id,
      },
      data: {
        shareTags: buildRouteShareTags(refreshedRoute, routeStops),
      },
    });
  }

  return refreshedRoute;
}

export async function reorderRouteStops(
  prisma: PrismaClient,
  user: User,
  input: ReorderRouteStopsInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  const stopIds = input.stopIds.filter(Boolean);
  const uniqueStopIds = new Set(stopIds);

  if (uniqueStopIds.size !== stopIds.length) {
    throw new Error("중복된 장소가 포함되어 있습니다.");
  }

  const day = await prisma.routeDay.findUnique({
    where: {
      id: input.dayId,
    },
  });

  if (!day || day.routeId !== route.id) {
    throw new Error("일정 날짜를 찾을 수 없습니다.");
  }

  const existingStops = await prisma.routeStop.findMany({
    where: {
      routeId: route.id,
      dayId: day.id,
    },
    orderBy: {
      order: "asc",
    },
  });

  if (existingStops.length !== stopIds.length) {
    throw new Error("같은 날짜 안의 모든 장소를 포함해야 합니다.");
  }

  const existingStopIds = new Set(existingStops.map((stop) => stop.id));
  const hasUnknownStop = stopIds.some((stopId) => !existingStopIds.has(stopId));

  if (hasUnknownStop) {
    throw new Error("다른 일정의 장소는 순서를 바꿀 수 없습니다.");
  }

  const orderSlots = existingStops
    .map((stop) => stop.order)
    .sort((left, right) => left - right);

  await prisma.$transaction(
    stopIds.map((stopId, index) =>
      prisma.routeStop.update({
        where: {
          id: stopId,
        },
        data: {
          order: orderSlots[index] ?? index + 1,
        },
      })
    )
  );

  return refreshRouteProgress(prisma, route.id);
}

export async function clearRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string
) {
  await assertRouteOwner(prisma, routeId, user.id);

  await prisma.routeStop.updateMany({
    where: {
      routeId,
    },
    data: {
      visitStatus: "VISITED",
      visitedAt: new Date(),
    },
  });

  return refreshRouteProgress(prisma, routeId);
}

export async function deleteRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string
) {
  const route = await assertRouteOwner(prisma, routeId, user.id);
  const routeStops = await prisma.routeStop.findMany({
    where: {
      routeId: route.id,
    },
  });

  await prisma.$transaction(async (transaction) => {
    for (const routeStop of routeStops) {
      await syncPlaceStayStatForRouteStopChange(transaction, routeStop, null);
    }

    await transaction.placePhoto.deleteMany({
      where: {
        routeId: route.id,
      },
    });
    await transaction.routeStop.deleteMany({
      where: {
        routeId: route.id,
      },
    });
    await transaction.routeDay.deleteMany({
      where: {
        routeId: route.id,
      },
    });
    await transaction.routeLike.deleteMany({
      where: {
        routeId: route.id,
      },
    });
    await transaction.routeSave.deleteMany({
      where: {
        routeId: route.id,
      },
    });
    await transaction.route.delete({
      where: {
        id: route.id,
      },
    });
  });

  return {
    id: route.id,
  };
}

export async function deleteRouteDay(
  prisma: PrismaClient,
  user: User,
  dayId: string
) {
  const day = await prisma.routeDay.findUnique({
    where: {
      id: dayId,
    },
  });

  if (!day) {
    throw new Error("일정 날짜를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, day.routeId, user.id);
  const routeDays = await prisma.routeDay.findMany({
    where: {
      routeId: route.id,
    },
    orderBy: {
      dayIndex: "asc",
    },
  });

  if (routeDays.length <= 1) {
    throw new Error("마지막 DAY는 전체 일정 삭제로 지워 주세요.");
  }

  const routeStops = await prisma.routeStop.findMany({
    where: {
      routeId: route.id,
      dayId: day.id,
    },
  });

  const remainingDays = routeDays.filter((routeDay) => routeDay.id !== day.id);
  const nextTripDays = remainingDays.length;

  await prisma.$transaction(async (transaction) => {
    for (const routeStop of routeStops) {
      await syncPlaceStayStatForRouteStopChange(transaction, routeStop, null);
    }

    await transaction.placePhoto.deleteMany({
      where: {
        routeStopId: {
          in: routeStops.map((routeStop) => routeStop.id),
        },
      },
    });
    await transaction.routeStop.deleteMany({
      where: {
        routeId: route.id,
        dayId: day.id,
      },
    });
    await transaction.routeDay.delete({
      where: {
        id: day.id,
      },
    });

    for (const [index, remainingDay] of remainingDays.entries()) {
      await transaction.routeDay.update({
        where: {
          id: remainingDay.id,
        },
        data: {
          dayIndex: index + 1,
          date: route.travelStartDate
            ? addDays(route.travelStartDate, index)
            : remainingDay.date,
        },
      });
    }

    await transaction.route.update({
      where: {
        id: route.id,
      },
      data: {
        tripDays: nextTripDays,
        travelEndDate: route.travelStartDate
          ? addDays(route.travelStartDate, nextTripDays - 1)
          : (remainingDays.at(-1)?.date ?? route.travelEndDate),
        status: route.status === "COMPLETED" ? "ACTIVE" : route.status,
      },
    });
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function cloneRoute(
  prisma: PrismaClient,
  user: User,
  input: CloneRouteInput
) {
  const sourceRoute = await prisma.route.findUnique({
    where: {
      id: input.routeId,
    },
    include: {
      days: {
        orderBy: {
          dayIndex: "asc",
        },
      },
      stops: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!sourceRoute || sourceRoute.visibility !== "PUBLIC") {
    throw new Error("복사할 수 있는 공유 루트를 찾을 수 없습니다.");
  }

  const route = await prisma.route.create({
    data: {
      ownerId: user.id,
      sourceRouteId: sourceRoute.id,
      countryCode: sourceRoute.countryCode,
      primaryRegionCode: sourceRoute.primaryRegionCode,
      primaryRegionLabelKey: sourceRoute.primaryRegionLabelKey,
      tripDays: sourceRoute.tripDays,
      travelStartDate: sourceRoute.travelStartDate,
      travelEndDate: sourceRoute.travelEndDate,
      dailyStartMinutes: sourceRoute.dailyStartMinutes,
      scheduleEndMinutes: sourceRoute.scheduleEndMinutes,
      startLocation: sourceRoute.startLocation,
      status: input.startImmediately ? "ACTIVE" : "DRAFT",
      totalStopCount: sourceRoute.stops.length,
      startedAt: input.startImmediately ? new Date() : null,
    },
  });
  const dayIdBySourceDayId = new Map<string, string>();

  for (const day of sourceRoute.days) {
    const copiedDay = await prisma.routeDay.create({
      data: {
        routeId: route.id,
        dayIndex: day.dayIndex,
        date: day.date,
      },
    });
    dayIdBySourceDayId.set(day.id, copiedDay.id);
  }

  for (const stop of sourceRoute.stops) {
    await prisma.routeStop.create({
      data: {
        routeId: route.id,
        dayId: stop.dayId ? dayIdBySourceDayId.get(stop.dayId) : null,
        order: stop.order,
        place: stop.place,
        stayMinutes: stop.stayMinutes,
        travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
        memo: stop.memo,
        visitStatus: "PENDING",
        visitedAt: null,
      },
    });
  }

  return refreshRouteProgress(prisma, route.id);
}
