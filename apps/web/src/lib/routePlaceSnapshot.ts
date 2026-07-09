import type { PlaceProvider, PlaceSnapshotInput } from "@/generated/graphql";
import type { MapSheetPlace } from "@/types/place";

const ROUTE_PLACE_PROVIDER: PlaceProvider = "TOUR_API";
export const MIN_PLACE_STAY_SUMMARY_VISIT_COUNT = 3;

export type PlaceStaySummaryPreview = {
  averageActualStayMinutes: number | null;
  visitCount: number;
  lastVisitedAt?: string | null;
};

const GANGNEUNG_SIGUNGU_CODE = "1";
const GANGNEUNG_TOP_PLACE_STAY_SUMMARY_BY_RANK: Record<
  number,
  PlaceStaySummaryPreview
> = {
  1: { averageActualStayMinutes: 95, visitCount: 14 },
  2: { averageActualStayMinutes: 82, visitCount: 11 },
  3: { averageActualStayMinutes: 76, visitCount: 9 },
  4: { averageActualStayMinutes: 68, visitCount: 8 },
  5: { averageActualStayMinutes: 72, visitCount: 10 },
  6: { averageActualStayMinutes: 88, visitCount: 7 },
  7: { averageActualStayMinutes: 61, visitCount: 6 },
  8: { averageActualStayMinutes: 54, visitCount: 5 },
  9: { averageActualStayMinutes: 79, visitCount: 8 },
  10: { averageActualStayMinutes: 66, visitCount: 6 },
};

export function getMapSheetPlaceRegionCode(place: MapSheetPlace) {
  return place.signguCode || place.areaCode || null;
}

export function getMapSheetPlaceRegionLabelKey(place: MapSheetPlace) {
  if (place.areaCode && place.signguCode) {
    return `${place.areaCode}:${place.signguCode}`;
  }

  return place.areaCode || place.signguCode || null;
}

export function getMapSheetPlaceStaySummaryKey(place: MapSheetPlace) {
  return [
    place.id,
    place.contentId,
    place.contentTypeId,
    place.title,
    place.lat.toFixed(5),
    place.lng.toFixed(5),
  ].join("|");
}

export function getMockGangneungTopPlaceStaySummary(
  place: MapSheetPlace
): PlaceStaySummaryPreview | null {
  if (place.signguCode !== GANGNEUNG_SIGUNGU_CODE || !place.topRank) {
    return null;
  }

  return GANGNEUNG_TOP_PLACE_STAY_SUMMARY_BY_RANK[place.topRank] ?? null;
}

export function resolvePlaceStaySummaryForDisplay(
  place: MapSheetPlace,
  summary?: PlaceStaySummaryPreview | null
) {
  if (summary && summary.visitCount >= MIN_PLACE_STAY_SUMMARY_VISIT_COUNT) {
    return summary;
  }

  return getMockGangneungTopPlaceStaySummary(place) ?? summary ?? null;
}

export function mapSheetPlaceToPlaceSnapshotInput(
  place: MapSheetPlace
): PlaceSnapshotInput {
  return {
    provider: ROUTE_PLACE_PROVIDER,
    externalId: place.id,
    contentId: place.contentId,
    contentTypeId: place.contentTypeId,
    title: place.title,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    categoryLabel: place.contentTypeLabel,
    categoryName: place.categoryName,
    imageUrl: place.images[0] ?? null,
    regionCode: getMapSheetPlaceRegionCode(place),
    regionLabelKey: getMapSheetPlaceRegionLabelKey(place),
  };
}
