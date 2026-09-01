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
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  rank: number | null;
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
