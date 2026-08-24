import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MdCelebration } from "react-icons/md";
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
import { useHomeAttractionData } from "@/features/home/useHomeAttractionData";
import { useHomeMap } from "@/features/home/useHomeMap";
import type { ServiceRegion } from "@/data/serviceAreas";
import { useUiText } from "@/lib/uiText";
import { getAuthToken } from "@/lib/authToken";
import {
  readRecentPlaceSearches,
  writeRecentPlaceSearches,
} from "@/lib/recentPlaceSearches";
import {
  calculateDistanceMeters,
  findRegionContainingLocation,
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
} from "@/lib/gangwonAttractionMap";
import { nativeBridge } from "@/native-bridge";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import {
  isDevelopmentServiceAreaEnabled,
  useEffectiveServiceArea,
} from "@/stores/serviceAreaStore";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  PLACE_SEARCH_FILTERS,
  SEARCH_RESULTS_PAGE_SIZE,
  TOUR_API_SERVICE_KEY,
} from "@/pages/HomePage.constants";

function getNearestServiceRegion(
  currentLocation: CurrentLocation,
  regions: readonly ServiceRegion[]
) {
  const [firstRegion, ...remainingRegions] = regions;
  if (!firstRegion) {
    return null;
  }

  return remainingRegions.reduce((nearest, region) => {
    const nearestDistance = calculateDistanceMeters(
      currentLocation,
      nearest.center
    );
    const regionDistance = calculateDistanceMeters(
      currentLocation,
      region.center
    );

    return regionDistance < nearestDistance ? region : nearest;
  }, firstRegion);
}

function HomePage() {
  const text = useUiText();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hasAuthToken = Boolean(getAuthToken());
  const serviceArea = useEffectiveServiceArea();
  const isDevelopmentRuntime = isDevelopmentServiceAreaEnabled();
  const canSelectServiceArea = isDevelopmentRuntime;
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
  const searchKeyword = useHomeExploreStore((state) => state.searchKeyword);
  const searchFilter = useHomeExploreStore((state) => state.searchFilter);
  const visibleSearchState = useHomeExploreStore(
    (state) => state.visibleSearchState
  );
  const resolveInitialRegion = useHomeExploreStore(
    (state) => state.resolveInitialRegion
  );
  const selectRegion = useHomeExploreStore((state) => state.selectRegion);
  const setSearchKeyword = useHomeExploreStore(
    (state) => state.setSearchKeyword
  );
  const setSearchFilter = useHomeExploreStore(
    (state) => state.setSearchFilter
  );
  const resetSearch = useHomeExploreStore((state) => state.resetSearch);
  const loadMoreSearchResults = useHomeExploreStore(
    (state) => state.loadMoreSearchResults
  );
  const [canLoadHomeAttractions, setCanLoadHomeAttractions] =
    useState(false);
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const searchResultScope = `${serviceArea.id}:${selectedSigunguCode}:${searchFilter}:${searchKeyword}`;
  const visibleSearchResultCount =
    visibleSearchState?.scope === searchResultScope
      ? visibleSearchState.count
      : SEARCH_RESULTS_PAGE_SIZE;
  const [recentSearches, setRecentSearches] = useState<string[]>(
    readRecentPlaceSearches
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
  const registerNativePushDevice = useCallback(async () => {
    if (!nativeBridge.runtime.isAvailable()) {
      return;
    }

    const pushToken =
      await nativeBridge.notifications.getPushToken(true);

    if (!pushToken?.expoPushToken) {
      if (pushToken?.permissionStatus === "denied") {
        nativeBridge.permissions.openSettings();
        throw new Error(text.home.festivalTestPermissionDenied);
      }

      if (pushToken?.reason === "missing-project-id") {
        throw new Error(text.home.festivalTestProjectUnavailable);
      }

      throw new Error(text.home.festivalTestDeviceUnavailable);
    }

    if (
      pushToken.platform !== "ios" &&
      pushToken.platform !== "android"
    ) {
      throw new Error(text.home.festivalTestDeviceUnavailable);
    }

    const result = await notificationApi.registerPushDevice({
      expoPushToken: pushToken.expoPushToken,
      platform: pushToken.platform === "ios" ? "IOS" : "ANDROID",
      appVariant: pushToken.appVariant,
    });

    return result.registerPushDevice.id;
  }, [
    text.home.festivalTestDeviceUnavailable,
    text.home.festivalTestPermissionDenied,
    text.home.festivalTestProjectUnavailable,
  ]);
  const testNotificationMutation = useMutation({
    mutationFn: async () => {
      if (!isDevelopmentRuntime) {
        throw new Error("Festival test notifications are disabled in prod.");
      }

      await registerNativePushDevice();

      const result = await notificationApi.sendFestivalTest();

      return result.sendFestivalTestNotification;
    },
    onSuccess: (delivery) => {
      if (delivery.pushStatus === "SENT") {
        showToast(text.home.festivalTestSent);
      } else {
        const pushError = delivery.pushError ?? "";

        showToast(text.home.festivalTestFailed(pushError), 3200);
      }

      void notificationInboxQuery.refetch();
    },
    onError: (error) => {
      const reason = error instanceof Error ? error.message : "";

      showToast(text.home.festivalTestFailed(reason), 3200);
    },
  });

  const {
    attractionData,
    attractionError,
    attractionLoadingStage,
    boundaryBySigunguCode,
    festivalCountBySigunguCode,
    isAttractionFetching,
    isAttractionLoading,
    isBoundaryDataReady,
    isUpdatingPlaceLabelsRef,
    setAttractionLoadingStage,
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
    focusCurrentLocation,
    isCurrentLocationLookupPending,
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
    mapCenter: serviceArea.center,
    regions: serviceArea.regions,
    selectedSigunguCode,
    setAttractionLoadingStage,
    topRankByAttractionId,
    trendNameByAttractionId,
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
          ? findRegionContainingLocation(
              currentLocation,
              serviceArea.regions,
              boundaryBySigunguCode
            ) ?? getNearestServiceRegion(currentLocation, serviceArea.regions)
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
  const shouldShowAttractionLoader =
    Boolean(TOUR_API_SERVICE_KEY) &&
    canLoadHomeAttractions &&
    mapReady &&
    !mapError &&
    (attractionLoadingStage !== "idle" || isAttractionFetching);
  const shouldShowInitialRegionLoader =
    !developmentFixedRegion &&
    !isInitialRegionResolved &&
    !mapError;
  const shouldShowMapSetupSkeleton = !isInitialRegionResolved;
  const shouldShowInteractiveMapUi = isInitialRegionResolved;
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
  const placeSearchFilters = useMemo(
    () =>
      PLACE_SEARCH_FILTERS.filter(
        (filter) =>
          serviceArea.hasFestivalSource || filter.key !== "festival"
      ).map((filter) => ({
          ...filter,
          label: text.search.filters[filter.key],
        })),
    [serviceArea.hasFestivalSource, text]
  );

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
      setSearchFilter("festival");
      setSearchKeyword(
        festivalTitle ||
          text.labels.regions[festivalRegion.label] ||
          festivalRegion.label
      );
      setIsSearchPopupOpen(true);
      setSearchParams(nextSearchParams, { replace: true });
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [
    searchParams,
    selectRegion,
    setSearchFilter,
    setSearchKeyword,
    setSearchParams,
    serviceArea,
    text,
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
    resetSearch();
  }, [resetSearch]);

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
    if (isSearchPopupOpen) {
      hideLoading();
      return;
    }

    if (shouldShowInitialRegionLoader) {
      showLoading({
        title: text.home.loadingLocationTitle,
        description: text.home.loadingLocationDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (!shouldShowAttractionLoader) {
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
    shouldShowInitialRegionLoader,
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
          unreadNotificationCount={unreadNotificationCount}
          isSavedPlaceCountLoading={isAttractionLoading}
          isCurrentLocationLookupPending={isCurrentLocationLookupPending}
          isMapReady={mapReady}
          onOpenNotifications={() => navigate("/notifications")}
          onOpenSearch={() => setIsSearchPopupOpen(true)}
          onOpenSavedList={() => {
            resetSheet();
            openSavedList();
          }}
          onFocusCurrentLocation={() => {
            void focusCurrentLocation().then((didFocus) => {
              if (!didFocus) {
                showToast(text.home.currentLocationUnavailable);
              }
            });
          }}
          onSelectRegion={selectRegion}
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
            loadMoreSearchResults(
              searchResultScope,
              SEARCH_RESULTS_PAGE_SIZE
            );
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

      {isDevelopmentRuntime &&
      shouldShowInteractiveMapUi &&
      hasAuthToken &&
      serviceArea.hasFestivalSource ? (
        <div className="pointer-events-none absolute bottom-20 right-4 z-30 flex flex-col items-end gap-2">
          <button
            type="button"
            aria-label={text.home.festivalTestSendAria}
            disabled={testNotificationMutation.isPending}
            onClick={() => testNotificationMutation.mutate()}
            className="pointer-events-auto inline-flex h-12 items-center gap-2 rounded-full border border-white/80 bg-rose-500 px-4 text-sm font-black text-white shadow-[0_12px_28px_rgba(244,63,94,0.35)] transition hover:bg-rose-600 active:scale-[0.98] disabled:cursor-wait disabled:bg-rose-300"
          >
            <MdCelebration aria-hidden="true" className="text-lg" />
            <span>
              {testNotificationMutation.isPending
                ? text.home.festivalTestSending
                : text.home.festivalTestSend}
            </span>
          </button>
        </div>
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
