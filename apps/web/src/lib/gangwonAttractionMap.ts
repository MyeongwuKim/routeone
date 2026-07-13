import type { MapMarkerBadge } from "@/components/map/NaverMapMarkerIcon";
import { GANGWON_TATS_AREA_CODE } from "@/data/gangwonRegions";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
  getRoutePlaceCategory,
  isCafePlace,
  type RoutePlaceCategory,
} from "@/lib/placeCategory";
import {
  normalizeTouristPlaceNameForMatch,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import type { MapSheetMode } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";
import {
  calculateDistanceMeters,
  type CurrentLocation,
} from "@/lib/gangwonBoundaryUtils";
import {
  getTourContentTypeCategory,
  isTourContentTypeId,
  type TourContentTypeCategory,
} from "@/lib/tourContentType";

const OVERLAPPING_MARKER_DISTANCE_METERS = 36;
const OVERLAPPING_MARKER_OFFSET_DEGREES = 0.0002;

const CONTENT_TYPE_BADGES: Record<
  TourContentTypeCategory,
  MapMarkerBadge
> = {
  tourist: {
    label: "관광지",
    icon: "📍",
    background: "#e0f2fe",
    border: "#0284c7",
    text: "#0c4a6e",
  },
  culture: {
    label: "문화시설",
    icon: "🏛",
    background: "#fef3c7",
    border: "#d97706",
    text: "#78350f",
  },
  festival: {
    label: "축제/공연",
    icon: "🎉",
    background: "#fee2e2",
    border: "#dc2626",
    text: "#7f1d1d",
  },
  leisure: {
    label: "레포츠",
    icon: "🚴",
    background: "#dcfce7",
    border: "#16a34a",
    text: "#14532d",
  },
  shopping: {
    label: "쇼핑",
    icon: "🛍",
    background: "#ffedd5",
    border: "#ea580c",
    text: "#7c2d12",
  },
  food: {
    label: "음식점",
    icon: "🍽",
    background: "#fed7aa",
    border: "#f97316",
    text: "#7c2d12",
  },
};

const DEFAULT_BADGE: MapMarkerBadge = {
  label: "장소",
  icon: "📌",
  background: "#ccfbf1",
  border: "#0d9488",
  text: "#115e59",
};

const CAFE_BADGE: MapMarkerBadge = {
  label: "카페",
  icon: "☕",
  background: "#fef3c7",
  border: "#d97706",
  text: "#78350f",
};

export type SearchFilter = "all" | RoutePlaceCategory | "festival";
export type AttractionLoadingStage =
  | "idle"
  | "fetching-places"
  | "ranking"
  | "localizing"
  | "rendering-markers";

export function resolveMarkerType(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const contentTypeCategory = getTourContentTypeCategory(
    attraction.contentTypeId
  );
  const contentTypeBadge =
    (contentTypeCategory
      ? CONTENT_TYPE_BADGES[contentTypeCategory]
      : null) ?? DEFAULT_BADGE;
  const categoryName =
    lclsNameByCode[attraction.lclsSystm3] ||
    lclsNameByCode[attraction.lclsSystm2] ||
    lclsNameByCode[attraction.lclsSystm1] ||
    contentTypeBadge.label;

  const contentTypeLabel = getPlaceCategoryLabel(attraction, categoryName);
  const badge = isCafePlace(attraction, categoryName)
    ? CAFE_BADGE
    : contentTypeBadge;

  return {
    typeName: categoryName,
    contentTypeLabel,
    badge,
  };
}

export type ResolvedMarkerType = ReturnType<typeof resolveMarkerType>;

export function shouldHideAttraction(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const categoryText = [
    lclsNameByCode[attraction.lclsSystm1] || "",
    lclsNameByCode[attraction.lclsSystm2] || "",
    lclsNameByCode[attraction.lclsSystm3] || "",
  ].join(" ");
  const targetText = `${attraction.title} ${categoryText}`;

  return /화장실|공중.?화장실|주차장|공영주차장|parking|교회|성당|대성당|사찰|절|암자|성지|성지순례|cathedral|church|temple/i.test(
    targetText
  );
}

export function formatDistanceLabel(distanceM: number | null) {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return null;
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}

export function getAttractionMarkerKey(attraction: GangwonAttraction) {
  return `${attraction.id}-${attraction.contentTypeId}`;
}

export function buildSpreadMarkerPositionMap(attractions: GangwonAttraction[]) {
  const groups: Array<{
    anchor: CurrentLocation;
    attractions: GangwonAttraction[];
  }> = [];

  attractions.forEach((attraction) => {
    const position = {
      lat: attraction.lat,
      lng: attraction.lng,
    };
    const overlappingGroup = groups.find(
      (group) =>
        calculateDistanceMeters(group.anchor, position) <
        OVERLAPPING_MARKER_DISTANCE_METERS
    );

    if (overlappingGroup) {
      overlappingGroup.attractions.push(attraction);
      return;
    }

    groups.push({
      anchor: position,
      attractions: [attraction],
    });
  });

  const positionByKey = new Map<string, CurrentLocation>();

  groups.forEach((group) => {
    if (group.attractions.length === 1) {
      const [attraction] = group.attractions;

      if (!attraction) {
        return;
      }

      positionByKey.set(getAttractionMarkerKey(attraction), {
        lat: attraction.lat,
        lng: attraction.lng,
      });
      return;
    }

    const lngScale = Math.max(
      0.4,
      Math.cos((group.anchor.lat * Math.PI) / 180)
    );

    group.attractions.forEach((attraction, index) => {
      const angle =
        -Math.PI / 2 + (2 * Math.PI * index) / group.attractions.length;

      positionByKey.set(getAttractionMarkerKey(attraction), {
        lat:
          attraction.lat +
          Math.sin(angle) * OVERLAPPING_MARKER_OFFSET_DEGREES,
        lng:
          attraction.lng +
          (Math.cos(angle) * OVERLAPPING_MARKER_OFFSET_DEGREES) / lngScale,
      });
    });
  });

  return positionByKey;
}

export function getTouristNameMatchScore(
  placeTitle: string,
  touristName: string
) {
  const normalizedPlace = normalizeTouristPlaceNameForMatch(placeTitle);
  const normalizedTourist = normalizeTouristPlaceNameForMatch(touristName);

  if (!normalizedPlace || !normalizedTourist) {
    return 0;
  }

  if (normalizedPlace === normalizedTourist) {
    return 100;
  }

  if (
    normalizedTourist.includes(normalizedPlace) ||
    normalizedPlace.includes(normalizedTourist)
  ) {
    return 70;
  }

  return 0;
}

export function getPlaceSearchMatchPriority(
  title: string,
  address: string,
  typeName: string,
  keyword: string
) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return 0;
  }

  const normalizedTitle = title.trim().toLowerCase();
  const normalizedAddress = address.trim().toLowerCase();
  const normalizedTypeName = typeName.trim().toLowerCase();

  if (normalizedTitle === normalizedKeyword) {
    return 0;
  }
  if (normalizedTitle.startsWith(normalizedKeyword)) {
    return 1;
  }
  if (normalizedTitle.includes(normalizedKeyword)) {
    return 2;
  }
  if (normalizedAddress.includes(normalizedKeyword)) {
    return 3;
  }
  if (normalizedTypeName.includes(normalizedKeyword)) {
    return 4;
  }

  return null;
}

export function matchesPlaceFilter(
  attraction: GangwonAttraction,
  markerType: ResolvedMarkerType,
  filter: SearchFilter
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "festival") {
    return isTourContentTypeId(attraction.contentTypeId, "festival");
  }

  if (
    filter === "tourist" &&
    isTourContentTypeId(attraction.contentTypeId, "festival")
  ) {
    return false;
  }

  return (
    getRoutePlaceCategory({
      contentTypeId: attraction.contentTypeId,
      contentTypeLabel: markerType.contentTypeLabel,
    }) === filter
  );
}

export function getMarkerTypeIcon(markerType: ResolvedMarkerType) {
  if (markerType.contentTypeLabel !== "장소") {
    return getPlaceCategoryIcon(markerType.contentTypeLabel);
  }

  return markerType.badge.icon;
}

type AttractionMapSheetPlaceInput = {
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  signguCode: string;
  touristTrendName: string;
  topRank: number | null;
};

export function createMapSheetPlaceFromAttraction({
  attraction,
  markerType,
  signguCode,
  touristTrendName,
  topRank,
}: AttractionMapSheetPlaceInput): MapSheetPlace {
  return {
    id: `${attraction.id}-${attraction.contentTypeId}`,
    contentId: attraction.id,
    contentTypeId: attraction.contentTypeId,
    areaCode: GANGWON_TATS_AREA_CODE,
    signguCode,
    touristTrendName,
    topRank,
    title: attraction.title,
    address: attraction.address,
    lat: attraction.lat,
    lng: attraction.lng,
    contentTypeLabel: markerType.contentTypeLabel,
    categoryName: markerType.typeName,
    icon: markerType.badge.icon,
    images: [attraction.firstImage, attraction.secondImage].filter(Boolean),
  };
}

export type OpenPlaceSheetFromAttractionOptions = {
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  touristTrendName: string;
  rank: number | null;
  mode?: MapSheetMode;
};
