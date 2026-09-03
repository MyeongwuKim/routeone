/**
 * 용도:
 * 홈 지도에서 현재 GPS를 지역 필터에 적용해도 되는지 판단한다.
 *
 * 동작 방식:
 * 위치 좌표와 정확도가 신뢰 범위 안에 있을 때 경계에 포함된 지역을 찾고,
 * 경계 밖이면 서비스 지역 가운데 가장 가까운 지역을 반환한다.
 */
import type { ServiceArea } from "@/data/serviceAreas";
import { getNearestServiceRegion } from "@/data/serviceAreas";
import {
  findRegionContainingLocation,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type { RouteOnePosition } from "@/lib/currentPosition";

export const HOME_REGION_MAX_POSITION_ACCURACY_METERS = 1_000;

export function isReliableHomeRegionPosition(
  position: RouteOnePosition
) {
  const { accuracyMeters, lat, lng } = position;

  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    typeof accuracyMeters === "number" &&
    Number.isFinite(accuracyMeters) &&
    accuracyMeters >= 0 &&
    accuracyMeters <= HOME_REGION_MAX_POSITION_ACCURACY_METERS
  );
}

export function resolveHomeRegionFromPosition(
  position: RouteOnePosition,
  serviceArea: ServiceArea,
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>
) {
  if (!isReliableHomeRegionPosition(position)) {
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
