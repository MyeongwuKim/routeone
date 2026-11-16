import { suppressTracing } from "@sentry/node";
import { setTimeout as delay } from "node:timers/promises";

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
const TOUR_COURSE_CATALOG_TIMEOUT_MS = 10_000;
const TOUR_COURSE_SOURCE_TIMEOUT_MS = 4_000;
const TOUR_COURSE_SOURCE_MAX_ATTEMPTS = 3;
const TOUR_COURSE_SOURCE_RETRY_DELAY_MS = 200;
const NETWORK_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
  "ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
  "ERR_TLS_CERT_ALTNAME_INVALID", "ERR_TLS_HANDSHAKE_TIMEOUT", "CERT_HAS_EXPIRED", "CERT_NOT_YET_VALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
]);
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_SOCKET",
  "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH",
  "TimeoutError",
]);

/** URL이 담길 수 있는 원본 오류 대신, 중첩·복수 연결 실패에서 허용한 네트워크 코드만 남긴다. */
function readNetworkErrorCodes(error: unknown) {
  const pending = [error];
  const visited = new Set<unknown>();
  const codes = new Set<string>();

  // 순환하거나 과도하게 중첩된 원인도 최대 16개까지만 확인한다.
  for (let index = 0; index < pending.length && index < 16; index += 1) {
    const current = pending[index];
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);
    const { code, name, cause, errors } = current as {
      code?: unknown; name?: unknown; cause?: unknown; errors?: unknown;
    };
    if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) codes.add(code);
    if (name === "TimeoutError" || name === "AbortError") codes.add(name);
    if (cause) pending.push(cause);
    if (Array.isArray(errors)) pending.push(...errors.slice(0, 16));
  }

  return [...codes];
}

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

/** 일시적인 연결 실패만 최대 3회 시도하고, 전체 목록의 제한 시간이 끝나면 재시도를 중단한다. */
async function fetchTourCourseSourceResponse(url: URL, pageNo: number, signal: AbortSignal) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      signal.throwIfAborted();
      // 관광공사 게이트웨이는 Sentry 추적 헤더가 붙은 요청을 HTTP 400으로 거절한다.
      return await suppressTracing(() => fetch(url, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(TOUR_COURSE_SOURCE_TIMEOUT_MS)]),
      }));
    } catch (error: unknown) {
      const codes = readNetworkErrorCodes(error);
      const canRetry = attempt < TOUR_COURSE_SOURCE_MAX_ATTEMPTS && !signal.aborted && codes.length > 0 &&
        codes.every((code) => RETRYABLE_NETWORK_ERROR_CODES.has(code));
      if (canRetry) {
        // 대기 중에도 전체 목록의 기한을 지키고, 중단 이유는 다음 시도에서 키가 없는 오류로 바꾼다.
        await delay(TOUR_COURSE_SOURCE_RETRY_DELAY_MS * attempt, undefined, { signal }).catch(() => undefined);
        continue;
      }
      const details = codes.length ? `, ${codes.join(", ")}` : "";
      throw new Error(`Tour course source request failed (page ${pageNo}${details})`);
    }
  }
}

/** 지역 코드가 비어 있는 코스도 인덱싱할 수 있도록 지역 조건 없이 공식 목록 한 페이지를 읽는다. */
async function fetchTourCourseSourcePage(serviceKey: string, pageNo: number, signal: AbortSignal) {
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

  const response = await fetchTourCourseSourceResponse(url, pageNo, signal);
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

/** 국문 코스 전체를 10초 안에 읽으며 연결 실패는 페이지별로 재시도하고, 같은 ID의 첫 항목만 지역 인덱스에 전달한다. */
export async function fetchOfficialTourCourses(): Promise<OfficialTourCourse[]> {
  const configuredKey = process.env.VISITKOREA_SERVICE_KEY?.trim() || process.env.TOUR_API_SERVICE_KEY?.trim();
  if (!configuredKey) throw new Error("Tour course source service key is missing");

  const serviceKey = normalizeServiceKey(configuredKey);
  // 웹의 12초 요청 제한 안에 오류를 반환하도록 모든 원본 페이지가 같은 마감 시간을 사용한다.
  const signal = AbortSignal.timeout(TOUR_COURSE_CATALOG_TIMEOUT_MS);
  const firstPage = await fetchTourCourseSourcePage(serviceKey, 1, signal);
  const totalPages = Math.min(TOUR_COURSE_SOURCE_MAX_PAGES, Math.ceil(firstPage.totalCount / TOUR_COURSE_SOURCE_PAGE_SIZE));
  const remainingPages = await Promise.all(Array.from(
    { length: Math.max(0, totalPages - 1) },
    (_, index) => fetchTourCourseSourcePage(serviceKey, index + 2, signal)
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
