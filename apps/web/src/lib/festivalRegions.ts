import { SERVICE_REGION_LIST, SERVICE_AREAS } from "@/data/serviceAreas";

/** 전국 행정 코드 또는 예전에 저장한 강원 단축 코드로 축제의 권역·시군구를 찾는다. */
export function resolveFestivalRegion(code: string) {
  const value = code.trim();
  const selection = SERVICE_REGION_LIST.find(({ region }) => region.adminCode === value);
  if (selection) return selection;
  const region = SERVICE_AREAS.gangwon.regions.find(region => region.sigunguCode === value);
  return region ? { area: SERVICE_AREAS.gangwon, region } : null;
}

/** 알림 설정의 지역 코드를 행정 코드로 통일한다. 지원하지 않는 저장값은 제외하고 중복은 한 번만 남긴다. */
export function normalizeFestivalRegionCodes(codes: readonly string[]) {
  return [...new Set(codes.flatMap(code => {
    const selection = resolveFestivalRegion(code);
    return selection ? [selection.region.adminCode] : [];
  }))];
}
