import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import { createBadgeMarkerIconHtml } from "@/components/map/NaverMapMarkerIcon";
import HomeMapControls from "@/components/home/HomeMapControls";
import PlaceSearchPopup from "@/components/search/PlaceSearchPopup";
import {
  GANGWON_BOUNDS,
  GANGWON_CENTER,
  GANGWON_REGIONS,
  GANGWON_SIGNGU_ADMIN_CODES,
  GANGWON_TATS_AREA_CODE,
} from "@/data/gangwonRegions";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { getCurrentPosition } from "@/lib/currentPosition";
import { useUiText } from "@/lib/uiText";
import {
  readRecentPlaceSearches,
  writeRecentPlaceSearches,
} from "@/lib/recentPlaceSearches";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import {
  CAFE_LCLS_CODE,
  isTouristPlace,
} from "@/lib/placeCategory";
import {
  buildBoundaryMapBySigunguCode,
  calculateDistanceMeters,
  convertUtmkToWgs84,
  type CurrentLocation,
  type GangwonBoundaryCollection,
} from "@/lib/gangwonBoundaryUtils";
import {
  buildSpreadMarkerPositionMap,
  createMapSheetPlaceFromAttraction,
  formatDistanceLabel,
  getAttractionMarkerKey,
  getMarkerTypeIcon,
  getPlaceSearchMatchPriority,
  getTouristNameMatchScore,
  matchesPlaceFilter,
  resolveMarkerType,
  shouldHideAttraction,
  type AttractionLoadingStage,
  type OpenPlaceSheetFromAttractionOptions,
  type SearchFilter,
} from "@/lib/gangwonAttractionMap";
import {
  buildLatestConcentrationMap,
  fetchGangwonAttractions,
  fetchGangwonFestivals,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import {
  cacheTourCategoryLocalizationMap,
  localizeTourPlaces,
  readCachedTourCategoryLocalizationMap,
} from "@/lib/placeLocalization";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import {
  NCP_KEY_ID,
  PLACE_SEARCH_FILTERS,
  SEARCH_RESULTS_PAGE_SIZE,
  TOUR_API_SERVICE_KEY,
} from "@/pages/HomePage.constants";

const MARKER_RENDER_CHUNK_SIZE = 80;
const ENGLISH_DISPLAY_DATA_TIMEOUT_MS = 5_000;

type HomeAttractionQueryData = {
  allAttractions: GangwonAttraction[];
  sourceAttractions: GangwonAttraction[];
  topAttractions: Array<{
    attraction: GangwonAttraction;
    touristTrendName: string;
  }>;
  lclsNameByCode: Record<string, string>;
  isLocalized: boolean;
};

function withTimeoutFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
) {
  let timeoutId: number | undefined;

  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}

function mergeAttractionDisplayData(
  sourceAttractions: GangwonAttraction[],
  displayAttractions: GangwonAttraction[]
) {
  const displayAttractionById = new Map(
    displayAttractions.map((attraction) => [attraction.id, attraction])
  );

  return sourceAttractions.map((sourceAttraction) => {
    const displayAttraction = displayAttractionById.get(sourceAttraction.id);

    if (!displayAttraction) {
      return sourceAttraction;
    }

    return {
      ...sourceAttraction,
      title: displayAttraction.title || sourceAttraction.title,
      address: displayAttraction.address || sourceAttraction.address,
      firstImage: sourceAttraction.firstImage || displayAttraction.firstImage,
      secondImage:
        sourceAttraction.secondImage || displayAttraction.secondImage,
    };
  });
}

function HomePage() {
  const text = useUiText();
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const naverMapsRef = useRef<any>(null);
  const boundaryPolygonRefs = useRef<any[]>([]);
  const markerRefs = useRef<any[]>([]);
  const markerListenerRefs = useRef<any[]>([]);
  const hasRenderedAttractionMarkersRef = useRef(false);
  const isUpdatingPlaceLabelsRef = useRef(false);

  const openSheet = useMapSheetStore((state) => state.openSheet);
  const closeSheet = useMapSheetStore((state) => state.closeSheet);
  const resetSheet = useMapSheetStore((state) => state.resetSheet);
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
  const [recentSearches, setRecentSearches] = useState<string[]>(
    readRecentPlaceSearches
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const updateHasRenderedAttractionMarkers = useCallback(
    (hasRendered: boolean) => {
      hasRenderedAttractionMarkersRef.current = hasRendered;
    },
    []
  );

  const loadLclsNameByCode = useCallback(async () => {
    try {
      const codeNameMap = await fetchLclsSystemNameMap(
        TOUR_API_SERVICE_KEY,
        appLanguage
      );
      void cacheTourCategoryLocalizationMap(codeNameMap, appLanguage);
      return codeNameMap;
    } catch (error) {
      const cachedCodeNameMap =
        await readCachedTourCategoryLocalizationMap(appLanguage);

      if (Object.keys(cachedCodeNameMap).length > 0) {
        return cachedCodeNameMap;
      }

      throw error;
    }
  }, [appLanguage]);

  const attractionQueryKey = useMemo(
    () =>
      [
        "gangwon-attractions",
        "source-first-v2",
        selectedSigunguCode,
        appLanguage,
      ] as const,
    [appLanguage, selectedSigunguCode]
  );

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

  const attractionsQuery = useQuery<HomeAttractionQueryData>({
    queryKey: attractionQueryKey,
    enabled: Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      setAttractionLoadingStage("fetching-places");
      const signguCode = GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode];
      const [
        lclsNameByCode,
        attractions,
        festivals,
        concentrationPoints,
      ] = await Promise.all([
        loadLclsNameByCode(),
        fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
          sigunguCode: selectedSigunguCode || undefined,
          contentTypeIds: ["12", "39"],
        }, "ko"),
        fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
          sigunguCode: selectedSigunguCode || undefined,
          lookAheadDays: 90,
        }, "ko").catch(() => [] as GangwonAttraction[]),
        fetchTouristConcentrationPoints(TOUR_API_SERVICE_KEY, {
          areaCode: GANGWON_TATS_AREA_CODE,
          signguCode,
          numOfRows: 2000,
        }),
      ]);

      const resolvedLclsNameByCode = {
        ...lclsNameByCode,
        [CAFE_LCLS_CODE]:
          lclsNameByCode[CAFE_LCLS_CODE] ||
          (appLanguage === "en" ? "Cafe" : "카페"),
      };
      void cacheTourCategoryLocalizationMap(
        resolvedLclsNameByCode,
        appLanguage
      );
      setAttractionLoadingStage("ranking");
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
        (attraction) =>
          !shouldHideAttraction(attraction, resolvedLclsNameByCode)
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

      const englishDisplayAttractions =
        appLanguage === "en"
          ? await withTimeoutFallback(
              Promise.all([
                fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
                  sigunguCode: selectedSigunguCode || undefined,
                  contentTypeIds: ["12", "39"],
                }, "en").catch(() => [] as GangwonAttraction[]),
                fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
                  sigunguCode: selectedSigunguCode || undefined,
                  lookAheadDays: 90,
                }, "en").catch(() => [] as GangwonAttraction[]),
              ]).then(([englishAttractions, englishFestivals]) => [
                ...englishAttractions,
                ...englishFestivals,
              ]),
              ENGLISH_DISPLAY_DATA_TIMEOUT_MS,
              [] as GangwonAttraction[]
            )
          : [];
      const displayAttractions =
        englishDisplayAttractions.length > 0
          ? mergeAttractionDisplayData(
              filteredAttractions,
              englishDisplayAttractions
            )
          : filteredAttractions;
      const displayAttractionByKey = new Map(
        displayAttractions.map((attraction) => [
          `${attraction.id}-${attraction.contentTypeId}`,
          attraction,
        ])
      );

      return {
        allAttractions: displayAttractions,
        sourceAttractions: filteredAttractions,
        topAttractions: topAttractions.map((item) => ({
          ...item,
          attraction:
            displayAttractionByKey.get(
              `${item.attraction.id}-${item.attraction.contentTypeId}`
            ) ?? item.attraction,
        })),
        lclsNameByCode: resolvedLclsNameByCode,
        isLocalized: appLanguage !== "en",
      };
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  useEffect(() => {
    const attractionData = attractionsQuery.data;

    if (
      appLanguage !== "en" ||
      !attractionData ||
      attractionData.isLocalized ||
      attractionData.allAttractions.length === 0 ||
      attractionsQuery.isFetching
    ) {
      return;
    }

    let isCancelled = false;

    const sourceAttractions =
      attractionData.sourceAttractions ?? attractionData.allAttractions;

    void localizeTourPlaces(sourceAttractions, appLanguage)
      .then((localizedAttractions) => {
        if (isCancelled) {
          return;
        }

        const sourceAttractionByKey = new Map(
          sourceAttractions.map((attraction) => [
            `${attraction.id}-${attraction.contentTypeId}`,
            attraction,
          ])
        );
        const hasLocalizedText = localizedAttractions.some((attraction) => {
          const sourceAttraction = sourceAttractionByKey.get(
            `${attraction.id}-${attraction.contentTypeId}`
          );

          return (
            sourceAttraction &&
            (attraction.title !== sourceAttraction.title ||
              attraction.address !== sourceAttraction.address)
          );
        });

        if (!hasLocalizedText) {
          return;
        }

        const localizedAttractionByKey = new Map(
          localizedAttractions.map((attraction) => [
            `${attraction.id}-${attraction.contentTypeId}`,
            attraction,
          ])
        );

        isUpdatingPlaceLabelsRef.current = true;
        queryClient.setQueryData<HomeAttractionQueryData>(
          attractionQueryKey,
          (currentData) => {
            if (!currentData || currentData.isLocalized) {
              isUpdatingPlaceLabelsRef.current = false;
              return currentData;
            }

            const currentAttractionByKey = new Map(
              currentData.allAttractions.map((attraction) => [
                `${attraction.id}-${attraction.contentTypeId}`,
                attraction,
              ])
            );
            const nextAttractions = localizedAttractions.map((attraction) => {
              const currentAttraction = currentAttractionByKey.get(
                `${attraction.id}-${attraction.contentTypeId}`
              );

              if (!currentAttraction) {
                return attraction;
              }

              return {
                ...attraction,
                firstImage:
                  currentAttraction.firstImage || attraction.firstImage,
                secondImage:
                  currentAttraction.secondImage || attraction.secondImage,
              };
            });

            return {
              ...currentData,
              allAttractions: nextAttractions,
              sourceAttractions,
              topAttractions: currentData.topAttractions.map((item) => ({
                ...item,
                attraction:
                  localizedAttractionByKey.get(
                    `${item.attraction.id}-${item.attraction.contentTypeId}`
                  ) ?? item.attraction,
              })),
              isLocalized: true,
            };
          }
        );
      })
      .catch((error) => {
        console.warn("홈 장소 영문 현지화에 실패해 원문을 유지합니다.", error);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    appLanguage,
    attractionQueryKey,
    attractionsQuery.data,
    attractionsQuery.isFetching,
    queryClient,
  ]);

  const festivalsQuery = useQuery({
    queryKey: ["gangwon-festivals", "90-days", appLanguage],
    enabled: Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      const festivals = await fetchGangwonFestivals(TOUR_API_SERVICE_KEY, {
        lookAheadDays: 90,
      }, "ko").catch(() => [] as GangwonAttraction[]);
      return localizeTourPlaces(festivals, appLanguage);
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const boundaryBySigunguCode = boundaryQuery.data ?? {};
  const isBoundaryDataReady = boundaryQuery.isSuccess || boundaryQuery.isError;
  const isAttractionLoading = attractionsQuery.isFetching;
  const attractionError = !TOUR_API_SERVICE_KEY
    ? text.home.missingTourKey
    : attractionsQuery.error instanceof Error
      ? attractionsQuery.error.message
      : null;
  const shouldShowAttractionLoader =
    Boolean(TOUR_API_SERVICE_KEY) &&
    !mapError &&
    !attractionsQuery.data &&
    (attractionLoadingStage !== "idle" ||
      !mapReady ||
      attractionsQuery.isFetching);
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
  const placeSearchFilters = useMemo(
    () =>
      PLACE_SEARCH_FILTERS.map((filter) => ({
        ...filter,
        label: text.search.filters[filter.key],
      })),
    [text]
  );

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

    const keyword = searchKeyword.trim();

    return attractionData.allAttractions
      .map((attraction) => {
        const markerType = resolveMarkerType(attraction, attractionData.lclsNameByCode);
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

        const matchesFilter = matchesPlaceFilter(attraction, markerType, searchFilter);

        return {
          attraction,
          markerType,
          rank,
          distanceM,
          distanceLabel: formatDistanceLabel(distanceM),
          thumbnailUrl: attraction.firstImage || attraction.secondImage,
          icon: getMarkerTypeIcon(markerType),
          touristTrendName: trendNameByAttractionId.get(attraction.id) ?? attraction.title,
          searchMatchPriority,
          matchesFilter,
        };
      })
      .filter(
        (item) => item.matchesFilter && item.searchMatchPriority !== null
      )
      .sort((a, b) => {
        if (a.searchMatchPriority !== b.searchMatchPriority) {
          return (
            (a.searchMatchPriority ?? Number.POSITIVE_INFINITY) -
            (b.searchMatchPriority ?? Number.POSITIVE_INFINITY)
          );
        }
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
    setRecentSearches((previous) =>
      writeRecentPlaceSearches([
        trimmedKeyword,
        ...previous.filter((item) => item !== trimmedKeyword),
      ])
    );
  };
  const removeRecentSearch = (keyword: string) => {
    setRecentSearches((previous) =>
      writeRecentPlaceSearches(
        previous.filter((item) => item !== keyword)
      )
    );
  };
  const clearRecentSearches = () => {
    setRecentSearches(writeRecentPlaceSearches([]));
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
        title: text.home.loadingMapTitle,
        description: text.home.loadingMapDescription,
        footerText: text.home.loadingFooter,
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
        title: text.home.loadingPlacesTitle,
        description: text.home.loadingPlacesDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (attractionLoadingStage === "ranking" || attractionsQuery.isFetching) {
      if (attractionLoadingStage === "localizing") {
        showLoading({
          title: text.home.loadingEnglishTitle,
          description: text.home.loadingEnglishDescription,
          footerText: text.home.loadingEnglishFooter,
          animation: "searching",
        });
        return;
      }

      showLoading({
        title: text.home.loadingRankingTitle,
        description: text.home.loadingRankingDescription,
        footerText: text.home.loadingFooter,
        animation: "ranking",
      });
      return;
    }

    showLoading({
      title: text.home.loadingMarkersTitle,
      description: text.home.loadingMarkersDescription,
      footerText: text.home.loadingFooter,
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
    text,
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
    let isMounted = true;

    getCurrentPosition()
      .then((position) => {
        if (!isMounted) {
          return;
        }

        setCurrentLocation({
          lat: position.lat,
          lng: position.lng,
        });
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setCurrentLocation(null);
      });

    return () => {
      isMounted = false;
    };
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
      setMapError(text.home.mapMissingKey);
      return;
    }

    let isDisposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;

    setMapReady(false);
    setMapError(null);
    container.innerHTML = "";

    window.navermap_authFailure = () => {
      setMapError(text.home.mapAuthError);
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapSdk(NCP_KEY_ID, appLanguage);

        if (isDisposed) {
          return;
        }

        const naverMaps = window.naver?.maps;

        if (!naverMaps) {
          setMapError(text.home.mapSdkMissing);
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
        if (!isDisposed) {
          setMapError(text.home.mapLoadError);
        }
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
  }, [appLanguage, closeSheet, text]);

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
    updateHasRenderedAttractionMarkers(false);
    clearMarkers();
  }, [
    closeSheet,
    mapReady,
    selectedSigunguCode,
    updateHasRenderedAttractionMarkers,
  ]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const attractionData = attractionsQuery.data;

    if (!mapReady || !mapInstance || !naverMaps || !attractionData) {
      return;
    }

    const isPlaceLabelUpdate =
      isUpdatingPlaceLabelsRef.current &&
      hasRenderedAttractionMarkersRef.current;

    if (!isPlaceLabelUpdate) {
      setAttractionLoadingStage("rendering-markers");
      updateHasRenderedAttractionMarkers(false);
    }
    clearMarkers();
    const markerBounds = new naverMaps.LatLngBounds();
    let visibleMarkerCount = 0;
    let isCancelled = false;
    let frameId: number | null = null;
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

    const completeMarkerRendering = () => {
      if (isCancelled || mapInstanceRef.current !== mapInstance) {
        return;
      }

      if (!isPlaceLabelUpdate) {
        fitMapToSelectedRegion({
          smooth: true,
          fallbackBounds: visibleMarkerCount > 0 ? markerBounds : null,
        });
      }
      updateHasRenderedAttractionMarkers(true);
      setAttractionLoadingStage("idle");
      isUpdatingPlaceLabelsRef.current = false;
    };

    let markerIndex = 0;
    const renderMarkerChunk = () => {
      if (isCancelled || mapInstanceRef.current !== mapInstance) {
        return;
      }

      const nextIndex = Math.min(
        markerIndex + MARKER_RENDER_CHUNK_SIZE,
        visibleAttractions.length
      );

      for (; markerIndex < nextIndex; markerIndex += 1) {
        const markerItem = visibleAttractions[markerIndex];

        if (!markerItem) {
          continue;
        }

        const { attraction, markerType } = markerItem;
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
                highlightLabel: text.home.today,
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
      }

      if (markerIndex < visibleAttractions.length) {
        frameId = window.requestAnimationFrame(renderMarkerChunk);
        return;
      }

      completeMarkerRendering();
    };

    renderMarkerChunk();

    return () => {
      isCancelled = true;
      if (isPlaceLabelUpdate) {
        isUpdatingPlaceLabelsRef.current = false;
      }

      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    attractionsQuery.data,
    mapReady,
    searchFilter,
    selectedSigunguCode,
    topRankByAttractionId,
    trendNameByAttractionId,
    updateHasRenderedAttractionMarkers,
    text,
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

      <HomeMapControls
        regions={orderedRegions}
        selectedSigunguCode={selectedSigunguCode}
        festivalCountBySigunguCode={festivalCountBySigunguCode}
        filters={placeSearchFilters}
        selectedFilter={searchFilter}
        savedPlaceCount={savedPlaceIds.length}
        isSavedPlaceCountLoading={isAttractionLoading}
        onOpenSearch={() => setIsSearchPopupOpen(true)}
        onOpenSavedList={() => {
          resetSheet();
          openSavedList();
        }}
        onSelectRegion={setSelectedSigunguCode}
        onSelectFilter={(filter) => {
          resetSheet();
          setSearchFilter(filter);
        }}
      />

      {appendTarget ? (
        <div className="pointer-events-auto absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)] z-30 rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-md backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
              D{appendTarget.nextDayIndex}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900">
                {text.home.appendDayTitle(appendTarget.routeTitle)}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {text.home.appendDayDescription}
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
                  {text.home.checkout}
                </button>
                <button
                  type="button"
                  onClick={clearAppendTarget}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500"
                >
                  {text.common.cancel}
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
        <PlaceSearchPopup
          searchInputRef={searchInputRef}
          filters={placeSearchFilters}
          searchKeyword={searchKeyword}
          searchFilter={searchFilter}
          searchResults={searchResults}
          visibleSearchResults={visibleSearchResults}
          recentSearches={recentSearches}
          onKeywordChange={setSearchKeyword}
          onSearchSubmit={appendRecentSearch}
          onSearchFilterChange={setSearchFilter}
          onClose={closeSearchPopup}
          onLoadMore={() =>
            setVisibleSearchResultCount(
              (count) => count + SEARCH_RESULTS_PAGE_SIZE
            )
          }
          onResultClick={(item) => {
            appendRecentSearch(searchKeyword);
            openPlaceSheetFromAttraction({
              attraction: item.attraction,
              markerType: item.markerType,
              touristTrendName: item.touristTrendName,
              rank: item.rank,
              mode: "full-popup",
            });
          }}
          onRecentSearchSelect={setSearchKeyword}
          onRecentSearchDelete={removeRecentSearch}
          onRecentSearchClear={clearRecentSearches}
        />
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
