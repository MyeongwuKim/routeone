import { suppressTracing } from "@sentry/node";

export type OfficialTourCourse = {
  id: string;
  title: string;
  image: string;
  areaCode: string;
  sigunguCode: string;
  adminCode: string;
  /** 코스 자체에 등록된 대표 좌표. 방문 장소의 좌표와 구분한다. */
  location: { lat: number; lng: number } | null;
};

type TourCourseSourceItem = {
  contentid?: string;
  title?: string;
  firstimage?: string;
  firstimage2?: string;
  areacode?: string;
  sigungucode?: string;
  lDongRegnCd?: string;
  lDongSignguCd?: string;
  mapx?: string;
  mapy?: string;
};

type TourCourseSourceResponse = {
  response?: {
    header?: { resultCode?: string };
    body?: {
      items?: { item?: TourCourseSourceItem | TourCourseSourceItem[] };
      totalCount?: string | number;
    };
  };
};

const TOUR_COURSE_SOURCE_URL = "https://apis.data.go.kr/B551011/KorService2/areaBasedList2";
const TOUR_COURSE_SOURCE_PAGE_SIZE = 200;
const TOUR_COURSE_SOURCE_MAX_PAGES = 100;
const TOUR_COURSE_SOURCE_TIMEOUT_MS = 15_000;

function normalizeServiceKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey);
  } catch {
    return serviceKey;
  }
}

function readText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

/** 지역 코드가 비어 있는 코스도 인덱싱할 수 있도록 지역 조건 없이 공식 목록 한 페이지를 읽는다. */
async function fetchTourCourseSourcePage(serviceKey: string, pageNo: number) {
  const url = new URL(TOUR_COURSE_SOURCE_URL);
  url.search = new URLSearchParams({
    serviceKey,
    MobileOS: "ETC",
    MobileApp: "RouteOne",
    _type: "json",
    contentTypeId: "25",
    arrange: "C",
    pageNo: String(pageNo),
    numOfRows: String(TOUR_COURSE_SOURCE_PAGE_SIZE),
  }).toString();

  // 관광공사 게이트웨이는 Sentry 추적 헤더가 붙은 요청을 HTTP 400으로 거절한다.
  const response = await suppressTracing(() =>
    fetch(url, { signal: AbortSignal.timeout(TOUR_COURSE_SOURCE_TIMEOUT_MS) })
  ).catch(() => {
    throw new Error(`Tour course source request failed (page ${pageNo})`);
  });
  if (!response.ok) {
    throw new Error(`Tour course source request failed (page ${pageNo}, HTTP ${response.status})`);
  }

  // 응답 본문이나 요청 URL을 오류에 포함하지 않아 서비스 키가 노출되지 않게 한다.
  const data = (await response.json().catch(() => null)) as TourCourseSourceResponse | null;
  const body = data?.response?.body;
  const totalCount = Number(readText(body?.totalCount) || Number.NaN);
  if (data?.response?.header?.resultCode !== "0000" || !Number.isSafeInteger(totalCount) || totalCount < 0) {
    throw new Error(`Tour course source returned an invalid response (page ${pageNo})`);
  }

  const item = body?.items?.item;
  const items = Array.isArray(item) ? item : item ? [item] : [];
  if (totalCount > 0 && items.length === 0) {
    throw new Error(`Tour course source returned an empty page (page ${pageNo})`);
  }
  return { items, totalCount };
}

/** 국문 공식 여행코스를 원본 순서로 읽고, 같은 콘텐츠 ID의 첫 항목만 지역 인덱스에 전달한다. */
export async function fetchOfficialTourCourses(): Promise<OfficialTourCourse[]> {
  const configuredKey = process.env.VISITKOREA_SERVICE_KEY?.trim() || process.env.TOUR_API_SERVICE_KEY?.trim();
  if (!configuredKey) throw new Error("Tour course source service key is missing");

  const serviceKey = normalizeServiceKey(configuredKey);
  const firstPage = await fetchTourCourseSourcePage(serviceKey, 1);
  const totalPages = Math.min(TOUR_COURSE_SOURCE_MAX_PAGES, Math.ceil(firstPage.totalCount / TOUR_COURSE_SOURCE_PAGE_SIZE));
  const remainingPages = await Promise.all(Array.from(
    { length: Math.max(0, totalPages - 1) },
    (_, index) => fetchTourCourseSourcePage(serviceKey, index + 2)
  ));

  const courses = new Map<string, OfficialTourCourse>();
  for (const { items } of [firstPage, ...remainingPages]) {
    for (const item of items) {
      const id = readText(item?.contentid);
      const title = readText(item?.title).replaceAll(/<[^>]*>/g, " ").replaceAll(/\s+/g, " ").trim();
      if (!id || !title || courses.has(id)) continue;

      const lat = Number(item.mapy);
      const lng = Number(item.mapx);
      courses.set(id, {
        id,
        title,
        image: readText(item.firstimage) || readText(item.firstimage2),
        areaCode: readText(item.areacode),
        sigunguCode: readText(item.sigungucode),
        adminCode: `${item.lDongRegnCd ?? ""}${item.lDongSignguCd ?? ""}`,
        location: lat >= 32 && lat <= 40 && lng >= 123 && lng <= 133 ? { lat, lng } : null,
      });
    }
  }
  return [...courses.values()];
}
