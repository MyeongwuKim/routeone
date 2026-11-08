import { UserFacingError } from "../../graphql/userFacingError.js";
import { FESTIVAL_AREAS, FESTIVAL_REGION_BY_CODE, normalizeFestivalRegionCode } from "./festivalRegions.js";
import { fetchFestivalSource, hasFestivalCoordinates } from "./festivalSource.service.js";

type FestivalLookupInput = {
  startDate: string;
  endDate: string;
  areaCode?: string | null;
  regionCodes?: string[] | null;
};

/**
 * 시도 또는 시군구를 지정해 기간과 겹치는 축제를 조회한다. 기간은 최대 31일이다.
 * 지역을 생략하면 거절한다. 기존 여러 지역 알림은 호출자가 강원 권역을 명시해서 조회한다.
 * 반환 지역 코드는 행정 코드이며 지도 필터용 관광공사 권역·시군구 코드도 함께 제공한다.
 */
export async function getFestivals(input: FestivalLookupInput) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const dates = [input.startDate, input.endDate].map(value => new Date(`${value}T00:00:00.000Z`));
  if ([input.startDate, input.endDate].some((value, index) =>
    !datePattern.test(value) || !Number.isFinite(dates[index].getTime()) || dates[index].toISOString().slice(0, 10) !== value
  ) || input.startDate > input.endDate) {
    throw new UserFacingError("축제 조회 기간이 올바르지 않습니다.");
  }
  if (dates[1].getTime() - dates[0].getTime() > 31 * 86_400_000) {
    throw new UserFacingError("축제는 최대 31일 범위까지 조회할 수 있습니다.");
  }
  const regionCodes = [...new Set((input.regionCodes ?? []).map(normalizeFestivalRegionCode))];
  if (regionCodes.includes(null) || (input.areaCode && !FESTIVAL_AREAS.some(area => area.areaCode === input.areaCode))) {
    throw new UserFacingError("축제 조회 지역이 올바르지 않습니다.");
  }
  const regions = regionCodes.filter((code): code is string => code !== null);
  if (!input.areaCode && !regions.length) throw new UserFacingError("축제 조회 지역을 선택해 주세요.");
  const areaCodes = input.areaCode ? [input.areaCode]
    : [...new Set(regions.map(code => FESTIVAL_REGION_BY_CODE[code].areaCode))];
  const festivals = (await Promise.all(areaCodes.map(area => fetchFestivalSource(area)))).flat();
  const startYmd = input.startDate.replaceAll("-", "");
  const endYmd = input.endDate.replaceAll("-", "");
  return festivals.filter(festival =>
    (!regions.length || regions.includes(festival.regionCode)) &&
    festival.startYmd <= endYmd && festival.endYmd >= startYmd && hasFestivalCoordinates(festival)
  ).map(festival => ({
    ...festival,
    startDate: `${festival.startYmd.slice(0, 4)}-${festival.startYmd.slice(4, 6)}-${festival.startYmd.slice(6, 8)}`,
    endDate: `${festival.endYmd.slice(0, 4)}-${festival.endYmd.slice(4, 6)}-${festival.endYmd.slice(6, 8)}`,
  }));
}
