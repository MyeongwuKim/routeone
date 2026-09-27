/**
 * 진입 경로: 하단 홈 탭
 *
 * 서비스 지역과 시·군·구, 장소 종류, 검색어를 기준으로 관광지를 조회해 지도와 검색 결과에 표시한다.
 * 마커나 검색 결과를 선택하면 장소 상세 시트를 열고 여행 장소 담기와 길찾기로 연결한다.
 *
 * 현재 위치·선택 지역·검색 조건은 전역 Store에서 읽고, 장소 조회와 검색 결과 계산은 전용 Hook에 맡긴다.
 * 이 화면은 위치 권한 안내, 검색 팝업, 지도 오버레이와 장소 상세 시트의 열림·선택 흐름을 연결한다.
 */
import { useCallback, useMemo } from "react";
import MapLoadingSkeleton from "@/components/map/MapLoadingSkeleton";
import LocationPermissionNotice from "@/components/map/LocationPermissionNotice";
import { useLocationPermissionDenied } from "@/native-bridge/useLocationPermissionDenied";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
  NOTIFICATION_INBOX_PAGE_SIZE,
} from "@/api/notificationApi";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import HomeMapControls, {
  HomeMapControlsSkeleton,
} from "@/components/home/HomeMapControls";
import HomeAppendDayBanner from "@/components/home/HomeAppendDayBanner";
import PlaceSearchPopup from "@/components/search/PlaceSearchPopup";
import {
  resolveHomeLoadingPhase,
} from "@/features/home/homeLoadingPhase";
import { useHomeAttractionData } from "@/features/home/useHomeAttractionData";
import { useHomeFestivalSearchNavigation } from "@/features/home/useHomeFestivalSearchNavigation";
import { useHomeLoadingOverlay } from "@/features/home/useHomeLoadingOverlay";
import { useHomeMap } from "@/features/home/useHomeMap";
import { useHomeRegionController } from "@/features/home/useHomeRegionController";
import {
  useHomeSearch,
  useHomeSearchResults,
} from "@/features/home/useHomeSearch";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useLoginRequest } from "@/hooks/useLoginRequest";
import { useUiText } from "@/lib/uiText";
import {
  createMapSheetPlaceFromAttraction,
  resolveMarkerType,
  type OpenPlaceSheetFromAttractionOptions,
} from "@/lib/gangwonAttractionMap";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";

function HomePage() {
  const isLocationPermissionDenied = useLocationPermissionDenied();
  const text = useUiText();
  const navigate = useNavigate();
  const requestLogin = useLoginRequest();
  const { isAuthenticated } = useAuthSession();
  const serviceArea = useEffectiveServiceArea();

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
  const selectRegion = useHomeExploreStore((state) => state.selectRegion);
  const {
    actions: {
      closeSearchPopup,
      loadMore,
      openSearchPopup,
      setSearchFilter,
      setSearchKeyword,
    },
    isSearchPopupOpen,
    placeSearchFilters,
    searchFilter,
    searchInputRef,
    searchKeyword,
    visibleSearchResultCount,
  } = useHomeSearch({
    hasFestivalSource: serviceArea.hasFestivalSource,
    serviceAreaId: serviceArea.id,
  });
  useHomeFestivalSearchNavigation({
    openSearchPopup,
  });
  const notificationInboxQuery = useQuery({
    queryKey: NOTIFICATION_INBOX_FIRST_PAGE_QUERY_KEY,
    queryFn: () =>
      notificationApi.inbox({
        first: NOTIFICATION_INBOX_PAGE_SIZE,
        after: null,
      }),
    enabled: isAuthenticated,
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
    enabled: isInitialRegionResolved,
  });
  const handleSelectAttraction = useCallback(
    ({
      attraction,
      markerType,
      touristTrendName,
      rank,
      mode = "bottom-sheet",
    }: OpenPlaceSheetFromAttractionOptions) => {
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
          fallbackDirectionOrigin: {
            coordinates: selectedRegionForOrigin.center,
            label: text.placeSheet.referenceLocation(selectedRegionOriginLabel),
            isCurrentLocation: false,
          },
          mode,
        }
      );
    },
    [
      openSheet,
      selectedSigunguCode,
      serviceArea,
      text,
    ]
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
  const {
    focusCurrentLocation,
    orderedRegions,
    selectedRegion,
    selectedRegionLabel,
    shouldShowInitialRegionLoader,
    shouldShowInteractiveMapUi,
    shouldShowMapSetupSkeleton,
  } = useHomeRegionController({
    boundaryBySigunguCode,
    currentLocation,
    focusLocation,
    isBoundaryDataReady,
    isCurrentLocationLookupPending,
    mapError,
    mapReady,
    refreshCurrentLocation,
    selectedSigunguCode,
    serviceArea,
  });
  const openPlaceSheetFromAttraction = useCallback(
    (options: OpenPlaceSheetFromAttractionOptions) => {
      focusAttraction(options.attraction);
      handleSelectAttraction(options);
    },
    [focusAttraction, handleSelectAttraction]
  );
  const canShowAttractionLoading =
    Boolean(TOUR_API_SERVICE_KEY) &&
    isInitialRegionResolved &&
    mapReady &&
    !mapError;
  const homeLoadingPhase = resolveHomeLoadingPhase({
    attractionLoadingPhase,
    canShowAttractionLoading,
    hasAttractionData: Boolean(attractionData),
    isAttractionFetching,
    isInitialRegionLoading: shouldShowInitialRegionLoader,
    isRenderingMarkers,
    isSearchPopupOpen,
  });
  const homeOriginLocation = currentLocation;
  const routeStartLocation = homeOriginLocation
    ? {
        lat: homeOriginLocation.lat,
        lng: homeOriginLocation.lng,
      }
    : null;
  const selectedRegionDirectionOrigin = {
    coordinates: selectedRegion.center,
    label: text.placeSheet.referenceLocation(selectedRegionLabel),
    isCurrentLocation: false,
  };
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
  useHomeLoadingOverlay(homeLoadingPhase);

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

      {isLocationPermissionDenied ? (
        <div className="absolute inset-x-3 bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4rem)] z-20 mx-auto max-w-sm">
          <LocationPermissionNotice text={text} />
        </div>
      ) : null}

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
          isAuthenticated={isAuthenticated}
          onOpenNotifications={() => navigate("/notifications")}
          onRequestLogin={() => requestLogin("home-header")}
          onOpenSearch={() => openSearchPopup()}
          onOpenSavedList={() => {
            resetSheet();
            openSavedList();
          }}
          onFocusCurrentLocation={focusCurrentLocation}
          onSelectRegion={selectRegion}
          onSelectFilter={(filter) => {
            resetSheet();
            setSearchFilter(filter);
          }}
        />
      ) : null}

      {appendTarget && shouldShowInteractiveMapUi ? (
        <HomeAppendDayBanner
          appendTarget={appendTarget}
          onCancel={clearAppendTarget}
          onOpenCheckout={() => {
            resetSheet();
            openSavedList();
          }}
          text={text}
        />
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
            fallbackDirectionOrigin: selectedRegionDirectionOrigin,
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
          onKeywordChange={setSearchKeyword}
          onSearchFilterChange={setSearchFilter}
          onClose={closeSearchPopup}
          onLoadMore={loadMore}
          onResultClick={(item) => {
            openPlaceSheetFromAttraction({
              attraction: item.attraction,
              markerType: item.markerType,
              touristTrendName: item.touristTrendName,
              rank: item.rank,
              mode: "full-popup",
            });
          }}
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
