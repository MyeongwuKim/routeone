import type { AppLanguage } from "@/stores/appLanguageStore";
import {
  getDefaultTourContentTypeIds,
  getTourContentTypeId,
  isTourContentTypeId,
  localizeTourContentTypeId,
} from "@/lib/tourContentType";

const TOUR_TATS_CONCENTRATION_BASE_URL =
  "/tour-api/B551011/TatsCnctrRateService/tatsCnctrRatedList";
const TOUR_RELATED_TOURIST_KEYWORD_BASE_URL =
  "/tour-api/B551011/TarRlteTarService1/searchKeyword1";

const TOUR_SERVICE_NAME_BY_LANGUAGE: Record<AppLanguage, string> = {
  ko: "KorService2",
  en: "EngService2",
};

function getTourApiUrl(language: AppLanguage, operation: string) {
  return `/tour-api/B551011/${TOUR_SERVICE_NAME_BY_LANGUAGE[language]}/${operation}`;
}

export const GANGWON_AREA_CODE = "32";

type TourApiItem = {
  title?: string;
  mapx?: string;
  mapy?: string;
  addr1?: string;
  contentid?: string;
  contenttypeid?: string;
  areacode?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
  firstimage?: string;
  firstimage2?: string;
  eventstartdate?: string;
  eventenddate?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  sigungucode?: string;
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
  eventStartDate: string;
  eventEndDate: string;
  isTodayFestival: boolean;
  tourApiSigunguCode: string;
};

export type TourPlaceDetail = {
  overview: string;
  images: string[];
  operatingHours: string;
  restDate: string;
  infoCenter: string;
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

type FetchGangwonFestivalsOptions = {
  sigunguCode?: string;
  today?: Date;
  lookAheadDays?: number;
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

type TourApiListPage = {
  items: TourApiItem[];
  totalCount: number;
};

function normalizeServiceKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

const lclsSystemNameMapPromiseByServiceKey = new Map<
  string,
  Promise<Record<string, string>>
>();

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

function readIntroText(
  source: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  if (!source) {
    return "";
  }

  for (const key of keys) {
    const rawValue = source[key];
    if (typeof rawValue !== "string" && typeof rawValue !== "number") {
      continue;
    }

    const value = stripHtml(String(rawValue));
    if (value) {
      return value;
    }
  }

  return "";
}

function getTourIntroFields(
  source: Record<string, unknown> | null | undefined,
  contentTypeId?: string
) {
  const commonOperatingHourKeys = [
    "usetime",
    "usetimeculture",
    "usetimeleports",
    "opentime",
    "opentimefood",
    "playtime",
    "usetimefestival",
  ];
  const commonRestDateKeys = [
    "restdate",
    "restdateculture",
    "restdateleports",
    "restdateshopping",
    "restdatefood",
  ];
  const commonInfoCenterKeys = [
    "infocenter",
    "infocenterculture",
    "infocenterleports",
    "infocentershopping",
    "infocenterfood",
    "sponsor1tel",
    "sponsor2tel",
  ];

  const operatingHourKeysByType: Record<string, string[]> = {
    "12": ["usetime"],
    "14": ["usetimeculture"],
    "15": ["playtime", "usetimefestival"],
    "28": ["usetimeleports"],
    "38": ["opentime"],
    "39": ["opentimefood"],
  };
  const restDateKeysByType: Record<string, string[]> = {
    "12": ["restdate"],
    "14": ["restdateculture"],
    "28": ["restdateleports"],
    "38": ["restdateshopping"],
    "39": ["restdatefood"],
  };
  const infoCenterKeysByType: Record<string, string[]> = {
    "12": ["infocenter"],
    "14": ["infocenterculture"],
    "15": ["sponsor1tel", "sponsor2tel"],
    "28": ["infocenterleports"],
    "38": ["infocentershopping"],
    "39": ["infocenterfood"],
  };

  return {
    operatingHours: readIntroText(source, [
      ...(contentTypeId ? (operatingHourKeysByType[contentTypeId] ?? []) : []),
      ...commonOperatingHourKeys,
    ]),
    restDate: readIntroText(source, [
      ...(contentTypeId ? (restDateKeysByType[contentTypeId] ?? []) : []),
      ...commonRestDateKeys,
    ]),
    infoCenter: readIntroText(source, [
      ...(contentTypeId ? (infoCenterKeysByType[contentTypeId] ?? []) : []),
      ...commonInfoCenterKeys,
    ]),
  };
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

export async function fetchTourPlaceImageUrls(
  serviceKey: string,
  contentId: string,
  language: AppLanguage = "ko"
) {
  if (!serviceKey || !contentId) {
    return [];
  }

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

  const imageResponse = await fetch(
    `${getTourApiUrl(language, "detailImage2")}?${imageQuery.toString()}`
  );

  if (!imageResponse.ok) {
    return [];
  }

  const imageData = (await imageResponse.json()) as TourApiResponse;
  const imageCode = imageData.response?.header?.resultCode;

  if (imageCode && imageCode !== "0000") {
    return [];
  }

  return dedupeImageUrls(
    toArray(imageData.response?.body?.items?.item)
      .map((item) => item.originimgurl ?? "")
      .filter((image): image is string => Boolean(image))
  );
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

function formatTourApiYmd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}${month}${day}`;
}

function addDateDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function isYmdInRange(ymd: string, startYmd: string, endYmd: string) {
  if (!ymd || !startYmd) {
    return false;
  }

  const resolvedEndYmd = endYmd || startYmd;
  return startYmd <= ymd && ymd <= resolvedEndYmd;
}

const GANGWON_SIGUNGU_CODE_BY_NAME: Record<string, string> = {
  강릉: "1",
  고성: "2",
  동해: "3",
  삼척: "4",
  속초: "5",
  양구: "6",
  양양: "7",
  영월: "8",
  원주: "9",
  인제: "10",
  정선: "11",
  철원: "12",
  춘천: "13",
  태백: "14",
  평창: "15",
  홍천: "16",
  화천: "17",
  횡성: "18",
};

function inferGangwonSigunguCode(address?: string) {
  if (!address || !/강원/.test(address)) {
    return "";
  }

  const matchedName = Object.keys(GANGWON_SIGUNGU_CODE_BY_NAME).find((name) =>
    new RegExp(`${name}(시|군)`).test(address)
  );

  return matchedName ? GANGWON_SIGUNGU_CODE_BY_NAME[matchedName] : "";
}

function isGangwonTourApiItem(item: TourApiItem) {
  return (
    item.areacode === GANGWON_AREA_CODE ||
    Boolean(inferGangwonSigunguCode(item.addr1))
  );
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

function parseGangwonAttraction(
  item: TourApiItem,
  contentTypeId: string,
  index: number,
  options?: {
    todayYmd?: string;
    forceTodayFestival?: boolean;
  }
) {
  const lat = Number(item.mapy);
  const lng = Number(item.mapx);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const eventStartDate =
    normalizeYmd(item.eventstartdate) ?? normalizeYmd(item.eventStartDate) ?? "";
  const eventEndDate =
    normalizeYmd(item.eventenddate) ?? normalizeYmd(item.eventEndDate) ?? "";
  const resolvedContentTypeId = item.contenttypeid ?? contentTypeId;
  const isTodayFestival =
    isTourContentTypeId(resolvedContentTypeId, "festival") &&
    (options?.forceTodayFestival ||
      Boolean(
        options?.todayYmd &&
          isYmdInRange(options.todayYmd, eventStartDate, eventEndDate)
      ));

  return {
    id:
      item.contentid ??
      `${item.title ?? "spot"}-${resolvedContentTypeId}-${index}`,
    title: item.title ?? "이름 없음",
    address: item.addr1 ?? "주소 정보 없음",
    lat,
    lng,
    contentTypeId: resolvedContentTypeId,
    lclsSystm1: item.lclsSystm1 ?? "",
    lclsSystm2: item.lclsSystm2 ?? "",
    lclsSystm3: item.lclsSystm3 ?? "",
    firstImage: item.firstimage ?? "",
    secondImage: item.firstimage2 ?? "",
    eventStartDate,
    eventEndDate,
    isTodayFestival,
    tourApiSigunguCode: item.sigungucode || inferGangwonSigunguCode(item.addr1),
  } satisfies GangwonAttraction;
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

async function requestTourApiListPage(
  endpoint: string,
  params: URLSearchParams,
  errorPrefix: string
): Promise<TourApiListPage> {
  const response = await fetch(`${endpoint}?${params.toString()}`);

  if (!response.ok) {
    const errorText = (await response.text()).trim();
    throw new Error(
      `${errorPrefix} request failed: ${response.status}${
        errorText ? ` (${errorText})` : ""
      }`
    );
  }

  const data = (await response.json()) as TourApiResponse;
  const resultCode = data.response?.header?.resultCode;

  if (resultCode && resultCode !== "0000") {
    const resultMsg = data.response?.header?.resultMsg ?? "Unknown error";
    throw new Error(`${errorPrefix} API error: ${resultCode} ${resultMsg}`);
  }

  return {
    items: toArray(data.response?.body?.items?.item),
    totalCount: Number(data.response?.body?.totalCount ?? 0),
  };
}

function resolveKnownTotalPages(
  totalCount: number,
  pageSize: number,
  maxPagesSafetyLimit: number
) {
  if (!Number.isFinite(totalCount) || totalCount <= 0) {
    return null;
  }

  return Math.min(maxPagesSafetyLimit, Math.ceil(totalCount / pageSize));
}

function getPageNumbers(startPage: number, endPage: number) {
  if (endPage < startPage) {
    return [];
  }

  return Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index
  );
}

export async function fetchGangwonAttractions(
  serviceKey: string,
  options: FetchGangwonAttractionsOptions = {},
  language: AppLanguage = "ko"
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const requestedContentTypeIds =
    options.contentTypeIds && options.contentTypeIds.length > 0
      ? options.contentTypeIds
      : getDefaultTourContentTypeIds(language);
  const contentTypeIds = [
    ...new Set(
      requestedContentTypeIds.map((contentTypeId) =>
        localizeTourContentTypeId(contentTypeId, language)
      )
    ),
  ];

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
      const createQuery = (pageNo: number) =>
        new URLSearchParams({
          ...queryBase,
          pageNo: `${pageNo}`,
          contentTypeId,
        });

      const firstPage = await requestTourApiListPage(
        getTourApiUrl(language, "areaBasedList2"),
        createQuery(1),
        "Tour API"
      );

      if (firstPage.items.length === 0) {
        return [] as GangwonAttraction[];
      }

      const knownTotalPages = resolveKnownTotalPages(
        firstPage.totalCount,
        pageSize,
        maxPagesSafetyLimit
      );

      let remainingPages: TourApiListPage[] = [];

      if (knownTotalPages) {
        remainingPages = await Promise.all(
          getPageNumbers(2, knownTotalPages).map((pageNo) =>
            requestTourApiListPage(
              getTourApiUrl(language, "areaBasedList2"),
              createQuery(pageNo),
              "Tour API"
            )
          )
        );
      } else {
        for (let pageNo = 2; pageNo <= maxPagesSafetyLimit; pageNo += 1) {
          const page = await requestTourApiListPage(
            getTourApiUrl(language, "areaBasedList2"),
            createQuery(pageNo),
            "Tour API"
          );
          if (page.items.length === 0) {
            break;
          }
          remainingPages.push(page);
          if (page.items.length < pageSize) {
            break;
          }
        }
      }

      return [firstPage, ...remainingPages]
        .flatMap((page) => page.items)
        .map((item, index): GangwonAttraction | null => {
          return parseGangwonAttraction(item, contentTypeId, index);
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

export async function fetchGangwonFestivals(
  serviceKey: string,
  options: FetchGangwonFestivalsOptions = {},
  language: AppLanguage = "ko"
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const today = options.today ?? new Date();
  const todayYmd = formatTourApiYmd(today);
  const lookAheadDays = Math.max(0, Math.min(366, options.lookAheadDays ?? 90));
  const rangeEndYmd = formatTourApiYmd(addDateDays(today, lookAheadDays));
  const searchStartYmd = formatTourApiYmd(addDateDays(today, -366));
  const pageSize = 200;
  const maxPagesSafetyLimit = 20;
  const createQuery = (pageNo: number) =>
    new URLSearchParams({
      serviceKey: normalizeServiceKey(serviceKey),
      MobileOS: "ETC",
      MobileApp: "RouteOne",
      _type: "json",
      numOfRows: `${pageSize}`,
      pageNo: `${pageNo}`,
      arrange: "A",
      eventStartDate: searchStartYmd,
    });

  const firstPage = await requestTourApiListPage(
    getTourApiUrl(language, "searchFestival2"),
    createQuery(1),
    "Tour festival"
  );
  const knownTotalPages = resolveKnownTotalPages(
    firstPage.totalCount,
    pageSize,
    maxPagesSafetyLimit
  );
  let remainingPages: TourApiListPage[] = [];

  if (firstPage.items.length > 0) {
    if (knownTotalPages) {
      remainingPages = await Promise.all(
        getPageNumbers(2, knownTotalPages).map((pageNo) =>
          requestTourApiListPage(
            getTourApiUrl(language, "searchFestival2"),
            createQuery(pageNo),
            "Tour festival"
          )
        )
      );
    } else {
      for (let pageNo = 2; pageNo <= maxPagesSafetyLimit; pageNo += 1) {
        const page = await requestTourApiListPage(
          getTourApiUrl(language, "searchFestival2"),
          createQuery(pageNo),
          "Tour festival"
        );
        if (page.items.length === 0) {
          break;
        }
        remainingPages.push(page);
        if (page.items.length < pageSize) {
          break;
        }
      }
    }
  }

  const unique = new Map<string, GangwonAttraction>();
  [firstPage, ...remainingPages]
    .flatMap((page) => page.items)
    .filter(isGangwonTourApiItem)
    .map((item, index) =>
      parseGangwonAttraction(
        item,
        getTourContentTypeId(language, "festival"),
        index,
        {
          todayYmd,
          forceTodayFestival: false,
        }
      )
    )
    .filter((item): item is GangwonAttraction => item !== null)
    .filter((festival) => {
      if (!festival.eventStartDate) {
        return false;
      }

      const eventEndDate = festival.eventEndDate || festival.eventStartDate;
      return festival.eventStartDate <= rangeEndYmd && eventEndDate >= todayYmd;
    })
    .filter(
      (festival) =>
        !options.sigunguCode ||
        festival.tourApiSigunguCode === options.sigunguCode
    )
    .forEach((festival) => {
      const uniqueKey = `${festival.id}-${festival.contentTypeId}`;
      if (!unique.has(uniqueKey)) {
        unique.set(uniqueKey, {
          ...festival,
          isTodayFestival: isYmdInRange(
            todayYmd,
            festival.eventStartDate,
            festival.eventEndDate
          ),
        });
      }
    });

  return [...unique.values()];
}

export async function fetchLclsSystemNameMap(
  serviceKey: string,
  language: AppLanguage = "ko"
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  const normalizedServiceKey = normalizeServiceKey(serviceKey);
  const cacheKey = `${language}:${normalizedServiceKey}`;
  const cachedPromise =
    lclsSystemNameMapPromiseByServiceKey.get(cacheKey);

  if (cachedPromise) {
    return cachedPromise;
  }

  const requestPromise = (async () => {
    const query = new URLSearchParams({
      serviceKey: normalizedServiceKey,
      MobileOS: "ETC",
      MobileApp: "RouteOne",
      _type: "json",
      numOfRows: "1000",
      pageNo: "1",
      lclsSystmListYn: "Y",
    });

    const response = await fetch(
      `${getTourApiUrl(language, "lclsSystmCode2")}?${query.toString()}`
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
  })().catch((error) => {
    lclsSystemNameMapPromiseByServiceKey.delete(cacheKey);
    throw error;
  });

  lclsSystemNameMapPromiseByServiceKey.set(
    cacheKey,
    requestPromise
  );

  return requestPromise;
}

export async function fetchTourPlaceDetail(
  serviceKey: string,
  contentId: string,
  contentTypeId?: string,
  language: AppLanguage = "ko"
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

  const introQuery = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentId,
    contentTypeId: contentTypeId ?? "",
    numOfRows: "10",
    pageNo: "1",
  });

  const [commonResponse, imageResponse, introResponse] = await Promise.all([
    fetch(
      `${getTourApiUrl(language, "detailCommon2")}?${commonQuery.toString()}`
    ),
    fetch(
      `${getTourApiUrl(language, "detailImage2")}?${imageQuery.toString()}`
    ),
    fetch(
      `${getTourApiUrl(language, "detailIntro2")}?${introQuery.toString()}`
    ),
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

  let introFields = {
    operatingHours: "",
    restDate: "",
    infoCenter: "",
  };
  if (introResponse.ok) {
    const introData = (await introResponse.json()) as TourApiResponse;
    const introCode = introData.response?.header?.resultCode;
    if (!introCode || introCode === "0000") {
      const introItem = toArray(introData.response?.body?.items?.item)[0] as
        | Record<string, unknown>
        | undefined;
      introFields = getTourIntroFields(introItem, contentTypeId);
    }
  }

  const images = dedupeImageUrls(detailImageUrls);

  return {
    overview: stripHtml(commonItem?.overview),
    images,
    ...introFields,
  } satisfies TourPlaceDetail;
}

export async function fetchNearbyTouristPlaces(
  serviceKey: string,
  options: FetchNearbyTouristPlacesOptions,
  language: AppLanguage = "ko"
) {
  if (!serviceKey) {
    throw new Error("VisitKorea service key is missing.");
  }

  if (!Number.isFinite(options.lat) || !Number.isFinite(options.lng)) {
    throw new Error("주변 장소 조회 좌표가 올바르지 않습니다.");
  }

  const maxCount = Math.max(1, Math.min(30, options.numOfRows ?? 12));
  const radiusM = Math.max(100, Math.min(20000, Math.round(options.radiusM ?? 5000)));
  const requestedContentTypeIds =
    options.contentTypeIds && options.contentTypeIds.length > 0
      ? options.contentTypeIds
      : ["12", "14", "15", "28", "38"];
  const contentTypeIds = [
    ...new Set(
      requestedContentTypeIds.map((contentTypeId) =>
        localizeTourContentTypeId(contentTypeId, language)
      )
    ),
  ];

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
      `${getTourApiUrl(language, "locationBasedList2")}?${query.toString()}`
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
