const TOUR_API_BASE_URL = "/tour-api/B551011/KorService2/areaBasedList2";
const TOUR_LCLS_CODE_BASE_URL = "/tour-api/B551011/KorService2/lclsSystmCode2";
const TOUR_DETAIL_COMMON_BASE_URL =
  "/tour-api/B551011/KorService2/detailCommon2";
const TOUR_DETAIL_IMAGE_BASE_URL = "/tour-api/B551011/KorService2/detailImage2";
const TOUR_TATS_CONCENTRATION_BASE_URL =
  "/tour-api/B551011/TatsCnctrRateService/tatsCnctrRatedList";
const TOUR_LOCATION_BASED_BASE_URL =
  "/tour-api/B551011/KorService2/locationBasedList2";
const TOUR_RELATED_TOURIST_KEYWORD_BASE_URL =
  "/tour-api/B551011/TarRlteTarService1/searchKeyword1";

export const GANGWON_AREA_CODE = "32";

export const TOUR_CONTENT_TYPE_IDS = [
  "39", // 음식점
  "38", // 쇼핑
  "12", // 관광지
  "14", // 문화시설
  "15", // 축제/공연
  "28", // 레포츠
] as const;

type TourApiItem = {
  title?: string;
  mapx?: string;
  mapy?: string;
  addr1?: string;
  contentid?: string;
  contenttypeid?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  firstimage?: string;
  firstimage2?: string;
  overview?: string;
  originimgurl?: string;
  smallimageurl?: string;
};

type TourApiResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      totalCount?: string | number;
      items?: {
        item?: TourApiItem[] | TourApiItem;
      };
    };
  };
};

type LclsSystemItem = {
  lclsSystm1Cd?: string;
  lclsSystm1Nm?: string;
  lclsSystm2Cd?: string;
  lclsSystm2Nm?: string;
  lclsSystm3Cd?: string;
  lclsSystm3Nm?: string;
};

type LclsSystemResponse = {
  response?: {
    header?: {
      resultCode?: string;
      resultMsg?: string;
    };
    body?: {
      items?: {
        item?: LclsSystemItem[] | LclsSystemItem;
      };
    };
  };
};

export type GangwonAttraction = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeId: string;
  lclsSystm1: string;
  lclsSystm2: string;
  lclsSystm3: string;
  firstImage: string;
  secondImage: string;
};

export type TourPlaceDetail = {
  overview: string;
  images: string[];
};

export type TouristConcentrationPoint = {
  touristName: string;
  baseYmd: string;
  concentrationRate: number;
  areaCode: string;
  signguCode: string;
};

export type RelatedTouristPlace = {
  id: string;
  name: string;
  category: string;
  rank: number | null;
  relationScore: number | null;
  keyword: string;
  areaCode: string;
  signguCode: string;
  baseYm: string;
};

export type NearbyTouristPlace = {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeId: string;
  lclsSystm1: string;
  lclsSystm2: string;
  lclsSystm3: string;
  firstImage: string;
  secondImage: string;
  distanceM: number | null;
};

type FetchGangwonAttractionsOptions = {
  sigunguCode?: string;
  contentTypeIds?: string[];
};

type FetchTouristConcentrationOptions = {
  areaCode: string;
  signguCode: string;
  touristName?: string;
  numOfRows?: number;
  pageNo?: number;
};

type FetchRelatedTouristPlacesOptions = {
  areaCode: string;
  signguCode: string;
  keyword: string;
  baseYm?: string;
  numOfRows?: number;
  pageNo?: number;
};

type FetchNearbyTouristPlacesOptions = {
  lat: number;
  lng: number;
  radiusM?: number;
  numOfRows?: number;
  pageNo?: number;
  contentTypeIds?: string[];
  excludeContentId?: string;
};

function normalizeServiceKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function toArray<T>(value: T | T[] | undefined) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function stripHtml(htmlText?: string) {
  if (!htmlText) {
    return "";
  }

  return htmlText
    .replaceAll(/<br\s*\/?>/gi, "\n")
    .replaceAll(/<[^>]*>/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function canonicalizeImageUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.split("?")[0].split("#")[0];
  }
}

function dedupeImageUrls(urls: string[]) {
  const unique = new Map<string, string>();

  urls.forEach((imageUrl) => {
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return;
    }
    const key = canonicalizeImageUrl(trimmed);
    if (!unique.has(key)) {
      unique.set(key, trimmed);
    }
  });

  return [...unique.values()];
}

function normalizeYmd(rawValue: unknown) {
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }

  const digitsOnly = String(rawValue).replaceAll(/\D/g, "");
  if (digitsOnly.length !== 8) {
    return null;
  }

  return digitsOnly;
}

function readNumberFromUnknown(
  source: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const rawValue = source[key];
    if (rawValue == null) {
      continue;
    }
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function readStringFromUnknown(
  source: Record<string, unknown>,
  keys: string[]
) {
  for (const key of keys) {
    const rawValue = source[key];
    if (typeof rawValue === "string" && rawValue.trim()) {
      return rawValue.trim();
    }
  }
  return "";
}

function normalizeTouristName(rawName: string) {
  return rawName
    .toLowerCase()
    .replaceAll(/\([^)]*\)/g, "")
    .replaceAll(/[\s·\-_,./]/g, "")
    .trim();
}

function formatBaseYm(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}${month}`;
}

function buildBaseYmCandidates(explicitBaseYm?: string) {
  if (explicitBaseYm && /^\d{6}$/.test(explicitBaseYm)) {
    return [explicitBaseYm];
  }

  const now = new Date();
  const candidates: string[] = [];

  for (let offset = 0; offset < 6; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    candidates.push(formatBaseYm(date));
  }

  return candidates;
}

function parseRelatedTouristPlaces(
  rawItems: Record<string, unknown>[],
  fallback: {
    areaCode: string;
    signguCode: string;
    keyword: string;
    baseYm: string;
  }
) {
  return rawItems
    .map((rawItem, index): RelatedTouristPlace | null => {
      const name = readStringFromUnknown(rawItem, [
        "rlteAtsNm",
        "relatedTouristNm",
        "touristNm",
        "tAtsNm",
      ]);
      if (!name) {
        return null;
      }

      const category = readStringFromUnknown(rawItem, [
        "rlteAtsKndNm",
        "rlteAtsTypeNm",
        "category",
      ]);
      const rankValue = readNumberFromUnknown(rawItem, [
        "rlteRk",
        "rank",
        "rlteAtsRk",
        "seq",
      ]);
      const relationScore = readNumberFromUnknown(rawItem, [
        "cnctRate",
        "cnctRto",
        "score",
        "rlteScore",
      ]);
      const keyword = readStringFromUnknown(rawItem, [
        "keyword",
        "tAtsNm",
        "touristNm",
      ]);
      const areaCode =
        readStringFromUnknown(rawItem, ["areaCd", "areaCode"]) ||
        fallback.areaCode;
      const signguCode =
        readStringFromUnknown(rawItem, ["signguCd", "signguCode"]) ||
        fallback.signguCode;

      return {
        id: `related-${normalizeTouristName(name)}-${rankValue ?? index}-${
          fallback.baseYm
        }`,
        name,
        category,
        rank: rankValue != null ? Math.max(1, Math.round(rankValue)) : null,
        relationScore,
        keyword: keyword || fallback.keyword,
        areaCode,
        signguCode,
        baseYm: fallback.baseYm,
      };
    })
    .filter((item): item is RelatedTouristPlace => item !== null)
    .sort(sortRelatedTouristPlaces);
}

function sortRelatedTouristPlaces(
  a: RelatedTouristPlace,
  b: RelatedTouristPlace
) {
  if (a.rank != null && b.rank != null) {
    return a.rank - b.rank;
  }
  if (a.rank != null) {
    return -1;
  }
  if (b.rank != null) {
    return 1;
  }
  return (b.relationScore ?? -1) - (a.relationScore ?? -1);
}

function pickBetterRelatedTouristPlace(
  current: RelatedTouristPlace,
  incoming: RelatedTouristPlace
) {
  const rankingOrder = sortRelatedTouristPlaces(current, incoming);

  if (rankingOrder <= 0) {
    return {
      ...current,
      category: current.category || incoming.category,
      relationScore:
        current.relationScore ??
        incoming.relationScore ??
        current.relationScore,
    };
  }

  return {
    ...incoming,
    category: incoming.category || current.category,
    relationScore:
      incoming.relationScore ?? current.relationScore ?? incoming.relationScore,
  };
}

function mergeRelatedTouristPlaces(
  bucket: Map<string, RelatedTouristPlace>,
  places: RelatedTouristPlace[]
) {
  places.forEach((place) => {
    const normalizedName = normalizeTouristName(place.name);
    if (!normalizedName) {
      return;
    }

    const current = bucket.get(normalizedName);
    if (!current) {
      bucket.set(normalizedName, place);
      return;
    }

    bucket.set(normalizedName, pickBetterRelatedTouristPlace(current, place));
  });
}

async function requestRelatedTouristPlaces(
  endpoint: string,
  params: URLSearchParams
) {
  const response = await fetch(`${endpoint}?${params.toString()}`);
  if (!response.ok) {
    return [] as Record<string, unknown>[];
  }

  const data = (await response.json()) as TourApiResponse;
  const resultCode = data.response?.header?.resultCode;
  if (resultCode && resultCode !== "0000") {
    return [] as Record<string, unknown>[];
  }

  return toArray(data.response?.body?.items?.item) as Record<string, unknown>[];
}

export async function fetchGangwonAttractions(
  serviceKey: string,
  options: FetchGangwonAttractionsOptions = {}
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const contentTypeIds =
    options.contentTypeIds && options.contentTypeIds.length > 0
      ? options.contentTypeIds
      : [...TOUR_CONTENT_TYPE_IDS];

  const pageSize = 200;
  const maxPagesSafetyLimit = 100;
  const queryBase: Record<string, string> = {
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: `${pageSize}`,
    pageNo: "1",
    arrange: "Q",
    areaCode: GANGWON_AREA_CODE,
  };

  if (options.sigunguCode) {
    queryBase.sigunguCode = options.sigunguCode;
  }

  const results = await Promise.all(
    contentTypeIds.map(async (contentTypeId) => {
      const aggregatedItems: TourApiItem[] = [];
      let totalPages = Number.POSITIVE_INFINITY;

      for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
        if (pageNo > maxPagesSafetyLimit) {
          break;
        }

        const query = new URLSearchParams({
          ...queryBase,
          pageNo: `${pageNo}`,
          contentTypeId,
        });

        const response = await fetch(
          `${TOUR_API_BASE_URL}?${query.toString()}`
        );

        if (!response.ok) {
          const errorText = (await response.text()).trim();
          throw new Error(
            `Tour API request failed: ${response.status}${
              errorText ? ` (${errorText})` : ""
            }`
          );
        }

        const data = (await response.json()) as TourApiResponse;
        const resultCode = data.response?.header?.resultCode;

        if (resultCode && resultCode !== "0000") {
          const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
          throw new Error(`Tour API error: ${resultCode} ${resultMsg}`);
        }

        const items = toArray(data.response?.body?.items?.item);
        if (items.length === 0) {
          break;
        }
        aggregatedItems.push(...items);

        const totalCount = Number(data.response?.body?.totalCount ?? 0);
        if (Number.isFinite(totalCount) && totalCount > 0) {
          totalPages = Math.ceil(totalCount / pageSize);
        }

        if (items.length < pageSize) {
          break;
        }
      }

      return aggregatedItems
        .map((item, index): GangwonAttraction | null => {
          const lat = Number(item.mapy);
          const lng = Number(item.mapx);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return null;
          }

          return {
            id:
              item.contentid ??
              `${item.title ?? "spot"}-${contentTypeId}-${index}`,
            title: item.title ?? "이름 없음",
            address: item.addr1 ?? "주소 정보 없음",
            lat,
            lng,
            contentTypeId: item.contenttypeid ?? contentTypeId,
            lclsSystm1: item.lclsSystm1 ?? "",
            lclsSystm2: item.lclsSystm2 ?? "",
            lclsSystm3: item.lclsSystm3 ?? "",
            firstImage: item.firstimage ?? "",
            secondImage: item.firstimage2 ?? "",
          };
        })
        .filter((item): item is GangwonAttraction => item !== null);
    })
  );

  const unique = new Map<string, GangwonAttraction>();
  results.flat().forEach((attraction) => {
    const uniqueKey = `${attraction.id}-${attraction.contentTypeId}`;
    if (!unique.has(uniqueKey)) {
      unique.set(uniqueKey, attraction);
    }
  });

  return [...unique.values()];
}

export async function fetchLclsSystemNameMap(serviceKey: string) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const query = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: "1000",
    pageNo: "1",
    lclsSystmListYn: "Y",
  });

  const response = await fetch(
    `${TOUR_LCLS_CODE_BASE_URL}?${query.toString()}`
  );

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `Lcls code request failed: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const data = (await response.json()) as LclsSystemResponse;
  const resultCode = data.response?.header?.resultCode;

  if (resultCode && resultCode !== "0000") {
    const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`Lcls code API error: ${resultCode} ${resultMsg}`);
  }

  const items = toArray(data.response?.body?.items?.item);
  const codeNameMap: Record<string, string> = {};

  items.forEach((item) => {
    if (item.lclsSystm1Cd && item.lclsSystm1Nm) {
      codeNameMap[item.lclsSystm1Cd] = item.lclsSystm1Nm;
    }
    if (item.lclsSystm2Cd && item.lclsSystm2Nm) {
      codeNameMap[item.lclsSystm2Cd] = item.lclsSystm2Nm;
    }
    if (item.lclsSystm3Cd && item.lclsSystm3Nm) {
      codeNameMap[item.lclsSystm3Cd] = item.lclsSystm3Nm;
    }
  });

  return codeNameMap;
}

export async function fetchTourPlaceDetail(
  serviceKey: string,
  contentId: string,
  _contentTypeId?: string
) {
  if (!serviceKey || !contentId) {
    throw new Error("Tour place detail params are missing.");
  }

  const commonQuery = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentId,
    numOfRows: "10",
    pageNo: "1",
  });

  const imageQuery = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentId,
    imageYN: "Y",
    numOfRows: "50",
    pageNo: "1",
  });

  const [commonResponse, imageResponse] = await Promise.all([
    fetch(`${TOUR_DETAIL_COMMON_BASE_URL}?${commonQuery.toString()}`),
    fetch(`${TOUR_DETAIL_IMAGE_BASE_URL}?${imageQuery.toString()}`),
  ]);

  if (!commonResponse.ok) {
    const errorText = (await commonResponse.text()).trim();
    throw new Error(
      `Tour detail request failed: ${commonResponse.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const commonData = (await commonResponse.json()) as TourApiResponse;
  const commonCode = commonData.response?.header?.resultCode;

  if (commonCode && commonCode !== "0000") {
    const resultMsg = commonData.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`Tour detail API error: ${commonCode} ${resultMsg}`);
  }

  const commonItem = toArray(commonData.response?.body?.items?.item)[0];

  let detailImageUrls: string[] = [];
  if (imageResponse.ok) {
    const imageData = (await imageResponse.json()) as TourApiResponse;
    const imageCode = imageData.response?.header?.resultCode;
    if (!imageCode || imageCode === "0000") {
      detailImageUrls = toArray(imageData.response?.body?.items?.item)
        .map((item) => item.originimgurl ?? "")
        .filter((image): image is string => Boolean(image));
    }
  }

  const images = dedupeImageUrls(detailImageUrls);

  return {
    overview: stripHtml(commonItem?.overview),
    images,
  } satisfies TourPlaceDetail;
}

export async function fetchNearbyTouristPlaces(
  serviceKey: string,
  options: FetchNearbyTouristPlacesOptions
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  if (!Number.isFinite(options.lat) || !Number.isFinite(options.lng)) {
    throw new Error("주변 장소 조회 좌표가 올바르지 않습니다.");
  }

  const maxCount = Math.max(1, Math.min(30, options.numOfRows ?? 12));
  const radiusM = Math.max(100, Math.min(20000, Math.round(options.radiusM ?? 5000)));
  const contentTypeIds =
    options.contentTypeIds && options.contentTypeIds.length > 0
      ? options.contentTypeIds
      : ["12", "14", "15", "28", "38"];

  const unique = new Map<string, NearbyTouristPlace>();

  for (const contentTypeId of contentTypeIds) {
    const query = new URLSearchParams({
      serviceKey: normalizeServiceKey(serviceKey),
      MobileOS: "ETC",
      MobileApp: "RouteOne",
      _type: "json",
      pageNo: `${options.pageNo ?? 1}`,
      numOfRows: `${maxCount}`,
      arrange: "E",
      mapX: `${options.lng}`,
      mapY: `${options.lat}`,
      radius: `${radiusM}`,
      contentTypeId,
    });

    const response = await fetch(
      `${TOUR_LOCATION_BASED_BASE_URL}?${query.toString()}`
    );

    if (!response.ok) {
      const errorText = (await response.text()).trim();
      throw new Error(
        `Tour nearby request failed: ${response.status}${
          errorText ? ` (${errorText})` : ""
        }`
      );
    }

    const data = (await response.json()) as TourApiResponse;
    const resultCode = data.response?.header?.resultCode;

    if (resultCode && resultCode !== "0000") {
      const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
      throw new Error(`Tour nearby API error: ${resultCode} ${resultMsg}`);
    }

    const items = toArray(data.response?.body?.items?.item);
    items.forEach((item, index) => {
      const lat = Number(item.mapy);
      const lng = Number(item.mapx);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const parsedDistance = readNumberFromUnknown(item as Record<string, unknown>, [
        "dist",
        "distance",
      ]);

      const parsed: NearbyTouristPlace = {
        id: item.contentid ?? `${item.title ?? "spot"}-${contentTypeId}-${index}`,
        title: item.title ?? "이름 없음",
        address: item.addr1 ?? "주소 정보 없음",
        lat,
        lng,
        contentTypeId: item.contenttypeid ?? contentTypeId,
        lclsSystm1: item.lclsSystm1 ?? "",
        lclsSystm2: item.lclsSystm2 ?? "",
        lclsSystm3: item.lclsSystm3 ?? "",
        firstImage: item.firstimage ?? "",
        secondImage: item.firstimage2 ?? "",
        distanceM: parsedDistance,
      };

      const uniqueKey = `${parsed.id}-${parsed.contentTypeId}`;
      const existing = unique.get(uniqueKey);
      if (!existing) {
        unique.set(uniqueKey, parsed);
        return;
      }

      const existingDistance = existing.distanceM ?? Number.POSITIVE_INFINITY;
      const nextDistance = parsed.distanceM ?? Number.POSITIVE_INFINITY;
      if (nextDistance < existingDistance) {
        unique.set(uniqueKey, parsed);
      }
    });
  }

  return [...unique.values()]
    .filter((place) => place.id !== options.excludeContentId)
    .sort((a, b) => {
      const distanceA = a.distanceM ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distanceM ?? Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return a.title.localeCompare(b.title, "ko");
    })
    .slice(0, maxCount);
}

export async function fetchTouristConcentrationPoints(
  serviceKey: string,
  options: FetchTouristConcentrationOptions
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  if (!options.areaCode || !options.signguCode) {
    throw new Error("지역 코드를 찾을 수 없습니다.");
  }

  const query = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    pageNo: `${options.pageNo ?? 1}`,
    numOfRows: `${options.numOfRows ?? 300}`,
    areaCd: options.areaCode,
    signguCd: options.signguCode,
  });

  if (options.touristName) {
    query.set("tAtsNm", options.touristName);
  }

  const response = await fetch(
    `${TOUR_TATS_CONCENTRATION_BASE_URL}?${query.toString()}`
  );

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `Tour trend request failed: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const data = (await response.json()) as TourApiResponse;
  const resultCode = data.response?.header?.resultCode;

  if (resultCode && resultCode !== "0000") {
    const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`Tour trend API error: ${resultCode} ${resultMsg}`);
  }

  const rawItems = toArray(data.response?.body?.items?.item) as Record<
    string,
    unknown
  >[];

  const parsed = rawItems
    .map((rawItem): TouristConcentrationPoint | null => {
      const touristName = readStringFromUnknown(rawItem, [
        "tAtsNm",
        "touristName",
        "touristNm",
        "atsNm",
      ]);
      const baseYmd =
        normalizeYmd(rawItem.baseYmd) ||
        normalizeYmd(rawItem.predYmd) ||
        normalizeYmd(rawItem.fcstYmd) ||
        normalizeYmd(rawItem.cnctrYmd) ||
        normalizeYmd(rawItem.ymd);
      const concentrationRate = readNumberFromUnknown(rawItem, [
        "cnctrRate",
        "cnctrRto",
        "predVal",
        "cnctrVal",
        "score",
      ]);

      if (!touristName || !baseYmd || concentrationRate == null) {
        return null;
      }

      return {
        touristName,
        baseYmd,
        concentrationRate,
        areaCode:
          readStringFromUnknown(rawItem, ["areaCd", "areaCode"]) ||
          options.areaCode,
        signguCode:
          readStringFromUnknown(rawItem, ["signguCd", "signguCode"]) ||
          options.signguCode,
      };
    })
    .filter((item): item is TouristConcentrationPoint => item !== null)
    .sort((a, b) => a.baseYmd.localeCompare(b.baseYmd));

  return parsed;
}

export function buildLatestConcentrationMap(
  points: TouristConcentrationPoint[]
) {
  const latestByTourist = new Map<string, TouristConcentrationPoint>();

  points.forEach((point) => {
    const key = normalizeTouristName(point.touristName);
    const current = latestByTourist.get(key);
    if (!current || current.baseYmd < point.baseYmd) {
      latestByTourist.set(key, point);
    }
  });

  return latestByTourist;
}

export function toWeeklyAndMonthlySeries(points: TouristConcentrationPoint[]) {
  const sortedPoints = [...points].sort((a, b) =>
    a.baseYmd.localeCompare(b.baseYmd)
  );
  const monthly = sortedPoints.slice(-30);
  const weekly = sortedPoints.slice(-7);

  return {
    weekly,
    monthly,
  };
}

export async function fetchRelatedTouristPlaces(
  serviceKey: string,
  options: FetchRelatedTouristPlacesOptions
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  if (!options.areaCode || !options.signguCode || !options.keyword.trim()) {
    throw new Error("연관 관광지 조회 필수값이 누락되었습니다.");
  }

  const baseYmCandidates = buildBaseYmCandidates(options.baseYm);
  const maxCount = Math.max(1, Math.min(20, options.numOfRows ?? 10));
  const uniqueRelatedPlaces = new Map<string, RelatedTouristPlace>();

  for (const baseYm of baseYmCandidates) {
    const baseParams = new URLSearchParams({
      serviceKey: normalizeServiceKey(serviceKey),
      MobileOS: "ETC",
      MobileApp: "RouteOne",
      _type: "json",
      pageNo: `${options.pageNo ?? 1}`,
      numOfRows: `${options.numOfRows ?? 10}`,
      areaCd: options.areaCode,
      signguCd: options.signguCode,
      baseYm,
    });

    const keywordParams = new URLSearchParams(baseParams);
    keywordParams.set("keyword", options.keyword.trim());

    const keywordItems = await requestRelatedTouristPlaces(
      TOUR_RELATED_TOURIST_KEYWORD_BASE_URL,
      keywordParams
    );
    const keywordParsed = parseRelatedTouristPlaces(keywordItems, {
      areaCode: options.areaCode,
      signguCode: options.signguCode,
      keyword: options.keyword.trim(),
      baseYm,
    });

    mergeRelatedTouristPlaces(uniqueRelatedPlaces, keywordParsed);

    if (uniqueRelatedPlaces.size >= maxCount) {
      return [...uniqueRelatedPlaces.values()]
        .sort(sortRelatedTouristPlaces)
        .slice(0, maxCount);
    }

  }

  return [...uniqueRelatedPlaces.values()]
    .sort(sortRelatedTouristPlaces)
    .slice(0, maxCount);
}

export function normalizeTouristPlaceNameForMatch(placeName: string) {
  return normalizeTouristName(placeName);
}
