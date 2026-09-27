/** 홈 화면의 현재 위치 좌표 검증과 서비스 지역 선택 규칙을 제공한다. */
import type { ServiceArea } from "@/data/serviceAreas";
import { getNearestServiceRegion } from "@/data/serviceAreas";
import {
  findRegionContainingLocation,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type { RouteOnePosition } from "@/lib/currentPosition";

/**
 * position의 위도와 경도가 유한한 숫자이고 각각 -90~90, -180~180 범위에 있는지 확인한다.
 * 위치 권한, 측정 시각, 정확도는 판정하지 않는다.
 */
export function isUsableHomeRegionPosition(
  position: RouteOnePosition
) {
  const { lat, lng } = position;

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * 유효한 현재 위치가 어느 서비스 지역 경계에 포함되는지 찾는다.
 * 경계에 포함되지 않으면 serviceArea.regions의 중심 좌표를 기준으로 가장 가까운 지역을 반환하고,
 * 좌표 자체가 유효하지 않으면 지역을 추정하지 않고 null을 반환한다.
 */
export function resolveHomeRegionFromPosition(
  position: RouteOnePosition,
  serviceArea: ServiceArea,
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>
) {
  if (!isUsableHomeRegionPosition(position)) {
    return null;
  }

  return (
    findRegionContainingLocation(
      position,
      serviceArea.regions,
      boundaryBySigunguCode
    ) ?? getNearestServiceRegion(serviceArea, position)
  );
}
