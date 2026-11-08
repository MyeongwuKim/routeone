export type WalkingPoint = { lat: number; lng: number };
export type WalkingBounds = { south: number; west: number; north: number; east: number };

/** 자체 도보 계산에 쓰는 OSM 스냅샷. 구간의 노드 번호는 nodes 배열의 인덱스다. */
export type WalkingDataPack = {
  version: 1;
  regionId: string;
  regionLabel: string;
  bounds: WalkingBounds;
  downloadedAt: string;
  sourceTimestamp: string;
  attribution: "© OpenStreetMap contributors";
  license: "ODbL-1.0";
  nodes: Array<[lat: number, lng: number]>;
  /** 방향: 0은 양방향, 1은 from→to, -1은 to→from. steps는 계단 구간이다. */
  segments: Array<[from: number, to: number, steps: 0 | 1, direction: -1 | 0 | 1]>;
};

export type WalkingRouteResult = {
  mode: "walking";
  /** 데이터에 기록된 보행로 구간만 합산하며 지도점과 보행로 사이의 간격은 제외한다. */
  distanceM: number;
  durationMs: number;
  path: WalkingPoint[];
  snappedStart: WalkingPoint;
  snappedGoal: WalkingPoint;
  startAccessDistanceM: number;
  goalAccessDistanceM: number;
  stepsDistanceM: number;
  dataDate: string;
  regionLabel: string;
};

export type WalkingErrorCode =
  | "INVALID_INPUT"
  | "OUTSIDE_COVERAGE"
  | "NO_NEARBY_PATH"
  | "NO_ROUTE"
  | "DATA_UNAVAILABLE"
  | "SEARCH_LIMIT";

/** 연결되지 않은 길이나 지원 범위 밖의 좌표를 가짜 경로로 대체하지 않고 구분해 전달한다. */
export class WalkingRoutingError extends Error {
  readonly code: WalkingErrorCode;

  constructor(code: WalkingErrorCode) {
    super(code);
    this.name = "WalkingRoutingError";
    this.code = code;
  }
}
