import { UserFacingError } from "../../graphql/userFacingError.js";
import { FESTIVAL_AREAS } from "../notifications/festivalRegions.js";
import { findTourCourseRegions, loadTourCourseBoundaries } from "./tourCourseRegions.js";
import { fetchOfficialTourCourses, type OfficialTourCourse } from "./tourCourseSource.js";

type CoursePreview = Pick<OfficialTourCourse, "id" | "title" | "image">;
type CourseIndex = Map<string, CoursePreview[]>;
type CoursePageInput = {
  areaCode: string;
  sigunguCode?: string | null;
  sigunguCodes?: string[] | null;
  page: number;
};

const PAGE_SIZE = 12;
const INDEX_MAX_AGE_MS = 60 * 60 * 1000;
const INDEX_REFRESH_RETRY_MS = 60 * 1000;

/** 마지막으로 완료된 지역별 인덱스를 유지해 갱신이 늦거나 실패해도 기존 목록을 제공한다. */
let cachedIndex: { value: CourseIndex; refreshAfter: number } | undefined;
let refreshInFlight: Promise<CourseIndex> | undefined;
let boundariesPromise: ReturnType<typeof loadTourCourseBoundaries> | undefined;

function appendCourse(index: CourseIndex, regionKey: string, course: CoursePreview) {
  const courses = index.get(regionKey);
  if (courses) courses.push(course);
  else index.set(regionKey, [course]);
}

async function buildCourseIndex(): Promise<CourseIndex> {
  boundariesPromise ??= loadTourCourseBoundaries().catch((error: unknown) => {
    boundariesPromise = undefined;
    throw error;
  });
  const [courses, boundaries] = await Promise.all([fetchOfficialTourCourses(), boundariesPromise]);
  const index: CourseIndex = new Map();

  // 공사 목록 순서를 유지하고, 맞닿은 시군구 경계에 걸친 코스는 시도 목록에서 한 번만 넣는다.
  for (const course of courses) {
    const regions = findTourCourseRegions(course, boundaries);
    const preview = { id: course.id, title: course.title, image: course.image };
    for (const areaCode of new Set(regions.map((region) => region.areaCode))) {
      appendCourse(index, areaCode, preview);
    }
    for (const { areaCode, sigunguCode } of regions) {
      appendCourse(index, `${areaCode}:${sigunguCode}`, preview);
    }
  }

  return index;
}

function refreshCourseIndex() {
  refreshInFlight ??= buildCourseIndex()
    .then((value) => {
      cachedIndex = { value, refreshAfter: Date.now() + INDEX_MAX_AGE_MS };
      return value;
    })
    .catch((error: unknown) => {
      if (cachedIndex) cachedIndex.refreshAfter = Date.now() + INDEX_REFRESH_RETRY_MS;
      throw error;
    })
    .finally(() => {
      refreshInFlight = undefined;
    });
  return refreshInFlight;
}

/** 서버 기동이나 인덱스 만료 때 응답을 막지 않고 백그라운드에서 한 번만 갱신한다. */
export function warmHomeTourCourses() {
  if (refreshInFlight || (cachedIndex && cachedIndex.refreshAfter > Date.now())) return;
  void refreshCourseIndex().catch((error: unknown) => {
    console.warn("[home-tour-courses] failed to refresh catalog", error);
  });
}

/** 선택 지역의 합집합을 공식 순서로 12개씩 반환한다. 지역이 없으면 시·도 전체를 사용한다. */
export async function getHomeTourCoursePage({ areaCode, sigunguCode, sigunguCodes, page }: CoursePageInput) {
  const regionCodes = [...new Set([...(sigunguCodes ?? []), ...(sigunguCode == null ? [] : [sigunguCode])])];
  const area = FESTIVAL_AREAS.find((candidate) => candidate.areaCode === areaCode);
  if (!area || regionCodes.some((code) => !area.regions.some((region) => region[1] === code))) {
    throw new UserFacingError("여행 코스 지역이 올바르지 않아요.");
  }
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new UserFacingError("여행 코스 페이지가 올바르지 않아요.");
  }

  if (cachedIndex) warmHomeTourCourses();
  const index = cachedIndex?.value ?? await refreshCourseIndex();
  let courses = index.get(areaCode) ?? [];
  if (regionCodes.length === 1) {
    courses = index.get(`${areaCode}:${regionCodes[0]}`) ?? [];
  } else if (regionCodes.length > 1) {
    // 시도 목록의 순서로 걸러서 지역이 겹치는 코스도 페이지에 한 번만 넣는다.
    const selectedIds = new Set(regionCodes.flatMap((code) =>
      (index.get(`${areaCode}:${code}`) ?? []).map(({ id }) => id)
    ));
    courses = courses.filter(({ id }) => selectedIds.has(id));
  }
  const offset = (page - 1) * PAGE_SIZE;
  return { courses: courses.slice(offset, offset + PAGE_SIZE), totalCount: courses.length };
}
