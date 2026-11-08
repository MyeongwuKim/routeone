import { readFile } from "node:fs/promises";
import {
  FESTIVAL_REGION_BY_CODE,
  getFestivalRegionCode,
  resolveFestivalRegionCode,
} from "../notifications/festivalRegions.js";
import type { OfficialTourCourse } from "./tourCourseSource.js";

type Coordinate = [lng: number, lat: number];
type Polygon = Coordinate[][];
type BoundaryFeature = {
  properties: { SIG_CD: string };
  geometry:
    | { type: "Polygon"; coordinates: Polygon }
    | { type: "MultiPolygon"; coordinates: Polygon[] };
};
type CourseRegion = {
  areaCode: string;
  sigunguCode: string;
};
type CourseBoundary = CourseRegion & {
  polygons: Polygon[];
  west: number;
  east: number;
  south: number;
  north: number;
};

const EDGE_TOLERANCE = 1e-9;

/** 개발과 배포에서 API에 포함된 시군구 경계를 읽어 코스의 대표 좌표를 지역에 매핑할 때 사용한다. */
export async function loadTourCourseBoundaries(): Promise<CourseBoundary[]> {
  const boundaryFile = new URL("../../assets/service-region-boundary.json", import.meta.url);
  const { features } = JSON.parse(await readFile(boundaryFile, "utf8")) as { features: BoundaryFeature[] };
  return features.flatMap(({ properties, geometry }) => {
    const region = FESTIVAL_REGION_BY_CODE[properties.SIG_CD];
    if (!region) return [];

    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    let west = Infinity;
    let east = -Infinity;
    let south = Infinity;
    let north = -Infinity;

    for (const polygon of polygons) {
      for (const [lng, lat] of polygon[0] ?? []) {
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
    }

    return [{ areaCode: region.areaCode, sigunguCode: region.tourCode, polygons, west, east, south, north }];
  });
}

/** 경계선 위의 좌표를 포함해 WGS84 링 안에 있는지 판정한다. */
function isInsideRing([lng, lat]: Coordinate, ring: Coordinate[]) {
  let inside = false;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [currentLng, currentLat] = ring[index];
    const [previousLng, previousLat] = ring[previous];
    const cross = (lng - previousLng) * (currentLat - previousLat) -
      (lat - previousLat) * (currentLng - previousLng);

    if (
      Math.abs(cross) <= EDGE_TOLERANCE &&
      lng >= Math.min(previousLng, currentLng) - EDGE_TOLERANCE &&
      lng <= Math.max(previousLng, currentLng) + EDGE_TOLERANCE &&
      lat >= Math.min(previousLat, currentLat) - EDGE_TOLERANCE &&
      lat <= Math.max(previousLat, currentLat) + EDGE_TOLERANCE
    ) return true;

    if (
      (currentLat > lat) !== (previousLat > lat) &&
      lng < currentLng + ((previousLng - currentLng) * (lat - currentLat)) / (previousLat - currentLat)
    ) inside = !inside;
  }

  return inside;
}

/** 공식 법정동·관광공사 지역 코드를 우선하고, 그 외에는 등록 대표 좌표가 속한 경계를 찾는다. */
export function findTourCourseRegions(course: OfficialTourCourse, boundaries: CourseBoundary[]): CourseRegion[] {
  const legalRegionCode = /^\d{5}$/.test(course.adminCode) ? resolveFestivalRegionCode(course.adminCode) : null;
  const registeredRegionCode = legalRegionCode ?? getFestivalRegionCode(course.areaCode, course.sigunguCode);
  if (registeredRegionCode) {
    const region = FESTIVAL_REGION_BY_CODE[registeredRegionCode];
    return [{ areaCode: region.areaCode, sigunguCode: region.tourCode }];
  }

  if (!course.location) return [];
  const { lng, lat } = course.location;
  const point: Coordinate = [lng, lat];

  return boundaries.filter((boundary) => (
    (!course.areaCode || boundary.areaCode === course.areaCode) &&
    lng >= boundary.west - EDGE_TOLERANCE && lng <= boundary.east + EDGE_TOLERANCE &&
    lat >= boundary.south - EDGE_TOLERANCE && lat <= boundary.north + EDGE_TOLERANCE &&
    boundary.polygons.some(([outerRing, ...holes]) => (
      outerRing && isInsideRing(point, outerRing) && !holes.some((hole) => isInsideRing(point, hole))
    ))
  ));
}
