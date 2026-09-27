/** 홈 관광지 데이터를 검색 팝업 카드에 필요한 표시값과 정렬 기준으로 변환한다. */
import {
  calculateDistanceMeters,
  type CurrentLocation,
} from "@/lib/gangwonBoundaryUtils";
import {
  formatDistanceLabel,
  getMarkerTypeIcon,
  getPlaceSearchMatchPriority,
  matchesPlaceFilter,
  resolveMarkerType,
  type ResolvedMarkerType,
  type SearchFilter,
} from "@/lib/gangwonAttractionMap";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import type { HomeAttractionQueryData } from "./useHomeAttractionData";

export type HomeSearchResult = {
  /** 결과를 선택할 때 지도 이동과 장소 상세 열기에 전달하는 원본 관광지 */
  attraction: GangwonAttraction;
  /** 장소 종류 필터 판정과 카드 분류명에 사용하는 해석된 마커 정보 */
  markerType: ResolvedMarkerType;
  /** 관광지 혼잡도 순위. 순위가 없으면 null */
  rank: number | null;
  /** 현재 위치가 있을 때 계산한 사용자용 거리 문자열 */
  distanceLabel: string | null;
  thumbnailUrl: string;
  icon: string;
  touristTrendName: string;
};

type BuildHomeSearchResultsOptions = {
  attractionData: HomeAttractionQueryData | undefined;
  currentLocation: CurrentLocation | null;
  searchFilter: SearchFilter;

  searchKeyword: string;

  topRankByAttractionId: Map<string, number>;

  trendNameByAttractionId: Map<string, string>;
};

/**
 * 전체 관광지를 장소 종류와 검색어로 거른 뒤 제목 일치도 순으로 정렬한다.
 * 같은 일치도에서는 현재 위치가 있으면 가까운 장소를 먼저 배치한다. 현재 위치가 없으면
 * 혼잡도 순위를 비교하고, 순위도 같거나 없을 때 한국어 장소명으로 정렬한다.
 * 원본 관광지 배열은 변경하지 않는다.
 */
export function buildHomeSearchResults({
  attractionData,
  currentLocation,
  searchFilter,
  searchKeyword,
  topRankByAttractionId,
  trendNameByAttractionId,
}: BuildHomeSearchResultsOptions): HomeSearchResult[] {
  if (!attractionData) {
    return [];
  }

  const keyword = searchKeyword.trim();

  return attractionData.allAttractions
    .map((attraction) => {
      const markerType = resolveMarkerType(
        attraction,
        attractionData.lclsNameByCode
      );
      const rank = topRankByAttractionId.get(attraction.id) ?? null;
      const searchMatchPriority = getPlaceSearchMatchPriority(
        attraction.title,
        attraction.address,
        markerType.typeName,
        keyword
      );
      const distanceM = currentLocation
        ? calculateDistanceMeters(currentLocation, {
            lat: attraction.lat,
            lng: attraction.lng,
          })
        : null;

      return {
        attraction,
        markerType,
        rank,
        distanceM,
        distanceLabel: formatDistanceLabel(distanceM),
        thumbnailUrl: attraction.firstImage || attraction.secondImage,
        icon: getMarkerTypeIcon(markerType),
        touristTrendName:
          trendNameByAttractionId.get(attraction.id) ?? attraction.title,
        searchMatchPriority,
        matchesFilter: matchesPlaceFilter(
          attraction,
          markerType,
          searchFilter
        ),
      };
    })
    .filter(
      (item) => item.matchesFilter && item.searchMatchPriority !== null
    )
    .sort((left, right) => {
      if (left.searchMatchPriority !== right.searchMatchPriority) {
        return (
          (left.searchMatchPriority ?? Number.POSITIVE_INFINITY) -
          (right.searchMatchPriority ?? Number.POSITIVE_INFINITY)
        );
      }
      if (left.distanceM != null && right.distanceM != null) {
        return left.distanceM - right.distanceM;
      }
      if (left.distanceM != null) {
        return -1;
      }
      if (right.distanceM != null) {
        return 1;
      }
      if (left.rank != null && right.rank != null) {
        return left.rank - right.rank;
      }
      if (left.rank != null) {
        return -1;
      }
      if (right.rank != null) {
        return 1;
      }
      return left.attraction.title.localeCompare(
        right.attraction.title,
        "ko"
      );
    });
}
