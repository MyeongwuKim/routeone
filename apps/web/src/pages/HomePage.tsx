/**
 * 진입 경로: 홈 → 지도에서 직접 찾기, 축제 알림, 내 루트 → 장소 추가
 *
 * 서비스 지역과 시·군·구, 장소 종류, 검색어를 기준으로 관광지를 조회해 지도와 검색 결과에 표시한다.
 * 지도 아래 목록에서는 팝업 없이 장소를 담고, 사진·이름이나 마커를 누르면 상세·길찾기를 연다.
 *
 * 현재 위치·선택 지역·검색 조건은 전역 Store에서 읽고, 장소 조회와 검색 결과 계산은 전용 Hook에 맡긴다.
 * 이 화면은 위치 권한 안내, 검색 팝업, 지도 오버레이와 장소 상세 시트의 열림·선택 흐름을 연결한다.
 */
import { useCallback, useMemo } from "react";
import MapLoadingSkeleton from "@/components/map/MapLoadingSkeleton";
import LocationPermissionNotice from "@/components/map/LocationPermissionNotice";
import { useLocationPermissionDenied } from "@/native-bridge/useLocationPermissionDenied";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MdArrowBack } from "react-icons/md";
import { getHomeRecommendationText } from "@/features/home/recommendations/homeRecommendationText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
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
import HomePlaceList from "@/features/home/components/HomePlaceList";
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
import { findRegionContainingLocation } from "@/lib/gangwonBoundaryUtils";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useEffectiveServiceArea } from "@/stores/serviceAreaStore";
import { selectExploreRegion as selectServiceRegion } from "@/features/service-area/serviceAreaSelection";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";

function HomePage() {
  const isLocationPermissionDenied = useLocationPermissionDenied();
  const text = useUiText();
  const navigate = useNavigate();
  const location = useLocation();
  const language = useAppLanguageStore((state) => state.language);
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
    boundaryByAdminCode,
    boundaryError,
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
  /** 다른 시·군·구를 누르면 해당 필터를 선택하고 지도 이동에 사용할 지역 중심을 반환한다. */
  const handleSelectMapLocation = useCallback((position: { lat: number; lng: number }) => {
    const region = findRegionContainingLocation(position, serviceArea.regions, boundaryBySigunguCode);
    if (!region || region.sigunguCode === useHomeExploreStore.getState().selectedSigunguCode) return null;

    selectServiceRegion(serviceArea.id, region.sigunguCode);
    return region.center;
  }, [boundaryBySigunguCode, serviceArea]);
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
    onSelectMapLocation: handleSelectMapLocation,
    isUpdatingPlaceLabelsRef,
    onSelectAttraction: handleSelectAttraction,
    searchFilter,
    mapCenter: serviceArea.center,
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
    boundaryByAdminCode,
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
  /** 지도와 목록의 선택을 유지한 채 담은 장소 검토·코스 생성 화면을 연다. */
  const handleOpenCheckout = () => {
    resetSheet();
    openSavedList();
  };
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
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden bg-brand-50">
      <div className="relative min-h-0 flex-1">
        <div
          ref={mapRef}
          className="naver-map-root h-full w-full"
          style={{ background: "#dbeafe" }}
        />
        <Link
          to={`/home${location.search}`}
          className="absolute bottom-4 left-3 z-20 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-200 bg-white/95 px-4 text-sm font-bold text-brand-800 shadow-md dark:border-brand-400/25 dark:bg-slate-900 dark:text-brand-100"
        >
          <MdArrowBack aria-hidden="true" />{getHomeRecommendationText(language).backHome}
        </Link>

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
            serviceAreaId={serviceArea.id}
            onSelectServiceArea={selectServiceRegion}
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
            onOpenSavedList={handleOpenCheckout}
            onFocusCurrentLocation={focusCurrentLocation}
            onSelectRegion={(regionCode) => selectServiceRegion(serviceArea.id, regionCode)}
            onSelectFilter={(filter) => {
              resetSheet();
              setSearchFilter(filter);
            }}
          />
        ) : null}
        {boundaryError ? (
          <p role="status" className="absolute inset-x-3 bottom-20 z-20 rounded-xl bg-white/95 px-3 py-2 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {text.serviceArea.boundaryUnavailable}
          </p>
        ) : null}

        {appendTarget && shouldShowInteractiveMapUi ? (
          <HomeAppendDayBanner
            appendTarget={appendTarget}
            onCancel={clearAppendTarget}
            onOpenCheckout={handleOpenCheckout}
            text={text}
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
      </div>

      <HomePlaceList
        regionLabel={selectedRegionLabel}
        areaCode={serviceArea.tatsAreaCode}
        signguCode={selectedRegion.adminCode}
        scopeKey={`${serviceArea.id}:${selectedSigunguCode}:${searchFilter}:${searchKeyword}`}
        results={visibleSearchResults}
        totalCount={searchResults.length}
        isLoading={!isInitialRegionResolved || isAttractionLoading}
        error={attractionError}
        onLoadMore={loadMore}
        onOpenPlace={(item) => openPlaceSheetFromAttraction({ ...item, mode: "full-popup" })}
        onOpenCheckout={handleOpenCheckout}
      />

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
    </section>
  );
}

export default HomePage;
