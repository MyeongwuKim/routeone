import { FESTIVAL_AREAS, getFestivalRegionCode, normalizeFestivalRegionCode } from "./festivalRegions.js";

type FestivalSourceItem = {
  contentid?: unknown;
  title?: unknown;
  eventstartdate?: unknown;
  eventenddate?: unknown;
  sigungucode?: unknown;
  areacode?: unknown;
  addr1?: unknown;
  mapx?: unknown;
  mapy?: unknown;
  firstimage?: unknown;
};

type OfficialFestivalSourceItem = {
  fstvlCntntsId?: unknown;
  cntntsNm?: unknown;
  fstvlBgngDe?: unknown;
  fstvlEndDe?: unknown;
  signguDivCd?: unknown;
  regnDivCd?: unknown;
  adres?: unknown;
  xcrdVal?: unknown;
  ycrdVal?: unknown;
  dispFstvlCntntsImgRout?: unknown;
};

export type FestivalSourceRecord = {
  id: string;
  title: string;
  startYmd: string;
  endYmd: string;
  /** 전국에서 고유한 5자리 시군구 행정 코드. */
  regionCode: string;
  areaCode: string;
  sigunguCode: string;
  address: string;
  lat: number | null;
  lng: number | null;
  imageUrl: string;
};

type FestivalCache = {
  expiresAt: number;
  festivals: FestivalSourceRecord[];
};

const FESTIVAL_API_URL =
  "https://apis.data.go.kr/B551011/KorService2/searchFestival2";
const OFFICIAL_FESTIVAL_LIST_URL =
  "https://award.visitkorea.or.kr/kfes/list/selectWntyFstvlList.do";
const FESTIVAL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const FESTIVAL_PAGE_SIZE = 200;
const FESTIVAL_MAX_PAGE_COUNT = 20;
const OFFICIAL_FESTIVAL_MAX_PAGE_COUNT = 20;
const YMD_PATTERN = /^\d{8}$/;

const festivalCache = new Map<string, FestivalCache>();
const pendingFestivalRequests = new Map<string, Promise<FestivalSourceRecord[]>>();

function readString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function readFiniteNumber(value: unknown) {
  const text = readString(value);
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeServiceKey(serviceKey: string) {
  try {
    return serviceKey.includes("%")
      ? decodeURIComponent(serviceKey)
      : serviceKey;
  } catch {
    return serviceKey;
  }
}

function formatYmd(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function normalizeYmd(value: unknown) {
  return readString(value).replaceAll(".", "").replaceAll("-", "");
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function readPageItems(payload: unknown) {
  const header = (payload as { response?: { header?: { resultCode?: string; resultMsg?: string } } })?.response?.header;
  if (header?.resultCode && !["0000", "00"].includes(header.resultCode)) {
    throw new Error(`VisitKorea festival API error: ${header.resultMsg ?? header.resultCode}`);
  }
  const body = (
    payload as {
      response?: {
        body?: {
          items?: { item?: FestivalSourceItem | FestivalSourceItem[] };
          totalCount?: unknown;
        };
      };
    }
  )?.response?.body;
  if (!body) throw new Error("Invalid festival API response");
  const rawItems = body.items?.item;
  const items = Array.isArray(rawItems)
    ? rawItems
    : rawItems
      ? [rawItems]
      : [];
  const totalCount = Number(body?.totalCount);

  return {
    items,
    totalCount: Number.isFinite(totalCount) ? totalCount : null,
  };
}

async function fetchFestivalPage(
  serviceKey: string,
  searchStartYmd: string,
  pageNo: number,
  areaCode: string
) {
  const query = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: String(FESTIVAL_PAGE_SIZE),
    pageNo: String(pageNo),
    arrange: "A",
    areaCode,
    eventStartDate: searchStartYmd,
  });
  const response = await fetch(`${FESTIVAL_API_URL}?${query.toString()}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`VisitKorea festival API failed (${response.status})`);
  }

  return readPageItems(await response.json());
}

function readOfficialPage(payload: unknown) {
  const response = payload as {
    resultList?: OfficialFestivalSourceItem[];
    totalCnt?: unknown;
  };
  if (!Array.isArray(response?.resultList)) throw new Error("Invalid official festival response");
  const items = response.resultList;
  const totalCount = Number(response?.totalCnt);

  return {
    items,
    totalCount: Number.isFinite(totalCount) ? totalCount : null,
  };
}

async function fetchOfficialFestivalPage(
  searchDate: "A" | "B",
  startIdx: number,
  areaCode: string
) {
  const body = new URLSearchParams({
    startIdx: String(startIdx),
    searchType: "A",
    searchDate,
    searchArea: areaCode,
    searchCate: "",
    locationx: "undefined",
    locationy: "undefined",
    filterExcluded: "true",
  });
  const response = await fetch(OFFICIAL_FESTIVAL_LIST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `VisitKorea official festival list failed (${response.status})`
    );
  }

  return readOfficialPage(await response.json());
}

async function fetchOfficialFestivalsByStatus(searchDate: "A" | "B", areaCode: string) {
  const items: OfficialFestivalSourceItem[] = [];
  let startIdx = 0;

  for (
    let page = 0;
    page < OFFICIAL_FESTIVAL_MAX_PAGE_COUNT;
    page += 1
  ) {
    const result = await fetchOfficialFestivalPage(searchDate, startIdx, areaCode);
    items.push(...result.items);

    if (
      result.items.length === 0 ||
      (result.totalCount !== null && items.length >= result.totalCount)
    ) {
      break;
    }

    startIdx += result.items.length;
  }

  return items;
}

async function fetchOfficialFestivals(areaCode: string) {
  const results = await Promise.allSettled([
    fetchOfficialFestivalsByStatus("A", areaCode),
    fetchOfficialFestivalsByStatus("B", areaCode),
  ]);
  const fulfilledResults = results.filter(
    (
      result
    ): result is PromiseFulfilledResult<OfficialFestivalSourceItem[]> =>
      result.status === "fulfilled"
  );

  if (fulfilledResults.length === 0) {
    const rejectedResult = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected"
    );

    throw rejectedResult?.reason ?? new Error(
      "VisitKorea official festival list failed"
    );
  }

  return fulfilledResults
    .flatMap((result) => result.value)
    .map((item) => ({
      id: readString(item.fstvlCntntsId),
      title: readString(item.cntntsNm),
      startYmd: normalizeYmd(item.fstvlBgngDe),
      endYmd:
        normalizeYmd(item.fstvlEndDe) ||
        normalizeYmd(item.fstvlBgngDe),
      regionCode: getFestivalRegionCode(areaCode, readString(item.signguDivCd)) ?? "",
      sigunguCode: readString(item.signguDivCd),
      areaCode: readString(item.regnDivCd),
      address: readString(item.adres),
      lat: readFiniteNumber(item.ycrdVal),
      lng: readFiniteNumber(item.xcrdVal),
      imageUrl: readString(item.dispFstvlCntntsImgRout),
    }))
    .filter(
      (festival) =>
        festival.areaCode === areaCode &&
        Boolean(festival.id) &&
        Boolean(festival.title) &&
        YMD_PATTERN.test(festival.startYmd) &&
        YMD_PATTERN.test(festival.endYmd) &&
        Boolean(festival.regionCode)
    );
}

async function fetchOpenApiFestivals(
  serviceKey: string,
  now: Date,
  areaCode: string
) {
  const searchStartYmd = formatYmd(addUtcDays(now, -366));
  const firstPage = await fetchFestivalPage(serviceKey, searchStartYmd, 1, areaCode);
  const knownPageCount = firstPage.totalCount
    ? Math.min(
        FESTIVAL_MAX_PAGE_COUNT,
        Math.ceil(firstPage.totalCount / FESTIVAL_PAGE_SIZE)
      )
    : 1;
  const remainingPages =
    knownPageCount > 1
      ? await Promise.all(
          Array.from({ length: knownPageCount - 1 }, (_, index) =>
            fetchFestivalPage(serviceKey, searchStartYmd, index + 2, areaCode)
          )
        )
      : [];
  const festivalById = new Map<string, FestivalSourceRecord>();

  [firstPage, ...remainingPages]
    .flatMap((page) => page.items)
    .forEach((item) => {
      const id = readString(item.contentid);
      const title = readString(item.title);
      const startYmd = readString(item.eventstartdate);
      const endYmd = readString(item.eventenddate) || startYmd;
      const sigunguCode = readString(item.sigungucode);
      const regionCode = getFestivalRegionCode(areaCode, sigunguCode);

      if (
        (readString(item.areacode) && readString(item.areacode) !== areaCode) ||
        !id ||
        !title ||
        !YMD_PATTERN.test(startYmd) ||
        !YMD_PATTERN.test(endYmd) ||
        !regionCode
      ) {
        return;
      }

      festivalById.set(id, {
        id,
        title,
        startYmd,
        endYmd,
        regionCode,
        areaCode,
        sigunguCode,
        address: readString(item.addr1),
        lat: readFiniteNumber(item.mapy),
        lng: readFiniteNumber(item.mapx),
        imageUrl: readString(item.firstimage),
      });
    });

  return [...festivalById.values()];
}

/** 권역별 두 축제 출처를 합친다. 일부 출처만 성공해도 성공한 목록을 반환한다. */
async function loadFestivalSource(areaCode: string, now: Date) {
  const serviceKey =
    process.env.VISITKOREA_SERVICE_KEY?.trim() ||
    process.env.TOUR_API_SERVICE_KEY?.trim() ||
    "";
  const sourceResults = await Promise.allSettled([
    fetchOfficialFestivals(areaCode),
    ...(serviceKey
      ? [fetchOpenApiFestivals(serviceKey, now, areaCode)]
      : []),
  ]);
  const fulfilledSources = sourceResults.filter(
    (
      result
    ): result is PromiseFulfilledResult<FestivalSourceRecord[]> =>
      result.status === "fulfilled"
  );

  if (fulfilledSources.length === 0) {
    const rejectedSource = sourceResults.find(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected"
    );

    throw rejectedSource?.reason ?? new Error(
      "VisitKorea festival lookup failed"
    );
  }

  const festivalByFingerprint = new Map<string, FestivalSourceRecord>();

  fulfilledSources
    .flatMap((result) => result.value)
    .forEach((festival) => {
      const fingerprint = [
        festival.regionCode,
        festival.title,
        festival.startYmd,
        festival.endYmd,
      ].join(":");

      const existing = festivalByFingerprint.get(fingerprint);
      if (!existing || (!hasFestivalCoordinates(existing) && hasFestivalCoordinates(festival))) {
        festivalByFingerprint.set(fingerprint, festival);
      }
    });

  const festivals = [...festivalByFingerprint.values()];
  festivalCache.set(areaCode, {
    festivals,
    expiresAt: now.getTime() + FESTIVAL_CACHE_TTL_MS,
  });

  return festivals;
}

/**
 * 선택 권역의 축제를 조회하고 6시간 동안 권역별로 재사용한다.
 * 같은 권역의 동시 요청은 합치며 실패한 요청은 캐시하지 않아 다음 조회에서 다시 시도한다.
 */
export async function fetchFestivalSource(areaCode: string, now = new Date()) {
  if (!FESTIVAL_AREAS.some((area) => area.areaCode === areaCode)) {
    throw new Error("지원하지 않는 축제 권역입니다.");
  }
  const cached = festivalCache.get(areaCode);
  if (cached && cached.expiresAt > now.getTime()) return cached.festivals;
  const pending = pendingFestivalRequests.get(areaCode);
  if (pending) return pending;
  const request = loadFestivalSource(areaCode, now);
  pendingFestivalRequests.set(areaCode, request);
  try {
    return await request;
  } finally {
    pendingFestivalRequests.delete(areaCode);
  }
}

/** 기존 강원 조회 호출을 유지한다. 반환 지역 코드는 다른 권역과 같은 행정 코드 형식이다. */
export function fetchGangwonFestivalSource(now = new Date()) {
  return fetchFestivalSource("32", now);
}

/** 지정한 시군구에서 조회 기간과 하루라도 겹치는 축제를 이름순으로 반환한다. */
export function filterFestivalsForRegionAndRange(
  festivals: FestivalSourceRecord[],
  regionCode: string,
  startDateKey: string,
  endDateKey: string
) {
  const normalizedRegionCode = normalizeFestivalRegionCode(regionCode);
  const startYmd = startDateKey.replaceAll("-", "");
  const endYmd = endDateKey.replaceAll("-", "");

  return festivals
    .filter(
      (festival) =>
        festival.regionCode === normalizedRegionCode &&
        festival.startYmd <= endYmd &&
        festival.endYmd >= startYmd
    )
    .sort((left, right) => left.title.localeCompare(right.title, "ko"));
}

/** 지도와 축제 알림에 사용할 수 있는 유한한 국내 좌표가 모두 있는지 확인한다. */
export function hasFestivalCoordinates(
  festival: FestivalSourceRecord
): festival is FestivalSourceRecord & { lat: number; lng: number } {
  return festival.lat !== null && festival.lng !== null &&
    Number.isFinite(festival.lat) && Number.isFinite(festival.lng) &&
    festival.lat >= 32 && festival.lat <= 40 && festival.lng >= 123 && festival.lng <= 133;
}
