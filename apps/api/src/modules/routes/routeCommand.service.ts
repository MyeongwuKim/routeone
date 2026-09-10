/**
 * 용도:
 * 일정 생성·시작과 날짜, 장소 구성의 변경을 처리한다.
 *
 * 요청 흐름:
 * DAY·장소 저장과 삭제 통계는 트랜잭션에서 일괄 반영한다.
 * 진행 상태는 조회한 장소로 계산하고, 같은 생성 요청은 이미 저장된 일정을 반환한다.
 */
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient, User } from "@prisma/client";
import { runTransactionWithRetry } from "../../lib/transaction.js";
import { UserFacingError } from "../../graphql/userFacingError.js";
import {
  addDays,
  assertRouteOwner,
  buildRouteShareTags,
  buildRouteProgressData,
  countRouteStops,
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
import {
  changedFields,
  createRouteDaysBatch,
  removeRouteStopStayContributions,
  updateRouteRowsBatch,
} from "./routeBatch.repository.js";

type RouteCommandPrisma = PrismaClient | Prisma.TransactionClient;

const ROUTE_START_TIME_ZONE = "Asia/Seoul";
const MAX_ROUTE_CREATE_REQUEST_ID_LENGTH = 160;

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
  const startLocationByDay = new Map(
    input.dayStartLocations.map((day) => [day.dayIndex, day.startLocation])
  );
  return createRouteDaysBatch(prisma, Array.from({ length: input.tripDays }, (_, index) => ({
    routeId,
    dayIndex: (input.dayIndexOffset ?? 0) + index + 1,
    date: input.travelStartDate ? addDays(input.travelStartDate, index) : null,
    startLocation: startLocationByDay.get(index + 1) ?? input.startLocation,
  })));
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
  const stopInputs = normalizedRouteDays.stops.map((stop) => ({
    ...stop,
    place: normalizePlaceSnapshot(stop.place),
  }));
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
    stops: stopInputs,
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
        completedStopCount: 0,
      },
    });
    const days = await createRouteDays(database, route.id, {
      tripDays,
      travelStartDate,
      startLocation,
      dayStartLocations,
    });
    const dayIdByIndex = new Map(days.map((day) => [day.dayIndex, day.id]));

    if (stopInputs.length > 0) {
      await database.routeStop.createMany({
        data: stopInputs.map((stop, index) => ({
          routeId: route.id,
          dayId: dayIdByIndex.get(stop.dayIndex),
          order: stop.order ?? index + 1,
          place: stop.place,
          stayMinutes: stop.stayMinutes ?? null,
          travelMinutesFromPrevious: normalizeTravelMinutes(
            stop.travelMinutesFromPrevious
          ),
          memo: nullableString(stop.memo),
        })),
      });
    }

    // 새 장소는 모두 미방문이므로 생성할 때 기록한 개수와 상태를 그대로 쓴다.
    return route;
  };

  return runTransactionWithRetry(prisma, async (transaction) => {
    if (!clientRequestId) {
      return persistRoute(transaction);
    }

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
        return existingRoute;
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
  const normalizedRouteDays = normalizeRouteDayInputs(
    input.tripDays,
    input.stops ?? [],
    input.dayStartLocations
  );
  const tripDays = normalizedRouteDays.tripDays;
  const stopInputs = normalizedRouteDays.stops.map((stop) => ({
    ...stop,
    place: normalizePlaceSnapshot(stop.place),
  }));
  assertNoDuplicateRouteStops(stopInputs);

  if (stopInputs.length === 0) {
    throw new UserFacingError("추가할 장소가 없습니다.");
  }

  return runTransactionWithRetry(prisma, async (transaction) => {
    const route = await assertRouteOwner(transaction, input.routeId, user.id);
    const existingStops = await transaction.routeStop.findMany({
      where: { routeId: route.id }, select: { visitStatus: true },
    });
    const existingDayCount = await transaction.routeDay.count({
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
      transaction,
      user.id,
      travelStartDate,
      travelEndDate,
      route.id
    );

    const newDays = await createRouteDays(transaction, route.id, {
      tripDays,
      travelStartDate,
      startLocation,
      dayStartLocations: normalizedRouteDays.dayStartLocations,
      dayIndexOffset: baseDayIndex,
    });

    const dayIdByRelativeIndex = new Map(
      newDays.map((day, index) => [index + 1, day.id])
    );

    await transaction.routeStop.createMany({
      data: stopInputs.map((stop, index) => ({
        routeId: route.id,
        dayId: dayIdByRelativeIndex.get(Math.max(1, Math.min(tripDays, stop.dayIndex ?? 1))),
        order: stop.order ?? index + 1,
        place: stop.place,
        stayMinutes: stop.stayMinutes ?? null,
        travelMinutesFromPrevious: normalizeTravelMinutes(stop.travelMinutesFromPrevious),
        memo: nullableString(stop.memo),
      })),
    });

    await deletePendingRouteStartNotifications(transaction, route.id);

    return transaction.route.update({
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
        ...buildRouteProgressData({ ...route, status: "ACTIVE" }, {
          totalStopCount: existingStops.length + stopInputs.length,
          completedStopCount: countRouteStops(existingStops).completedStopCount,
        }),
      },
    });
  });
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

  return runTransactionWithRetry(prisma, async (transaction) => {
    const route = await assertRouteOwner(transaction, input.routeId, user.id);

    if (route.status === "COMPLETED") {
      throw new UserFacingError("이미 완료된 일정은 다시 시작할 수 없어요.");
    }

    if (getRouteDateKey(input.startedAt) > getRouteDateKey(new Date())) {
      throw new UserFacingError("미래 날짜의 여행은 아직 시작할 수 없어요.");
    }

    if (route.startedAt) {
      await deletePendingRouteStartNotifications(transaction, route.id);
      return route;
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

    await updateRouteRowsBatch(transaction, "RouteDay", route.id, routeDays.map((day, index) => ({
      id: day.id,
      data: changedFields(day, {
        date: addDays(travelStartDate, index),
        ...(index === 0 ? { startedAt: resolvedDayStartedAt } : {}),
      }),
    })));
    const stops = await transaction.routeStop.findMany({
      where: { routeId: route.id }, select: { visitStatus: true },
    });
    await deletePendingRouteStartNotifications(transaction, route.id);

    return transaction.route.update({
      where: {
        id: route.id,
      },
      data: {
        tripDays,
        travelStartDate,
        travelEndDate,
        ...buildRouteProgressData(
          { ...route, status: "ACTIVE", startedAt: resolvedDayStartedAt },
          countRouteStops(stops)
        ),
      },
    });
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
  return prisma.$transaction(async (transaction) => {
    const route = await assertRouteOwner(transaction, input.routeId, user.id);
    const stopIds = input.stopIds.filter(Boolean);
    const uniqueStopIds = new Set(stopIds);

    if (uniqueStopIds.size !== stopIds.length) {
      throw new UserFacingError("중복된 장소가 포함되어 있습니다.");
    }

    const day = await transaction.routeDay.findUnique({
      where: {
        id: input.dayId,
      },
    });

    if (!day || day.routeId !== route.id) {
      throw new UserFacingError("일정 날짜를 찾을 수 없습니다.");
    }

    const existingStops = await transaction.routeStop.findMany({
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

    const stopById = new Map(existingStops.map((stop) => [stop.id, stop]));
    const updates = stopIds.map((id, index) => ({
      id,
      data: changedFields(stopById.get(id)!, { order: orderSlots[index] ?? index + 1 }),
    })).filter((row) => Object.keys(row.data).length > 0);
    if (!updates.length) return route;
    await updateRouteRowsBatch(transaction, "RouteStop", route.id, updates);
    return transaction.route.update({ where: { id: route.id }, data: { updatedAt: new Date() } });
  });
}

export async function updateRouteLayout(
  prisma: PrismaClient,
  user: User,
  input: UpdateRouteLayoutInput
) {
  return prisma.$transaction(async (transaction) => {
    const route = await assertRouteOwner(transaction, input.routeId, user.id);
    const routeDays = await transaction.routeDay.findMany({
      where: { routeId: route.id },
      orderBy: { dayIndex: "asc" },
    });
    const routeStops = await transaction.routeStop.findMany({
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

    await removeRouteStopStayContributions(transaction, removedStops);

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

    const dayUpdates: { id: string; data: Record<string, unknown> }[] = [];
    const stopUpdates: { id: string; data: Record<string, unknown> }[] = [];
    let nextOrder = 1;
    for (const [dayIndex, day] of remainingDays.entries()) {
      const layout = layoutByDayId.get(day.id)!;
      dayUpdates.push({
        id: day.id, data: changedFields(day, {
          dayIndex: dayIndex + 1,
          date: route.travelStartDate ? addDays(route.travelStartDate, dayIndex) : day.date,
          ...(layout.startLocation ? { startLocation: layout.startLocation } : {}),
        })
      });
      for (const stopInput of layout.stops) {
        const stop = routeStopById.get(stopInput.stopId)!;
        stopUpdates.push({
          id: stop.id, data: changedFields(stop, {
            dayId: day.id,
            order: nextOrder++,
            stayMinutes: stopInput.stayMinutes == null
              ? null : Math.max(10, Math.min(480, Math.round(stopInput.stayMinutes))),
            // 편집 저장 시 이동시간을 다시 계산하는 기존 동작은 유지한다.
            travelMinutesFromPrevious: null,
          })
        });
      }
    }
    await updateRouteRowsBatch(transaction, "RouteDay", route.id, dayUpdates);
    await updateRouteRowsBatch(transaction, "RouteStop", route.id, stopUpdates);
    const routeData = changedFields(route, {
      tripDays: remainingDays.length,
      travelEndDate: route.travelStartDate
        ? addDays(route.travelStartDate, remainingDays.length - 1)
        : (remainingDays.at(-1)?.date ?? route.travelEndDate),
      ...buildRouteProgressData(
        route,
        countRouteStops(routeStops.filter((stop) => keptStopIdSet.has(stop.id)))
      ),
    });
    const hasChanges = Object.keys(routeData).length > 0
      || removedStops.length > 0
      || deletedDayIds.length > 0
      || [...dayUpdates, ...stopUpdates].some((row) => Object.keys(row.data).length > 0);
    if (!hasChanges) return route;
    return transaction.route.update({ where: { id: route.id }, data: { ...routeData, updatedAt: new Date() } });
  });
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
  return prisma.$transaction(async (transaction) => {
    const route = await assertRouteOwner(transaction, routeId, user.id);
    const routeStops = await transaction.routeStop.findMany({
      where: {
        routeId: route.id,
      },
    });

    await removeRouteStopStayContributions(transaction, routeStops);

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
    return { id: route.id };
  });
}

export async function deleteRouteDay(
  prisma: PrismaClient,
  user: User,
  dayId: string
) {
  return prisma.$transaction(async (transaction) => {
    const day = await transaction.routeDay.findUnique({
      where: {
        id: dayId,
      },
    });

    if (!day) {
      throw new UserFacingError("일정 날짜를 찾을 수 없습니다.");
    }

    const route = await assertRouteOwner(transaction, day.routeId, user.id);
    const routeDays = await transaction.routeDay.findMany({
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

    const routeStops = await transaction.routeStop.findMany({
      where: {
        routeId: route.id,
      },
    });

    const removedStops = routeStops.filter((stop) => stop.dayId === day.id);
    const remainingDays = routeDays.filter((routeDay) => routeDay.id !== day.id);
    const nextTripDays = remainingDays.length;

    await removeRouteStopStayContributions(transaction, removedStops);

    await transaction.placePhoto.deleteMany({
      where: {
        routeStopId: {
          in: removedStops.map((routeStop) => routeStop.id),
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

    await updateRouteRowsBatch(transaction, "RouteDay", route.id, remainingDays.map((remainingDay, index) => ({
      id: remainingDay.id,
      data: changedFields(remainingDay, {
        dayIndex: index + 1,
        date: route.travelStartDate ? addDays(route.travelStartDate, index) : remainingDay.date,
      }),
    })));

    return transaction.route.update({
      where: {
        id: route.id,
      },
      data: {
        tripDays: nextTripDays,
        travelEndDate: route.travelStartDate
          ? addDays(route.travelStartDate, nextTripDays - 1)
          : (remainingDays.at(-1)?.date ?? route.travelEndDate),
        ...buildRouteProgressData(
          route,
          countRouteStops(routeStops.filter((stop) => stop.dayId !== day.id))
        ),
      },
    });
  });
}

export async function cloneRoute(
  prisma: PrismaClient,
  user: User,
  input: CloneRouteInput
) {
  return prisma.$transaction(async (transaction) => {
    const sourceRoute = await transaction.route.findUnique({
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

    const route = await transaction.route.create({
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
    const copiedDays = await createRouteDaysBatch(transaction, sourceDays.map((day) => ({
      routeId: route.id,
      dayIndex: day.dayIndex,
      date: day.date,
      plannedStartMinutes: day.plannedStartMinutes,
      startedAt: input.startImmediately && day.dayIndex === 1 ? route.startedAt : null,
      startLocation: day.startLocation,
    })));
    const dayIdBySourceDayId = new Map(sourceDays.map((day, index) => [day.id, copiedDays[index]!.id]));
    if (sourceRoute.stops.length) {
      await transaction.routeStop.createMany({
        data: sourceRoute.stops.map((stop) => ({
          routeId: route.id,
          dayId: stop.dayId ? dayIdBySourceDayId.get(stop.dayId) : null,
          order: stop.order,
          place: stop.place,
          stayMinutes: stop.stayMinutes,
          travelMinutesFromPrevious: stop.travelMinutesFromPrevious,
          memo: stop.memo,
          visitStatus: "PENDING",
          visitedAt: null,
        }))
      });
    }
    return route;
  });
}
