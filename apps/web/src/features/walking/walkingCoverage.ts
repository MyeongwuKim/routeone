import type { WalkingBounds } from "./walkingTypes";

/** 브라우저에서 자체 도보 계산을 지원하는 지역 데이터. 다른 지역은 경로를 추측하지 않고 미지원으로 알린다. */
export const WALKING_COVERAGE = {
  id: "gangneung",
  label: "강릉 시내·경포·안목",
  bounds: { south: 37.72, west: 128.85, north: 37.83, east: 128.96 } satisfies WalkingBounds,
  filename: "gangneung.json",
};
