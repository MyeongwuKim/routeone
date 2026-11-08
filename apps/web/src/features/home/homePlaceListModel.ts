import { createMapSheetPlaceFromAttraction } from "@/lib/gangwonAttractionMap";
import { createPlaceDuplicateKeySet, hasDuplicatePlace } from "@/lib/placeDuplicate";
import type { MapSheetPlace } from "@/types/place";
import type { HomeSearchResult } from "./homeSearchResults";

export type HomePlaceListItemModel = {
  result: HomeSearchResult;
  /** 지도 마커에서 담을 때와 동일한 ID·장소 정보를 사용하는 여행 장소 스냅샷 */
  place: MapSheetPlace;
  isSaved: boolean;
};

/**
 * 지도와 같은 검색 결과를 담기용 장소로 변환한다. 다른 ID로 저장된 동일 장소도
 * 기존 카트의 중복 판정으로 찾아 버튼에 반영하며, 저장 목록과 결과 순서는 변경하지 않는다.
 */
export function buildHomePlaceListItems({ results, savedPlaces, areaCode, signguCode }: {
  results: HomeSearchResult[];
  savedPlaces: MapSheetPlace[];
  areaCode: string;
  signguCode: string;
}): HomePlaceListItemModel[] {
  const duplicateKeys = createPlaceDuplicateKeySet(savedPlaces);

  return results.map(result => {
    const place = createMapSheetPlaceFromAttraction({
      attraction: result.attraction,
      markerType: result.markerType,
      areaCode,
      signguCode,
      touristTrendName: result.touristTrendName,
      topRank: result.rank,
    });
    return { result, place, isSaved: hasDuplicatePlace(place, duplicateKeys) };
  });
}
