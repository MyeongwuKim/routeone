import { getServiceArea, isServiceAreaId, SERVICE_REGION_LIST, type ServiceAreaId } from "@/data/serviceAreas";
import type { HomeTourCoursesQuery } from "@/generated/graphql";
import type { AppLanguage } from "@/stores/appLanguageStore";

/** 홈 추천에서 시·도의 모든 시·군·구를 조회하는 값. */
export const ALL_HOME_REGIONS = "all";

/** 공유 루트에서 홈의 추천 결과로 바로 이동하는 앵커. */
export const HOME_RECOMMENDATIONS_ANCHOR = "recommendations";

export type HomeSelection = {
  areaId: ServiceAreaId;
  /** 선택한 관광공사 시·군·구 코드. 빈 배열은 시·도 전체다. */
  regionCodes: string[];
};

export type HomeTourCourse = HomeTourCoursesQuery["homeTourCourses"]["courses"][number];

const ENGLISH_COURSE_UNITS: Record<string, string> = {
  킬로미터: "km",
  미터: "m",
  "㎞": "km",
  시간: "hr",
  분: "min",
  초: "sec",
};

/** 영어 모드에서는 숫자 뒤에 붙은 단위를 변환한다. 문장에 남은 한국어는 번역 요청에서 처리한다. */
export function formatTourCourseMeasurement(value: string, language: AppLanguage) {
  if (language === "ko") return value;

  return value
    .replace(/^약\s*(?=\d)/u, "About ")
    .replaceAll(/(\d)\s*(킬로미터|미터|㎞|시간|분|초)\s*/gu, (_, digit: string, unit: string) => {
      return digit + " " + ENGLISH_COURSE_UNITS[unit] + " ";
    })
    .trim();
}

const COURSE_LIST_PAGE_SIZE = 12;
const COURSE_CHECK_BATCH_SIZE = 4;
const PARTIAL_FAILURE_RETRY_INTERVAL_MS = 30_000;

type CoursePage = HomeTourCoursesQuery["homeTourCourses"];

type CoursePageLoaders = {
  loadPage: (page: number) => Promise<CoursePage>;
  loadStops: (courseId: string) => Promise<{ contentId: string }[]>;
  loadPlace: (contentId: string) => Promise<unknown>;
  signal: AbortSignal;
};

/** 부분 실패가 있는 조회만 다시 시도하고, 정상 조회는 주기적으로 다시 받지 않는다. */
export function getHomeCourseRetryInterval(pages?: Array<{ hadLookupError?: boolean }>) {
  return pages?.some((page) => page.hadLookupError) ? PARTIAL_FAILURE_RETRY_INTERVAL_MS : false;
}

/**
 * 방문지 전부를 지도에 연결할 수 있는 코스만 원래 순서로 남기고, 표시할 코스가 없는 페이지는 건너뛴다.
 * 일부 상세 조회가 실패하면 정상 코스를 유지하고 재조회 표시를 남긴다. 모든 상세 조회가 실패하면 오류를 전달한다.
 */
export async function loadAvailableHomeCoursePage(firstPage: number, loaders: CoursePageLoaders) {
  const { loadPage, loadStops, loadPlace, signal } = loaders;
  const hasAllPlaces = async ({ id }: HomeTourCourse) => {
    const stops = await loadStops(id);
    signal.throwIfAborted();
    const ids = new Set(stops.map(({ contentId }) => contentId));
    if (!ids.size || [...ids].some((contentId) => !/^\d+$/.test(contentId))) return false;

    const places = await Promise.all([...ids].map(loadPlace));
    return places.every(Boolean);
  };

  let page: number | undefined = firstPage;
  const courses: HomeTourCourse[] = [];
  let hasLookupError = false;
  let hasCompletedLookup = false;
  let firstLookupError: unknown;
  while (page !== undefined && !courses.length) {
    signal.throwIfAborted();
    const source = await loadPage(page);
    for (let start = 0; start < source.courses.length; start += COURSE_CHECK_BATCH_SIZE) {
      signal.throwIfAborted();
      const batch = source.courses.slice(start, start + COURSE_CHECK_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map(hasAllPlaces));
      signal.throwIfAborted();
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          hasCompletedLookup = true;
          if (result.value) courses.push(batch[index]);
        } else if (!hasLookupError) {
          hasLookupError = true;
          firstLookupError = result.reason;
        }
      });
    }
    page = page * COURSE_LIST_PAGE_SIZE < source.totalCount ? page + 1 : undefined;
  }
  signal.throwIfAborted();
  if (!hasCompletedLookup && hasLookupError) throw firstLookupError;
  return hasLookupError
    ? { courses, nextPage: page, hadLookupError: true }
    : { courses, nextPage: page };
}

/** 기존 단일 region과 여러 region 값에서 조회 범위를 복원하고, 같은 조합은 지역 순서로 정규화한다. */
export function readHomeSelection(params: URLSearchParams): HomeSelection | null {
  const areaId = params.get("area");
  if (!isServiceAreaId(areaId)) return null;
  const requestedCodes = new Set(params.getAll("region").filter((code) => code && code !== ALL_HOME_REGIONS));
  const regionCodes = getServiceArea(areaId).regions.map(({ sigunguCode }) => sigunguCode)
    .filter((code) => requestedCodes.has(code));
  if (regionCodes.length !== requestedCodes.size) return null;
  return { areaId, regionCodes };
}

/** 추천 홈과 지도 복귀 링크에 같은 시·도 및 시·군·구 선택을 남긴다. */
export function createHomeSelectionParams({ areaId, regionCodes }: HomeSelection) {
  const params = new URLSearchParams({ area: areaId });
  for (const code of regionCodes.length ? regionCodes : [ALL_HOME_REGIONS]) {
    params.append("region", code);
  }
  return params;
}

/** 법정동 코드 또는 관광공사 시·도와 시·군·구 코드 쌍으로 등록 지역을 찾는다. */
export function findTourCourseRegion({ adminCode, areaCode, sigunguCode }: { adminCode: string; areaCode: string; sigunguCode: string }) {
  return SERVICE_REGION_LIST.find(({ region }) => region.adminCode === adminCode) ??
    SERVICE_REGION_LIST.find(({ area, region }) => area.tourAreaCode === areaCode && region.sigunguCode === sigunguCode);
}
