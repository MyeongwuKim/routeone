import { isWithinWalkingBounds, isWalkingPoint } from "./walkingGeometry";
import type { WalkingBounds, WalkingDataPack } from "./walkingTypes";

type OsmTags = Record<string, string>;
type OsmNode = { type: "node"; id: number; lat: number; lon: number; tags?: OsmTags };
type OsmWay = { type: "way"; id: number; nodes: number[]; tags?: OsmTags };
export type OsmWalkingInput = {
  elements: Array<OsmNode | OsmWay | { type: "relation"; id: number }>;
  osm3s?: { timestamp_osm_base?: string };
};

const WALKABLE_HIGHWAYS = new Set([
  "footway", "path", "pedestrian", "steps", "living_street", "residential", "service",
  "unclassified", "track", "tertiary", "tertiary_link", "secondary", "secondary_link",
  "primary", "primary_link", "road",
]);
const ALLOWED_FOOT = new Set(["yes", "designated", "permissive", "official"]);
const RESTRICTED_ACCESS = new Set(["no", "private", "military", "customers", "delivery", "agricultural", "forestry", "destination", "permit"]);

/** 보행 허용 태그를 우선하되 자동차 전용·공사·조건부 통행·어려운 등산로는 제외한다. */
export function isWalkableOsmWay(tags: OsmTags) {
  if (!WALKABLE_HIGHWAYS.has(tags.highway) || tags.motorroad === "yes"
    || tags.area === "yes" || tags.construction || tags.proposed
    || tags["foot:conditional"] || tags["access:conditional"]
    || tags.sidewalk === "use_sidepath" || tags.foot === "use_sidepath"
    || ["mountain_hiking", "demanding_mountain_hiking", "alpine_hiking", "demanding_alpine_hiking", "difficult_alpine_hiking"].includes(tags.sac_scale)) {
    return false;
  }
  if (tags.foot) return ALLOWED_FOOT.has(tags.foot);
  return !RESTRICTED_ACCESS.has(tags.access);
}

function isBlockedNode(tags: OsmTags) {
  if (tags["foot:conditional"] || tags["access:conditional"]) return true;
  if (tags.locked === "yes") return true;
  if (tags.foot) return !ALLOWED_FOOT.has(tags.foot);
  if (RESTRICTED_ACCESS.has(tags.access)) return true;
  return ["wall", "fence", "block", "retaining_wall", "jersey_barrier"].includes(tags.barrier);
}

/**
 * 내려받은 OSM 데이터에서 보행 가능한 연결만 추출한다. 교차해 보이는 선도 OSM 노드를 공유하지 않으면 연결하지 않는다.
 * 장벽 노드 양쪽을 건너뛰어 연결하거나, 외곽·누락 노드를 직선으로 메우지 않는다.
 */
export function createWalkingDataPack(input: OsmWalkingInput, options: {
  regionId: string;
  regionLabel: string;
  bounds: WalkingBounds;
  downloadedAt: string;
}): WalkingDataPack {
  const sourceNodes = new Map<number, OsmNode>();
  for (const element of input.elements) {
    if (element.type === "node" && isWalkingPoint({ lat: element.lat, lng: element.lon })
      && isWithinWalkingBounds({ lat: element.lat, lng: element.lon }, options.bounds)
      && !isBlockedNode(element.tags ?? {})) sourceNodes.set(element.id, element);
  }
  const nodes: WalkingDataPack["nodes"] = [];
  const indices = new Map<number, number>();
  const segments: WalkingDataPack["segments"] = [];
  const seen = new Set<string>();
  const nodeIndex = (id: number) => {
    let index = indices.get(id);
    if (index !== undefined) return index;
    const node = sourceNodes.get(id)!;
    index = nodes.length;
    nodes.push([node.lat, node.lon]);
    indices.set(id, index);
    return index;
  };
  for (const element of input.elements) {
    if (element.type !== "way" || !isWalkableOsmWay(element.tags ?? {})) continue;
    const tags = element.tags ?? {};
    const steps = tags.highway === "steps" ? 1 : 0;
    // 자동차 일방통행은 보행자에게 적용하지 않고 보행자용 방향 지정만 사용한다.
    const footDirection = tags["oneway:foot"];
    const direction = footDirection === "-1" ? -1 : ["yes", "1", "true"].includes(footDirection) ? 1 : 0;
    for (let i = 1; i < element.nodes.length; i++) {
      const fromId = element.nodes[i - 1];
      const toId = element.nodes[i];
      if (fromId === toId || !sourceNodes.has(fromId) || !sourceNodes.has(toId)) continue;
      const from = nodeIndex(fromId);
      const to = nodeIndex(toId);
      const key = direction === 0
        ? `${Math.min(from, to)}:${Math.max(from, to)}:${steps}:0`
        : `${direction === -1 ? to : from}:${direction === -1 ? from : to}:${steps}:1`;
      if (seen.has(key)) continue;
      seen.add(key);
      segments.push([from, to, steps, direction]);
    }
  }
  return {
    version: 1, ...options,
    sourceTimestamp: input.osm3s?.timestamp_osm_base ?? options.downloadedAt,
    attribution: "© OpenStreetMap contributors", license: "ODbL-1.0",
    nodes, segments,
  };
}
