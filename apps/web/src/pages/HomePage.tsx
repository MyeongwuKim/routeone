import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { routeApi } from "@/api/routeApi";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import HomeMapControls, {
  HomeMapControlsSkeleton,
} from "@/components/home/HomeMapControls";
import PlaceSearchPopup from "@/components/search/PlaceSearchPopup";
import { syncFestivalNotifications } from "@/features/home/festivalNotificationService";
import { useHomeAttractionData } from "@/features/home/useHomeAttractionData";
import { useHomeMap } from "@/features/home/useHomeMap";
import { MY_ROUTES_QUERY_KEY } from "@/features/my-route/myRouteCache";
import {
  DEFAULT_GANGWON_REGION,
  GANGWON_REGIONS,
  GANGWON_SIGNGU_ADMIN_CODES,
} from "@/data/gangwonRegions";
import { useUiText } from "@/lib/uiText";
import { getAuthToken } from "@/lib/authToken";
import {
  readRecentPlaceSearches,
  writeRecentPlaceSearches,
} from "@/lib/recentPlaceSearches";
import {
  calculateDistanceMeters,
  type CurrentLocation,
} from "@/lib/gangwonBoundaryUtils";
import {
  createMapSheetPlaceFromAttraction,
  formatDistanceLabel,
  getMarkerTypeIcon,
  getPlaceSearchMatchPriority,
  matchesPlaceFilter,
  resolveMarkerType,
  type OpenPlaceSheetFromAttractionOptions,
  type SearchFilter,
} from "@/lib/gangwonAttractionMap";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";
import {
  PLACE_SEARCH_FILTERS,
  SEARCH_RESULTS_PAGE_SIZE,
  TOUR_API_SERVICE_KEY,
} from "@/pages/HomePage.constants";

function HomePage() {
  const text = useUiText();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAuthToken = Boolean(getAuthToken());

  const openSheet = useMapSheetStore((state) => state.openSheet);
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
    DEFAULT_GANGWON_REGION.sigunguCode
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const searchResultScope = `${selectedSigunguCode}:${searchFilter}:${searchKeyword}`;
  const [visibleSearchState, setVisibleSearchState] = useState({
    scope: searchResultScope,
    count: SEARCH_RESULTS_PAGE_SIZE,
  });
  const visibleSearchResultCount =
    visibleSearchState.scope === searchResultScope
      ? visibleSearchState.count
      : SEARCH_RESULTS_PAGE_SIZE;
  const [recentSearches, setRecentSearches] = useState<string[]>(
    readRecentPlaceSearches
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const currentLocationRef = useRef<CurrentLocation | null>(null);
  const hasManuallySelectedRegionRef = useRef(false);
  const myRoutesQuery = useQuery({
    queryKey: MY_ROUTES_QUERY_KEY,
    queryFn: () => routeApi.myRoutes(),
    enabled: hasAuthToken,
    staleTime: 1000 * 60 * 5,
  });

  const {
    attractionData,
    attractionError,
    attractionLoadingStage,
    boundaryBySigunguCode,
    festivalCountBySigunguCode,
    festivals,
    isAttractionFetching,
    isAttractionLoading,
    isBoundaryDataReady,
    isFestivalDataReady,
    isUpdatingPlaceLabelsRef,
    setAttractionLoadingStage,
    topRankByAttractionId,
    trendNameByAttractionId,
  } = useHomeAttractionData(selectedSigunguCode);
  const handleSelectAttraction = useCallback(
    ({
      attraction,
      markerType,
      touristTrendName,
      rank,
      mode = "bottom-sheet",
    }: OpenPlaceSheetFromAttractionOptions) => {
      const currentLocationForOrigin = currentLocationRef.current;
      const selectedRegionForOrigin =
        GANGWON_REGIONS.find(
          (region) => region.sigunguCode === selectedSigunguCode
        ) ?? DEFAULT_GANGWON_REGION;
      const selectedRegionOriginLabel =
        text.labels.regions[selectedRegionForOrigin.label] ??
        selectedRegionForOrigin.label;

      openSheet(
        createMapSheetPlaceFromAttraction({
          attraction,
          markerType,
          signguCode: GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode] ?? "",
          touristTrendName,
          topRank: rank ?? null,
        }),
        {
          directionOrigin: currentLocationForOrigin
            ? {
                coordinates: currentLocationForOrigin,
                label: text.placeSheet.currentLocation,
                isCurrentLocation: true,
              }
            : {
                coordinates: selectedRegionForOrigin.center,
                label: text.placeSheet.referenceLocation(
                  selectedRegionOriginLabel
                ),
                isCurrentLocation: false,
              },
          mode,
        }
      );
    },
    [openSheet, selectedSigunguCode, text]
  );
  const {
    currentLocation,
    focusAttraction,
    mapError,
    mapReady,
    mapRef,
  } = useHomeMap({
    attractionData,
    boundaryBySigunguCode,
    isBoundaryDataReady,
    isUpdatingPlaceLabelsRef,
    onSelectAttraction: handleSelectAttraction,
    searchFilter,
    selectedSigunguCode,
    setAttractionLoadingStage,
    topRankByAttractionId,
    trendNameByAttractionId,
  });

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    if (!currentLocation || hasManuallySelectedRegionRef.current) {
      return;
    }

    const nearestRegion = GANGWON_REGIONS.reduce((nearest, region) => {
      const nearestDistance = calculateDistanceMeters(
        currentLocation,
        nearest.center
      );
      const regionDistance = calculateDistanceMeters(
        currentLocation,
        region.center
      );
      return regionDistance < nearestDistance ? region : nearest;
    }, GANGWON_REGIONS[0]);

    setSelectedSigunguCode((currentSigunguCode) =>
      currentSigunguCode === nearestRegion.sigunguCode
        ? currentSigunguCode
        : nearestRegion.sigunguCode
    );
  }, [currentLocation]);
  const openPlaceSheetFromAttraction = useCallback(
    (options: OpenPlaceSheetFromAttractionOptions) => {
      focusAttraction(options.attraction);
      handleSelectAttraction(options);
    },
    [focusAttraction, handleSelectAttraction]
  );
  const shouldShowAttractionLoader =
    Boolean(TOUR_API_SERVICE_KEY) &&
    mapReady &&
    !mapError &&
    !attractionData &&
    (attractionLoadingStage !== "idle" || isAttractionFetching);
  const shouldShowMapSetupSkeleton = !mapReady && !mapError;
  const shouldShowInteractiveMapUi = mapReady || Boolean(mapError);
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
  const regionLabelByCode = useMemo(
    () =>
      Object.fromEntries(
        GANGWON_REGIONS.map((region) => [
          region.sigunguCode,
          text.labels.regions[region.label] ?? region.label,
        ])
      ),
    [text]
  );
  const selectedRegion =
    GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
    DEFAULT_GANGWON_REGION;
  const selectedRegionLabel =
    text.labels.regions[selectedRegion.label] ?? selectedRegion.label;
  const routeStartLocation = currentLocation;
  const selectedRegionDirectionOrigin = currentLocation
    ? {
        coordinates: currentLocation,
        label: text.placeSheet.currentLocation,
        isCurrentLocation: true,
      }
    : {
        coordinates: selectedRegion.center,
        label: text.placeSheet.referenceLocation(selectedRegionLabel),
        isCurrentLocation: false,
      };
  const placeSearchFilters = useMemo(
    () =>
      PLACE_SEARCH_FILTERS.map((filter) => ({
        ...filter,
        label: text.search.filters[filter.key],
      })),
    [text]
  );

  useEffect(() => {
    const festivalRegionCode = searchParams.get("festivalRegion");

    if (!festivalRegionCode) {
      return;
    }

    const festivalRegion = GANGWON_REGIONS.find(
      (region) => region.sigunguCode === festivalRegionCode
    );

    if (!festivalRegion) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("festivalRegion");
    nextSearchParams.delete("festivalDate");
    nextSearchParams.delete("source");
    const frameId = requestAnimationFrame(() => {
      hasManuallySelectedRegionRef.current = true;
      setSelectedSigunguCode(festivalRegion.sigunguCode);
      setSearchFilter("festival");
      setSearchKeyword(
        text.labels.regions[festivalRegion.label] ?? festivalRegion.label
      );
      setIsSearchPopupOpen(true);
      setSearchParams(nextSearchParams, { replace: true });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [searchParams, setSearchParams, text]);

  useEffect(() => {
    const isRouteDataReady = !hasAuthToken || myRoutesQuery.isSuccess;

    if (!isFestivalDataReady || !isRouteDataReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void syncFestivalNotifications({
        currentRegionCode: currentLocation
          ? (orderedRegions[0]?.sigunguCode ?? null)
          : null,
        festivals,
        regionLabelByCode,
        routes: myRoutesQuery.data?.myRoutes ?? [],
      });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    currentLocation,
    festivals,
    hasAuthToken,
    isFestivalDataReady,
    myRoutesQuery.data,
    myRoutesQuery.isSuccess,
    orderedRegions,
    regionLabelByCode,
  ]);

  const searchResults = useMemo(() => {
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
    attractionData,
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
    attractionData,
    selectedSigunguCode,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

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

    if (
      attractionLoadingStage === "fetching-places" ||
      (attractionLoadingStage === "idle" &&
        isAttractionFetching &&
        !attractionData)
    ) {
      showLoading({
        title: text.home.loadingPlacesTitle,
        description: text.home.loadingPlacesDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (attractionLoadingStage === "ranking" || isAttractionFetching) {
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
    attractionData,
    isAttractionFetching,
    hideLoading,
    isSearchPopupOpen,
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

  return (
    <section className="relative h-full overflow-hidden bg-brand-50">
      <div
        ref={mapRef}
        className="naver-map-root h-full w-full"
        style={{ background: "#dbeafe" }}
      />

      {shouldShowMapSetupSkeleton ? <HomeMapControlsSkeleton /> : null}

      {shouldShowInteractiveMapUi ? (
        <HomeMapControls
          regions={orderedRegions}
          selectedSigunguCode={selectedSigunguCode}
          selectedRegionLabel={selectedRegionLabel}
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
          onSelectRegion={(sigunguCode) => {
            hasManuallySelectedRegionRef.current = true;
            setSelectedSigunguCode(sigunguCode);
          }}
          onSelectFilter={(filter) => {
            resetSheet();
            setSearchFilter(filter);
          }}
        />
      ) : null}

      {appendTarget && shouldShowInteractiveMapUi ? (
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
          openSheet(place, {
            directionOrigin: selectedRegionDirectionOrigin,
            mode: "full-popup",
          });
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
          regionLabel={selectedRegionLabel}
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
          onLoadMore={() => {
            setVisibleSearchState((currentState) => ({
              scope: searchResultScope,
              count:
                currentState.scope === searchResultScope
                  ? currentState.count + SEARCH_RESULTS_PAGE_SIZE
                  : SEARCH_RESULTS_PAGE_SIZE * 2,
            }));
          }}
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
