type FestivalSourceItem = {
  contentid?: unknown;
  title?: unknown;
  eventstartdate?: unknown;
  eventenddate?: unknown;
  sigungucode?: unknown;
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
  regionCode: string;
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

let festivalCache: FestivalCache | null = null;

function readString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function readFiniteNumber(value: unknown) {
  const parsed = Number(readString(value));
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
  const rawItems = body?.items?.item;
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
  pageNo: number
) {
  const query = new URLSearchParams({
    serviceKey: normalizeServiceKey(serviceKey),
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    numOfRows: String(FESTIVAL_PAGE_SIZE),
    pageNo: String(pageNo),
    arrange: "A",
    areaCode: "32",
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
  const items = Array.isArray(response?.resultList)
    ? response.resultList
    : [];
  const totalCount = Number(response?.totalCnt);

  return {
    items,
    totalCount: Number.isFinite(totalCount) ? totalCount : null,
  };
}

async function fetchOfficialFestivalPage(
  searchDate: "A" | "B",
  startIdx: number
) {
  const body = new URLSearchParams({
    startIdx: String(startIdx),
    searchType: "A",
    searchDate,
    searchArea: "32",
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

async function fetchOfficialFestivalsByStatus(searchDate: "A" | "B") {
  const items: OfficialFestivalSourceItem[] = [];
  let startIdx = 0;

  for (
    let page = 0;
    page < OFFICIAL_FESTIVAL_MAX_PAGE_COUNT;
    page += 1
  ) {
    const result = await fetchOfficialFestivalPage(searchDate, startIdx);
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

async function fetchOfficialGangwonFestivals() {
  const results = await Promise.allSettled([
    fetchOfficialFestivalsByStatus("A"),
    fetchOfficialFestivalsByStatus("B"),
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
      regionCode: readString(item.signguDivCd),
      areaCode: readString(item.regnDivCd),
      address: readString(item.adres),
      lat: readFiniteNumber(item.ycrdVal),
      lng: readFiniteNumber(item.xcrdVal),
      imageUrl: readString(item.dispFstvlCntntsImgRout),
    }))
    .filter(
      (festival) =>
        festival.areaCode === "32" &&
        Boolean(festival.id) &&
        Boolean(festival.title) &&
        YMD_PATTERN.test(festival.startYmd) &&
        YMD_PATTERN.test(festival.endYmd) &&
        Boolean(festival.regionCode)
    )
    .map(({ areaCode: _areaCode, ...festival }) => festival);
}

async function fetchOpenApiGangwonFestivals(
  serviceKey: string,
  now: Date
) {
  const searchStartYmd = formatYmd(addUtcDays(now, -366));
  const firstPage = await fetchFestivalPage(serviceKey, searchStartYmd, 1);
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
            fetchFestivalPage(serviceKey, searchStartYmd, index + 2)
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
      const regionCode = readString(item.sigungucode);

      if (
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
        address: readString(item.addr1),
        lat: readFiniteNumber(item.mapy),
        lng: readFiniteNumber(item.mapx),
        imageUrl: readString(item.firstimage),
      });
    });

  return [...festivalById.values()];
}

export async function fetchGangwonFestivalSource(now = new Date()) {
  if (festivalCache && festivalCache.expiresAt > now.getTime()) {
    return festivalCache.festivals;
  }

  const serviceKey =
    process.env.VISITKOREA_SERVICE_KEY?.trim() ||
    process.env.TOUR_API_SERVICE_KEY?.trim() ||
    "";
  const sourceResults = await Promise.allSettled([
    fetchOfficialGangwonFestivals(),
    ...(serviceKey
      ? [fetchOpenApiGangwonFestivals(serviceKey, now)]
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

      if (!festivalByFingerprint.has(fingerprint)) {
        festivalByFingerprint.set(fingerprint, festival);
      }
    });

  const festivals = [...festivalByFingerprint.values()];
  festivalCache = {
    festivals,
    expiresAt: now.getTime() + FESTIVAL_CACHE_TTL_MS,
  };

  return festivals;
}

export function filterFestivalsForRegionAndRange(
  festivals: FestivalSourceRecord[],
  regionCode: string,
  startDateKey: string,
  endDateKey: string
) {
  const startYmd = startDateKey.replaceAll("-", "");
  const endYmd = endDateKey.replaceAll("-", "");

  return festivals
    .filter(
      (festival) =>
        festival.regionCode === regionCode &&
        festival.startYmd <= endYmd &&
        festival.endYmd >= startYmd
    )
    .sort((left, right) => left.title.localeCompare(right.title, "ko"));
}

export function hasFestivalCoordinates(
  festival: FestivalSourceRecord
): festival is FestivalSourceRecord & { lat: number; lng: number } {
  return festival.lat !== null && festival.lng !== null;
}
