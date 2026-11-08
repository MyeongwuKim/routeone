import { isWalkingPoint, isWithinWalkingBounds, projectOntoWalkingSegment, walkingDistanceM } from "./walkingGeometry";
import { WalkingRoutingError, type WalkingDataPack, type WalkingPoint, type WalkingRouteResult } from "./walkingTypes";

const WALKING_SPEED_M_PER_SECOND = 4_000 / 3_600;
const STEPS_SPEED_M_PER_SECOND = 2_000 / 3_600;
const MAX_SNAP_DISTANCE_M = 60;
const MAX_SEARCH_NODES = 300_000;

type Edge = { to: number; distanceM: number; seconds: number; steps: boolean; segment: number };
type Segment = { from: number; to: number; steps: boolean; direction: number };
export type WalkingGraph = {
  pack: WalkingDataPack;
  points: WalkingPoint[];
  edges: Edge[][];
  segments: Segment[];
};

/** 예상 시간이 가장 작은 후보부터 꺼낸다. 탐색할 때마다 모든 노드를 정렬하지 않는다. */
class MinQueue {
  private items: Array<{ node: number; cost: number }> = [];
  push(item: { node: number; cost: number }) {
    let index = this.items.length;
    this.items.push(item);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].cost <= item.cost) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    const first = this.items[0];
    const last = this.items.pop();
    if (last && this.items.length > 0) {
      let index = 0;
      while (index * 2 + 1 < this.items.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.items.length && this.items[child + 1].cost < this.items[child].cost) child++;
        if (this.items[child].cost >= last.cost) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

function makeEdge(to: number, distanceM: number, steps: boolean, segment: number): Edge {
  return { to, distanceM, steps, segment,
    seconds: distanceM / (steps ? STEPS_SPEED_M_PER_SECOND : WALKING_SPEED_M_PER_SECOND) };
}

/** 미리 추출한 보행로를 방향 그래프로 만든다. 데이터가 손상되면 계산을 시작하지 않는다. */
export function buildWalkingGraph(pack: WalkingDataPack): WalkingGraph {
  if (pack?.version !== 1 || !Array.isArray(pack.nodes) || !Array.isArray(pack.segments)
    || pack.nodes.length === 0 || pack.segments.length === 0) throw new WalkingRoutingError("DATA_UNAVAILABLE");
  const points = pack.nodes.map(([lat, lng]) => ({ lat, lng }));
  if (points.some(point => !isWalkingPoint(point))) throw new WalkingRoutingError("DATA_UNAVAILABLE");
  const edges: Edge[][] = points.map(() => []);
  const segments: Segment[] = [];
  pack.segments.forEach(([from, to, stepFlag, direction], index) => {
    if (!Number.isInteger(from) || !Number.isInteger(to) || !points[from] || !points[to]
      || ![0, 1].includes(stepFlag) || ![-1, 0, 1].includes(direction)) {
      throw new WalkingRoutingError("DATA_UNAVAILABLE");
    }
    const steps = stepFlag === 1;
    const distanceM = walkingDistanceM(points[from], points[to]);
    segments.push({ from, to, steps, direction });
    if (direction !== -1) edges[from].push(makeEdge(to, distanceM, steps, index));
    if (direction !== 1) edges[to].push(makeEdge(from, distanceM, steps, index));
  });
  return { pack, points, edges, segments };
}

function snapToGraph(graph: WalkingGraph, point: WalkingPoint) {
  let best: (ReturnType<typeof projectOntoWalkingSegment> & { segment: number }) | null = null;
  graph.segments.forEach((segment, index) => {
    const projection = projectOntoWalkingSegment(point, graph.points[segment.from], graph.points[segment.to]);
    if (!best || projection.distanceM < best.distanceM) best = { ...projection, segment: index };
  });
  const found = best as (ReturnType<typeof projectOntoWalkingSegment> & { segment: number }) | null;
  if (!found || found.distanceM > MAX_SNAP_DISTANCE_M) throw new WalkingRoutingError("NO_NEARBY_PATH");
  return found;
}

/**
 * A*로 기록된 보행로를 탐색한다. 양 끝점은 60m 안의 가장 가까운 선분에 투영하고 같은 선분에서도 실제 부분 거리만 계산한다.
 * 일반 보행로는 시속 4km, 계단은 시속 2km로 추정한다. 신호대기·실시간 통제·경사는 반영하지 않는다.
 * 연결 실패 시 직선이나 자동차 경로로 대체하지 않는다. 지도점→보행로 접근 거리는 따로 반환하며 합계에서 제외한다.
 */
export function calculateWalkingRoute(graph: WalkingGraph, start: WalkingPoint, goal: WalkingPoint): WalkingRouteResult {
  if (!isWalkingPoint(start) || !isWalkingPoint(goal)) throw new WalkingRoutingError("INVALID_INPUT");
  if (!isWithinWalkingBounds(start, graph.pack.bounds) || !isWithinWalkingBounds(goal, graph.pack.bounds)) {
    throw new WalkingRoutingError("OUTSIDE_COVERAGE");
  }
  const startSnap = snapToGraph(graph, start);
  const goalSnap = snapToGraph(graph, goal);
  const points = [...graph.points, startSnap.point, goalSnap.point];
  const startIndex = graph.points.length;
  const goalIndex = startIndex + 1;
  const extraEdges = new Map<number, Edge[]>();
  const splitSegments = new Set([startSnap.segment, goalSnap.segment]);
  const addExtraEdge = (from: number, to: number, steps: boolean, segment: number) => {
    const list = extraEdges.get(from) ?? [];
    list.push(makeEdge(to, walkingDistanceM(points[from], points[to]), steps, segment));
    extraEdges.set(from, list);
  };
  for (const index of splitSegments) {
    const segment = graph.segments[index];
    const splitPoints = [
      { node: segment.from, t: 0 },
      ...(startSnap.segment === index ? [{ node: startIndex, t: startSnap.t }] : []),
      ...(goalSnap.segment === index ? [{ node: goalIndex, t: goalSnap.t }] : []),
      { node: segment.to, t: 1 },
    ].sort((a, b) => a.t - b.t);
    for (let i = 1; i < splitPoints.length; i++) {
      const a = splitPoints[i - 1].node;
      const b = splitPoints[i].node;
      if (segment.direction !== -1) addExtraEdge(a, b, segment.steps, index);
      if (segment.direction !== 1) addExtraEdge(b, a, segment.steps, index);
    }
  }
  const costs = new Float64Array(points.length).fill(Infinity);
  const previous = new Int32Array(points.length).fill(-1);
  const previousEdges: Array<Edge | undefined> = new Array(points.length);
  const visited = new Uint8Array(points.length);
  const queue = new MinQueue();
  costs[startIndex] = 0;
  queue.push({ node: startIndex, cost: 0 });
  let expanded = 0;
  let entry;
  while ((entry = queue.pop())) {
    const current = entry.node;
    if (visited[current]) continue;
    visited[current] = 1;
    if (current === goalIndex) break;
    if (++expanded > MAX_SEARCH_NODES) throw new WalkingRoutingError("SEARCH_LIMIT");
    const neighbors = [
      ...(graph.edges[current] ?? []).filter(edge => !splitSegments.has(edge.segment)),
      ...(extraEdges.get(current) ?? []),
    ];
    for (const edge of neighbors) {
      const nextCost = costs[current] + edge.seconds;
      if (nextCost >= costs[edge.to]) continue;
      costs[edge.to] = nextCost;
      previous[edge.to] = current;
      previousEdges[edge.to] = edge;
      const remaining = walkingDistanceM(points[edge.to], goalSnap.point) / WALKING_SPEED_M_PER_SECOND;
      queue.push({ node: edge.to, cost: nextCost + remaining });
    }
  }
  if (!Number.isFinite(costs[goalIndex])) throw new WalkingRoutingError("NO_ROUTE");
  const path: WalkingPoint[] = [];
  let distanceM = 0;
  let stepsDistanceM = 0;
  for (let current = goalIndex; current !== -1; current = previous[current]) {
    path.push(points[current]);
    const edge = previousEdges[current];
    if (edge) {
      distanceM += edge.distanceM;
      if (edge.steps) stepsDistanceM += edge.distanceM;
    }
  }
  path.reverse();
  const dedupedPath = path.filter((point, index) => index === 0
    || walkingDistanceM(path[index - 1], point) > 0.01);
  return {
    mode: "walking", distanceM: Math.round(distanceM), durationMs: Math.round(costs[goalIndex] * 1000),
    path: dedupedPath.length === 1 ? [dedupedPath[0], dedupedPath[0]] : dedupedPath,
    snappedStart: startSnap.point, snappedGoal: goalSnap.point,
    startAccessDistanceM: Math.round(startSnap.distanceM), goalAccessDistanceM: Math.round(goalSnap.distanceM),
    stepsDistanceM: Math.round(stepsDistanceM),
    dataDate: graph.pack.sourceTimestamp.slice(0, 10), regionLabel: graph.pack.regionLabel,
  };
}
