/**
 * 용도:
 * GPS 테스트의 지도 범위와 지정한 좌표부터 장소까지 가상 이동할 경로를 계산한다.
 *
 * 동작 방식:
 * 출발 좌표를 첫 단계로 유지하고, 장소와의 거리를 줄이며 방문 인증 반경까지 이동한다.
 */
import { calculateDistanceMeters } from "@/lib/gangwonBoundaryUtils";

export type TestLocation = { lat: number; lng: number };

const AUTO_WALK_FINAL_DISTANCE_METERS = 30;
const NEARBY_AUTO_WALK_DISTANCES_METERS = [
  1000,
  450,
  350,
  290,
  180,
  AUTO_WALK_FINAL_DISTANCE_METERS,
] as const;

export function getOffsetTestLocation(
  place: TestLocation,
  distanceMeters: number
) {
  const latitudeRadians = (place.lat * Math.PI) / 180;
  const longitudeOffset =
    distanceMeters /
    (111_320 * Math.max(0.2, Math.cos(latitudeRadians)));

  return {
    lat: place.lat,
    lng: place.lng + longitudeOffset,
  };
}

function interpolateLocation(
  start: TestLocation,
  target: TestLocation,
  progress: number
) {
  const normalizedProgress = Math.max(0, Math.min(1, progress));

  return {
    lat: start.lat + (target.lat - start.lat) * normalizedProgress,
    lng: start.lng + (target.lng - start.lng) * normalizedProgress,
  };
}

export function createAutoWalkSteps(
  start: TestLocation,
  target: TestLocation
) {
  const totalDistanceMeters = calculateDistanceMeters(start, target);
  const acceleratedDistances =
    totalDistanceMeters > 2000
      ? [totalDistanceMeters * 0.65, totalDistanceMeters * 0.3]
      : [];
  const remainingDistances = [
    totalDistanceMeters,
    ...acceleratedDistances,
    ...NEARBY_AUTO_WALK_DISTANCES_METERS,
  ]
    .filter(
      (distance) =>
        distance <= totalDistanceMeters &&
        (distance === totalDistanceMeters ||
          distance >= AUTO_WALK_FINAL_DISTANCE_METERS)
    )
    .sort((left, right) => right - left)
    .filter(
      (distance, index, distances) =>
        index === 0 || Math.abs(distances[index - 1] - distance) >= 10
    );

  return remainingDistances.map((remainingDistanceMeters) => ({
    distanceMeters: remainingDistanceMeters,
    position:
      totalDistanceMeters <= 0
        ? target
        : interpolateLocation(
            start,
            target,
            1 - remainingDistanceMeters / totalDistanceMeters
          ),
  }));
}

export function formatGpsTestDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

