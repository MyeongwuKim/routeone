import type { WalkingBounds, WalkingPoint } from "./walkingTypes";

const EARTH_RADIUS_M = 6_371_008.8;
const TO_RADIANS = Math.PI / 180;

/** 두 위경도의 지표면 직선거리(m). 경로의 각 선분 길이와 탐색 휴리스틱에 사용한다. */
export function walkingDistanceM(a: WalkingPoint, b: WalkingPoint) {
  const latDelta = (b.lat - a.lat) * TO_RADIANS;
  const lngDelta = (b.lng - a.lng) * TO_RADIANS;
  const h = Math.sin(latDelta / 2) ** 2
    + Math.cos(a.lat * TO_RADIANS) * Math.cos(b.lat * TO_RADIANS)
    * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.min(1, h)));
}

/** 위경도가 유한한 지구 좌표인지 확인한다. 문자열이나 누락된 필드는 거부한다. */
export function isWalkingPoint(point: WalkingPoint) {
  return Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng)
    && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
}

/** 데이터에 없는 외곽 경로가 지원되는 것으로 표시되지 않도록 양 끝점을 검사한다. */
export function isWithinWalkingBounds(point: WalkingPoint, bounds: WalkingBounds) {
  return point.lat >= bounds.south && point.lat <= bounds.north
    && point.lng >= bounds.west && point.lng <= bounds.east;
}

/** 지역 규모의 위경도 선분에 좌표를 투영한다. 실제 보행로 연결선은 생성하지 않는다. */
export function projectOntoWalkingSegment(point: WalkingPoint, a: WalkingPoint, b: WalkingPoint) {
  const lngScale = Math.cos(point.lat * TO_RADIANS);
  const dx = (b.lng - a.lng) * lngScale;
  const dy = b.lat - a.lat;
  const denominator = dx * dx + dy * dy;
  const t = denominator === 0 ? 0 : Math.max(0, Math.min(1,
    (((point.lng - a.lng) * lngScale) * dx + (point.lat - a.lat) * dy) / denominator,
  ));
  const projected = { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
  return { point: projected, t, distanceM: walkingDistanceM(point, projected) };
}
