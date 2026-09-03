/**
 * 용도:
 * 홈 지도에서 현재 GPS를 지역 필터에 적용해도 되는지 판단한다.
 *
 * 동작 방식:
 * 유효한 위치 좌표가 경계에 포함되는 지역을 찾고,
 * 경계 밖이면 서비스 지역 가운데 가장 가까운 지역을 반환한다.
 */
import type { ServiceArea } from "@/data/serviceAreas";
import { getNearestServiceRegion } from "@/data/serviceAreas";
import {
  findRegionContainingLocation,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type { RouteOnePosition } from "@/lib/currentPosition";

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
