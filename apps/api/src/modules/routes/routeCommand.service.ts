import { createHash } from "node:crypto";
import { Prisma, type PrismaClient, type User } from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
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
  RouteDayStartLocationInput,
  RouteStartLocationInput,
  StartRouteInput,
  UpdateRouteLayoutInput,
  UpdateRouteStartLocationInput,
  UpdateRouteStopStayMinutesInput,
} from "./route.types.js";
import {
  normalizeRouteDayInputs,
  normalizeRouteStartLocation,
} from "./routeDayInput.js";
import { syncPlaceStayStatForRouteStopChange } from "./routeVisit.service.js";

type RouteCommandPrisma = PrismaClient | Prisma.TransactionClient;

const ROUTE_START_TIME_ZONE = "Asia/Seoul";
const MAX_ROUTE_CREATE_REQUEST_ID_LENGTH = 160;
const ROUTE_TRANSACTION_MAX_ATTEMPTS = 4;

function deletePendingRouteStartNotifications(
  prisma: RouteCommandPrisma,
  routeId: string
) {
  return prisma.userNotification.deleteMany({
    where: {
      routeId,
      type: "ROUTE_START",
      pushStatus: {
        in: ["PENDING", "FAILED", "CANCELED"],
      },
    },
  });
}

function getRouteDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROUTE_START_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function getRouteClockMinutes(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ROUTE_START_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0
  );

  return hour * 60 + minute;
}

function combineRouteDateAndMinutes(date: Date, minutes: number) {
  const dateKey = getRouteDateKey(date);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return new Date(
    `${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`
  );
}

function normalizeRouteCreateRequestId(value?: string | null) {
  const normalized = nullableString(value);

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_ROUTE_CREATE_REQUEST_ID_LENGTH) {
    throw new UserFacingError("경로 생성 요청 식별값이 너무 깁니다.");
  }

  return normalized;
}

function stableSerialize(value: unknown): string {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "null";
}

function buildRouteCreateInputHash(value: unknown) {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

function isRetryableRouteTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

async function runRouteTransactionWithRetry<T>(
  prisma: PrismaClient,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>
) {
  let lastError: unknown;

  for (
    let attempt = 1;
    attempt <= ROUTE_TRANSACTION_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      return await prisma.$transaction(operation);
    } catch (error) {
      lastError = error;

      if (
        !isRetryableRouteTransactionError(error) ||
        attempt === ROUTE_TRANSACTION_MAX_ATTEMPTS
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 15));
    }
  }

  throw lastError;
}

function assertValidDate(value: Date) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new UserFacingError("시작 날짜가 올바르지 않습니다.");
  }
}

async function assertNoRouteDateConflict(
  prisma: RouteCommandPrisma,
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
    throw new UserFacingError(
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
      throw new UserFacingError("같은 장소는 루트에 한 번만 추가할 수 있어요.");
    }

    duplicateKeys.forEach((key) => usedKeys.add(key));
  }
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
  prisma: RouteCommandPrisma,
  routeId: string,
  input: {
    tripDays: number;
    travelStartDate: Date | null;
    startLocation: RouteStartLocationInput | null;
    dayStartLocations: RouteDayStartLocationInput[];
    dayIndexOffset?: number;
  }
) {
  const days = [];
  const startLocationByDay = new Map(
    input.dayStartLocations.map((day) => [day.dayIndex, day.startLocation])
  );

  for (let dayIndex = 1; dayIndex <= input.tripDays; dayIndex += 1) {
    days.push(
      await prisma.routeDay.create({
        data: {
          routeId,
          dayIndex: (input.dayIndexOffset ?? 0) + dayIndex,
          date: input.travelStartDate
            ? addDays(input.travelStartDate, dayIndex - 1)
            : null,
          startLocation: startLocationByDay.get(dayIndex) ?? input.startLocation,
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
  const normalizedRouteDays = normalizeRouteDayInputs(
    input.tripDays,
    input.stops ?? [],
    input.dayStartLocations
  );
  const tripDays = normalizedRouteDays.tripDays;
  const stopInputs = normalizedRouteDays.stops;
  const dayStartLocations = normalizedRouteDays.dayStartLocations;
  assertNoDuplicateRouteStops(stopInputs);
  const travelStartDate = input.travelStartDate ?? null;
  const travelEndDate =
    travelStartDate
      ? addDays(travelStartDate, tripDays - 1)
      : (input.travelEndDate ?? null);
  const startLocation = normalizeRouteStartLocation(input.startLocation);
  const countryCode = nullableString(input.countryCode) ?? "KR";
  const primaryRegionCode = nullableString(input.primaryRegionCode);
  const primaryRegionLabelKey = nullableString(input.primaryRegionLabelKey);
  const dailyStartMinutes = normalizeDayMinutes(input.dailyStartMinutes);
  const scheduleEndMinutes = normalizeDayMinutes(input.scheduleEndMinutes);
  const clientRequestId = normalizeRouteCreateRequestId(input.clientRequestId);
  const inputHash = buildRouteCreateInputHash({
    countryCode,
    primaryRegionCode,
    primaryRegionLabelKey,
    tripDays,
    travelStartDate,
    travelEndDate,
    dailyStartMinutes,
    scheduleEndMinutes,
    startLocation,
    // Preserve existing idempotency hashes when no DAY overrides are supplied.
    ...(dayStartLocations.length > 0 ? { dayStartLocations } : {}),
    stops: stopInputs.map((stop) => ({
      ...stop,
      place: normalizePlaceSnapshot(stop.place),
    })),
  });

  const persistRoute = async (database: RouteCommandPrisma) => {
    await assertNoRouteDateConflict(
      database,
      owner.id,
      travelStartDate,
      travelEndDate
    );
    const route = await database.route.create({
      data: {
        ownerId: owner.id,
        countryCode,
        primaryRegionCode,
        primaryRegionLabelKey,
        tripDays,
        travelStartDate,
        travelEndDate,
        dailyStartMinutes,
        scheduleEndMinutes,
        startLocation,
        status: stopInputs.length > 0 ? "ACTIVE" : "DRAFT",
        totalStopCount: stopInputs.length,
      },
    });
    const days = await createRouteDays(database, route.id, {
      tripDays,
      travelStartDate,
      startLocation,
      dayStartLocations,
    });
    const dayIdByIndex = new Map(days.map((day) => [day.dayIndex, day.id]));

    for (const [index, stop] of stopInputs.entries()) {
      const dayIndex = Math.max(1, Math.min(tripDays, stop.dayIndex ?? 1));

      await database.routeStop.create({
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

    return refreshRouteProgress(database, route.id);
  };

  if (!clientRequestId) {
    return persistRoute(prisma);
  }

  return runRouteTransactionWithRetry(prisma, async (transaction) => {
    const existingRequest = await transaction.routeCreateRequest.findUnique({
      where: {
        ownerId_requestId: {
          ownerId: owner.id,
          requestId: clientRequestId,
        },
      },
    });

    if (existingRequest) {
      if (existingRequest.inputHash !== inputHash) {
        throw new UserFacingError(
          "같은 경로 생성 요청에 서로 다른 일정 정보가 전달됐습니다. 다시 시도해 주세요."
        );
      }

      const existingRoute = await transaction.route.findUnique({
        where: {
          id: existingRequest.routeId,
        },
      });

      if (existingRoute) {
        return refreshRouteProgress(transaction, existingRoute.id);
      }

      await transaction.routeCreateRequest.delete({
        where: {
          id: existingRequest.id,
        },
      });
    }

    const route = await persistRoute(transaction);

    await transaction.routeCreateRequest.create({
      data: {
        ownerId: owner.id,
        requestId: clientRequestId,
        inputHash,
        routeId: route.id,
      },
    });

    return route;
  });
}

export async function appendRouteDays(
  prisma: PrismaClient,
  user: User,
  input: AppendRouteDaysInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  const normalizedRouteDays = normalizeRouteDayInputs(
    input.tripDays,
    input.stops ?? [],
    input.dayStartLocations
  );
  const tripDays = normalizedRouteDays.tripDays;
  const stopInputs = normalizedRouteDays.stops;
  assertNoDuplicateRouteStops(stopInputs);

  if (stopInputs.length === 0) {
    throw new UserFacingError("추가할 장소가 없습니다.");
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
  const startLocation = normalizeRouteStartLocation(
    input.startLocation ?? route.startLocation
  );

  if (
    route.travelEndDate &&
    travelStartDate &&
    travelStartDate <= route.travelEndDate
  ) {
    throw new UserFacingError("추가할 DAY는 기존 일정 마지막 날짜 이후로 선택해 주세요.");
  }

  await assertNoRouteDateConflict(
    prisma,
    user.id,
    travelStartDate,
    travelEndDate,
    route.id
  );

  const newDays = await createRouteDays(prisma, route.id, {
    tripDays,
    travelStartDate,
    startLocation,
    dayStartLocations: normalizedRouteDays.dayStartLocations,
    dayIndexOffset: baseDayIndex,
  });

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
      status: "ACTIVE",
    },
  });

  await deletePendingRouteStartNotifications(prisma, route.id);

  return refreshRouteProgress(prisma, route.id);
}

export async function startRoute(
  prisma: PrismaClient,
  user: User,
  input: StartRouteInput
) {
  assertValidDate(input.startedAt);
  const dayStartedAt = input.dayStartedAt ?? null;

  if (dayStartedAt) {
    assertValidDate(dayStartedAt);

    if (dayStartedAt.getTime() > Date.now() + 60_000) {
      throw new UserFacingError("현재보다 이후 시간으로는 시작할 수 없어요.");
    }
  }

  return runRouteTransactionWithRetry(prisma, async (transaction) => {
    const route = await assertRouteOwner(transaction, input.routeId, user.id);

    if (route.status === "COMPLETED") {
      throw new UserFacingError("이미 완료된 일정은 다시 시작할 수 없어요.");
    }

    if (getRouteDateKey(input.startedAt) > getRouteDateKey(new Date())) {
      throw new UserFacingError("미래 날짜의 여행은 아직 시작할 수 없어요.");
    }

    if (route.startedAt) {
      await deletePendingRouteStartNotifications(transaction, route.id);
      return refreshRouteProgress(transaction, route.id);
    }

    const routeDays = await transaction.routeDay.findMany({
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
    const resolvedDayStartedAt =
      dayStartedAt ??
      combineRouteDateAndMinutes(
        travelStartDate,
        routeDays.find((day) => day.dayIndex === 1)?.plannedStartMinutes ??
          route.dailyStartMinutes ??
          9 * 60
      );

    if (
      dayStartedAt &&
      getRouteDateKey(dayStartedAt) !== getRouteDateKey(travelStartDate)
    ) {
      throw new UserFacingError(
        "실제 시작시간은 여행 시작일과 같은 날짜여야 해요."
      );
    }

    await assertNoRouteDateConflict(
      transaction,
      user.id,
      travelStartDate,
      travelEndDate,
      route.id
    );

    for (const [index, day] of routeDays.entries()) {
      await transaction.routeDay.update({
        where: {
          id: day.id,
        },
        data: {
          date: addDays(travelStartDate, index),
          ...(index === 0 ? { startedAt: resolvedDayStartedAt } : {}),
        },
      });
    }

    await transaction.route.update({
      where: {
        id: route.id,
      },
      data: {
        tripDays,
        travelStartDate,
        travelEndDate,
        status: "ACTIVE",
        startedAt: resolvedDayStartedAt,
        completedAt: null,
      },
    });

    await deletePendingRouteStartNotifications(transaction, route.id);

    return refreshRouteProgress(transaction, route.id);
  });
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
    throw new UserFacingError("장소를 찾을 수 없습니다.");
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

export async function updateRouteStartLocation(
  prisma: PrismaClient,
  user: User,
  input: UpdateRouteStartLocationInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  const startLocation = normalizeRouteStartLocation(input.startLocation);

  if (!startLocation) {
    throw new UserFacingError("스타트 지점을 선택해 주세요.");
  }

  if (input.dayId != null) {
    const day = await prisma.routeDay.findUnique({
      where: { id: input.dayId },
    });

    if (!day || day.routeId !== route.id) {
      throw new UserFacingError("일정 날짜를 찾을 수 없습니다.");
    }

    await prisma.routeDay.update({
      where: { id: day.id },
      data: { startLocation },
    });
  } else {
    await prisma.route.update({
      where: { id: route.id },
      data: { startLocation },
    });
  }

  return refreshRouteProgress(prisma, route.id);
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
    throw new UserFacingError("중복된 장소가 포함되어 있습니다.");
  }

  const day = await prisma.routeDay.findUnique({
    where: {
      id: input.dayId,
    },
  });

  if (!day || day.routeId !== route.id) {
    throw new UserFacingError("일정 날짜를 찾을 수 없습니다.");
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
    throw new UserFacingError("같은 날짜 안의 모든 장소를 포함해야 합니다.");
  }

  const existingStopIds = new Set(existingStops.map((stop) => stop.id));
  const hasUnknownStop = stopIds.some((stopId) => !existingStopIds.has(stopId));

  if (hasUnknownStop) {
    throw new UserFacingError("다른 일정의 장소는 순서를 바꿀 수 없습니다.");
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

export async function updateRouteLayout(
  prisma: PrismaClient,
  user: User,
  input: UpdateRouteLayoutInput
) {
  const route = await assertRouteOwner(prisma, input.routeId, user.id);
  const routeDays = await prisma.routeDay.findMany({
    where: { routeId: route.id },
    orderBy: { dayIndex: "asc" },
  });
  const routeStops = await prisma.routeStop.findMany({
    where: { routeId: route.id },
    orderBy: { order: "asc" },
  });
  const routeDayIdSet = new Set(routeDays.map((day) => day.id));
  const routeStopById = new Map(routeStops.map((stop) => [stop.id, stop]));
  const deletedDayIds = [...new Set(input.deletedDayIds ?? [])];
  const deletedDayIdSet = new Set(deletedDayIds);
  const layoutDayIds = input.days.map((day) => day.dayId);
  const layoutDayIdSet = new Set(layoutDayIds);

  if (layoutDayIds.length !== layoutDayIdSet.size) {
    throw new UserFacingError("같은 DAY가 중복되어 있습니다.");
  }

  if (
    deletedDayIds.some((dayId) => !routeDayIdSet.has(dayId)) ||
    layoutDayIds.some((dayId) => !routeDayIdSet.has(dayId))
  ) {
    throw new UserFacingError("일정에 없는 DAY가 포함되어 있습니다.");
  }

  if (deletedDayIds.some((dayId) => layoutDayIdSet.has(dayId))) {
    throw new UserFacingError("삭제할 DAY에는 장소를 배치할 수 없습니다.");
  }

  const remainingDays = routeDays.filter(
    (day) => !deletedDayIdSet.has(day.id)
  );

  if (remainingDays.length === 0) {
    throw new UserFacingError("마지막 DAY는 전체 일정 삭제로 지워 주세요.");
  }

  if (
    remainingDays.some((day) => !layoutDayIdSet.has(day.id)) ||
    input.days.length !== remainingDays.length
  ) {
    throw new UserFacingError("남아 있는 모든 DAY의 장소를 포함해 주세요.");
  }

  const layoutByDayId = new Map(
    input.days.map((day) => [
      day.dayId,
      { ...day, startLocation: normalizeRouteStartLocation(day.startLocation) },
    ])
  );
  const keptStopIds: string[] = [];

  for (const day of remainingDays) {
    const layout = layoutByDayId.get(day.id);

    for (const stopInput of layout?.stops ?? []) {
      if (!routeStopById.has(stopInput.stopId)) {
        throw new UserFacingError("일정에 없는 장소가 포함되어 있습니다.");
      }

      keptStopIds.push(stopInput.stopId);
    }
  }

  if (keptStopIds.length !== new Set(keptStopIds).size) {
    throw new UserFacingError("같은 장소가 중복되어 있습니다.");
  }

  const keptStopIdSet = new Set(keptStopIds);
  const removedStops = routeStops.filter(
    (stop) => !keptStopIdSet.has(stop.id)
  );

  await prisma.$transaction(async (transaction) => {
    for (const stop of removedStops) {
      await syncPlaceStayStatForRouteStopChange(transaction, stop, null);
    }

    if (removedStops.length > 0) {
      const removedStopIds = removedStops.map((stop) => stop.id);
      await transaction.placePhoto.deleteMany({
        where: { routeStopId: { in: removedStopIds } },
      });
      await transaction.routeStop.deleteMany({
        where: { id: { in: removedStopIds } },
      });
    }

    if (deletedDayIds.length > 0) {
      await transaction.routeDay.deleteMany({
        where: { id: { in: deletedDayIds } },
      });
      await deletePendingRouteStartNotifications(transaction, route.id);
    }

    let nextOrder = 1;
    for (const [dayIndex, day] of remainingDays.entries()) {
      const layout = layoutByDayId.get(day.id);
      await transaction.routeDay.update({
        where: { id: day.id },
        data: {
          dayIndex: dayIndex + 1,
          date: route.travelStartDate
            ? addDays(route.travelStartDate, dayIndex)
            : day.date,
          ...(layout?.startLocation ? { startLocation: layout.startLocation } : {}),
        },
      });

      for (const stopInput of layout?.stops ?? []) {
        const stayMinutes =
          stopInput.stayMinutes == null
            ? null
            : Math.max(10, Math.min(480, Math.round(stopInput.stayMinutes)));

        await transaction.routeStop.update({
          where: { id: stopInput.stopId },
          data: {
            dayId: day.id,
            order: nextOrder,
            stayMinutes,
            travelMinutesFromPrevious: null,
          },
        });
        nextOrder += 1;
      }
    }

    await transaction.route.update({
      where: { id: route.id },
      data: {
        tripDays: remainingDays.length,
        travelEndDate: route.travelStartDate
          ? addDays(route.travelStartDate, remainingDays.length - 1)
          : (remainingDays.at(-1)?.date ?? route.travelEndDate),
        status: route.status === "COMPLETED" ? "ACTIVE" : route.status,
      },
    });
  });

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

  await deletePendingRouteStartNotifications(prisma, routeId);

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
    await transaction.userNotification.deleteMany({
      where: {
        userId: user.id,
        routeId: route.id,
      },
    });
    await transaction.routeCreateRequest.deleteMany({
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
    throw new UserFacingError("일정 날짜를 찾을 수 없습니다.");
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
    throw new UserFacingError("마지막 DAY는 전체 일정 삭제로 지워 주세요.");
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
    await deletePendingRouteStartNotifications(transaction, route.id);

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
    throw new UserFacingError("복사할 수 있는 공유 루트를 찾을 수 없습니다.");
  }

  const startLocation = normalizeRouteStartLocation(sourceRoute.startLocation);
  const sourceDays = sourceRoute.days.map((day) => ({
    ...day,
    startLocation: normalizeRouteStartLocation(day.startLocation ?? startLocation),
  }));

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
      startLocation,
      status: input.startImmediately ? "ACTIVE" : "DRAFT",
      totalStopCount: sourceRoute.stops.length,
      startedAt: input.startImmediately ? new Date() : null,
    },
  });
  const dayIdBySourceDayId = new Map<string, string>();

  for (const day of sourceDays) {
    const copiedDayStartedAt =
      input.startImmediately && day.dayIndex === 1 ? new Date() : null;
    const copiedDay = await prisma.routeDay.create({
      data: {
        routeId: route.id,
        dayIndex: day.dayIndex,
        date: day.date,
        plannedStartMinutes: day.plannedStartMinutes,
        startedAt: copiedDayStartedAt,
        startLocation: day.startLocation,
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
