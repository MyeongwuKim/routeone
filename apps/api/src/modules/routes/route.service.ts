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

export type CloneRouteInput = {
  routeId: string;
  startImmediately?: boolean | null;
};

function clampTripDays(value: number) {
  return Math.max(1, Math.min(30, Math.round(value || 1)));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
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
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    input.travelEndDate ?? (travelStartDate ? addDays(travelStartDate, tripDays - 1) : null);
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
