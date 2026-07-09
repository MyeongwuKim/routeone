import type {
  PlaceProvider,
  Prisma,
  PrismaClient,
  Route,
  RouteStop,
  RouteStopVerificationStatus,
  User,
  VisitStatus,
} from "@prisma/client";
import { isDevVerificationBypassEnabled } from "../../lib/devVerification.js";

export type PlaceSnapshotInput = {
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

type RouteStartLocationInput = {
  lat: number;
  lng: number;
};

type CreateRouteStopInput = {
  dayIndex?: number | null;
  order?: number | null;
  place: PlaceSnapshotInput;
  stayMinutes?: number | null;
  travelMinutesFromPrevious?: number | null;
  memo?: string | null;
};

export type CreateRouteInput = {
  countryCode?: string | null;
  primaryRegionCode?: string | null;
  primaryRegionLabelKey?: string | null;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  dailyStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  startLocation?: RouteStartLocationInput | null;
  stops?: CreateRouteStopInput[] | null;
};

export type AppendRouteDaysInput = {
  routeId: string;
  tripDays: number;
  travelStartDate?: Date | null;
  travelEndDate?: Date | null;
  dailyStartMinutes?: number | null;
  scheduleEndMinutes?: number | null;
  startLocation?: RouteStartLocationInput | null;
  stops?: CreateRouteStopInput[] | null;
};

export type StartRouteInput = {
  routeId: string;
  startedAt: Date;
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

export type UpdateRouteStopStayMinutesInput = {
  stopId: string;
  stayMinutes: number;
};

export type PlaceStaySummary = {
  averageActualStayMinutes: number | null;
  visitCount: number;
  lastVisitedAt: Date | null;
};

export type PlacePhotoListOptions = {
  limit?: number | null;
};

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

export type RouteStopVisitVerificationInput = {
  status?: RouteStopVerificationStatus | null;
  lat?: number | null;
  lng?: number | null;
  accuracyMeters?: number | null;
  photoImageId?: string | null;
  photoUrl?: string | null;
};

const VERIFIED_ROUTE_STOP_STATUSES = new Set<RouteStopVerificationStatus>([
  "GPS_PHOTO",
]);
const GPS_VERIFICATION_MAX_DISTANCE_METERS = 100;
const BYPASS_GPS_PHOTO_LOCATION_VERIFICATION = false;
const EARTH_RADIUS_METERS = 6_371_000;
const DEFAULT_PLACE_PHOTO_LIMIT = 30;
const MAX_PLACE_PHOTO_LIMIT = 60;

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

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
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

function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeDayMinutes(value?: number | null) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const minutes = Math.round(value ?? 0);
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null;
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

function getPlaceStayStatKeys(place: PlaceSnapshotInput) {
  return getPlaceDuplicateKeys(normalizePlaceSnapshot(place));
}

function getPrimaryPlaceStayStatKey(place: PlaceSnapshotInput) {
  return getPlaceStayStatKeys(place)[0] ?? null;
}

function buildPlaceStayStatSnapshotData(place: PlaceSnapshotInput) {
  const normalizedPlace = normalizePlaceSnapshot(place);

  return {
    provider: normalizedPlace.provider,
    externalId: normalizedPlace.externalId,
    contentId: normalizedPlace.contentId,
    contentTypeId: normalizedPlace.contentTypeId,
    title: normalizedPlace.title,
    address: normalizedPlace.address,
    lat: normalizedPlace.lat,
    lng: normalizedPlace.lng,
    categoryLabel: normalizedPlace.categoryLabel,
    categoryName: normalizedPlace.categoryName,
    imageUrl: normalizedPlace.imageUrl,
    regionCode: normalizedPlace.regionCode,
    regionLabelKey: normalizedPlace.regionLabelKey,
  };
}

function buildPlacePhotoSnapshotData(place: PlaceSnapshotInput) {
  const { imageUrl, ...snapshotData } = buildPlaceStayStatSnapshotData(place);

  return {
    ...snapshotData,
    placeImageUrl: imageUrl,
  };
}

function parseImageDeliveryUrl(imageUrl: string) {
  try {
    const url = new URL(imageUrl);

    if (url.hostname !== "imagedelivery.net") {
      return null;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);

    if (pathParts.length < 3) {
      return null;
    }

    return {
      url,
      accountHash: pathParts[0],
      imageId: pathParts[1],
      variant: pathParts[2],
      pathParts,
    };
  } catch {
    return null;
  }
}

function buildImageDeliveryVariantUrl(imageUrl: string, variant: string) {
  const parsedImageUrl = parseImageDeliveryUrl(imageUrl);

  if (!parsedImageUrl) {
    return null;
  }

  const nextUrl = new URL(parsedImageUrl.url.toString());
  const nextPathParts = [...parsedImageUrl.pathParts];
  nextPathParts[2] = variant;
  nextUrl.pathname = `/${nextPathParts.join("/")}`;

  return nextUrl.toString();
}

function getImageDeliveryVariantName(imageUrl: string) {
  return parseImageDeliveryUrl(imageUrl)?.variant ?? null;
}

function clampPlacePhotoLimit(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return DEFAULT_PLACE_PHOTO_LIMIT;
  }

  return Math.max(1, Math.min(MAX_PLACE_PHOTO_LIMIT, Math.round(value)));
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

const REGION_TAG_RULES = [
  { token: "강원", tag: "강원" },
  { token: "서울", tag: "서울" },
  { token: "부산", tag: "부산" },
  { token: "제주", tag: "제주" },
  { token: "경기", tag: "경기" },
  { token: "인천", tag: "인천" },
  { token: "대구", tag: "대구" },
  { token: "대전", tag: "대전" },
  { token: "광주", tag: "광주" },
  { token: "울산", tag: "울산" },
  { token: "세종", tag: "세종" },
  { token: "충북", tag: "충북" },
  { token: "충남", tag: "충남" },
  { token: "전북", tag: "전북" },
  { token: "전남", tag: "전남" },
  { token: "경북", tag: "경북" },
  { token: "경남", tag: "경남" },
];

function getRouteRegionTag(route: Route, stops: RouteStop[]) {
  const sourceText = [
    route.primaryRegionLabelKey,
    route.primaryRegionCode,
    ...stops.flatMap((stop) => [
      stop.place.address,
      stop.place.regionCode,
      stop.place.regionLabelKey,
    ]),
  ]
    .filter(Boolean)
    .join(" ");

  return REGION_TAG_RULES.find((rule) => sourceText.includes(rule.token))?.tag;
}

function getStopCategoryText(stop: RouteStop) {
  return [
    stop.place.title,
    stop.place.categoryLabel,
    stop.place.categoryName,
    stop.place.contentTypeId,
  ]
    .filter(Boolean)
    .join(" ");
}

function getStopFocusBucket(stop: RouteStop) {
  const categoryText = getStopCategoryText(stop);

  if (/카페|커피|디저트|베이커리|찻집/.test(categoryText)) {
    return "카페";
  }

  if (/해변|해수욕장|바다|항구|항만/.test(categoryText)) {
    return "해변";
  }

  if (/공원|수목원|정원/.test(categoryText)) {
    return "공원";
  }

  if (/동굴|굴/.test(categoryText)) {
    return "동굴";
  }

  if (/시장|전통시장/.test(categoryText)) {
    return "시장";
  }

  if (/음식|맛집|식당|한식|일식|중식|양식|분식|주점|술집|39/.test(categoryText)) {
    return "음식점";
  }

  if (
    /관광|여행|명소|박물관|전시|체험|역사|문화|12|14|28/.test(categoryText)
  ) {
    return "관광지";
  }

  return "장소";
}

function getRouteFocusTag(stops: RouteStop[]) {
  if (stops.length === 0) {
    return null;
  }

  const bucketCounts = new Map<string, number>();
  const tourBuckets = new Set(["관광지", "해변", "공원", "동굴", "시장"]);

  for (const stop of stops) {
    const bucket = getStopFocusBucket(stop);
    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  }

  const sortedBuckets = [...bucketCounts.entries()].sort(
    (left, right) => right[1] - left[1]
  );
  const [topBucket, topCount] = sortedBuckets[0] ?? [];
  const cafeCount = bucketCounts.get("카페") ?? 0;
  const foodCount = bucketCounts.get("음식점") ?? 0;
  const tourCount = sortedBuckets.reduce(
    (total, [bucket, count]) => total + (tourBuckets.has(bucket) ? count : 0),
    0
  );

  if (!topBucket || !topCount) {
    return null;
  }

  if (cafeCount >= 2 && cafeCount / stops.length >= 0.35 && cafeCount >= foodCount) {
    return "카페 위주";
  }

  if (foodCount >= 2 && foodCount / stops.length >= 0.35) {
    return "음식점 위주";
  }

  if (tourCount >= 2 && tourCount / stops.length >= 0.4) {
    const topTourBucket = sortedBuckets.find(([bucket]) =>
      tourBuckets.has(bucket)
    );

    if (
      topTourBucket &&
      topTourBucket[0] !== "관광지" &&
      topTourBucket[1] >= 2 &&
      topTourBucket[1] / stops.length >= 0.35
    ) {
      return `${topTourBucket[0]} 위주`;
    }

    return "관광지 위주";
  }

  if (topCount >= 2 && topCount / stops.length >= 0.4) {
    return `${topBucket} 위주`;
  }

  return "골고루 담은 루트";
}

function getRoutePlanPaceTag(route: Route, stops: RouteStop[]) {
  if (stops.length === 0) {
    return "가벼운 플랜";
  }

  const averageStopsPerDay = stops.length / Math.max(1, route.tripDays);
  const averageStayMinutes =
    stops.reduce((total, stop) => total + (stop.stayMinutes ?? 60), 0) /
    stops.length;

  if (averageStopsPerDay >= 4 || averageStayMinutes <= 55) {
    return "촘촘 플랜";
  }

  if (averageStopsPerDay <= 2.5 || averageStayMinutes >= 85) {
    return "여유 플랜";
  }

  return "균형 플랜";
}

function isVerifiedRouteStop(stop: RouteStop) {
  return VERIFIED_ROUTE_STOP_STATUSES.has(stop.verificationStatus ?? "NONE");
}

function getRouteVerificationTag(stops: RouteStop[]) {
  if (stops.length === 0) {
    return null;
  }

  const verifiedStopCount = stops.filter(isVerifiedRouteStop).length;

  return verifiedStopCount > 0
    ? `인증 ${verifiedStopCount}/${stops.length}곳`
    : "미인증 루트";
}

function getRouteDurationTag(route: Route) {
  if (route.tripDays <= 1) {
    return "당일치기";
  }

  return `${route.tripDays - 1}박 ${route.tripDays}일`;
}

function buildRouteShareTags(route: Route, stops: RouteStop[]) {
  return [
    getRouteRegionTag(route, stops),
    getRouteDurationTag(route),
    getRoutePlanPaceTag(route, stops),
    getRouteVerificationTag(stops),
    getRouteFocusTag(stops),
  ].filter((tag, index, tags): tag is string =>
    Boolean(tag && tags.indexOf(tag) === index)
  );
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

function getVisitVerificationStatus(
  verification?: RouteStopVisitVerificationInput | null
) {
  const status = verification?.status ?? "MANUAL";

  if (status === "GPS") {
    throw new Error("사진 인증은 위치와 사진을 함께 확인해야 해요.");
  }

  return status === "NONE" ? "MANUAL" : status;
}

function assertRouteStopGpsVerification(
  stop: RouteStop,
  verification: RouteStopVisitVerificationInput | null | undefined,
  verificationStatus: RouteStopVerificationStatus
) {
  if (verificationStatus !== "GPS_PHOTO") {
    return;
  }

  if (isDevVerificationBypassEnabled()) {
    return;
  }

  if (BYPASS_GPS_PHOTO_LOCATION_VERIFICATION) {
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
  const isVerified = VERIFIED_ROUTE_STOP_STATUSES.has(verificationStatus);

  assertRouteStopGpsVerification(stop, verification, verificationStatus);

  const checkedInAt = stop.checkedInAt ?? (isVerified ? visitedAt : null);
  const checkedOutAt = stop.checkedInAt ? visitedAt : null;
  const normalizedActualStayMinutes =
    normalizeActualStayMinutes(actualStayMinutes);

  return {
    visitStatus: "VISITED" as VisitStatus,
    visitedAt,
    verificationStatus,
    verifiedAt: isVerified ? visitedAt : null,
    verificationPhotoImageId: isVerified
      ? nullableString(verification?.photoImageId)
      : null,
    verificationPhotoUrl: isVerified ? (verification?.photoUrl?.trim() ?? null) : null,
    verificationLat: isVerified ? (verification?.lat ?? null) : null,
    verificationLng: isVerified ? (verification?.lng ?? null) : null,
    verificationAccuracyMeters: isVerified
      ? (verification?.accuracyMeters ?? null)
      : null,
    checkedInAt,
    checkedOutAt,
    actualStayMinutes:
      normalizedActualStayMinutes ??
      getActualStayMinutes(checkedInAt, checkedOutAt),
  };
}

type RouteStopVisitData = ReturnType<typeof buildRouteStopVisitData>;

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

async function syncPlaceStayStatForRouteStopChange(
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

async function syncPlacePhotoForRouteStopVisit(
  prisma: RouteServicePrisma,
  user: User,
  route: Route,
  stop: RouteStop,
  visitData: RouteStopVisitData
) {
  const photoUrl = nullableString(visitData.verificationPhotoUrl);

  if (visitData.verificationStatus !== "GPS_PHOTO" || !photoUrl) {
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
  const thumbnailUrl = buildImageDeliveryVariantUrl(photoUrl, "thumbnail");
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

export async function shareRoute(
  prisma: PrismaClient,
  user: User,
  routeId: string
) {
  const route = await assertRouteOwner(prisma, routeId, user.id);
  const refreshedRoute = await refreshRouteProgress(prisma, route.id);
  const routeStops = await prisma.routeStop.findMany({
    where: {
      routeId: route.id,
    },
    orderBy: {
      order: "asc",
    },
  });

  if (refreshedRoute.status !== "COMPLETED") {
    throw new Error("완료한 루트만 공유할 수 있습니다.");
  }

  const shareTags = buildRouteShareTags(refreshedRoute, routeStops);

  return prisma.$transaction(async (transaction) => {
    const sharedRoute = await transaction.route.update({
      where: {
        id: routeId,
      },
      data: {
        visibility: "PUBLIC",
        sharedAt: refreshedRoute.sharedAt ?? new Date(),
        shareTags,
      },
    });

    await transaction.placePhoto.updateMany({
      where: {
        routeId,
        status: "ACTIVE",
      },
      data: {
        routeVisibility: "PUBLIC",
      },
    });

    return sharedRoute;
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

export async function getLikedRoutes(prisma: PrismaClient, user: User) {
  const likes = await prisma.routeLike.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const routes = await Promise.all(
    likes.map((like) =>
      prisma.route.findFirst({
        where: {
          id: like.routeId,
          visibility: "PUBLIC",
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
