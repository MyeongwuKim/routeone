import { getServiceArea, isServiceAreaId, SERVICE_REGION_LIST, type ServiceAreaId } from "@/data/serviceAreas";
import type { HomeTourCoursesQuery } from "@/generated/graphql";

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
