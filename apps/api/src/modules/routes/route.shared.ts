import type {
  PrismaClient,
  Route,
  RouteStop,
  RouteStopVerificationStatus,
} from "@prisma/client";
import type { PlaceSnapshotInput } from "./route.types.js";

export const VERIFIED_ROUTE_STOP_STATUSES = new Set<RouteStopVerificationStatus>([
  "GPS",
  "GPS_PHOTO",
]);

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function nullableString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || null;
}

function normalizeDuplicateText(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toLowerCase() ?? "";
}

function coordinateDuplicateKey(value: number) {
  return Number.isFinite(value) ? value.toFixed(5) : "";
}

export function getPlaceDuplicateKeys(place: PlaceSnapshotInput) {
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

export function getPlaceStayStatKeys(place: PlaceSnapshotInput) {
  return getPlaceDuplicateKeys(normalizePlaceSnapshot(place));
}

export function getPrimaryPlaceStayStatKey(place: PlaceSnapshotInput) {
  return getPlaceStayStatKeys(place)[0] ?? null;
}

export function buildPlaceStayStatSnapshotData(place: PlaceSnapshotInput) {
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

export function buildPlacePhotoSnapshotData(place: PlaceSnapshotInput) {
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

export function getImageDeliveryVariantName(imageUrl: string) {
  return parseImageDeliveryUrl(imageUrl)?.variant ?? null;
}

function getPlacePhotoThumbnailVariantName() {
  return process.env.CF_IMAGES_THUMBNAIL_VARIANT?.trim() || null;
}

export function buildPlacePhotoThumbnailUrl(imageUrl: string) {
  const thumbnailVariant = getPlacePhotoThumbnailVariantName();

  if (!thumbnailVariant) {
    return imageUrl;
  }

  return buildImageDeliveryVariantUrl(imageUrl, thumbnailVariant) ?? imageUrl;
}

export function normalizePlaceSnapshot(place: PlaceSnapshotInput) {
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

export function buildRouteShareTags(route: Route, stops: RouteStop[]) {
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

export async function assertRouteOwner(
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

export async function refreshRouteProgress(prisma: PrismaClient, routeId: string) {
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
