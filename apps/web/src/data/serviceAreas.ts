import {
  DEFAULT_GANGWON_REGION,
  GANGWON_AREA_CODE,
  GANGWON_CENTER,
  GANGWON_REGIONS,
  GANGWON_TATS_AREA_CODE,
} from "@/data/gangwonRegions";
import {
  DEFAULT_SEOUL_REGION,
  SEOUL_CENTER,
  SEOUL_REGIONS,
  SEOUL_TATS_AREA_CODE,
  SEOUL_TOUR_AREA_CODE,
} from "@/data/seoulRegions";

export type ServiceAreaId = "gangwon" | "seoul";

export type ServiceRegion = {
  label: string;
  sigunguCode: string;
  adminCode: string;
  center: {
    lat: number;
    lng: number;
  };
};

export type ServiceArea = {
  id: ServiceAreaId;
  label: string;
  tourAreaCode: string;
  tatsAreaCode: string;
  center: {
    lat: number;
    lng: number;
  };
  defaultRegion: ServiceRegion;
  regions: readonly ServiceRegion[];
  hasBoundaryAsset: boolean;
  hasFestivalSource: boolean;
};

export const SERVICE_AREAS: Record<ServiceAreaId, ServiceArea> = {
  gangwon: {
    id: "gangwon",
    label: "강원",
    tourAreaCode: GANGWON_AREA_CODE,
    tatsAreaCode: GANGWON_TATS_AREA_CODE,
    center: GANGWON_CENTER,
    defaultRegion: DEFAULT_GANGWON_REGION,
    regions: GANGWON_REGIONS,
    hasBoundaryAsset: true,
    hasFestivalSource: true,
  },
  seoul: {
    id: "seoul",
    label: "서울",
    tourAreaCode: SEOUL_TOUR_AREA_CODE,
    tatsAreaCode: SEOUL_TATS_AREA_CODE,
    center: SEOUL_CENTER,
    defaultRegion: DEFAULT_SEOUL_REGION,
    regions: SEOUL_REGIONS,
    hasBoundaryAsset: false,
    hasFestivalSource: false,
  },
};

export const DEFAULT_SERVICE_AREA = SERVICE_AREAS.gangwon;

export function getServiceArea(id: ServiceAreaId) {
  return SERVICE_AREAS[id];
}

export function isServiceAreaId(value: unknown): value is ServiceAreaId {
  return value === "gangwon" || value === "seoul";
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
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

export function getNearestServiceRegion(
  serviceArea: ServiceArea,
  location: { lat: number; lng: number }
) {
  return serviceArea.regions.reduce((nearestRegion, region) => {
    const nearestDistance = calculateDistanceMeters(
      location,
      nearestRegion.center
    );
    const regionDistance = calculateDistanceMeters(location, region.center);

    return regionDistance < nearestDistance ? region : nearestRegion;
  }, serviceArea.defaultRegion);
}
