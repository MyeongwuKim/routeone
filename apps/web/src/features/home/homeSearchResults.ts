/** 홈 관광지 데이터를 지도 아래 목록과 검색 팝업에 사용할 표시값·정렬 기준으로 변환한다. */
import {
  calculateDistanceMeters,
  type CurrentLocation,
} from "@/lib/gangwonBoundaryUtils";
import {
  formatDistanceLabel,
  getAttractionMarkerKey,
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
  /** 현재 언어로 표시하며, 선택 시 지도 이동과 장소 상세 열기에 전달하는 관광지 */
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
 * 현재 언어의 장소명·주소와 같은 관광지의 원문을 검색해 더 잘 맞는 쪽의 우선순위로 정렬한다.
 * 결과에는 현재 언어의 관광지를 담고, 장소 종류 필터도 해당 표시 데이터를 사용한다.
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
  const { allAttractions, sourceAttractions } = attractionData;
  const sourceAttractionByKey =
    keyword && sourceAttractions && sourceAttractions !== allAttractions
      ? new Map(
          sourceAttractions.map((place) => [getAttractionMarkerKey(place), place])
        )
      : null;

  return allAttractions
    .map((attraction) => {
      const markerType = resolveMarkerType(
        attraction,
        attractionData.lclsNameByCode
      );
      const rank = topRankByAttractionId.get(attraction.id) ?? null;
      let searchMatchPriority = getPlaceSearchMatchPriority(
        attraction.title,
        attraction.address,
        markerType.typeName,
        keyword
      );
      const sourceAttraction = sourceAttractionByKey?.get(
        getAttractionMarkerKey(attraction)
      );
      if (sourceAttraction && searchMatchPriority !== 0) {
        const sourceMatchPriority = getPlaceSearchMatchPriority(
          sourceAttraction.title,
          sourceAttraction.address,
          "",
          keyword
        );
        if (sourceMatchPriority !== null) {
          searchMatchPriority = Math.min(
            searchMatchPriority ?? sourceMatchPriority,
            sourceMatchPriority
          );
        }
      }
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
