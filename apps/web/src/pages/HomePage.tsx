import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IoArrowBack,
  IoBagHandleOutline,
  IoCafeOutline,
  IoClose,
  IoLocationSharp,
  IoRestaurantOutline,
  IoSearch,
} from "react-icons/io5";
import PlaceBottomSheet from "../features/place-sheet/components/PlaceBottomSheet";
import RouteCheckoutModal from "../features/route-checkout/components/RouteCheckoutModal";
import { loadNaverMapSdk } from "../lib/naverMapSdk";
import {
  buildLatestConcentrationMap,
  fetchGangwonAttractions,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  normalizeTouristPlaceNameForMatch,
  type GangwonAttraction,
} from "../lib/visitKoreaTourApi";
import { useMapSheetStore } from "../stores/mapSheetStore";
import { useUiLoadingStore } from "../stores/uiLoadingStore";

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

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

type MarkerBadge = {
  label: string;
  icon: string;
  background: string;
  border: string;
  text: string;
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

type SearchFilter = "all" | "tourist" | "food" | "cafe";
type AttractionLoadingStage =
  | "idle"
  | "fetching-places"
  | "ranking"
  | "rendering-markers";

const CONTENT_TYPE_BADGES: Record<string, MarkerBadge> = {
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

const DEFAULT_BADGE: MarkerBadge = {
  label: "장소",
  icon: "📌",
  background: "#ccfbf1",
  border: "#0d9488",
  text: "#115e59",
};

const CAFE_LCLS_CODE = "FD050100";
const CAFE_BADGE: MarkerBadge = {
  label: "카페",
  icon: "☕",
  background: "#fef3c7",
  border: "#d97706",
  text: "#78350f",
};

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

  const isCafe =
    attraction.contentTypeId === "39" &&
    (attraction.lclsSystm3 === CAFE_LCLS_CODE ||
      /카페|커피|coffee|찻집/i.test(`${categoryName} ${attraction.title}`));

  const badge = isCafe ? CAFE_BADGE : contentTypeBadge;
  const contentTypeLabel = isCafe ? "카페" : contentTypeBadge.label;

  return {
    typeName: categoryName,
    contentTypeLabel,
    badge,
  };
}

function createBadgeMarkerIconHtml(badge: MarkerBadge, rankLabel?: string) {
  const rank = rankLabel ? Number(rankLabel) : Number.NaN;
  const isRankNumber = Number.isFinite(rank);
  const rankBadgeStyle = (() => {
    if (!isRankNumber) {
      return {
        background: "#ef4444",
        text: "#ffffff",
        border: "#ffffff",
      };
    }

    if (rank === 1) {
      return {
        background: "#f59e0b",
        text: "#ffffff",
        border: "#ffffff",
      };
    }
    if (rank === 2) {
      return {
        background: "#94a3b8",
        text: "#ffffff",
        border: "#ffffff",
      };
    }
    if (rank === 3) {
      return {
        background: "#b45309",
        text: "#ffffff",
        border: "#ffffff",
      };
    }

    return {
      background: "#ef4444",
      text: "#ffffff",
      border: "#ffffff",
    };
  })();

  return `
    <div style="
      position:relative;
      width:34px;
      height:34px;
      border-radius:9999px;
      border:2px solid ${badge.border};
      background:${badge.background};
      color:${badge.text};
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:15px;
      font-weight:700;
      line-height:1;
      box-shadow:0 4px 10px rgba(15,23,42,0.18);
      letter-spacing:-0.02em;
      user-select:none;
    ">
      <span>${escapeHtml(badge.icon)}</span>
      ${
        rankLabel
          ? `<span style="
              position:absolute;
              top:-8px;
              right:-8px;
              min-width:18px;
              height:18px;
              border-radius:9999px;
              border:2px solid ${rankBadgeStyle.border};
              background:${rankBadgeStyle.background};
              color:${rankBadgeStyle.text};
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:10px;
              font-weight:800;
              line-height:1;
              padding:0 3px;
              box-shadow:0 3px 8px rgba(15,23,42,0.2);
            ">${escapeHtml(rankLabel)}</span>`
          : ""
      }
    </div>
  `;
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

function HomePage() {
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
    savedPlaceIds,
    savedPlaces,
    isSavedListOpen,
    openSavedList,
    closeSavedList,
    removeSavedPlace,
    clearSavedPlaces,
  } = useMapSheetStore();
  const showLoading = useUiLoadingStore((state) => state.showLoading);
  const hideLoading = useUiLoadingStore((state) => state.hideLoading);

  const [selectedSigunguCode, setSelectedSigunguCode] = useState<string>(
    GANGWON_REGIONS[0].sigunguCode
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [attractionLoadingStage, setAttractionLoadingStage] =
    useState<AttractionLoadingStage>("idle");
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
      const attractions = await fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
        sigunguCode: selectedSigunguCode || undefined,
        contentTypeIds: ["12", "39"],
      });
      setAttractionLoadingStage("ranking");
      const concentrationPoints = await fetchTouristConcentrationPoints(
        TOUR_API_SERVICE_KEY,
        {
          areaCode: GANGWON_TATS_AREA_CODE,
          signguCode,
          numOfRows: 2000,
        }
      );
      const dedupedAttractions = attractions.filter((attraction, index, array) => {
        const key = `${attraction.title.trim().toLowerCase()}|${attraction.address
          .trim()
          .toLowerCase()}`;
        return (
          array.findIndex((candidate) => {
            const candidateKey = `${candidate.title.trim().toLowerCase()}|${candidate.address
              .trim()
              .toLowerCase()}`;
            return candidateKey === key;
          }) === index
        );
      });
      const filteredAttractions = dedupedAttractions.filter(
        (attraction) => !shouldHideAttraction(attraction, lclsNameByCode)
      );
      const rankableTouristAttractions = filteredAttractions.filter(
        (attraction) => attraction.contentTypeId === "12"
      );
      const latestConcentrationByName =
        buildLatestConcentrationMap(concentrationPoints);
      const latestConcentrationPoints = [...latestConcentrationByName.values()].sort(
        (a, b) => b.concentrationRate - a.concentrationRate
      );

      const usedAttractionIds = new Set<string>();
      const topAttractions: Array<{
        attraction: GangwonAttraction;
        popularityScore: number;
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
          popularityScore: point.concentrationRate,
          touristTrendName: point.touristName,
        });
      });

      if (topAttractions.length < 10) {
        rankableTouristAttractions
          .filter((attraction) => !usedAttractionIds.has(attraction.id))
          .slice(0, 10 - topAttractions.length)
          .forEach((attraction) => {
            topAttractions.push({
              attraction,
              popularityScore: -1,
              touristTrendName: attraction.title,
            });
          });
      }

      return {
        allAttractions: filteredAttractions,
        topAttractions,
        lclsNameByCode,
      };
    },
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
        const isCafe = markerType.contentTypeLabel === "카페";
        const isFoodOrCafe =
          attraction.contentTypeId === "39" || markerType.contentTypeLabel === "카페";

        const matchesFilter =
          searchFilter === "all"
            ? true
            : searchFilter === "tourist"
              ? attraction.contentTypeId === "12"
              : searchFilter === "food"
                ? isFoodOrCafe
                : isCafe;
        const matchesKeyword = !keyword || textForSearch.includes(keyword);

        return {
          attraction,
          markerType,
          rank,
          touristTrendName: trendNameByAttractionId.get(attraction.id) ?? attraction.title,
          matchesFilter,
          matchesKeyword,
        };
      })
      .filter((item) => item.matchesFilter && item.matchesKeyword)
      .sort((a, b) => {
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
      .slice(0, 60);
  }, [attractionsQuery.data, searchFilter, searchKeyword, topRankByAttractionId, trendNameByAttractionId]);

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

  const openPlaceSheetFromAttraction = (
    attraction: GangwonAttraction,
    markerType: ReturnType<typeof resolveMarkerType>,
    touristTrendName: string,
    rank: number | null
  ) => {
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
      {
        id: `${attraction.id}-${attraction.contentTypeId}`,
        contentId: attraction.id,
        contentTypeId: attraction.contentTypeId,
        areaCode: GANGWON_TATS_AREA_CODE,
        signguCode:
          GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode] ?? "",
        touristTrendName,
        topRank: rank ?? null,
        title: attraction.title,
        address: attraction.address,
        lat: attraction.lat,
        lng: attraction.lng,
        contentTypeLabel: markerType.contentTypeLabel,
        categoryName: markerType.typeName,
        icon: markerType.badge.icon,
        images: [],
      },
      { mode: "bottom-sheet" }
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
    if (attractionLoadingStage === "idle" || isSearchPopupOpen) {
      hideLoading();
      return;
    }

    if (attractionLoadingStage === "fetching-places") {
      showLoading({
        title: "장소 데이터를 찾고 있어요",
        description: "지도를 보면서 장소 후보를 찾는 중",
        footerText: "감자 분석 모드 진행 중",
        animation: "map-thinking",
      });
      return;
    }

    if (attractionLoadingStage === "ranking") {
      showLoading({
        title: "순위를 매기고 있어요",
        description: "지도를 들고 TOP 후보를 정리하는 중",
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
  }, [attractionLoadingStage, hideLoading, isSearchPopupOpen, showLoading]);

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
        setIsSearchPopupOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isSearchPopupOpen]);

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
        strokeWeight: 3,
        strokeOpacity: 0.95,
        fillColor: "#14b8a6",
        fillOpacity: 0.12,
      });

      boundaryPolygonRefs.current.push(boundaryPolygon);
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

        const mapInstance = new naverMaps.Map(container, {
          center: new naverMaps.LatLng(GANGWON_CENTER.lat, GANGWON_CENTER.lng),
          zoom: 10,
          mapTypeId: naverMaps.MapTypeId.NORMAL,
          zoomControl: false,
          mapDataControl: true,
          logoControl: true,
          minZoom: 8,
        });

        mapInstanceRef.current = mapInstance;

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
    const markerBounds = new naverMaps.LatLngBounds();

    attractionData.allAttractions.forEach((attraction) => {
      const position = new naverMaps.LatLng(attraction.lat, attraction.lng);
      markerBounds.extend(position);

      const markerType = resolveMarkerType(attraction, attractionData.lclsNameByCode);
      const rank = topRankByAttractionId.get(attraction.id) ?? null;
      const touristTrendName =
        trendNameByAttractionId.get(attraction.id) ?? attraction.title;

      const marker = new naverMaps.Marker({
        map: mapInstance,
        position,
        title: attraction.title,
        zIndex: rank ? 2000 - rank : 1100,
        icon: {
          content: rank
            ? createBadgeMarkerIconHtml(markerType.badge, `${rank}`)
            : createBadgeMarkerIconHtml(markerType.badge),
          anchor: new naverMaps.Point(17, 17),
        },
      });

      markerRefs.current.push(marker);

      const listener = naverMaps.Event.addListener(marker, "click", () => {
        openPlaceSheetFromAttraction(attraction, markerType, touristTrendName, rank);
      });

      markerListenerRefs.current.push(listener);
    });

    fitMapToSelectedRegion({
      smooth: true,
      fallbackBounds: attractionData.allAttractions.length > 0 ? markerBounds : null,
    });
    setAttractionLoadingStage("idle");
  }, [attractionsQuery.data, mapReady, selectedSigunguCode, topRankByAttractionId, trendNameByAttractionId]);

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
          onClick={() => setIsSearchPopupOpen(true)}
          className="pointer-events-auto flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white/95 px-4 text-left shadow-md backdrop-blur"
        >
          <span className="text-base text-brand-500">
            <IoLocationSharp />
          </span>
          <span
            className={`ml-2 w-full truncate text-sm ${
              searchKeyword
                ? "text-slate-700"
                : "text-slate-400"
            }`}
          >
            {searchKeyword || "강원도 명소 검색"}
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

            return (
              <button
                key={region.sigunguCode || "all"}
                type="button"
                onClick={() => setSelectedSigunguCode(region.sigunguCode)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white/95 text-slate-600"
                }`}
              >
                {region.label}
              </button>
            );
          })}
        </div>
      </div>

      <RouteCheckoutModal
        isOpen={isSavedListOpen}
        savedPlaces={savedPlaces}
        onClose={closeSavedList}
        onSelectPlace={(place) => {
          openSheet(place, { mode: "full-popup" });
        }}
        onRemovePlace={removeSavedPlace}
        onClearPlaces={clearSavedPlaces}
      />

      <PlaceBottomSheet />

      {isSearchPopupOpen ? (
        <section className="fixed inset-0 z-[2300] bg-gradient-to-b from-brand-50 via-brand-50 to-white">
          <div className="flex h-full flex-col">
            <div className="border-b border-brand-100/80 bg-white/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white px-4 shadow-sm">
                  <button
                    type="button"
                    aria-label="검색 닫기"
                    onClick={() => setIsSearchPopupOpen(false)}
                    className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-700"
                  >
                    <IoArrowBack />
                  </button>
                  <input
                    ref={searchInputRef}
                    value={searchKeyword}
                    onChange={(event) => setSearchKeyword(event.target.value)}
                    placeholder="강원도 명소, 카페, 음식점 검색"
                    className="ml-2 w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
                  />
                  {searchKeyword ? (
                    <button
                      type="button"
                      aria-label="검색어 지우기"
                      onClick={() => setSearchKeyword("")}
                      className="ml-2 text-slate-400"
                    >
                      <IoClose />
                    </button>
                  ) : (
                    <span className="ml-2 text-slate-400">
                      <IoSearch />
                    </span>
                  )}
                </div>
              </div>

              <div className="scrollbar-hide mt-3 flex items-center gap-2 overflow-x-auto pr-2">
                {[
                  { key: "all", label: "전체" },
                  { key: "tourist", label: "관광지" },
                  { key: "food", label: "음식점" },
                  { key: "cafe", label: "카페" },
                ].map((filter) => {
                  const isActive = searchFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setSearchFilter(filter.key as SearchFilter)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-brand-200 bg-white text-slate-600"
                      }`}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {searchKeyword.trim() ? (
                <div className="space-y-2">
                  {searchResults.length > 0 ? (
                    searchResults.map((item) => (
                      <button
                        key={`${item.attraction.id}-${item.attraction.contentTypeId}`}
                        type="button"
                        onClick={() => {
                          appendRecentSearch(searchKeyword);
                          setSearchKeyword(item.attraction.title);
                          setIsSearchPopupOpen(false);
                          openPlaceSheetFromAttraction(
                            item.attraction,
                            item.markerType,
                            item.touristTrendName,
                            item.rank
                          );
                        }}
                        className="flex w-full items-start justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {item.attraction.title}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-500">
                            {item.attraction.address}
                          </p>
                        </div>
                        <div className="ml-3 flex shrink-0 items-center gap-2">
                          {item.rank ? (
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                              TOP {item.rank}
                            </span>
                          ) : null}
                          {item.markerType.contentTypeLabel === "카페" ? (
                            <IoCafeOutline className="text-brand-500" />
                          ) : item.attraction.contentTypeId === "39" ? (
                            <IoRestaurantOutline className="text-brand-500" />
                          ) : (
                            <span>{item.markerType.badge.icon}</span>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-4 py-8 text-center text-sm text-slate-500">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-semibold text-slate-500">최근 검색</p>
                  <div className="space-y-2">
                    {recentSearches.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => {
                          setSearchKeyword(keyword);
                        }}
                        className="flex w-full items-center justify-between rounded-2xl border border-brand-100 bg-white px-4 py-3 text-left"
                      >
                        <span className="text-sm text-slate-700">{keyword}</span>
                        <IoSearch className="text-slate-400" />
                      </button>
                    ))}
                  </div>
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
