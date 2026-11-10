/**
 * 서비스 가능 지역의 ID, 표시 이름, 기본 지도 위치와 축제 데이터 제공 여부를 정의한다.
 */
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
import { PROVINCIAL_SERVICE_AREAS } from "@/data/provincialServiceAreas";

export type ServiceAreaId =
  | "gangwon" | "seoul" | "gyeonggi" | "busan" | "daegu" | "gwangju" | "daejeon"
  | "ulsan" | "sejong" | "chungbuk" | "chungnam" | "jeonbuk"
  | "jeonnam" | "gyeongbuk" | "gyeongnam" | "jeju";

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
  boundaryAssetPath?: string;
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
    boundaryAssetPath: "/gangwon-sigungu-boundary.json",
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
    hasBoundaryAsset: true,
    boundaryAssetPath: "/seoul-sigungu-boundary.json",
    hasFestivalSource: true,
  },
  ...PROVINCIAL_SERVICE_AREAS,
};

export const DEFAULT_SERVICE_AREA = SERVICE_AREAS.gangwon;

/** 지역 선택 UI와 전국 경계 판정에서 사용하는 권역 목록. */
export const SERVICE_AREA_LIST = Object.values(SERVICE_AREAS);

/** 전국 경계 조회 키인 행정 코드와 해당 권역·시군구를 연결한다. 관광공사 코드는 권역 안에서만 고유하다. */
export const SERVICE_REGION_LIST = SERVICE_AREA_LIST.flatMap((area) =>
  area.regions.map((region) => ({ area, region }))
);

/** 선택한 권역의 지도 중심과 시·군·구 목록을 반환한다. */
export function getServiceArea(id: ServiceAreaId) {
  return SERVICE_AREAS[id];
}

export function isServiceAreaId(value: unknown): value is ServiceAreaId {
  return typeof value === "string" && Object.hasOwn(SERVICE_AREAS, value);
}

/**
 * 저장된 장소의 행정 코드 또는 권역:시군구 키로 지역을 찾는다.
 * 경기도 일반구는 관광공사 조회 단위인 상위 시로 연결한다.
 * 36이 경남 관광 코드와 세종 행정 코드에 함께 쓰이므로 전체 행정 코드를 우선하고, 짧은 코드는 관광 권역 안에서 찾는다.
 */
export function resolveServiceRegion(regionLabelKey?: string | null, regionCode?: string | null) {
  const [areaCode, localCode] = regionLabelKey?.split(":") ?? [];
  const adminCode = [regionCode, localCode].find((code) => code && /^\d{5}$/.test(code));
  if (adminCode) {
    const serviceCode = adminCode.startsWith("41") ? `${adminCode.slice(0, 4)}0` : adminCode;
    const match = SERVICE_REGION_LIST.find(({ region }) => region.adminCode === serviceCode);
    if (match) return match;
  }
  if (areaCode && localCode) {
    const area = SERVICE_AREA_LIST.find((area) => area.tourAreaCode === areaCode)
      ?? SERVICE_AREA_LIST.find((area) => area.tatsAreaCode === areaCode);
    const region = area?.regions.find((region) => region.sigunguCode === localCode);
    if (area && region) return { area, region };
  }
  const candidates = SERVICE_REGION_LIST.filter(({ region }) =>
    region.label === regionCode || region.label === regionLabelKey
  );
  return candidates.length === 1 ? candidates[0] : null;
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
