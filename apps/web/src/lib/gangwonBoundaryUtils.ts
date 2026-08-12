import { GANGWON_REGIONS } from "@/data/gangwonRegions";

const KOREA_UNIFIED_CS = {
  semiMajorAxis: 6378137,
  inverseFlattening: 298.257222101,
  originLat: (38 * Math.PI) / 180,
  originLng: (127.5 * Math.PI) / 180,
  falseEasting: 1_000_000,
  falseNorthing: 2_000_000,
  scaleFactor: 0.9996,
};

export type GeoRing = [number, number][];
export type GeoPolygon = GeoRing[];
export type GeoMultiPolygon = GeoPolygon[];

export type GangwonBoundaryFeature = {
  properties?: {
    id?: string;
    title?: string;
    SIG_CD?: string;
    SIG_KOR_NM?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

export type GangwonBoundaryCollection = {
  features?: GangwonBoundaryFeature[];
};

export type CurrentLocation = {
  lat: number;
  lng: number;
};

type BoundaryRegion = {
  label: string;
  sigunguCode: string;
  adminCode: string;
};

function toMultiPolygonCoordinates(
  feature: GangwonBoundaryFeature
): GeoMultiPolygon {
  const geometryType = feature.geometry?.type;
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates) {
    return [];
  }

  if (geometryType === "Polygon") {
    return [coordinates as GeoPolygon];
  }

  if (geometryType === "MultiPolygon") {
    return coordinates as GeoMultiPolygon;
  }

  return [];
}

export function buildBoundaryMapBySigunguCode(
  collection: GangwonBoundaryCollection
): Record<string, GeoMultiPolygon> {
  return buildBoundaryMapByRegions(collection, GANGWON_REGIONS);
}

export function buildBoundaryMapByRegions(
  collection: GangwonBoundaryCollection,
  regions: readonly BoundaryRegion[]
): Record<string, GeoMultiPolygon> {
  const features = collection.features ?? [];
  const mapByCode: Record<string, GeoMultiPolygon> = {};

  regions.forEach((region) => {
    const matchedFeature = features.find((feature) => {
      const properties = feature.properties;

      return (
        properties?.SIG_CD === region.adminCode ||
        properties?.SIG_KOR_NM === region.label ||
        properties?.title?.startsWith(region.label)
      );
    });

    if (matchedFeature) {
      mapByCode[region.sigunguCode] = toMultiPolygonCoordinates(matchedFeature);
    }
  });

  return mapByCode;
}

function isPointOnSegment(
  point: CurrentLocation,
  start: CurrentLocation,
  end: CurrentLocation
) {
  const crossProduct =
    (point.lng - start.lng) * (end.lat - start.lat) -
    (point.lat - start.lat) * (end.lng - start.lng);
  if (Math.abs(crossProduct) > 1e-9) {
    return false;
  }

  return (
    point.lng >= Math.min(start.lng, end.lng) - 1e-9 &&
    point.lng <= Math.max(start.lng, end.lng) + 1e-9 &&
    point.lat >= Math.min(start.lat, end.lat) - 1e-9 &&
    point.lat <= Math.max(start.lat, end.lat) + 1e-9
  );
}

function normalizeBoundaryPoint(
  coordinate: [number, number]
): CurrentLocation | null {
  const [x, y] = coordinate;

  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
    return { lat: y, lng: x };
  }

  return convertUtmkToWgs84(x, y);
}

function isLocationInsideRing(
  location: CurrentLocation,
  ring: GeoRing
) {
  let isInside = false;

  for (
    let index = 0, previousIndex = ring.length - 1;
    index < ring.length;
    previousIndex = index, index += 1
  ) {
    const current = normalizeBoundaryPoint(ring[index]);
    const previous = normalizeBoundaryPoint(ring[previousIndex]);
    if (!current || !previous) {
      continue;
    }

    if (isPointOnSegment(location, previous, current)) {
      return true;
    }

    const intersects =
      current.lat > location.lat !== previous.lat > location.lat &&
      location.lng <
        ((previous.lng - current.lng) * (location.lat - current.lat)) /
          (previous.lat - current.lat) +
          current.lng;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isLocationInsidePolygon(
  location: CurrentLocation,
  polygon: GeoPolygon
) {
  const [outerRing, ...innerRings] = polygon;

  return (
    Boolean(outerRing && isLocationInsideRing(location, outerRing)) &&
    !innerRings.some((ring) => isLocationInsideRing(location, ring))
  );
}

export function findRegionContainingLocation(
  location: CurrentLocation,
  regions: readonly BoundaryRegion[],
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>
) {
  return (
    regions.find((region) =>
      boundaryBySigunguCode[region.sigunguCode]?.some((polygon) =>
        isLocationInsidePolygon(location, polygon)
      )
    ) ?? null
  );
}

function getMeridianArc(radianLat: number) {
  const { semiMajorAxis, inverseFlattening } = KOREA_UNIFIED_CS;
  const flattening = 1 / inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;

  return (
    semiMajorAxis *
    ((1 -
      eccentricitySquared / 4 -
      (3 * eccentricityFourth) / 64 -
      (5 * eccentricitySixth) / 256) *
      radianLat -
      ((3 * eccentricitySquared) / 8 +
        (3 * eccentricityFourth) / 32 +
        (45 * eccentricitySixth) / 1024) *
        Math.sin(2 * radianLat) +
      ((15 * eccentricityFourth) / 256 + (45 * eccentricitySixth) / 1024) *
        Math.sin(4 * radianLat) -
      ((35 * eccentricitySixth) / 3072) * Math.sin(6 * radianLat))
  );
}

export function convertUtmkToWgs84(
  x: number,
  y: number
): CurrentLocation | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const {
    semiMajorAxis,
    inverseFlattening,
    originLat,
    originLng,
    falseEasting,
    falseNorthing,
    scaleFactor,
  } = KOREA_UNIFIED_CS;
  const flattening = 1 / inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const eccentricityPrimeSquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;
  const meridian =
    getMeridianArc(originLat) + (y - falseNorthing) / scaleFactor;
  const mu =
    meridian /
    (semiMajorAxis *
      (1 -
        eccentricitySquared / 4 -
        (3 * eccentricityFourth) / 64 -
        (5 * eccentricitySixth) / 256));
  const e1 =
    (1 - Math.sqrt(1 - eccentricitySquared)) /
    (1 + Math.sqrt(1 - eccentricitySquared));
  const footprintLat =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinFootprint = Math.sin(footprintLat);
  const cosFootprint = Math.cos(footprintLat);
  const tanFootprint = Math.tan(footprintLat);
  const c1 = eccentricityPrimeSquared * cosFootprint ** 2;
  const t1 = tanFootprint ** 2;
  const n1 =
    semiMajorAxis /
    Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
  const r1 =
    (semiMajorAxis * (1 - eccentricitySquared)) /
    (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
  const d = (x - falseEasting) / (n1 * scaleFactor);
  const lat =
    footprintLat -
    ((n1 * tanFootprint) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccentricityPrimeSquared) *
          d ** 4) /
          24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 * eccentricityPrimeSquared -
          3 * c1 ** 2) *
          d ** 6) /
          720);
  const lng =
    originLng +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 -
        2 * c1 +
        28 * t1 -
        3 * c1 ** 2 +
        8 * eccentricityPrimeSquared +
        24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosFootprint;

  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}

export function calculateDistanceMeters(
  from: CurrentLocation,
  to: CurrentLocation
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}
