import type { WalkingBounds } from "./walkingTypes";

/** 보행로 데이터가 서비스 지역 전체를 지원할 때까지 도보 진입점과 이동수단 선택을 숨긴다. */
export const WALKING_DIRECTIONS_ENABLED = false;

/** 브라우저에서 자체 도보 계산을 지원하는 지역 데이터. 다른 지역은 경로를 추측하지 않고 미지원으로 알린다. */
export const WALKING_COVERAGE = {
  id: "gangneung",
  label: "강릉 시내·경포·안목",
  bounds: { south: 37.72, west: 128.85, north: 37.83, east: 128.96 } satisfies WalkingBounds,
  filename: "gangneung.json",
};
