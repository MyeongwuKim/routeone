import type {
  PlaceProvider,
  PrismaClient,
  Route,
  User,
  VisitStatus,
} from "@prisma/client";

type PlaceSnapshotInput = {
  provider: PlaceProvider;
  externalId?: string | null;
  contentId?: string | null;
  contentTypeId?: string | null;
  title: string;
  address?: string | null;
  lat: number;
  lng: number;
  categoryLabel?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  regionCode?: string | null;
  regionLabelKey?: string | null;
};

type CreateRouteStopInput = {
  dayIndex?: number | null;
  order?: number | null;
  place: PlaceSnapshotInput;
  stayMinutes?: number | null;
  memo?: string | null;
};

export type CreateRouteInput = {
  countryCode?: string | null;
  primaryRegionCode?: string | null;
  primaryRegionLabelKey?: string | null;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  stops?: CreateRouteStopInput[] | null;
};

export type AppendRouteDaysInput = {
  routeId: string;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  stops?: CreateRouteStopInput[] | null;
};

export type CloneRouteInput = {
  routeId: string;
  startImmediately?: boolean | null;
};

export type ReorderRouteStopsInput = {
  routeId: string;
  dayId: string;
  stopIds: string[];
};

function clampTripDays(value: number) {
  return Math.max(1, Math.min(30, Math.round(value || 1)));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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

function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeDuplicateText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function coordinateDuplicateKey(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "";
}

function getPlaceDuplicateKeys(place: PlaceSnapshotInput) {
  const keys = new Set<string>();
  const externalId = normalizeDuplicateText(place.externalId);
  const contentId = normalizeDuplicateText(place.contentId);
  const contentTypeId = normalizeDuplicateText(place.contentTypeId);
  const title = normalizeDuplicateText(place.title);
  const address = normalizeDuplicateText(place.address);
  const lat = coordinateDuplicateKey(place.lat);
  const lng = coordinateDuplicateKey(place.lng);

  if (externalId) {
    keys.add(`external:${place.provider}:${externalId}`);
  }

  if (contentId) {
    keys.add(`content:${place.provider}:${contentTypeId}:${contentId}`);
  }

  if (title && address) {
    keys.add(`text:${title}|${address}`);
  }

  if (title && lat && lng) {
    keys.add(`geo:${title}|${lat}|${lng}`);
  }

  return [...keys];
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

function normalizePlaceSnapshot(place: PlaceSnapshotInput) {
  if (!place.title.trim()) {
    throw new Error("장소 이름이 필요합니다.");
  }

  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
    throw new Error("장소 좌표가 올바르지 않습니다.");
  }

  return {
    provider: place.provider,
    externalId: nullableString(place.externalId),
    contentId: nullableString(place.contentId),
    contentTypeId: nullableString(place.contentTypeId),
    title: place.title.trim(),
    address: nullableString(place.address),
    lat: place.lat,
    lng: place.lng,
    categoryLabel: nullableString(place.categoryLabel),
    categoryName: nullableString(place.categoryName),
    imageUrl: nullableString(place.imageUrl),
    regionCode: nullableString(place.regionCode),
    regionLabelKey: nullableString(place.regionLabelKey),
  };
}

async function assertRouteOwner(
  prisma: PrismaClient,
  routeId: string,
  userId: string
) {
  const route = await prisma.route.findUnique({
    where: {
      id: routeId,
    },
  });

  if (!route) {
    throw new Error("루트를 찾을 수 없습니다.");
  }

  if (route.ownerId !== userId) {
    throw new Error("루트에 접근할 수 없습니다.");
  }

  return route;
}

async function refreshRouteProgress(prisma: PrismaClient, routeId: string) {
  const [totalStopCount, completedStopCount] = await Promise.all([
    prisma.routeStop.count({
      where: {
        routeId,
      },
    }),
    prisma.routeStop.count({
      where: {
        routeId,
        visitStatus: "VISITED",
      },
    }),
  ]);
  const route = await prisma.route.findUnique({
    where: {
      id: routeId,
    },
  });

  if (!route) {
    throw new Error("루트를 찾을 수 없습니다.");
  }

  const isCompleted = totalStopCount > 0 && totalStopCount === completedStopCount;
  const nextStatus = isCompleted
    ? "COMPLETED"
    : route.status === "COMPLETED"
      ? "ACTIVE"
      : route.status;

  return prisma.route.update({
    where: {
      id: routeId,
    },
    data: {
      totalStopCount,
      completedStopCount,
      status: nextStatus,
      completedAt: isCompleted ? (route.completedAt ?? new Date()) : null,
      startedAt: route.startedAt ?? (completedStopCount > 0 ? new Date() : null),
    },
  });
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
  const tripDays = clampTripDays(input.tripDays);
  const stopInputs = input.stops ?? [];
  assertNoDuplicateRouteStops(stopInputs);
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    input.travelEndDate ?? (travelStartDate ? addDays(travelStartDate, tripDays - 1) : null);
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
  const tripDays = clampTripDays(input.tripDays);
  const stopInputs = input.stops ?? [];
  assertNoDuplicateRouteStops(stopInputs);

  const existingDayCount = await prisma.routeDay.count({
    where: {
      routeId: route.id,
    },
  });
  const baseDayIndex = Math.max(route.tripDays, existingDayCount);
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    input.travelEndDate ??
    (travelStartDate ? addDays(travelStartDate, tripDays - 1) : null);

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
      status: "ACTIVE",
    },
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function markRouteStopVisited(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  visited: boolean
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new Error("장소를 찾을 수 없습니다.");
  }

  await assertRouteOwner(prisma, stop.routeId, user.id);

  await prisma.routeStop.update({
    where: {
      id: stopId,
    },
    data: {
      visitStatus: visited ? "VISITED" : "PENDING",
      visitedAt: visited ? new Date() : null,
    },
  });

  return refreshRouteProgress(prisma, stop.routeId);
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

  await prisma.routeStop.deleteMany({
    where: {
      routeId: route.id,
    },
  });
  await prisma.routeDay.deleteMany({
    where: {
      routeId: route.id,
    },
  });
  await prisma.routeLike.deleteMany({
    where: {
      routeId: route.id,
    },
  });
  await prisma.routeSave.deleteMany({
    where: {
      routeId: route.id,
    },
  });
  await prisma.route.delete({
    where: {
      id: route.id,
    },
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

  await prisma.routeStop.deleteMany({
    where: {
      routeId: route.id,
      dayId: day.id,
    },
  });
  await prisma.routeDay.delete({
    where: {
      id: day.id,
    },
  });

  const remainingDays = routeDays.filter((routeDay) => routeDay.id !== day.id);

  for (const [index, remainingDay] of remainingDays.entries()) {
    await prisma.routeDay.update({
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

  const nextTripDays = remainingDays.length;

  await prisma.route.update({
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

  return refreshRouteProgress(prisma, route.id);
}

export async function shareRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string
) {
  const route = await assertRouteOwner(prisma, routeId, user.id);
  const refreshedRoute = await refreshRouteProgress(prisma, route.id);

  if (refreshedRoute.status !== "COMPLETED") {
    throw new Error("완료한 루트만 공유할 수 있습니다.");
  }

  return prisma.route.update({
    where: {
      id: routeId,
    },
    data: {
      visibility: "PUBLIC",
      sharedAt: refreshedRoute.sharedAt ?? new Date(),
    },
  });
}

async function readRouteInteraction(
  prisma: PrismaClient,
  userId: string,
  routeId: string
) {
  const [route, like, save] = await Promise.all([
    prisma.route.findUnique({
      where: {
        id: routeId,
      },
    }),
    prisma.routeLike.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
    }),
    prisma.routeSave.findUnique({
      where: {
        userId_routeId: {
          userId,
          routeId,
        },
      },
    }),
  ]);

  if (!route) {
    throw new Error("루트를 찾을 수 없습니다.");
  }

  return {
    route,
    liked: Boolean(like),
    saved: Boolean(save),
  };
}

export async function setRouteLike(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  liked: boolean
) {
  const existing = await prisma.routeLike.findUnique({
    where: {
      userId_routeId: {
        userId: user.id,
        routeId,
      },
    },
  });

  if (liked && !existing) {
    await prisma.routeLike.create({
      data: {
        userId: user.id,
        routeId,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        likeCount: {
          increment: 1,
        },
      },
    });
  }

  if (!liked && existing) {
    await prisma.routeLike.delete({
      where: {
        id: existing.id,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        likeCount: {
          decrement: 1,
        },
      },
    });
  }

  return readRouteInteraction(prisma, user.id, routeId);
}

export async function setRouteSave(
  prisma: PrismaClient,
  user: User,
  routeId: string,
  saved: boolean
) {
  const existing = await prisma.routeSave.findUnique({
    where: {
      userId_routeId: {
        userId: user.id,
        routeId,
      },
    },
  });

  if (saved && !existing) {
    await prisma.routeSave.create({
      data: {
        userId: user.id,
        routeId,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        saveCount: {
          increment: 1,
        },
      },
    });
  }

  if (!saved && existing) {
    await prisma.routeSave.delete({
      where: {
        id: existing.id,
      },
    });
    await prisma.route.update({
      where: {
        id: routeId,
      },
      data: {
        saveCount: {
          decrement: 1,
        },
      },
    });
  }

  return readRouteInteraction(prisma, user.id, routeId);
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
        memo: stop.memo,
        visitStatus: "PENDING",
        visitedAt: null,
      },
    });
  }

  return refreshRouteProgress(prisma, route.id);
}

export async function getSavedRoutes(prisma: PrismaClient, user: User) {
  const saves = await prisma.routeSave.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const routes = await Promise.all(
    saves.map((save) =>
      prisma.route.findUnique({
        where: {
          id: save.routeId,
        },
      })
    )
  );

  return routes.filter((route): route is Route => Boolean(route));
}

export async function getPublicRoutes(
  prisma: PrismaClient,
  options: {
    regionCode?: string | null;
    limit?: number | null;
  }
) {
  return prisma.route.findMany({
    where: {
      visibility: "PUBLIC",
      ...(options.regionCode
        ? {
            primaryRegionCode: options.regionCode,
          }
        : {}),
    },
    orderBy: {
      sharedAt: "desc",
    },
    take: Math.max(1, Math.min(50, options.limit ?? 20)),
  });
}
