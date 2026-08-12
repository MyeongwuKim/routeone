import type {
  Prisma,
  PrismaClient,
  Route,
  RouteStop,
  RouteStopVerificationStatus,
  User,
  VisitStatus,
} from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";
import { deleteRouteVisitPhotoImages } from "./routeVisitPhoto.service.js";
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
  UpdateRouteStopVisitTimesInput,
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
const GPS_VERIFICATION_MAX_ACCURACY_METERS = 100;

const BYPASS_GPS_LOCATION_VERIFICATION = false;

const EARTH_RADIUS_METERS = 6_371_000;

const DEFAULT_PLACE_PHOTO_LIMIT = 30;

const MAX_PLACE_PHOTO_LIMIT = 60;
const ROUTE_CORRECTION_GRACE_DAYS = 7;
const ROUTE_CORRECTION_TIME_ZONE = "Asia/Seoul";

const PUBLISHABLE_PLACE_PHOTO_STATUSES = new Set<RouteStopVerificationStatus>([
  "GPS_PHOTO",
  "GPS",
  "MANUAL",
]);

function getDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getTodayDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ROUTE_CORRECTION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getDateKeyDiffInDays(leftDateKey: string, rightDateKey: string) {
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.round(
    (Date.parse(`${leftDateKey}T00:00:00.000Z`) -
      Date.parse(`${rightDateKey}T00:00:00.000Z`)) /
      dayMs
  );
}

function assertRouteCorrectionWindow(route: Route) {
  const routeEndDate = route.travelEndDate ?? route.travelStartDate;

  if (!routeEndDate) {
    return;
  }

  const daysSinceEnd = getDateKeyDiffInDays(
    getTodayDateKey(),
    getDateKey(routeEndDate)
  );

  if (daysSinceEnd > ROUTE_CORRECTION_GRACE_DAYS) {
    throw new UserFacingError("루트 종료 후 7일이 지나 방문 기록을 수정할 수 없어요.");
  }
}

function assertRoutePhotoCorrectionWindow(route: Route) {
  const routeEndDate = route.travelEndDate ?? route.travelStartDate;

  if (!routeEndDate) {
    throw new UserFacingError("완료 일정의 날짜를 확인할 수 없어요.");
  }

  const daysSinceEnd = getDateKeyDiffInDays(
    getTodayDateKey(),
    getDateKey(routeEndDate)
  );

  if (daysSinceEnd < 0 || daysSinceEnd > ROUTE_CORRECTION_GRACE_DAYS) {
    throw new UserFacingError("일정 종료 후 7일 동안만 인증 사진을 수정할 수 있어요.");
  }
}

async function assertRouteStopVisitDate(
  prisma: RouteServicePrisma,
  route: Route,
  stop: RouteStop,
  options: { allowPast: boolean }
) {
  if (isDevVerificationBypassEnabled()) {
    return;
  }

  if (!route.startedAt) {
    throw new UserFacingError("루트를 먼저 시작한 뒤 인증해 주세요.");
  }

  if (!stop.dayId) {
    throw new UserFacingError("일정 날짜가 없는 장소는 인증할 수 없어요.");
  }

  const routeDay = await prisma.routeDay.findUnique({
    where: {
      id: stop.dayId,
    },
    select: {
      date: true,
    },
  });
  const routeDayDateKey = routeDay?.date ? getDateKey(routeDay.date) : null;

  if (!routeDayDateKey) {
    throw new UserFacingError("DAY 날짜를 먼저 설정한 뒤 인증해 주세요.");
  }

  const todayDateKey = getTodayDateKey();

  if (routeDayDateKey > todayDateKey) {
    throw new UserFacingError(
      `해당 DAY 날짜에만 인증할 수 있어요. 일정 날짜는 ${routeDayDateKey}예요.`
    );
  }

  if (!options.allowPast && routeDayDateKey < todayDateKey) {
    throw new UserFacingError(
      `지난 DAY에서는 실시간 인증을 진행할 수 없어요. 일정 날짜는 ${routeDayDateKey}예요.`
    );
  }
}

function clampPlacePhotoLimit(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_PLACE_PHOTO_LIMIT;
  }

  return Math.max(1, Math.min(MAX_PLACE_PHOTO_LIMIT, Math.round(value)));
}

function toFiniteCoordinate(value: unknown) {
  if (value == null || value === "") {
    return null;
  }

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
    throw new UserFacingError("현재 위치를 확인하지 못했어요. 위치 권한과 GPS 상태를 확인해 주세요.");
  }

  const accuracyMeters = toFiniteCoordinate(verification?.accuracyMeters);

  if (accuracyMeters == null || accuracyMeters < 0) {
    throw new UserFacingError(
      "현재 위치의 정확도를 확인하지 못했어요. GPS 상태를 확인한 뒤 다시 시도해 주세요."
    );
  }

  if (accuracyMeters > GPS_VERIFICATION_MAX_ACCURACY_METERS) {
    throw new UserFacingError(
      `위치 정확도가 낮아요. GPS 신호가 안정된 후 다시 시도해 주세요. 현재 정확도는 약 ${Math.round(
        accuracyMeters
      )}m예요.`
    );
  }

  const placeCoordinates = getRouteStopPlaceCoordinates(stop);

  if (!placeCoordinates) {
    throw new UserFacingError("장소 좌표가 없어 위치 인증을 진행할 수 없어요.");
  }

  const distanceMeters = calculateDistanceMeters(
    {
      lat: currentLat,
      lng: currentLng,
    },
    placeCoordinates
  );

  if (distanceMeters > GPS_VERIFICATION_MAX_DISTANCE_METERS) {
    throw new UserFacingError(
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

function getRecordedRouteStopArrivalAt(stop: RouteStop) {
  if (stop.checkedInAt) {
    return stop.checkedInAt;
  }

  const completedAt = stop.checkedOutAt ?? stop.visitedAt;

  if (!completedAt || !stop.actualStayMinutes) {
    return null;
  }

  return new Date(
    completedAt.getTime() - stop.actualStayMinutes * 60_000
  );
}

function getRecordedRouteStopCompletionAt(stop: RouteStop) {
  return stop.checkedOutAt ??
    (stop.visitStatus === "VISITED" ? stop.visitedAt : null);
}

async function assertRouteStopVisitTimeOrder(
  prisma: PrismaClient,
  stop: RouteStop,
  checkedInAt: Date,
  checkedOutAt: Date | null
) {
  const siblingStops = await prisma.routeStop.findMany({
    where: {
      routeId: stop.routeId,
      dayId: stop.dayId,
    },
    orderBy: {
      order: "asc",
    },
  });
  const stopIndex = siblingStops.findIndex(
    (candidateStop) => candidateStop.id === stop.id
  );

  if (stopIndex < 0) {
    return;
  }

  const previousTimedStop = siblingStops
    .slice(0, stopIndex)
    .reverse()
    .find(
      (candidateStop) =>
        getRecordedRouteStopCompletionAt(candidateStop) ||
        getRecordedRouteStopArrivalAt(candidateStop)
    );

  if (previousTimedStop) {
    const previousCompletionAt =
      getRecordedRouteStopCompletionAt(previousTimedStop);

    if (!previousCompletionAt) {
      throw new UserFacingError(
        `앞 장소 '${previousTimedStop.place.title}' 방문을 먼저 완료해 주세요.`
      );
    }

    if (checkedInAt.getTime() < previousCompletionAt.getTime()) {
      throw new UserFacingError(
        `도착시간은 앞 장소 '${previousTimedStop.place.title}'의 완료시간보다 빠를 수 없어요.`
      );
    }
  }

  const nextTimedStop = siblingStops
    .slice(stopIndex + 1)
    .find(
      (candidateStop) =>
        getRecordedRouteStopArrivalAt(candidateStop) ||
        getRecordedRouteStopCompletionAt(candidateStop)
    );

  if (!nextTimedStop) {
    return;
  }

  const nextBoundaryAt =
    getRecordedRouteStopArrivalAt(nextTimedStop) ??
    getRecordedRouteStopCompletionAt(nextTimedStop);
  const currentBoundaryAt = checkedOutAt ?? checkedInAt;

  if (
    nextBoundaryAt &&
    currentBoundaryAt.getTime() > nextBoundaryAt.getTime()
  ) {
    throw new UserFacingError(
      `방문시간은 다음 장소 '${nextTimedStop.place.title}'의 도착시간보다 늦을 수 없어요.`
    );
  }
}

function normalizeActualStayMinutes(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(1, Math.min(480, Math.round(value)));
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
      verificationPhotoPublicationConsent: false,
      verificationPhotoPublishedAt: null,
      verificationLat: null,
      verificationLng: null,
      verificationAccuracyMeters: null,
      checkedInAt: null,
      checkedOutAt: null,
      actualStayMinutes: null,
      visitTimeEditedAt: null,
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
    verificationPhotoPublicationConsent: hasPhotoRecord ? false : null,
    verificationPhotoPublishedAt: null,
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
    visitTimeEditedAt: null,
  };
}

function buildRouteStopCheckInData(
  stop: RouteStop,
  verification: RouteStopVisitVerificationInput
): RouteStopVisitData {
  const checkedInAt = new Date();
  const verificationStatus = getVisitVerificationStatus(verification);

  if (verificationStatus !== "GPS" && verificationStatus !== "GPS_PHOTO") {
    throw new UserFacingError("도착 인증은 GPS 확인이 필요해요.");
  }

  assertRouteStopGpsVerification(stop, verification, verificationStatus);

  return {
    visitStatus: "PENDING",
    visitedAt: null,
    verificationStatus,
    verifiedAt: checkedInAt,
    verificationPhotoImageId:
      verificationStatus === "GPS_PHOTO"
        ? nullableString(verification.photoImageId)
        : null,
    verificationPhotoUrl:
      verificationStatus === "GPS_PHOTO"
        ? nullableString(verification.photoUrl)
        : null,
    verificationPhotoPublicationConsent:
      verificationStatus === "GPS_PHOTO" ? false : null,
    verificationPhotoPublishedAt: null,
    verificationLat: verification.lat ?? null,
    verificationLng: verification.lng ?? null,
    verificationAccuracyMeters: verification.accuracyMeters ?? null,
    checkedInAt,
    checkedOutAt: null,
    actualStayMinutes: null,
    visitTimeEditedAt: null,
  };
}

function buildRouteStopCompletionData(
  stop: RouteStop,
  actualStayMinutes?: number | null
): RouteStopVisitData {
  if (!stop.checkedInAt) {
    throw new UserFacingError("먼저 장소 도착 인증을 진행해 주세요.");
  }

  const checkedOutAt = new Date();

  return {
    visitStatus: "VISITED",
    visitedAt: checkedOutAt,
    verificationStatus: stop.verificationStatus ?? "NONE",
    verifiedAt: stop.verifiedAt,
    verificationPhotoImageId: stop.verificationPhotoImageId,
    verificationPhotoUrl: stop.verificationPhotoUrl,
    verificationPhotoPublicationConsent:
      stop.verificationPhotoPublicationConsent,
    verificationPhotoPublishedAt: stop.verificationPhotoPublishedAt,
    verificationLat: stop.verificationLat,
    verificationLng: stop.verificationLng,
    verificationAccuracyMeters: stop.verificationAccuracyMeters,
    checkedInAt: stop.checkedInAt,
    checkedOutAt,
    actualStayMinutes:
      normalizeActualStayMinutes(actualStayMinutes) ??
      getActualStayMinutes(stop.checkedInAt, checkedOutAt),
    visitTimeEditedAt: stop.visitTimeEditedAt,
  };
}

export type RouteStopVisitData = {
  visitStatus: VisitStatus;
  visitedAt: Date | null;
  verificationStatus: RouteStopVerificationStatus;
  verifiedAt: Date | null;
  verificationPhotoImageId: string | null;
  verificationPhotoUrl: string | null;
  verificationPhotoPublicationConsent: boolean | null;
  verificationPhotoPublishedAt: Date | null;
  verificationLat: number | null;
  verificationLng: number | null;
  verificationAccuracyMeters: number | null;
  checkedInAt: Date | null;
  checkedOutAt: Date | null;
  actualStayMinutes: number | null;
  visitTimeEditedAt: Date | null;
};

export function buildRouteStopVisitDataFromStop(stop: RouteStop): RouteStopVisitData {
  return {
    visitStatus: stop.visitStatus,
    visitedAt: stop.visitedAt,
    verificationStatus: stop.verificationStatus ?? "NONE",
    verifiedAt: stop.verifiedAt,
    verificationPhotoImageId: stop.verificationPhotoImageId,
    verificationPhotoUrl: stop.verificationPhotoUrl,
    verificationPhotoPublicationConsent:
      stop.verificationPhotoPublicationConsent,
    verificationPhotoPublishedAt: stop.verificationPhotoPublishedAt,
    verificationLat: stop.verificationLat,
    verificationLng: stop.verificationLng,
    verificationAccuracyMeters: stop.verificationAccuracyMeters,
    checkedInAt: stop.checkedInAt,
    checkedOutAt: stop.checkedOutAt,
    actualStayMinutes: stop.actualStayMinutes,
    visitTimeEditedAt: stop.visitTimeEditedAt,
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
      publicationConsent: false,
      publishedAt: null,
    },
  });
}

async function refreshRouteAfterVisitChange(
  prisma: PrismaClient,
  route: Route
) {
  const refreshedRoute = await refreshRouteProgress(prisma, route.id);

  if (route.visibility !== "PUBLIC") {
    return refreshedRoute;
  }

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
  const publicationConsent =
    visitData.verificationPhotoPublicationConsent;
  const isPublished =
    publicationConsent === true ||
    (publicationConsent == null && route.visibility === "PUBLIC");
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
    status: isPublished ? ("ACTIVE" as const) : ("HIDDEN" as const),
    publicationConsent,
    publishedAt: isPublished
      ? (visitData.verificationPhotoPublishedAt ?? verifiedAt)
      : null,
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

export async function checkInRouteStop(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  verification: RouteStopVisitVerificationInput
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);
  assertRouteCorrectionWindow(route);
  await assertRouteStopVisitDate(prisma, route, stop, { allowPast: false });

  if (stop.visitStatus === "VISITED") {
    throw new UserFacingError("이미 방문 완료한 장소예요.");
  }

  if (stop.checkedInAt) {
    return refreshRouteProgress(prisma, route.id);
  }

  const checkInData = buildRouteStopCheckInData(stop, verification);

  await prisma.routeStop.update({
    where: {
      id: stopId,
    },
    data: {
      ...checkInData,
      stayStatSyncedAt: null,
    },
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function setRouteStopPhotoPublication(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  published: boolean
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);

  if (
    !nullableString(stop.verificationPhotoUrl) ||
    !PUBLISHABLE_PLACE_PHOTO_STATUSES.has(stop.verificationStatus)
  ) {
    throw new UserFacingError("공개할 인증 사진이 없어요.");
  }

  const publishedAt = published ? new Date() : null;

  await prisma.$transaction(async (transaction) => {
    const nextStop = await transaction.routeStop.update({
      where: {
        id: stop.id,
      },
      data: {
        verificationPhotoPublicationConsent: published,
        verificationPhotoPublishedAt: publishedAt,
      },
    });

    await syncPlacePhotoForRouteStopVisit(
      transaction,
      user,
      route,
      nextStop,
      buildRouteStopVisitDataFromStop(nextStop)
    );
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function setRouteStopVisitPhoto(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  imageId: string,
  imageUrl: string
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);
  assertRoutePhotoCorrectionWindow(route);

  if (stop.visitStatus !== "VISITED") {
    throw new UserFacingError("완료한 장소에서만 인증 사진을 수정할 수 있어요.");
  }

  const normalizedImageId = nullableString(imageId);
  const normalizedImageUrl = nullableString(imageUrl);

  if (!normalizedImageId || !normalizedImageUrl) {
    throw new UserFacingError("저장할 인증 사진 정보가 올바르지 않아요.");
  }

  const nextVerificationStatus: RouteStopVerificationStatus =
    stop.verificationStatus === "GPS_PHOTO"
      ? "GPS"
      : stop.verificationStatus === "NONE"
        ? "MANUAL"
        : stop.verificationStatus;

  await prisma.$transaction(async (transaction) => {
    const nextStop = await transaction.routeStop.update({
      where: {
        id: stop.id,
      },
      data: {
        verificationStatus: nextVerificationStatus,
        verificationPhotoImageId: normalizedImageId,
        verificationPhotoUrl: normalizedImageUrl,
        verificationPhotoPublicationConsent: false,
        verificationPhotoPublishedAt: null,
      },
    });

    await syncPlacePhotoForRouteStopVisit(
      transaction,
      user,
      route,
      nextStop,
      buildRouteStopVisitDataFromStop(nextStop)
    );
  });

  if (
    stop.verificationPhotoImageId &&
    stop.verificationPhotoImageId !== normalizedImageId
  ) {
    try {
      await deleteRouteVisitPhotoImages([stop.verificationPhotoImageId]);
    } catch (error) {
      console.error(
        "[visit-photo] replaced image cleanup failed",
        error instanceof Error ? error.message : error
      );
    }
  }

  return refreshRouteAfterVisitChange(prisma, route);
}

export async function deleteRouteStopVisitPhoto(
  prisma: PrismaClient,
  user: User,
  stopId: string
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);

  if (!stop.verificationPhotoUrl) {
    return refreshRouteProgress(prisma, route.id);
  }

  if (stop.verificationPhotoImageId) {
    await deleteRouteVisitPhotoImages([stop.verificationPhotoImageId]);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.routeStop.update({
      where: {
        id: stop.id,
      },
      data: {
        verificationStatus:
          stop.verificationStatus === "GPS_PHOTO"
            ? "GPS"
            : stop.verificationStatus,
        verificationPhotoImageId: null,
        verificationPhotoUrl: null,
        verificationPhotoPublicationConsent: false,
        verificationPhotoPublishedAt: null,
      },
    });
    await markPlacePhotoDeletedForRouteStop(transaction, stop.id);
  });

  return refreshRouteProgress(prisma, route.id);
}

export async function completeRouteStopVisit(
  prisma: PrismaClient,
  user: User,
  stopId: string,
  actualStayMinutes?: number | null
) {
  const stop = await prisma.routeStop.findUnique({
    where: {
      id: stopId,
    },
  });

  if (!stop) {
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);
  assertRouteCorrectionWindow(route);
  await assertRouteStopVisitDate(prisma, route, stop, { allowPast: false });

  if (stop.visitStatus === "VISITED") {
    return refreshRouteAfterVisitChange(prisma, route);
  }

  const visitData = buildRouteStopCompletionData(stop, actualStayMinutes);
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

  return refreshRouteAfterVisitChange(prisma, route);
}

export async function updateRouteStopVisitTimes(
  prisma: PrismaClient,
  user: User,
  input: UpdateRouteStopVisitTimesInput
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
  assertRouteCorrectionWindow(route);

  if (!stop.checkedInAt && stop.visitStatus !== "VISITED") {
    throw new UserFacingError("도착 기록이 있는 장소만 시간을 수정할 수 있어요.");
  }

  const checkedInAt = new Date(input.checkedInAt);
  const checkedOutAt = input.checkedOutAt
    ? new Date(input.checkedOutAt)
    : null;

  if (Number.isNaN(checkedInAt.getTime())) {
    throw new UserFacingError("도착시간을 다시 확인해 주세요.");
  }

  if (checkedOutAt && Number.isNaN(checkedOutAt.getTime())) {
    throw new UserFacingError("완료시간을 다시 확인해 주세요.");
  }

  if (stop.visitStatus === "VISITED" && !checkedOutAt) {
    throw new UserFacingError("완료된 방문은 완료시간도 입력해 주세요.");
  }

  if (stop.visitStatus !== "VISITED" && checkedOutAt) {
    throw new UserFacingError("머무는 중인 장소에는 완료시간을 입력할 수 없어요.");
  }

  const nowWithTolerance = Date.now() + 60_000;

  if (
    checkedInAt.getTime() > nowWithTolerance ||
    (checkedOutAt && checkedOutAt.getTime() > nowWithTolerance)
  ) {
    throw new UserFacingError("현재보다 이후 시간으로는 수정할 수 없어요.");
  }

  if (checkedOutAt && checkedOutAt.getTime() < checkedInAt.getTime()) {
    throw new UserFacingError("완료시간은 도착시간보다 빠를 수 없어요.");
  }

  const actualStayMinutes = checkedOutAt
    ? getActualStayMinutes(checkedInAt, checkedOutAt)
    : null;

  if (actualStayMinutes && actualStayMinutes > 480) {
    throw new UserFacingError("체류시간은 최대 8시간까지 기록할 수 있어요.");
  }

  await assertRouteStopVisitTimeOrder(
    prisma,
    stop,
    checkedInAt,
    checkedOutAt
  );

  const nextStop: RouteStopStayContributionSource = {
    place: stop.place,
    visitStatus: stop.visitStatus,
    visitedAt: checkedOutAt ?? stop.visitedAt,
    actualStayMinutes,
  };
  const shouldSyncNextStayStat =
    Boolean(getRouteStopStayContribution(nextStop)) &&
    Boolean(getPrimaryPlaceStayStatKey(stop.place));
  const nextStayStatSyncedAt = shouldSyncNextStayStat ? new Date() : null;

  await prisma.$transaction(async (transaction) => {
    await transaction.routeStop.update({
      where: {
        id: stop.id,
      },
      data: {
        checkedInAt,
        checkedOutAt,
        visitedAt: checkedOutAt ?? stop.visitedAt,
        actualStayMinutes,
        visitTimeEditedAt: new Date(),
        stayStatSyncedAt: nextStayStatSyncedAt,
      },
    });

    await syncPlaceStayStatForRouteStopChange(transaction, stop, nextStop);
  });

  return refreshRouteAfterVisitChange(prisma, route);
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
    throw new UserFacingError("장소를 찾을 수 없습니다.");
  }

  const route = await assertRouteOwner(prisma, stop.routeId, user.id);
  assertRouteCorrectionWindow(route);

  if (visited) {
    const verificationStatus = getVisitVerificationStatus(verification);

    await assertRouteStopVisitDate(prisma, route, stop, {
      allowPast: !VERIFIED_ROUTE_STOP_STATUSES.has(verificationStatus),
    });
  }

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

  return refreshRouteAfterVisitChange(prisma, route);
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
      AND: [
        {
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
        {
          OR: [
            { publicationConsent: true },
            {
              publicationConsent: null,
              routeVisibility: "PUBLIC",
            },
            {
              publicationConsent: { isSet: false },
              routeVisibility: "PUBLIC",
            },
          ],
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
