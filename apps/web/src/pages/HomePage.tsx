import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IoBagHandleOutline,
  IoCafeOutline,
  IoClose,
  IoLocationSharp,
  IoMapOutline,
  IoRestaurantOutline,
  IoSearch,
  IoTicketOutline,
} from "react-icons/io5";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import {
  createBadgeMarkerIconHtml,
  type MapMarkerBadge,
} from "@/components/map/NaverMapMarkerIcon";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import RecentSearchItem from "@/components/search/RecentSearchItem";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import {
  CAFE_LCLS_CODE,
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
  getRoutePlaceCategory,
  isCafePlace,
  isTouristPlace,
  type RoutePlaceCategory,
} from "@/lib/placeCategory";
import {
  buildLatestConcentrationMap,
  fetchGangwonAttractions,
  fetchGangwonFestivals,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  normalizeTouristPlaceNameForMatch,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import {
  useMapSheetStore,
  type MapSheetMode,
} from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type { MapSheetPlace } from "@/types/place";

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
const SEARCH_RESULTS_PAGE_SIZE = 12;

const GANGWON_CENTER = {
  lat: 37.8228,
  lng: 128.1555,
};

const GANGWON_BOUNDS = {
  south: 37.02,
  west: 127.1,
  north: 38.62,
  east: 129.38,
};

const GANGWON_REGIONS = [
  { label: "강릉", sigunguCode: "1", center: { lat: 37.7519, lng: 128.8761 } },
  { label: "고성", sigunguCode: "2", center: { lat: 38.3804, lng: 128.4677 } },
  { label: "동해", sigunguCode: "3", center: { lat: 37.5247, lng: 129.1143 } },
  { label: "삼척", sigunguCode: "4", center: { lat: 37.4499, lng: 129.1652 } },
  { label: "속초", sigunguCode: "5", center: { lat: 38.207, lng: 128.5918 } },
  { label: "양구", sigunguCode: "6", center: { lat: 38.1057, lng: 127.99 } },
  { label: "양양", sigunguCode: "7", center: { lat: 38.0754, lng: 128.6191 } },
  { label: "영월", sigunguCode: "8", center: { lat: 37.1836, lng: 128.4617 } },
  { label: "원주", sigunguCode: "9", center: { lat: 37.3422, lng: 127.9202 } },
  { label: "인제", sigunguCode: "10", center: { lat: 38.0697, lng: 128.1704 } },
  { label: "정선", sigunguCode: "11", center: { lat: 37.3807, lng: 128.6611 } },
  { label: "철원", sigunguCode: "12", center: { lat: 38.1466, lng: 127.3134 } },
  { label: "춘천", sigunguCode: "13", center: { lat: 37.8813, lng: 127.7298 } },
  { label: "태백", sigunguCode: "14", center: { lat: 37.1641, lng: 128.9856 } },
  { label: "평창", sigunguCode: "15", center: { lat: 37.3704, lng: 128.3906 } },
  { label: "홍천", sigunguCode: "16", center: { lat: 37.6972, lng: 127.8886 } },
  { label: "화천", sigunguCode: "17", center: { lat: 38.1062, lng: 127.7082 } },
  { label: "횡성", sigunguCode: "18", center: { lat: 37.4918, lng: 127.985 } },
] as const;

const GANGWON_SIGNGU_ADMIN_CODES: Record<string, string> = {
  "1": "51150", // 강릉
  "2": "51820", // 고성
  "3": "51170", // 동해
  "4": "51230", // 삼척
  "5": "51210", // 속초
  "6": "51800", // 양구
  "7": "51830", // 양양
  "8": "51750", // 영월
  "9": "51130", // 원주
  "10": "51810", // 인제
  "11": "51770", // 정선
  "12": "51780", // 철원
  "13": "51110", // 춘천
  "14": "51190", // 태백
  "15": "51760", // 평창
  "16": "51720", // 홍천
  "17": "51790", // 화천
  "18": "51730", // 횡성
};

const GANGWON_TATS_AREA_CODE = "51";
const KOREA_UNIFIED_CS = {
  semiMajorAxis: 6378137,
  inverseFlattening: 298.257222101,
  originLat: (38 * Math.PI) / 180,
  originLng: (127.5 * Math.PI) / 180,
  falseEasting: 1_000_000,
  falseNorthing: 2_000_000,
  scaleFactor: 0.9996,
};

type GeoRing = [number, number][];
type GeoPolygon = GeoRing[];
type GeoMultiPolygon = GeoPolygon[];

type GangwonBoundaryFeature = {
  properties?: {
    id?: string;
    title?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

type GangwonBoundaryCollection = {
  features?: GangwonBoundaryFeature[];
};

type CurrentLocation = {
  lat: number;
  lng: number;
};

type SearchFilter = "all" | RoutePlaceCategory | "festival";
type AttractionLoadingStage =
  | "idle"
  | "fetching-places"
  | "ranking"
  | "rendering-markers";

const OVERLAPPING_MARKER_DISTANCE_METERS = 36;
const OVERLAPPING_MARKER_OFFSET_DEGREES = 0.0002;

const CONTENT_TYPE_BADGES: Record<string, MapMarkerBadge> = {
  "12": {
    label: "관광지",
    icon: "📍",
    background: "#e0f2fe",
    border: "#0284c7",
    text: "#0c4a6e",
  },
  "14": {
    label: "문화시설",
    icon: "🏛",
    background: "#fef3c7",
    border: "#d97706",
    text: "#78350f",
  },
  "15": {
    label: "축제/공연",
    icon: "🎉",
    background: "#fee2e2",
    border: "#dc2626",
    text: "#7f1d1d",
  },
  "28": {
    label: "레포츠",
    icon: "🚴",
    background: "#dcfce7",
    border: "#16a34a",
    text: "#14532d",
  },
  "38": {
    label: "쇼핑",
    icon: "🛍",
    background: "#ffedd5",
    border: "#ea580c",
    text: "#7c2d12",
  },
  "39": {
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

function resolveMarkerType(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const contentTypeBadge =
    CONTENT_TYPE_BADGES[attraction.contentTypeId] ?? DEFAULT_BADGE;
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

function shouldHideAttraction(
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

function toMultiPolygonCoordinates(feature: GangwonBoundaryFeature): GeoMultiPolygon {
  const geometryType = feature.geometry?.type;
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates) {
    return [];
  }

  if (geometryType === "Polygon") {
    return [coordinates as GeoPolygon];
  }

  if (geometryType === "MultiPolygon") {
    return coordinates as GeoMultiPolygon;
  }

  return [];
}

function buildBoundaryMapBySigunguCode(
  collection: GangwonBoundaryCollection
): Record<string, GeoMultiPolygon> {
  const features = collection.features ?? [];
  const mapByCode: Record<string, GeoMultiPolygon> = {};

  GANGWON_REGIONS.forEach((region) => {
    const matchedFeature = features.find((feature) =>
      feature.properties?.title?.startsWith(region.label)
    );

    if (matchedFeature) {
      mapByCode[region.sigunguCode] = toMultiPolygonCoordinates(matchedFeature);
    }
  });

  return mapByCode;
}

function getMeridianArc(radianLat: number) {
  const { semiMajorAxis, inverseFlattening } = KOREA_UNIFIED_CS;
  const flattening = 1 / inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;

  return (
    semiMajorAxis *
    ((1 -
      eccentricitySquared / 4 -
      (3 * eccentricityFourth) / 64 -
      (5 * eccentricitySixth) / 256) *
      radianLat -
      ((3 * eccentricitySquared) / 8 +
        (3 * eccentricityFourth) / 32 +
        (45 * eccentricitySixth) / 1024) *
        Math.sin(2 * radianLat) +
      ((15 * eccentricityFourth) / 256 + (45 * eccentricitySixth) / 1024) *
        Math.sin(4 * radianLat) -
      ((35 * eccentricitySixth) / 3072) * Math.sin(6 * radianLat))
  );
}

function convertUtmkToWgs84(x: number, y: number): CurrentLocation | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const {
    semiMajorAxis,
    inverseFlattening,
    originLat,
    originLng,
    falseEasting,
    falseNorthing,
    scaleFactor,
  } = KOREA_UNIFIED_CS;
  const flattening = 1 / inverseFlattening;
  const eccentricitySquared = 2 * flattening - flattening * flattening;
  const eccentricityPrimeSquared =
    eccentricitySquared / (1 - eccentricitySquared);
  const eccentricityFourth = eccentricitySquared * eccentricitySquared;
  const eccentricitySixth = eccentricityFourth * eccentricitySquared;
  const meridian =
    getMeridianArc(originLat) + (y - falseNorthing) / scaleFactor;
  const mu =
    meridian /
    (semiMajorAxis *
      (1 -
        eccentricitySquared / 4 -
        (3 * eccentricityFourth) / 64 -
        (5 * eccentricitySixth) / 256));
  const e1 =
    (1 - Math.sqrt(1 - eccentricitySquared)) /
    (1 + Math.sqrt(1 - eccentricitySquared));
  const footprintLat =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
    ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);
  const sinFootprint = Math.sin(footprintLat);
  const cosFootprint = Math.cos(footprintLat);
  const tanFootprint = Math.tan(footprintLat);
  const c1 = eccentricityPrimeSquared * cosFootprint ** 2;
  const t1 = tanFootprint ** 2;
  const n1 =
    semiMajorAxis /
    Math.sqrt(1 - eccentricitySquared * sinFootprint ** 2);
  const r1 =
    (semiMajorAxis * (1 - eccentricitySquared)) /
    (1 - eccentricitySquared * sinFootprint ** 2) ** 1.5;
  const d = (x - falseEasting) / (n1 * scaleFactor);
  const lat =
    footprintLat -
    ((n1 * tanFootprint) / r1) *
      (d ** 2 / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * eccentricityPrimeSquared) *
          d ** 4) /
          24 +
        ((61 +
          90 * t1 +
          298 * c1 +
          45 * t1 ** 2 -
          252 * eccentricityPrimeSquared -
          3 * c1 ** 2) *
          d ** 6) /
          720);
  const lng =
    originLng +
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 -
        2 * c1 +
        28 * t1 -
        3 * c1 ** 2 +
        8 * eccentricityPrimeSquared +
        24 * t1 ** 2) *
        d ** 5) /
        120) /
      cosFootprint;

  return {
    lat: (lat * 180) / Math.PI,
    lng: (lng * 180) / Math.PI,
  };
}

function calculateDistanceMeters(
  from: CurrentLocation,
  to: CurrentLocation
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function formatDistanceLabel(distanceM: number | null) {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return null;
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}

function getAttractionMarkerKey(attraction: GangwonAttraction) {
  return `${attraction.id}-${attraction.contentTypeId}`;
}

function buildSpreadMarkerPositionMap(attractions: GangwonAttraction[]) {
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

function getTouristNameMatchScore(placeTitle: string, touristName: string) {
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

function matchesPlaceFilter(
  attraction: GangwonAttraction,
  markerType: ReturnType<typeof resolveMarkerType>,
  filter: SearchFilter
) {
  if (filter === "all") {
    return true;
  }

  if (filter === "festival") {
    return attraction.contentTypeId === "15";
  }

  if (filter === "tourist" && attraction.contentTypeId === "15") {
    return false;
  }

  return (
    getRoutePlaceCategory({
      contentTypeId: attraction.contentTypeId,
      contentTypeLabel: markerType.contentTypeLabel,
    }) === filter
  );
}

function getMarkerTypeIcon(markerType: ReturnType<typeof resolveMarkerType>) {
  if (markerType.contentTypeLabel !== "장소") {
    return getPlaceCategoryIcon(markerType.contentTypeLabel);
  }

  return markerType.badge.icon;
}

type ResolvedMarkerType = ReturnType<typeof resolveMarkerType>;

type AttractionMapSheetPlaceInput = {
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  signguCode: string;
  touristTrendName: string;
  topRank: number | null;
};

function createMapSheetPlaceFromAttraction({
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
    images: [attraction.firstImage].filter(Boolean),
  };
}

type OpenPlaceSheetFromAttractionOptions = {
  attraction: GangwonAttraction;
  markerType: ResolvedMarkerType;
  touristTrendName: string;
  rank: number | null;
  mode?: MapSheetMode;
};

function HomePage() {
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const naverMapsRef = useRef<any>(null);
  const boundaryPolygonRefs = useRef<any[]>([]);
  const markerRefs = useRef<any[]>([]);
  const markerListenerRefs = useRef<any[]>([]);

  const {
    openSheet,
    closeSheet,
    resetSheet,
  } = useMapSheetStore();
  const {
    savedPlaceIds,
    savedPlaces,
    isSavedListOpen,
    openSavedList,
    closeSavedList,
    removeSavedPlace,
    clearSavedPlaces,
  } = usePlaceCartStore();
  const showLoading = useUiLoadingStore((state) => state.showLoading);
  const hideLoading = useUiLoadingStore((state) => state.hideLoading);
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );

  const [selectedSigunguCode, setSelectedSigunguCode] = useState<string>(
    GANGWON_REGIONS[0].sigunguCode
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [visibleSearchResultCount, setVisibleSearchResultCount] = useState(
    SEARCH_RESULTS_PAGE_SIZE
  );
  const [attractionLoadingStage, setAttractionLoadingStage] =
    useState<AttractionLoadingStage>("idle");
  const [hasRenderedAttractionMarkers, setHasRenderedAttractionMarkers] =
    useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    "경포해변",
    "속초해수욕장",
    "봉포머구리집",
  ]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const boundaryQuery = useQuery({
    queryKey: ["gangwon-boundary"],
    queryFn: async () => {
      const response = await fetch("/gangwon-sigungu-boundary.json");
      if (!response.ok) {
        throw new Error("Failed to load boundary data.");
      }
      const data = (await response.json()) as GangwonBoundaryCollection;
      return buildBoundaryMapBySigunguCode(data);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const attractionsQuery = useQuery({
    queryKey: ["gangwon-attractions", selectedSigunguCode],
    enabled: mapReady && Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      setAttractionLoadingStage("fetching-places");
      const signguCode = GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode];
      const lclsNameByCode = await fetchLclsSystemNameMap(TOUR_API_SERVICE_KEY);
      lclsNameByCode[CAFE_LCLS_CODE] = lclsNameByCode[CAFE_LCLS_CODE] || "카페";
      const [attractions, festivals] = await Promise.all([
        fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
          sigunguCode: selectedSigunguCode || undefined,
          contentTypeIds: ["12", "39"],
        }),
        fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
          sigunguCode: selectedSigunguCode || undefined,
          lookAheadDays: 90,
        }).catch(() => [] as GangwonAttraction[]),
      ]);
      setAttractionLoadingStage("ranking");
      const concentrationPoints = await fetchTouristConcentrationPoints(
        TOUR_API_SERVICE_KEY,
        {
          areaCode: GANGWON_TATS_AREA_CODE,
          signguCode,
          numOfRows: 2000,
        }
      );
      const attractionsWithFestivals = [...attractions, ...festivals];
      const dedupedAttractions = attractionsWithFestivals.filter(
        (attraction, index, array) => {
          const key = `${attraction.title.trim().toLowerCase()}|${attraction.address
            .trim()
            .toLowerCase()}`;
          return (
            array.findIndex((candidate) => {
              const candidateKey = `${candidate.title
                .trim()
                .toLowerCase()}|${candidate.address.trim().toLowerCase()}`;
              return candidateKey === key;
            }) === index
          );
        }
      );
      const filteredAttractions = dedupedAttractions.filter(
        (attraction) => !shouldHideAttraction(attraction, lclsNameByCode)
      );
      const rankableTouristAttractions = filteredAttractions.filter(
        (attraction) => isTouristPlace(attraction)
      );
      const latestConcentrationByName =
        buildLatestConcentrationMap(concentrationPoints);
      const latestConcentrationPoints = [...latestConcentrationByName.values()].sort(
        (a, b) => b.concentrationRate - a.concentrationRate
      );

      const usedAttractionIds = new Set<string>();
      const topAttractions: Array<{
        attraction: GangwonAttraction;
        touristTrendName: string;
      }> = [];

      latestConcentrationPoints.forEach((point) => {
        if (topAttractions.length >= 10) {
          return;
        }

        const bestMatch = rankableTouristAttractions
          .filter((attraction) => !usedAttractionIds.has(attraction.id))
          .map((attraction) => ({
            attraction,
            score: getTouristNameMatchScore(attraction.title, point.touristName),
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((a, b) => b.score - a.score)[0];

        if (!bestMatch) {
          return;
        }

        usedAttractionIds.add(bestMatch.attraction.id);
        topAttractions.push({
          attraction: bestMatch.attraction,
          touristTrendName: point.touristName,
        });
      });

      return {
        allAttractions: filteredAttractions,
        topAttractions,
        lclsNameByCode,
      };
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const festivalsQuery = useQuery({
    queryKey: ["gangwon-festivals", "90-days"],
    enabled: mapReady && Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () =>
      fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
        lookAheadDays: 90,
      }).catch(() => [] as GangwonAttraction[]),
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const boundaryBySigunguCode = boundaryQuery.data ?? {};
  const isBoundaryDataReady = boundaryQuery.isSuccess || boundaryQuery.isError;
  const isAttractionLoading = attractionsQuery.isFetching;
  const attractionError = !TOUR_API_SERVICE_KEY
    ? "VITE_VISITKOREA_SERVICE_KEY가 비어있습니다."
    : attractionsQuery.error instanceof Error
      ? attractionsQuery.error.message
      : null;
  const shouldShowAttractionLoader =
    Boolean(TOUR_API_SERVICE_KEY) &&
    !mapError &&
    (attractionLoadingStage !== "idle" ||
      !mapReady ||
      (attractionsQuery.isFetching && !hasRenderedAttractionMarkers) ||
      Boolean(attractionsQuery.data && !hasRenderedAttractionMarkers));
  const festivalCountBySigunguCode = useMemo(() => {
    const map = new Map<string, number>();

    (festivalsQuery.data ?? []).forEach((festival) => {
      if (!festival.tourApiSigunguCode) {
        return;
      }

      map.set(
        festival.tourApiSigunguCode,
        (map.get(festival.tourApiSigunguCode) ?? 0) + 1
      );
    });

    return map;
  }, [festivalsQuery.data]);
  const orderedRegions = useMemo(() => {
    if (!currentLocation) {
      return GANGWON_REGIONS;
    }

    return [...GANGWON_REGIONS].sort((a, b) => {
      const distanceA = calculateDistanceMeters(currentLocation, a.center);
      const distanceB = calculateDistanceMeters(currentLocation, b.center);
      return distanceA - distanceB;
    });
  }, [currentLocation]);
  const selectedRegion =
    GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
    GANGWON_REGIONS[0];
  const routeStartLocation = currentLocation ?? selectedRegion.center;

  const topRankByAttractionId = useMemo(() => {
    const map = new Map<string, number>();
    (attractionsQuery.data?.topAttractions ?? []).forEach((item, index) => {
      map.set(item.attraction.id, index + 1);
    });
    return map;
  }, [attractionsQuery.data]);

  const trendNameByAttractionId = useMemo(() => {
    const map = new Map<string, string>();
    (attractionsQuery.data?.topAttractions ?? []).forEach((item) => {
      map.set(item.attraction.id, item.touristTrendName);
    });
    return map;
  }, [attractionsQuery.data]);

  const searchResults = useMemo(() => {
    const attractionData = attractionsQuery.data;
    if (!attractionData) {
      return [];
    }

    const keyword = searchKeyword.trim().toLowerCase();

    return attractionData.allAttractions
      .map((attraction) => {
        const markerType = resolveMarkerType(attraction, attractionData.lclsNameByCode);
        const rank = topRankByAttractionId.get(attraction.id) ?? null;
        const textForSearch = `${attraction.title} ${attraction.address} ${markerType.typeName}`.toLowerCase();
        const distanceM = currentLocation
          ? calculateDistanceMeters(currentLocation, {
              lat: attraction.lat,
              lng: attraction.lng,
            })
          : null;

        const matchesFilter = matchesPlaceFilter(attraction, markerType, searchFilter);
        const matchesKeyword = !keyword || textForSearch.includes(keyword);

        return {
          attraction,
          markerType,
          rank,
          distanceM,
          distanceLabel: formatDistanceLabel(distanceM),
          thumbnailUrl: attraction.firstImage || attraction.secondImage,
          icon: getMarkerTypeIcon(markerType),
          touristTrendName: trendNameByAttractionId.get(attraction.id) ?? attraction.title,
          matchesFilter,
          matchesKeyword,
        };
      })
      .filter((item) => item.matchesFilter && item.matchesKeyword)
      .sort((a, b) => {
        if (a.distanceM != null && b.distanceM != null) {
          return a.distanceM - b.distanceM;
        }
        if (a.distanceM != null) {
          return -1;
        }
        if (b.distanceM != null) {
          return 1;
        }
        if (a.rank != null && b.rank != null) {
          return a.rank - b.rank;
        }
        if (a.rank != null) {
          return -1;
        }
        if (b.rank != null) {
          return 1;
        }
        return a.attraction.title.localeCompare(b.attraction.title, "ko");
      })
  }, [
    attractionsQuery.data,
    currentLocation,
    searchFilter,
    searchKeyword,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  const visibleSearchResults = useMemo(
    () => searchResults.slice(0, visibleSearchResultCount),
    [searchResults, visibleSearchResultCount]
  );
  const routeInsertCandidatePlaces = useMemo(() => {
    const attractionData = attractionsQuery.data;
    if (!attractionData) {
      return [];
    }

    return attractionData.allAttractions
      .map((attraction) => {
        const markerType = resolveMarkerType(
          attraction,
          attractionData.lclsNameByCode
        );
        const rank = topRankByAttractionId.get(attraction.id) ?? null;

        return createMapSheetPlaceFromAttraction({
          attraction,
          markerType,
          signguCode: GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode] ?? "",
          touristTrendName:
            trendNameByAttractionId.get(attraction.id) ?? attraction.title,
          topRank: rank,
        });
      })
      .slice(0, 160);
  }, [
    attractionsQuery.data,
    selectedSigunguCode,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  useEffect(() => {
    setVisibleSearchResultCount(SEARCH_RESULTS_PAGE_SIZE);
  }, [searchFilter, searchKeyword]);

  const appendRecentSearch = (keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return;
    }
    setRecentSearches((previous) => [
      trimmedKeyword,
      ...previous.filter((item) => item !== trimmedKeyword),
    ].slice(0, 8));
  };
  const removeRecentSearch = (keyword: string) => {
    setRecentSearches((previous) => previous.filter((item) => item !== keyword));
  };
  const clearRecentSearches = () => {
    setRecentSearches([]);
  };
  const closeSearchPopup = useCallback(() => {
    setIsSearchPopupOpen(false);
    setSearchKeyword("");
  }, []);

  const openPlaceSheetFromAttraction = ({
    attraction,
    markerType,
    touristTrendName,
    rank,
    mode = "bottom-sheet",
  }: OpenPlaceSheetFromAttractionOptions) => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const position = naverMaps
      ? new naverMaps.LatLng(attraction.lat, attraction.lng)
      : null;

    if (mapInstance && position) {
      if (typeof mapInstance.panTo === "function") {
        mapInstance.panTo(position, {
          duration: 500,
        });
      } else {
        mapInstance.setCenter(position);
      }
    }

    openSheet(
      createMapSheetPlaceFromAttraction({
        attraction,
        markerType,
        signguCode: GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode] ?? "",
        touristTrendName,
        topRank: rank ?? null,
      }),
      { mode }
    );
  };

  useEffect(() => {
    if (!isSearchPopupOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchPopupOpen]);

  useEffect(() => {
    if (!shouldShowAttractionLoader || isSearchPopupOpen) {
      hideLoading();
      return;
    }

    if (!mapReady) {
      showLoading({
        title: "지도를 준비하고 있어요",
        description: "지도를 다시 연결하는 중",
        footerText: "감자 분석 모드 진행 중",
        animation: "map-rendering",
      });
      return;
    }

    if (
      attractionLoadingStage === "fetching-places" ||
      (attractionLoadingStage === "idle" &&
        attractionsQuery.isFetching &&
        !attractionsQuery.data)
    ) {
      showLoading({
        title: "장소 데이터를 찾고 있어요",
        description: "지도를 보면서 장소 후보를 찾는 중",
        footerText: "감자 분석 모드 진행 중",
        animation: "map-thinking",
      });
      return;
    }

    if (attractionLoadingStage === "ranking" || attractionsQuery.isFetching) {
      showLoading({
        title: "순위를 매기고 있어요",
        description: "방문자 집중률 데이터를 정리하는 중",
        footerText: "감자 분석 모드 진행 중",
        animation: "ranking",
      });
      return;
    }

    showLoading({
      title: "지도를 그리고 있어요",
      description: "지도 위에 핀을 배치하는 중",
      footerText: "감자 분석 모드 진행 중",
      animation: "map-rendering",
    });
  }, [
    attractionLoadingStage,
    attractionsQuery.data,
    attractionsQuery.isFetching,
    hideLoading,
    isSearchPopupOpen,
    mapReady,
    shouldShowAttractionLoader,
    showLoading,
  ]);

  useEffect(() => {
    return () => {
      hideLoading();
    };
  }, [hideLoading]);

  useEffect(() => {
    if (!isSearchPopupOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearchPopup();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeSearchPopup, isSearchPopupOpen]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setCurrentLocation(null);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 5,
        timeout: 4000,
      }
    );
  }, []);

  const clearMarkers = () => {
    const naverMaps = naverMapsRef.current;

    markerListenerRefs.current.forEach((listener) => {
      if (naverMaps?.Event) {
        naverMaps.Event.removeListener(listener);
      }
    });

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    markerListenerRefs.current = [];
  };

  const clearBoundaryPolygons = () => {
    boundaryPolygonRefs.current.forEach((polygon) => polygon.setMap(null));
    boundaryPolygonRefs.current = [];
  };

  const drawSelectedRegionBoundary = () => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;

    if (!mapInstance || !naverMaps) {
      return null;
    }

    clearBoundaryPolygons();

    const multiPolygon = boundaryBySigunguCode[selectedSigunguCode];
    if (!multiPolygon || multiPolygon.length === 0) {
      return null;
    }

    const regionBounds = new naverMaps.LatLngBounds();
    const isKoreaLatLng = (lat: number, lng: number) =>
      lat >= 32 && lat <= 40 && lng >= 123 && lng <= 133;
    const readLatLng = (coord: any) => {
      if (!coord) {
        return null;
      }

      const lat =
        typeof coord.lat === "function"
          ? coord.lat()
          : typeof coord.y === "number"
            ? coord.y
            : typeof coord._lat === "number"
              ? coord._lat
              : null;
      const lng =
        typeof coord.lng === "function"
          ? coord.lng()
          : typeof coord.x === "number"
            ? coord.x
            : typeof coord._lng === "number"
              ? coord._lng
              : null;

      if (typeof lat !== "number" || typeof lng !== "number") {
        return null;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return { lat, lng };
    };

    const toLatLng = ([x, y]: [number, number]) => {
      if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
        return isKoreaLatLng(y, x) ? new naverMaps.LatLng(y, x) : null;
      }

      const transCoord = naverMaps.TransCoord;
      const convertCandidates = [
        () => transCoord?.fromUTMKToLatLng?.(new naverMaps.Point(x, y)),
        () => transCoord?.fromTM128ToLatLng?.(new naverMaps.Point(x, y)),
        () => transCoord?.fromNaverToLatLng?.(new naverMaps.Point(x, y)),
      ];

      for (const convert of convertCandidates) {
        const coord = convert();
        const parsed = readLatLng(coord);
        if (parsed && isKoreaLatLng(parsed.lat, parsed.lng)) {
          return new naverMaps.LatLng(parsed.lat, parsed.lng);
        }
      }

      const converted = convertUtmkToWgs84(x, y);
      if (converted && isKoreaLatLng(converted.lat, converted.lng)) {
        return new naverMaps.LatLng(converted.lat, converted.lng);
      }

      return null;
    };

    multiPolygon.forEach((polygon) => {
      const paths = polygon
        .map((ring) =>
          ring
            .map((point) => {
              const latLng = toLatLng(point);
              if (!latLng) {
                return null;
              }
              regionBounds.extend(latLng);
              return latLng;
            })
            .filter((point): point is any => point !== null)
        )
        .filter((ring) => ring.length > 0);

      if (paths.length === 0) {
        return;
      }

      const boundaryPolygon = new naverMaps.Polygon({
        map: mapInstance,
        paths,
        strokeColor: "#0d9488",
        strokeWeight: 2,
        strokeOpacity: 0.95,
        fillColor: "#14b8a6",
        fillOpacity: 0.1,
        zIndex: 880,
      });

      boundaryPolygonRefs.current.push(boundaryPolygon);

      paths.forEach((path) => {
        const boundaryHaloLine = new naverMaps.Polyline({
          map: mapInstance,
          path,
          strokeColor: "#ffffff",
          strokeWeight: 8,
          strokeOpacity: 0.9,
          zIndex: 900,
          clickable: false,
        });
        const boundaryLine = new naverMaps.Polyline({
          map: mapInstance,
          path,
          strokeColor: "#0d9488",
          strokeWeight: 4,
          strokeOpacity: 1,
          zIndex: 901,
          clickable: false,
        });

        boundaryPolygonRefs.current.push(boundaryHaloLine, boundaryLine);
      });
    });

    if (boundaryPolygonRefs.current.length === 0) {
      return null;
    }

    return regionBounds;
  };

  const moveMapToBounds = (bounds: any, smooth: boolean) => {
    const mapInstance = mapInstanceRef.current;

    if (!mapInstance) {
      return;
    }

    if (!smooth) {
      mapInstance.fitBounds(bounds);
      return;
    }

    if (typeof mapInstance.panToBounds === "function") {
      mapInstance.panToBounds(bounds);
      return;
    }

    const center =
      typeof bounds?.getCenter === "function" ? bounds.getCenter() : null;

    if (center && typeof mapInstance.panTo === "function") {
      mapInstance.panTo(center, { duration: 450 });
      setTimeout(() => {
        if (mapInstanceRef.current === mapInstance) {
          mapInstance.fitBounds(bounds);
        }
      }, 220);
      return;
    }

    mapInstance.fitBounds(bounds);
  };

  const fitMapToSelectedRegion = (options?: { smooth?: boolean; fallbackBounds?: any }) => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const smooth = options?.smooth ?? false;
    const currentRegion =
      GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
      GANGWON_REGIONS[0];

    if (!mapInstance || !naverMaps) {
      return;
    }

    const regionBounds = drawSelectedRegionBoundary();
    if (regionBounds) {
      moveMapToBounds(regionBounds, smooth);
      return;
    }

    if (options?.fallbackBounds) {
      moveMapToBounds(options.fallbackBounds, smooth);
      return;
    }

    const center = new naverMaps.LatLng(currentRegion.center.lat, currentRegion.center.lng);
    if (smooth && typeof mapInstance.panTo === "function") {
      mapInstance.panTo(center, { duration: 450 });
      setTimeout(() => {
        if (mapInstanceRef.current === mapInstance) {
          mapInstance.setZoom(10);
        }
      }, 220);
      return;
    }

    mapInstance.setCenter(
      center
    );
    mapInstance.setZoom(10);
  };

  useEffect(() => {
    const container = mapRef.current;

    if (!container) {
      return;
    }

    if (!NCP_KEY_ID) {
      setMapError("VITE_NCP_MAPS_KEY_ID가 설정되지 않았습니다.");
      return;
    }

    let isDisposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;

    window.navermap_authFailure = () => {
      setMapError(
        "네이버 지도 인증에 실패했습니다. Web 서비스 URL(localhost/127.0.0.1)을 확인해 주세요."
      );
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapSdk(NCP_KEY_ID);

        if (isDisposed) {
          return;
        }

        const naverMaps = window.naver?.maps;

        if (!naverMaps) {
          setMapError("Naver Maps SDK를 찾을 수 없습니다.");
          return;
        }

        naverMapsRef.current = naverMaps;

        const shouldUseDarkMap = useUiThemeStore.getState().mode === "dark";
        const mapInstance = new naverMaps.Map(container, {
          center: new naverMaps.LatLng(GANGWON_CENTER.lat, GANGWON_CENTER.lng),
          zoom: 10,
          mapTypeId: naverMaps.MapTypeId.NORMAL,
          ...getNaverMapThemeOptions(shouldUseDarkMap),
          draggable: true,
          pinchZoom: true,
          scrollWheel: true,
          zoomControl: false,
          mapDataControl: true,
          logoControl: true,
          minZoom: 8,
        });

        mapInstanceRef.current = mapInstance;
        applyNaverMapTheme(mapInstance, shouldUseDarkMap);
        enableNaverMapPointerInteractions(mapInstance);

        const gangwonBounds = new naverMaps.LatLngBounds(
          new naverMaps.LatLng(GANGWON_BOUNDS.south, GANGWON_BOUNDS.west),
          new naverMaps.LatLng(GANGWON_BOUNDS.north, GANGWON_BOUNDS.east)
        );

        mapInstance.fitBounds(gangwonBounds);
        mapInstance.setZoom(Math.max(10, mapInstance.getZoom()));

        const forceResize = () => {
          if (!mapInstanceRef.current) {
            return;
          }
          naverMaps.Event.trigger(mapInstance, "resize");
        };

        requestAnimationFrame(forceResize);
        setTimeout(forceResize, 120);
        setTimeout(forceResize, 360);

        naverMaps.Event.once(mapInstance, "init", () => {
          setMapReady(true);
        });

        handleResize = forceResize;
        window.addEventListener("resize", handleResize);

        resizeObserver = new ResizeObserver(() => {
          forceResize();
        });
        resizeObserver.observe(container);
      } catch {
        setMapError("지도 로드에 실패했습니다. 키와 도메인 등록을 확인해 주세요.");
      }
    };

    initializeMap();

    return () => {
      isDisposed = true;
      clearMarkers();
      clearBoundaryPolygons();
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      mapInstanceRef.current = null;
      naverMapsRef.current = null;
      closeSheet();
      window.navermap_authFailure = undefined;
      container.innerHTML = "";
    };
  }, [closeSheet]);

  useEffect(() => {
    applyNaverMapTheme(mapInstanceRef.current, isDarkMode);
    enableNaverMapPointerInteractions(mapInstanceRef.current);
  }, [isDarkMode]);

  useEffect(() => {
    if (!mapReady || !isBoundaryDataReady) {
      return;
    }

    fitMapToSelectedRegion();
  }, [isBoundaryDataReady, mapReady, selectedSigunguCode]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    closeSheet();
    setHasRenderedAttractionMarkers(false);
    clearMarkers();
  }, [closeSheet, mapReady, selectedSigunguCode]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const attractionData = attractionsQuery.data;

    if (!mapReady || !mapInstance || !naverMaps || !attractionData) {
      return;
    }

    setAttractionLoadingStage("rendering-markers");
    setHasRenderedAttractionMarkers(false);
    clearMarkers();
    const markerBounds = new naverMaps.LatLngBounds();
    let visibleMarkerCount = 0;
    const visibleAttractions = attractionData.allAttractions
      .map((attraction) => ({
        attraction,
        markerType: resolveMarkerType(
          attraction,
          attractionData.lclsNameByCode
        ),
      }))
      .filter(({ attraction, markerType }) =>
        matchesPlaceFilter(attraction, markerType, searchFilter)
      );
    const spreadPositionByMarkerKey = buildSpreadMarkerPositionMap(
      visibleAttractions.map(({ attraction }) => attraction)
    );

    visibleAttractions.forEach(({ attraction, markerType }) => {
      const spreadPosition =
        spreadPositionByMarkerKey.get(getAttractionMarkerKey(attraction)) ?? {
          lat: attraction.lat,
          lng: attraction.lng,
        };
      const position = new naverMaps.LatLng(
        spreadPosition.lat,
        spreadPosition.lng
      );
      markerBounds.extend(position);
      visibleMarkerCount += 1;

      const rank = topRankByAttractionId.get(attraction.id) ?? null;
      const touristTrendName =
        trendNameByAttractionId.get(attraction.id) ?? attraction.title;
      const isTodayFestival = attraction.isTodayFestival;
      const markerAnchor = isTodayFestival ? 27 : 17;

      const marker = new naverMaps.Marker({
        map: mapInstance,
        position,
        title: attraction.title,
        zIndex: isTodayFestival ? 2600 : rank ? 2000 - rank : 1100,
        icon: {
          content: createBadgeMarkerIconHtml(
            markerType.badge,
            rank ? `${rank}` : undefined,
            {
              highlighted: isTodayFestival,
              highlightLabel: "오늘",
            }
          ),
          anchor: new naverMaps.Point(markerAnchor, markerAnchor),
        },
      });

      markerRefs.current.push(marker);

      const listener = naverMaps.Event.addListener(marker, "click", () => {
        openPlaceSheetFromAttraction({
          attraction,
          markerType,
          touristTrendName,
          rank,
        });
      });

      markerListenerRefs.current.push(listener);
    });

    fitMapToSelectedRegion({
      smooth: true,
      fallbackBounds: visibleMarkerCount > 0 ? markerBounds : null,
    });
    setHasRenderedAttractionMarkers(true);
    setAttractionLoadingStage("idle");
  }, [
    attractionsQuery.data,
    mapReady,
    searchFilter,
    selectedSigunguCode,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  useEffect(() => {
    if (attractionsQuery.isError) {
      setAttractionLoadingStage("idle");
    }
  }, [attractionsQuery.isError]);

  return (
    <section className="relative h-full overflow-hidden bg-brand-50">
      <div
        ref={mapRef}
        className="naver-map-root h-full w-full"
        style={{ background: "#dbeafe" }}
      />

      <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between">
        <button
          type="button"
          aria-label="장소 검색 열기"
          onClick={() => setIsSearchPopupOpen(true)}
          className="pointer-events-auto flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white/95 px-4 text-left shadow-md backdrop-blur"
        >
          <span className="text-base text-brand-500">
            <IoSearch />
          </span>
          <span className="ml-2 w-full truncate text-sm font-semibold text-slate-400">
            강원도 명소 검색
          </span>
        </button>
        <button
          type="button"
          aria-label="담은 장소"
          onClick={() => {
            resetSheet();
            openSavedList();
          }}
          className="pointer-events-auto ml-2 inline-flex h-12 items-center gap-2 rounded-full border border-brand-500 bg-brand-600/95 px-3 text-xs font-semibold text-white shadow"
        >
          <IoBagHandleOutline className="text-sm" />
          <span>{isAttractionLoading ? "…" : savedPlaceIds.length}</span>
        </button>
      </div>

      <div className="scrollbar-hide pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {orderedRegions.map((region) => {
            const isActive = selectedSigunguCode === region.sigunguCode;
            const festivalCount =
              festivalCountBySigunguCode.get(region.sigunguCode) ?? 0;

            return (
              <button
                key={region.sigunguCode || "all"}
                type="button"
                onClick={() => setSelectedSigunguCode(region.sigunguCode)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm transition ${
                  isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white/95 text-slate-600"
                }`}
              >
                <span>{region.label}</span>
                {festivalCount > 0 ? (
                  <span
                    className={`inline-flex h-5 items-center rounded-full px-1.5 text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    🎉 {festivalCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="scrollbar-hide pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+6.1rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {[
            { key: "all", label: "전체" },
            { key: "tourist", label: "관광지" },
            { key: "food", label: "음식점" },
            { key: "cafe", label: "카페" },
            { key: "festival", label: "축제" },
          ].map((filter) => {
            const isActive = searchFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  resetSheet();
                  setSearchFilter(filter.key as SearchFilter);
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold shadow-sm backdrop-blur transition ${
                  isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white/95 text-slate-600"
                }`}
              >
                {filter.key === "all" ? (
                  <IoMapOutline className="text-sm" />
                ) : filter.key === "tourist" ? (
                  <IoLocationSharp className="text-sm" />
                ) : filter.key === "food" ? (
                  <IoRestaurantOutline className="text-sm" />
                ) : filter.key === "cafe" ? (
                  <IoCafeOutline className="text-sm" />
                ) : (
                  <IoTicketOutline className="text-sm" />
                )}
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {appendTarget ? (
        <div className="pointer-events-auto absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)] z-30 rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
              D{appendTarget.nextDayIndex}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">
                {appendTarget.routeTitle}에 DAY 추가 중
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                장소를 담고 체크아웃에서 추가할 일정을 확인해요
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetSheet();
                    openSavedList();
                  }}
                  className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                >
                  체크아웃
                </button>
                <button
                  type="button"
                  onClick={clearAppendTarget}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <RouteCheckoutModal
        isOpen={isSavedListOpen}
        savedPlaces={savedPlaces}
        insertCandidatePlaces={routeInsertCandidatePlaces}
        currentLocation={routeStartLocation}
        appendRouteTitle={appendTarget?.routeTitle}
        initialTravelStartDate={appendTarget?.suggestedStartDate}
        initialTripDays={appendTarget ? 1 : undefined}
        onClose={closeSavedList}
        onSelectPlace={(place) => {
          openSheet(place, { mode: "full-popup" });
        }}
        onRemovePlace={removeSavedPlace}
        onClearPlaces={clearSavedPlaces}
        onRequestSearchPlace={() => {
          setIsSearchPopupOpen(true);
          window.setTimeout(() => searchInputRef.current?.focus(), 0);
        }}
      />
      {isSearchPopupOpen ? (
        <section className="fixed inset-0 z-[2300] bg-[#071f1f] text-slate-100">
          <div className="flex h-full flex-col">
            <div className="border-b border-brand-400/20 bg-[#0b2524]/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-brand-400/35 bg-[#071718] px-4 shadow-[0_10px_24px_rgba(0,0,0,0.22)]">
                  <input
                    ref={searchInputRef}
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="강원도 명소, 카페, 음식점, 축제 검색"
                    className="w-full bg-transparent text-sm font-semibold text-slate-100 placeholder:text-slate-400 outline-none"
                  />
                  {searchKeyword ? (
                    <button
                      type="button"
                      aria-label="검색어 지우기"
                      onClick={() => setSearchKeyword("")}
                      className="ml-2 text-slate-400 transition hover:text-slate-100"
                    >
                      <IoClose />
                    </button>
                  ) : (
                    <span className="ml-2 text-slate-400">
                      <IoSearch />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="검색 닫기"
                  onClick={closeSearchPopup}
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-400/30 bg-[#0f3431] text-xl text-brand-200 shadow-[0_10px_24px_rgba(0,0,0,0.22)] transition hover:bg-[#13423e]"
                >
                  <IoClose />
                </button>
              </div>

              <div className="scrollbar-hide mt-3 flex items-center gap-2 overflow-x-auto pr-2">
                {[
                  { key: "all", label: "전체" },
                  { key: "tourist", label: "관광지" },
                  { key: "food", label: "음식점" },
                  { key: "cafe", label: "카페" },
                  { key: "festival", label: "축제" },
                ].map((filter) => {
                  const isActive = searchFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setSearchFilter(filter.key as SearchFilter)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-brand-400 bg-brand-600 text-white shadow-sm shadow-brand-900/30"
                          : "border-brand-400/25 bg-[#071718] text-slate-300"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto bg-[#071f1f] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {searchKeyword.trim() ? (
                <div className="space-y-2">
                  {searchResults.length > 0 ? (
                    <>
                      {visibleSearchResults.map((item) => (
                        <PlaceResultCard
                          key={`${item.attraction.id}-${item.attraction.contentTypeId}`}
                          title={item.attraction.title}
                          address={item.attraction.address}
                          categoryLabel={item.markerType.contentTypeLabel}
                          thumbnailUrl={item.thumbnailUrl}
                          fallbackIcon={item.icon}
                          distanceLabel={item.distanceLabel}
                          badgeLabel={
                            item.attraction.isTodayFestival
                              ? "오늘 진행 중"
                              : item.rank
                                ? `집중률 ${item.rank}위`
                                : null
                          }
                          onClick={() => {
                            appendRecentSearch(searchKeyword);
                            openPlaceSheetFromAttraction({
                              attraction: item.attraction,
                              markerType: item.markerType,
                              touristTrendName: item.touristTrendName,
                              rank: item.rank,
                              mode: "full-popup",
                            });
                          }}
                        />
                      ))}
                      {visibleSearchResults.length < searchResults.length ? (
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleSearchResultCount(
                              (count) => count + SEARCH_RESULTS_PAGE_SIZE
                            )
                          }
                          className="w-full rounded-2xl border border-brand-400/30 bg-[#0b2524] px-4 py-3 text-sm font-semibold text-brand-200 shadow-sm transition hover:bg-[#10332f]"
                        >
                          더 보기 {visibleSearchResults.length}/{searchResults.length}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-400/35 bg-[#0b2524] px-4 py-8 text-center text-sm font-semibold text-slate-300">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-400">최근 검색</p>
                    {recentSearches.length > 0 ? (
                      <button
                        type="button"
                        onClick={clearRecentSearches}
                        className="text-xs font-semibold text-slate-400 transition hover:text-slate-100"
                      >
                        전체 삭제
                      </button>
                    ) : null}
                  </div>
                  {recentSearches.length > 0 ? (
                    <div className="space-y-2">
                      {recentSearches.map((keyword) => (
                        <RecentSearchItem
                          key={keyword}
                          keyword={keyword}
                          onSelect={setSearchKeyword}
                          onDelete={removeRecentSearch}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-400/35 bg-[#0b2524] px-4 py-8 text-center text-sm font-semibold text-slate-300">
                      최근 검색어가 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {mapError ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">
          {mapError}
        </div>
      ) : null}

      {attractionError ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm">
          {attractionError}
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;
