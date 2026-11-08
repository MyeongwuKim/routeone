import { useMemo } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { SERVICE_REGION_LIST, type ServiceArea } from "@/data/serviceAreas";
import { buildBoundaryMapByRegions, type GangwonBoundaryCollection } from "@/lib/gangwonBoundaryUtils";

/** 홈 코스와 지도가 행정 코드로 연결한 전국 경계를 같은 캐시에서 사용한다. */
export const serviceRegionBoundariesQueryOptions = queryOptions({
  queryKey: ["service-region-boundaries"],
  queryFn: async ({ signal }) => {
    const response = await fetch(new URL(`${import.meta.env.BASE_URL}service-region-boundary.json`, document.baseURI), { signal });
    if (!response.ok) throw new Error("지역 경계를 불러오지 못했어요.");
    const data = await response.json() as GangwonBoundaryCollection;
    return buildBoundaryMapByRegions(data, SERVICE_REGION_LIST.map(({ region }) => ({
      ...region,
      sigunguCode: region.adminCode,
    })));
  },
  staleTime: Infinity,
  gcTime: Infinity,
  retry: 1,
});

/** 지도 표시·선택에는 현재 시·도의 관광공사 코드를, 전국 위치 판정에는 행정 코드를 사용한다. */
export function useServiceRegionBoundaries(serviceArea: ServiceArea) {
  const query = useQuery(serviceRegionBoundariesQueryOptions);
  const boundaryBySigunguCode = useMemo(() => Object.fromEntries(
    serviceArea.regions.flatMap((region) => {
      const boundary = query.data?.[region.adminCode];
      return boundary ? [[region.sigunguCode, boundary]] : [];
    })
  ), [query.data, serviceArea]);

  return {
    boundaryBySigunguCode,
    boundaryByAdminCode: query.data,
    isBoundaryDataReady: query.isSuccess || query.isError,
    boundaryError: query.isError ? query.error.message : null,
  };
}
