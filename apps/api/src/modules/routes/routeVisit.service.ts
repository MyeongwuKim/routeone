import type {
  Prisma,
  PrismaClient,
  Route,
  RouteStop,
  RouteStopVerificationStatus,
  User,
  VisitStatus,
} from "@prisma/client";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";
import {
  VERIFIED_ROUTE_STOP_STATUSES,
  assertRouteOwner,
  buildPlacePhotoSnapshotData,
  buildPlacePhotoThumbnailUrl,
  buildPlaceStayStatSnapshotData,
  buildRouteShareTags,
  getImageDeliveryVariantName,
  getPlaceStayStatKeys,
  getPrimaryPlaceStayStatKey,
  nullableString,
  refreshRouteProgress,
} from "./route.shared.js";
import type {
  PlacePhotoListOptions,
  PlaceSnapshotInput,
  PlaceStaySummary,
  RouteStopVisitVerificationInput,
} from "./route.types.js";

type RouteServicePrisma = PrismaClient | Prisma.TransactionClient;

type RouteStopStayContributionSource = Pick<
  RouteStop,
  "place" | "visitStatus" | "visitedAt" | "actualStayMinutes"
> & {
  stayStatSyncedAt?: Date | null;
};

type RouteStopStayContribution = {
  minutes: number;
  visitedAt: Date | null;
};

const GPS_VERIFICATION_MAX_DISTANCE_METERS = 100;

const BYPASS_GPS_LOCATION_VERIFICATION = false;

const EARTH_RADIUS_METERS = 6_371_000;

const DEFAULT_PLACE_PHOTO_LIMIT = 30;

const MAX_PLACE_PHOTO_LIMIT = 60;

const PUBLISHABLE_PLACE_PHOTO_STATUSES = new Set<RouteStopVerificationStatus>([
  "GPS_PHOTO",
  "MANUAL",
]);

function clampPlacePhotoLimit(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_PLACE_PHOTO_LIMIT;
  }

  return Math.max(1, Math.min(MAX_PLACE_PHOTO_LIMIT, Math.round(value)));
}

function toFiniteCoordinate(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRouteStopPlaceCoordinates(stop: RouteStop) {
  const place =
    stop.place && typeof stop.place === "object" && !Array.isArray(stop.place)
      ? (stop.place as Record<string, unknown>)
      : null;

  if (!place) {
    return null;
  }

  const lat = toFiniteCoordinate(place.lat);
  const lng = toFiniteCoordinate(place.lng);

  return lat != null && lng != null ? { lat, lng } : null;
}

function toRadians(degree: number) {
  return (degree * Math.PI) / 180;
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
) {
  const latDelta = toRadians(to.lat - from.lat);
  const lngDelta = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

function getVisitVerificationStatus(
  verification?: RouteStopVisitVerificationInput | null
) {
  const status = verification?.status ?? "MANUAL";

  return status === "NONE" ? "MANUAL" : status;
}

function assertRouteStopGpsVerification(
  stop: RouteStop,
  verification: RouteStopVisitVerificationInput | null | undefined,
  verificationStatus: RouteStopVerificationStatus
) {
  if (verificationStatus !== "GPS" && verificationStatus !== "GPS_PHOTO") {
    return;
  }

  if (isDevVerificationBypassEnabled()) {
    return;
  }

  if (BYPASS_GPS_LOCATION_VERIFICATION) {
    return;
  }

  const currentLat = toFiniteCoordinate(verification?.lat);
  const currentLng = toFiniteCoordinate(verification?.lng);

  if (currentLat == null || currentLng == null) {
    throw new Error("현재 위치를 확인하지 못했어요. 위치 권한과 GPS 상태를 확인해 주세요.");
  }

  const placeCoordinates = getRouteStopPlaceCoordinates(stop);

  if (!placeCoordinates) {
    throw new Error("장소 좌표가 없어 위치 인증을 진행할 수 없어요.");
  }

  const distanceMeters = calculateDistanceMeters(
    {
      lat: currentLat,
      lng: currentLng,
    },
    placeCoordinates
  );

  if (distanceMeters > GPS_VERIFICATION_MAX_DISTANCE_METERS) {
    throw new Error(
      `장소 근처에서만 인증할 수 있어요. 현재 위치가 약 ${Math.round(
        distanceMeters
      )}m 떨어져 있어요.`
    );
  }
}

function getActualStayMinutes(checkedInAt: Date | null, checkedOutAt: Date | null) {
  if (!checkedInAt || !checkedOutAt) {
    return null;
  }

  return Math.max(
    1,
    Math.round((checkedOutAt.getTime() - checkedInAt.getTime()) / 60000)
  );
}

function normalizeActualStayMinutes(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(10, Math.min(480, Math.round(value)));
}

function buildRouteStopVisitData(
  stop: RouteStop,
  visited: boolean,
  verification?: RouteStopVisitVerificationInput | null,
  actualStayMinutes?: number | null
) {
  if (!visited) {
    return {
      visitStatus: "PENDING" as VisitStatus,
      visitedAt: null,
      verificationStatus: "NONE" as RouteStopVerificationStatus,
      verifiedAt: null,
      verificationPhotoImageId: null,
      verificationPhotoUrl: null,
      verificationLat: null,
      verificationLng: null,
      verificationAccuracyMeters: null,
      checkedInAt: null,
      checkedOutAt: null,
      actualStayMinutes: null,
    };
  }

  const visitedAt = new Date();
  const verificationStatus = getVisitVerificationStatus(verification);
  const isGpsVerified = VERIFIED_ROUTE_STOP_STATUSES.has(verificationStatus);
  const photoUrl = nullableString(verification?.photoUrl);
  const hasPhotoRecord =
    Boolean(photoUrl) &&
    (verificationStatus === "GPS_PHOTO" || verificationStatus === "MANUAL");

  assertRouteStopGpsVerification(stop, verification, verificationStatus);

  const checkedInAt = stop.checkedInAt ?? (isGpsVerified ? visitedAt : null);
  const checkedOutAt = stop.checkedInAt ? visitedAt : null;
  const normalizedActualStayMinutes =
    normalizeActualStayMinutes(actualStayMinutes);

  return {
    visitStatus: "VISITED" as VisitStatus,
    visitedAt,
    verificationStatus,
    verifiedAt: isGpsVerified ? visitedAt : null,
    verificationPhotoImageId:
      verificationStatus === "GPS_PHOTO" || hasPhotoRecord
        ? nullableString(verification?.photoImageId)
        : null,
    verificationPhotoUrl:
      verificationStatus === "GPS_PHOTO" || hasPhotoRecord ? photoUrl : null,
    verificationLat: isGpsVerified ? (verification?.lat ?? null) : null,
    verificationLng: isGpsVerified ? (verification?.lng ?? null) : null,
    verificationAccuracyMeters: isGpsVerified
      ? (verification?.accuracyMeters ?? null)
      : null,
    checkedInAt,
    checkedOutAt,
    actualStayMinutes:
      normalizedActualStayMinutes ??
      getActualStayMinutes(checkedInAt, checkedOutAt),
  };
}

export type RouteStopVisitData = {
  visitStatus: VisitStatus;
  visitedAt: Date | null;
  verificationStatus: RouteStopVerificationStatus;
  verifiedAt: Date | null;
  verificationPhotoImageId: string | null;
  verificationPhotoUrl: string | null;
  verificationLat: number | null;
  verificationLng: number | null;
  verificationAccuracyMeters: number | null;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  actualStayMinutes: number | null;
};

export function buildRouteStopVisitDataFromStop(stop: RouteStop): RouteStopVisitData {
  return {
    visitStatus: stop.visitStatus,
    visitedAt: stop.visitedAt,
    verificationStatus: stop.verificationStatus ?? "NONE",
    verifiedAt: stop.verifiedAt,
    verificationPhotoImageId: stop.verificationPhotoImageId,
    verificationPhotoUrl: stop.verificationPhotoUrl,
    verificationLat: stop.verificationLat,
    verificationLng: stop.verificationLng,
    verificationAccuracyMeters: stop.verificationAccuracyMeters,
    checkedInAt: stop.checkedInAt,
    checkedOutAt: stop.checkedOutAt,
    actualStayMinutes: stop.actualStayMinutes,
  };
}

function getRouteStopStayContribution(
  source: RouteStopStayContributionSource | null
): RouteStopStayContribution | null {
  const minutes = source?.actualStayMinutes ?? 0;

  if (!source || source.visitStatus !== "VISITED" || minutes <= 0) {
    return null;
  }

  return {
    minutes,
    visitedAt: source.visitedAt,
  };
}

async function applyPlaceStayStatChange(
  prisma: RouteServicePrisma,
  place: PlaceSnapshotInput,
  previousContribution: RouteStopStayContribution | null,
  nextContribution: RouteStopStayContribution | null
) {
  const placeKey = getPrimaryPlaceStayStatKey(place);

  if (!placeKey) {
    return;
  }

  const previousMinutes = previousContribution?.minutes ?? 0;
  const nextMinutes = nextContribution?.minutes ?? 0;
  const deltaMinutes = nextMinutes - previousMinutes;
  const deltaVisitCount =
    (nextContribution ? 1 : 0) - (previousContribution ? 1 : 0);

  if (deltaMinutes === 0 && deltaVisitCount === 0) {
    return;
  }

  const snapshotData = buildPlaceStayStatSnapshotData(place);

  if (nextContribution) {
    await prisma.placeStayStat.upsert({
      where: {
        placeKey,
      },
      create: {
        placeKey,
        ...snapshotData,
        totalActualStayMinutes: nextContribution.minutes,
        visitCount: 1,
        lastVisitedAt: nextContribution.visitedAt,
      },
      update: {
        ...snapshotData,
        totalActualStayMinutes: {
          increment: deltaMinutes,
        },
        visitCount: {
          increment: deltaVisitCount,
        },
        lastVisitedAt: nextContribution.visitedAt,
      },
    });
    return;
  }

  const currentStat = await prisma.placeStayStat.findUnique({
    where: {
      placeKey,
    },
  });

  if (!currentStat) {
    return;
  }

  const nextVisitCount = Math.max(0, currentStat.visitCount + deltaVisitCount);
  const nextTotalActualStayMinutes = Math.max(
    0,
    currentStat.totalActualStayMinutes + deltaMinutes
  );

  await prisma.placeStayStat.update({
    where: {
      placeKey,
    },
    data: {
      ...snapshotData,
      totalActualStayMinutes: nextTotalActualStayMinutes,
      visitCount: nextVisitCount,
      lastVisitedAt: nextVisitCount === 0 ? null : currentStat.lastVisitedAt,
    },
  });
}

export async function syncPlaceStayStatForRouteStopChange(
  prisma: RouteServicePrisma,
  previousStop: RouteStopStayContributionSource,
  nextStop: RouteStopStayContributionSource | null
) {
  await applyPlaceStayStatChange(
    prisma,
    previousStop.place,
    previousStop.stayStatSyncedAt
      ? getRouteStopStayContribution(previousStop)
      : null,
    getRouteStopStayContribution(nextStop)
  );
}

async function markPlacePhotoDeletedForRouteStop(
  prisma: RouteServicePrisma,
  routeStopId: string
) {
  await prisma.placePhoto.updateMany({
    where: {
      routeStopId,
    },
    data: {
      status: "DELETED",
    },
  });
}

export async function syncPlacePhotoForRouteStopVisit(
  prisma: RouteServicePrisma,
  user: User,
  route: Route,
  stop: RouteStop,
  visitData: RouteStopVisitData
) {
  const photoUrl = nullableString(visitData.verificationPhotoUrl);
  const canPublishPhoto =
    Boolean(photoUrl) &&
    PUBLISHABLE_PLACE_PHOTO_STATUSES.has(visitData.verificationStatus);

  if (!photoUrl || !canPublishPhoto) {
    await markPlacePhotoDeletedForRouteStop(prisma, stop.id);
    return;
  }

  const placeKeys = getPlaceStayStatKeys(stop.place);
  const placeKey = placeKeys[0];

  if (!placeKey) {
    await markPlacePhotoDeletedForRouteStop(prisma, stop.id);
    return;
  }

  const verifiedAt = visitData.verifiedAt ?? visitData.visitedAt ?? new Date();
  const thumbnailUrl = buildPlacePhotoThumbnailUrl(photoUrl);
  const placePhotoData = {
    placeKey,
    placeKeys,
    ...buildPlacePhotoSnapshotData(stop.place),
    userId: user.id,
    routeId: route.id,
    routeStopId: stop.id,
    routeDayId: stop.dayId,
    routeVisibility: route.visibility,
    imageId: nullableString(visitData.verificationPhotoImageId),
    imageUrl: photoUrl,
    thumbnailUrl: thumbnailUrl ?? photoUrl,
    variant: getImageDeliveryVariantName(photoUrl),
    source: "VISIT_PHOTO" as const,
    status: "ACTIVE" as const,
    verifiedAt,
  };

  await prisma.placePhoto.upsert({
    where: {
      routeStopId: stop.id,
    },
    create: placePhotoData,
    update: placePhotoData,
  });
}

export async function markRouteStopVisited(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  visited: boolean,
  verification?: RouteStopVisitVerificationInput | null,
  actualStayMinutes?: number | null
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new Error("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);

  const visitData = buildRouteStopVisitData(
    stop,
    visited,
    verification,
    actualStayMinutes
  );
  const nextStop: RouteStopStayContributionSource = {
    place: stop.place,
    visitStatus: visitData.visitStatus,
    visitedAt: visitData.visitedAt,
    actualStayMinutes: visitData.actualStayMinutes,
  };
  const shouldSyncNextStayStat =
    Boolean(getRouteStopStayContribution(nextStop)) &&
    Boolean(getPrimaryPlaceStayStatKey(stop.place));
  const nextStayStatSyncedAt = shouldSyncNextStayStat ? new Date() : null;

  await prisma.$transaction(async (transaction) => {
    await transaction.routeStop.update({
      where: {
        id: stopId,
      },
      data: {
        ...visitData,
        stayStatSyncedAt: nextStayStatSyncedAt,
      },
    });

    await syncPlaceStayStatForRouteStopChange(transaction, stop, nextStop);
    await syncPlacePhotoForRouteStopVisit(
      transaction,
      user,
      route,
      stop,
      visitData
    );
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

export async function getPlaceStaySummary(
  prisma: PrismaClient,
  input: PlaceSnapshotInput
): Promise<PlaceStaySummary> {
  const [summary] = await getPlaceStaySummaries(prisma, [input]);
  return summary ?? createEmptyPlaceStaySummary();
}

function createEmptyPlaceStaySummary(): PlaceStaySummary {
  return {
    averageActualStayMinutes: null,
    visitCount: 0,
    lastVisitedAt: null,
  };
}

export async function getPlaceStaySummaries(
  prisma: PrismaClient,
  inputs: PlaceSnapshotInput[]
): Promise<PlaceStaySummary[]> {
  const targetKeys = inputs.map((input) => getPlaceStayStatKeys(input));
  const uniquePlaceKeys = [...new Set(targetKeys.flat())];

  if (targetKeys.length === 0 || uniquePlaceKeys.length === 0) {
    return targetKeys.map(() => createEmptyPlaceStaySummary());
  }

  const stats = await prisma.placeStayStat.findMany({
    where: {
      placeKey: {
        in: uniquePlaceKeys,
      },
    },
    select: {
      placeKey: true,
      totalActualStayMinutes: true,
      visitCount: true,
      lastVisitedAt: true,
    },
  });

  const statByPlaceKey = new Map(
    stats.map((stat) => [stat.placeKey, stat] as const)
  );

  return targetKeys.map((placeKeys) => {
    const stat = placeKeys
      .map((placeKey) => statByPlaceKey.get(placeKey))
      .find(Boolean);

    if (!stat || stat.visitCount <= 0) {
      return createEmptyPlaceStaySummary();
    }

    return {
      averageActualStayMinutes: Math.round(
        stat.totalActualStayMinutes / stat.visitCount
      ),
      visitCount: stat.visitCount,
      lastVisitedAt: stat.lastVisitedAt,
    };
  });
}

export async function getPlacePhotos(
  prisma: PrismaClient,
  input: PlaceSnapshotInput,
  options: PlacePhotoListOptions = {}
) {
  const placeKeys = getPlaceStayStatKeys(input);

  if (placeKeys.length === 0) {
    return [];
  }

  return prisma.placePhoto.findMany({
    where: {
      status: "ACTIVE",
      routeVisibility: "PUBLIC",
      OR: [
        {
          placeKey: {
            in: placeKeys,
          },
        },
        {
          placeKeys: {
            hasSome: placeKeys,
          },
        },
      ],
    },
    orderBy: [
      {
        verifiedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
    take: clampPlacePhotoLimit(options.limit),
  });
}
