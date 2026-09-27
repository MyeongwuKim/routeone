import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";
import { useUiText } from "@/lib/uiText";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";

type UseHomeFestivalSearchNavigationOptions = {
  /** 검색 필터와 검색어를 저장하고 홈 검색 팝업을 여는 useHomeSearch의 함수다. */
  openSearchPopup: (options?: {
    filter?: SearchFilter;
    keyword?: string;
  }) => void;
};

/**
 * 축제 알림에서 홈으로 이동할 때 URL로 전달된 지역과 제목을 홈 검색 상태로 변환한다.(축제알림 딥링크처리)
 * festivalRegion이 현재 서비스 권역에 포함되고 해당 권역이 축제 데이터를 제공할 때만
 * 지역을 선택한 뒤 축제 필터의 검색 팝업을 열고, 처리한 알림용 파라미터를 URL에서 제거한다.
 * 일반적인 홈 진입이나 유효하지 않은 지역 코드는 검색 상태와 URL을 변경하지 않는다.
 */
export function useHomeFestivalSearchNavigation({
  openSearchPopup,
}: UseHomeFestivalSearchNavigationOptions) {
  const serviceArea = useEffectiveServiceArea();
  const selectRegion = useHomeExploreStore((state) => state.selectRegion);
  const text = useUiText();
  /** 현재 URL의 축제 이동 값을 읽고, 처리 후 같은 방문 기록에서 해당 값만 제거하는 데 사용한다. */
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * festivalRegion으로 현재 서비스 권역의 지역을 찾고, festivalTitle을 앞뒤 공백 없이 검색어로 사용한다.
   * 제목이 비어 있으면 번역된 지역명, 번역이 없으면 서비스 권역의 원래 지역명을 검색어로 사용한다.
   * 지역 선택과 팝업 열기를 함께 실행한 뒤 festivalRegion·festivalDate·festivalTitle·source를
   * URL에서 replace 방식으로 제거해 같은 알림 이동을 다시 처리하지 않도록 한다.
   */
  useEffect(() => {
    const festivalRegionCode = searchParams.get("festivalRegion");
    const festivalTitle = searchParams.get("festivalTitle")?.trim() ?? "";

    if (!festivalRegionCode || !serviceArea.hasFestivalSource) {
      return;
    }

    const festivalRegion = serviceArea.regions.find(
      (region) => region.sigunguCode === festivalRegionCode
    );
    if (!festivalRegion) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("festivalRegion");
    nextSearchParams.delete("festivalDate");
    nextSearchParams.delete("festivalTitle");
    nextSearchParams.delete("source");
    selectRegion(festivalRegion.sigunguCode);
    openSearchPopup({
      filter: "festival",
      keyword:
        festivalTitle ||
        text.labels.regions[festivalRegion.label] ||
        festivalRegion.label,
    });
    setSearchParams(nextSearchParams, { replace: true });
  }, [
    openSearchPopup,
    searchParams,
    selectRegion,
    serviceArea,
    setSearchParams,
    text,
  ]);
}
