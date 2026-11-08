import { SERVICE_REGION_LIST } from "@/data/serviceAreas";
import { findRegionContainingLocation, type CurrentLocation, type GeoMultiPolygon } from "@/lib/gangwonBoundaryUtils";

const regionsByAdminCode = SERVICE_REGION_LIST.map(({ region }) => ({
  ...region,
  sigunguCode: region.adminCode,
}));

/**
 * 지도에서 누른 좌표가 실제 경계 안에 있는 시군구와 권역을 찾는다.
 * 바다·해외처럼 지원 경계 밖인 위치는 가장 가까운 지역으로 대체하지 않고 null을 반환한다.
 */
export function findServiceRegionAtLocation(position: CurrentLocation, boundaryByAdminCode: Record<string, GeoMultiPolygon>) {
  const matchedRegion = findRegionContainingLocation(position, regionsByAdminCode, boundaryByAdminCode);
  return matchedRegion
    ? SERVICE_REGION_LIST.find(({ region }) => region.adminCode === matchedRegion.adminCode) ?? null
    : null;
}
