import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLoadingSkeleton from "@/components/map/MapLoadingSkeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  NOTIFICATION_INBOX_PAGE_SIZE,
} from "@/api/notificationApi";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import HomeMapControls, {
  HomeMapControlsSkeleton,
} from "@/components/home/HomeMapControls";
import PlaceSearchPopup from "@/components/search/PlaceSearchPopup";
import {
  isReliableHomeRegionPosition,
  resolveHomeRegionFromPosition,
} from "@/features/home/homeCurrentRegion";
import { resolveHomeLoadingPhase } from "@/features/home/homeLoadingPhase";
import { useHomeAttractionData } from "@/features/home/useHomeAttractionData";
import { useHomeMap } from "@/features/home/useHomeMap";
import {
  useHomeSearch,
  useHomeSearchResults,
} from "@/features/home/useHomeSearch";
import { useTestRegionLocation } from "@/features/home/useTestRegionLocation";
import { useUiText } from "@/lib/uiText";
import { getAuthToken } from "@/lib/authToken";
import type { CurrentLocation } from "@/lib/gangwonBoundaryUtils";
import {
  createMapSheetPlaceFromAttraction,
  resolveMarkerType,
  type OpenPlaceSheetFromAttractionOptions,
} from "@/lib/gangwonAttractionMap";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import {
  isTestServiceAreaEnabled,
  useEffectiveServiceArea,
} from "@/stores/serviceAreaStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";

function HomePage() {
  const text = useUiText();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAuthToken = Boolean(getAuthToken());
  const serviceArea = useEffectiveServiceArea();
  const canSelectServiceArea = isTestServiceAreaEnabled();
  const developmentFixedRegion = canSelectServiceArea
    ? serviceArea.developmentFixedRegion
    : undefined;

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
  const showToast = useUiToastStore((state) => state.showToast);
  const {
    applyRegionPosition,
    clearRegionPosition,
    isEnabled: isTestRegionLocationEnabled,
  } = useTestRegionLocation();
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );

  const selectedSigunguCode = useHomeExploreStore(
    (state) => state.selectedSigunguCode
  );
  const isInitialRegionResolved = useHomeExploreStore(
    (state) => state.isInitialRegionResolved
  );
  const resolveInitialRegion = useHomeExploreStore(
    (state) => state.resolveInitialRegion
  );
  const selectRegion = useHomeExploreStore((state) => state.selectRegion);
  const {
    actions: {
      appendRecentSearch,
      clearRecentSearches,
      closeSearchPopup,
      loadMore,
      openSearchPopup,
      removeRecentSearch,
      setSearchFilter,
      setSearchKeyword,
    },
    isSearchPopupOpen,
    placeSearchFilters,
    recentSearches,
    searchFilter,
    searchInputRef,
    searchKeyword,
    visibleSearchResultCount,
  } = useHomeSearch({
    hasFestivalSource: serviceArea.hasFestivalSource,
    selectedSigunguCode,
    serviceAreaId: serviceArea.id,
  });
  const [canLoadHomeAttractions, setCanLoadHomeAttractions] =
    useState(false);
  const [pendingCurrentLocationFocus, setPendingCurrentLocationFocus] =
    useState<{
      position: CurrentLocation;
      sigunguCode: string;
    } | null>(null);
  const currentLocationRef = useRef<CurrentLocation | null>(null);
  const isCurrentLocationLookupPendingRef = useRef(true);
  const notificationInboxQuery = useQuery({
    queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
    queryFn: () =>
      notificationApi.inbox({
        first: NOTIFICATION_INBOX_PAGE_SIZE,
        after: null,
      }),
    enabled: hasAuthToken,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const unreadNotificationCount =
    notificationInboxQuery.data?.unreadNotificationCount ?? 0;
  const {
    attractionData,
    attractionError,
    attractionLoadingPhase,
    boundaryBySigunguCode,
    festivalCountBySigunguCode,
    isAttractionFetching,
    isAttractionLoading,
    isBoundaryDataReady,
    isUpdatingPlaceLabelsRef,
    topRankByAttractionId,
    trendNameByAttractionId,
  } = useHomeAttractionData(selectedSigunguCode, serviceArea, {
    enabled: canLoadHomeAttractions,
  });
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
        serviceArea.regions.find(
          (region) => region.sigunguCode === selectedSigunguCode
        ) ?? serviceArea.defaultRegion;
      const selectedRegionOriginLabel =
        text.labels.regions[selectedRegionForOrigin.label] ??
        selectedRegionForOrigin.label;

      openSheet(
        createMapSheetPlaceFromAttraction({
          attraction,
          markerType,
          areaCode: serviceArea.tatsAreaCode,
          signguCode: selectedRegionForOrigin.adminCode,
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
            : isCurrentLocationLookupPendingRef.current
              ? undefined
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
    [openSheet, selectedSigunguCode, serviceArea, text]
  );
  const {
    currentLocation,
    focusAttraction,
    focusLocation,
    isCurrentLocationLookupPending,
    isRenderingMarkers,
    mapError,
    mapReady,
    mapRef,
    refreshCurrentLocation,
  } = useHomeMap({
    attractionData,
    boundaryBySigunguCode,
    isBoundaryDataReady,
    isUpdatingPlaceLabelsRef,
    onSelectAttraction: handleSelectAttraction,
    searchFilter,
    mapCenter: serviceArea.center,
    regions: serviceArea.regions,
    selectedSigunguCode,
    topRankByAttractionId,
    trendNameByAttractionId,
  });
  const { searchResults, visibleSearchResults } =
    useHomeSearchResults({
      attractionData,
      currentLocation,
      searchFilter,
      searchKeyword,
      topRankByAttractionId,
      trendNameByAttractionId,
      visibleSearchResultCount,
    });

  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    isCurrentLocationLookupPendingRef.current =
      isCurrentLocationLookupPending;
  }, [isCurrentLocationLookupPending]);

  useEffect(() => {
    if (
      (!developmentFixedRegion &&
        (isCurrentLocationLookupPending || !isBoundaryDataReady)) ||
      isInitialRegionResolved
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const initialRegion =
        developmentFixedRegion ??
        (currentLocation
          ? resolveHomeRegionFromPosition(
              currentLocation,
              serviceArea,
              boundaryBySigunguCode
            ) ?? serviceArea.defaultRegion
          : serviceArea.defaultRegion);
      if (!initialRegion) {
        return;
      }
      resolveInitialRegion(initialRegion.sigunguCode);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    currentLocation,
    developmentFixedRegion,
    boundaryBySigunguCode,
    isBoundaryDataReady,
    isCurrentLocationLookupPending,
    isInitialRegionResolved,
    resolveInitialRegion,
    serviceArea,
  ]);

  useEffect(() => {
    if (
      canLoadHomeAttractions ||
      !isInitialRegionResolved ||
      (!mapReady && !mapError)
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setCanLoadHomeAttractions(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    canLoadHomeAttractions,
    isInitialRegionResolved,
    mapError,
    mapReady,
  ]);
  const openPlaceSheetFromAttraction = useCallback(
    (options: OpenPlaceSheetFromAttractionOptions) => {
      focusAttraction(options.attraction);
      handleSelectAttraction(options);
    },
    [focusAttraction, handleSelectAttraction]
  );
  const canShowAttractionLoading =
    Boolean(TOUR_API_SERVICE_KEY) &&
    canLoadHomeAttractions &&
    mapReady &&
    !mapError;
  const shouldShowInitialRegionLoader =
    !developmentFixedRegion &&
    !isInitialRegionResolved &&
    !mapError;
  const shouldShowMapSetupSkeleton = !isInitialRegionResolved;
  const shouldShowInteractiveMapUi = isInitialRegionResolved;
  const homeLoadingPhase = resolveHomeLoadingPhase({
    attractionLoadingPhase,
    canShowAttractionLoading,
    hasAttractionData: Boolean(attractionData),
    isAttractionFetching,
    isInitialRegionLoading: shouldShowInitialRegionLoader,
    isRenderingMarkers,
    isSearchPopupOpen,
  });
  const orderedRegions = useMemo(
    () =>
      [...serviceArea.regions].sort((left, right) =>
        left.label.localeCompare(right.label, "ko-KR")
      ),
    [serviceArea.regions]
  );
  const selectedRegion =
    serviceArea.regions.find(
      (region) => region.sigunguCode === selectedSigunguCode
    ) ?? serviceArea.defaultRegion;
  const selectedRegionLabel =
    text.labels.regions[selectedRegion.label] ?? selectedRegion.label;
  const handleSelectRegion = useCallback(
    (sigunguCode: string) => {
      selectRegion(sigunguCode);

      const region = serviceArea.regions.find(
        (candidate) => candidate.sigunguCode === sigunguCode
      );
      if (!region || !isTestRegionLocationEnabled) {
        return;
      }

      const regionLabel = text.labels.regions[region.label] ?? region.label;

      void applyRegionPosition(region)
        .then((didApply) => {
          if (didApply) {
            showToast(text.home.testLocationApplied(regionLabel));
          }
        })
        .catch(() => {
          showToast(text.home.testLocationFailed);
        });
    },
    [
      applyRegionPosition,
      isTestRegionLocationEnabled,
      selectRegion,
      serviceArea.regions,
      showToast,
      text,
    ]
  );
  const handleFocusCurrentLocation = useCallback(() => {
    const focus = async () => {
      let didClearTestLocation = false;

      if (isTestRegionLocationEnabled) {
        try {
          didClearTestLocation = await clearRegionPosition();
        } catch {
          showToast(text.home.testLocationFailed);
          return;
        }
      }

      const nextLocation = await refreshCurrentLocation({
        forceRefresh: true,
      });
      if (!nextLocation) {
        showToast(text.home.currentLocationUnavailable);
        return;
      }

      if (!isReliableHomeRegionPosition(nextLocation)) {
        showToast(
          text.home.currentLocationAccuracyLow(
            nextLocation.accuracyMeters
          ),
          3200
        );
        return;
      }

      const nextRegion = resolveHomeRegionFromPosition(
        nextLocation,
        serviceArea,
        boundaryBySigunguCode
      );
      if (!nextRegion) {
        showToast(text.home.currentLocationUnavailable);
        return;
      }

      setPendingCurrentLocationFocus({
        position: nextLocation,
        sigunguCode: nextRegion.sigunguCode,
      });
      selectRegion(nextRegion.sigunguCode);

      if (didClearTestLocation) {
        showToast(text.home.testLocationRestored);
      }
    };

    void focus();
  }, [
    boundaryBySigunguCode,
    clearRegionPosition,
    isTestRegionLocationEnabled,
    refreshCurrentLocation,
    selectRegion,
    serviceArea,
    showToast,
    text,
  ]);
  useEffect(() => {
    if (
      !mapReady ||
      !pendingCurrentLocationFocus ||
      pendingCurrentLocationFocus.sigunguCode !== selectedSigunguCode
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      focusLocation(pendingCurrentLocationFocus.position);
      setPendingCurrentLocationFocus(null);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    focusLocation,
    mapReady,
    pendingCurrentLocationFocus,
    selectedSigunguCode,
  ]);
  const routeStartLocation = currentLocation
    ? {
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      }
    : null;
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
  useEffect(() => {
    const festivalRegionCode = searchParams.get("festivalRegion");
    const festivalTitle = searchParams.get("festivalTitle")?.trim() ?? "";

    if (!festivalRegionCode) {
      return;
    }

    if (!serviceArea.hasFestivalSource) {
      return;
    }

    const festivalRegion = serviceArea.regions.find(
      (region) => region.sigunguCode === festivalRegionCode
    );

    if (!festivalRegion) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("festivalRegion");
    nextSearchParams.delete("festivalDate");
    nextSearchParams.delete("festivalTitle");
    nextSearchParams.delete("source");
    const frameId = requestAnimationFrame(() => {
      selectRegion(festivalRegion.sigunguCode);
      openSearchPopup({
        filter: "festival",
        keyword:
          festivalTitle ||
          text.labels.regions[festivalRegion.label] ||
          festivalRegion.label,
      });
      setSearchParams(nextSearchParams, { replace: true });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    openSearchPopup,
    searchParams,
    selectRegion,
    setSearchParams,
    serviceArea,
    text,
  ]);
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
          areaCode: serviceArea.tatsAreaCode,
          signguCode: selectedRegion.adminCode,
          touristTrendName:
            trendNameByAttractionId.get(attraction.id) ?? attraction.title,
          topRank: rank,
        });
      })
      .slice(0, 160);
  }, [
    attractionData,
    selectedRegion.adminCode,
    serviceArea.tatsAreaCode,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  useEffect(() => {
    if (homeLoadingPhase === "location") {
      showLoading({
        title: text.home.loadingLocationTitle,
        description: text.home.loadingLocationDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (homeLoadingPhase === "places") {
      showLoading({
        title: text.home.loadingPlacesTitle,
        description: text.home.loadingPlacesDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (homeLoadingPhase === "ranking") {
      showLoading({
        title: text.home.loadingRankingTitle,
        description: text.home.loadingRankingDescription,
        footerText: text.home.loadingFooter,
        animation: "ranking",
      });
      return;
    }

    if (homeLoadingPhase !== "markers") {
      hideLoading();
      return;
    }

    showLoading({
      title: text.home.loadingMarkersTitle,
      description: text.home.loadingMarkersDescription,
      footerText: text.home.loadingFooter,
      animation: "map-rendering",
    });
  }, [homeLoadingPhase, hideLoading, showLoading, text]);

  useEffect(() => {
    return () => {
      hideLoading();
    };
  }, [hideLoading]);

  return (
    <section className="relative h-full overflow-hidden bg-brand-50">
      <div
        ref={mapRef}
        className="naver-map-root h-full w-full"
        style={{ background: "#dbeafe" }}
      />

      {!mapReady && !mapError ? (
        <MapLoadingSkeleton label={text.dayRoute.mapPreparing} />
      ) : null}
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
          unreadNotificationCount={unreadNotificationCount}
          isSavedPlaceCountLoading={isAttractionLoading}
          isCurrentLocationLookupPending={isCurrentLocationLookupPending}
          isMapReady={mapReady}
          onOpenNotifications={() => navigate("/notifications")}
          onOpenSearch={() => openSearchPopup()}
          onOpenSavedList={() => {
            resetSheet();
            openSavedList();
          }}
          onFocusCurrentLocation={handleFocusCurrentLocation}
          onSelectRegion={handleSelectRegion}
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
                {text.home.appendDayTitle(
                  appendTarget.routeTitle,
                  appendTarget.nextDayIndex
                )}
              </p>
              <p className="mt-0.5 text-xs font-semibold text-slate-500">
                {text.home.appendDayDescription(
                  appendTarget.nextDayIndex
                )}
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
            directionOrigin: isCurrentLocationLookupPending
              ? undefined
              : selectedRegionDirectionOrigin,
            mode: "full-popup",
          });
        }}
        onRemovePlace={removeSavedPlace}
        onClearPlaces={clearSavedPlaces}
        onRequestSearchPlace={() => openSearchPopup()}
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
          onLoadMore={loadMore}
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
