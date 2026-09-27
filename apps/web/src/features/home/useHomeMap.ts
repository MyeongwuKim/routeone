/**
 * 홈 화면의 네이버 지도 SDK 생명주기와 현재 위치 조회를 관리하고,
 * 지역 경계·현재 위치·관광지 마커 오버레이 훅을 하나의 지도 runtime에 연결한다.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { ServiceRegion } from "@/data/serviceAreas";
import type {
  CurrentLocation,
  GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type {
  OpenPlaceSheetFromAttractionOptions,
  SearchFilter,
} from "@/lib/gangwonAttractionMap";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import {
  getNaverMapAuthHref,
  getNaverMapAuthOrigin,
  loadNaverMapSdk,
} from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiText } from "@/lib/uiText";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import { NCP_KEY_ID } from "@/pages/HomePage.constants";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type {
  HomeMapBounds,
  HomeMapInstance,
  HomeMapRuntime,
  HomeNaverMaps,
} from "./map/homeMapTypes";
import { useHomeAttractionMarkerOverlay } from "./map/useHomeAttractionMarkerOverlay";
import { useHomeCurrentLocationOverlay } from "./map/useHomeCurrentLocationOverlay";
import { useHomeRegionBoundaryOverlay } from "./map/useHomeRegionBoundaryOverlay";
import type { HomeAttractionQueryData } from "./useHomeAttractionData";

const MAP_BOUNDS_RETRY_LIMIT = 6;
const MAP_BOUNDS_RETRY_DELAY_MS = 120;
const MAP_READY_FALLBACK_DELAY_MS = 650;

type HomeMapStatus = {
  /** 현재 지도 세션의 SDK 로드 또는 인증 오류 메시지 */
  error: string | null;
  /** 지도 init 이벤트나 대기 시간 경과 후 runtime을 사용할 수 있는 상태인지 여부 */
  isReady: boolean;
  /** 이 상태를 생성할 때 SDK에 적용한 언어 */
  language: string;
  /** 지도 인스턴스와 네이버 지도 API를 묶은 현재 세션 실행 객체 */
  runtime: HomeMapRuntime | null;
  /** 언어와 초기 중심 좌표로 구분하는 지도 생성 세션 키 */
  sessionKey: string;
};

type UseHomeMapOptions = {
  /** 선택 지역의 관광지와 분류 정보. 관광지 마커 오버레이 생성에 사용한다. */
  attractionData: HomeAttractionQueryData | undefined;
  /** 시·군·구 코드를 키로 갖는 경계 도형 데이터. 선택 지역 경계 오버레이에 전달한다. */
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  /** true가 된 뒤 선택 지역 경계를 그리고 해당 영역이 보이도록 지도를 이동한다. */
  isBoundaryDataReady: boolean;
  /** 언어 변경에 따른 장소명 갱신 중인지 마커 훅과 공유하는 ref */
  isUpdatingPlaceLabelsRef: RefObject<boolean>;
  /** 관광지 마커 클릭 시 선택한 관광지·마커 종류·트렌드명·순위를 전달하는 콜백 */
  onSelectAttraction: (
    options: OpenPlaceSheetFromAttractionOptions
  ) => void;
  /** 지도에 남길 관광지 마커 종류를 결정하는 현재 검색 필터 */
  searchFilter: SearchFilter;
  /** 지도 세션을 새로 만들 때 적용하는 초기 중심 좌표 */
  mapCenter: CurrentLocation;
  /** 선택 지역의 경계를 그릴 수 없을 때 사용할 지역별 대체 중심 좌표 목록 */
  regions: readonly ServiceRegion[];
  /** 경계와 관광지 마커를 표시할 현재 시·군·구 코드 */
  selectedSigunguCode: string;
  /** 관광지 ID를 키로 갖는 혼잡도 순위 조회표. 마커 배지와 겹침 순서에 사용한다. */
  topRankByAttractionId: Map<string, number>;
  /** 관광지 ID를 키로 갖는 트렌드명 조회표. 마커 선택 결과에 포함한다. */
  trendNameByAttractionId: Map<string, string>;
};

/** 지도 내부 모델이 준비되기 전에 fitBounds를 호출했을 때 발생하는 재시도 대상 오류인지 판별한다. */
function isNaverMapModelPendingError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  return (
    message.includes("_mapModel") ||
    message.includes("getFitZoomAndCenter")
  );
}

/**
 * 홈 화면의 네이버 지도를 생성하고 현재 언어·테마·선택 지역에 맞게 유지한다.
 * 지도 컨테이너가 준비되면 SDK를 로드해 지도 인스턴스를 만들고, 인증 실패와 로드 실패를
 * 화면에서 표시할 상태로 변환한다. 지도 runtime은 경계, 현재 위치, 관광지 마커 훅에 전달하며
 * 세션이 교체되거나 훅이 정리될 때 예약 작업·리스너·오버레이·열린 장소 시트를 정리한다.
 */
export function useHomeMap({
  attractionData,
  boundaryBySigunguCode,
  isBoundaryDataReady,
  isUpdatingPlaceLabelsRef,
  onSelectAttraction,
  searchFilter,
  mapCenter,
  regions,
  selectedSigunguCode,
  topRankByAttractionId,
  trendNameByAttractionId,
}: UseHomeMapOptions) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const closeSheet = useMapSheetStore((state) => state.closeSheet);
  const currentLocation = useCurrentPositionStore((state) => state.position);
  const currentLocationStatus = useCurrentPositionStore(
    (state) => state.status
  );
  const requestCurrentPosition = useCurrentPositionStore(
    (state) => state.requestCurrentPosition
  );
  const mapRef = useRef<HTMLDivElement | null>(null);
  /** 장소나 좌표로 지도를 이동할 때 사용하는 현재 지도 인스턴스 */
  const mapInstanceRef = useRef<HomeMapInstance | null>(null);
  /** 좌표 객체를 생성하고 지도 이벤트를 제어하는 현재 네이버 지도 API */
  const naverMapsRef = useRef<HomeNaverMaps | null>(null);
  /** 값이 바뀌면 이전 지역 경계 맞춤 이동과 재시도 콜백을 무효화한다. */
  const mapBoundsMoveRequestRef = useRef(0);
  /** 지도 내부 모델 준비를 기다리며 예약한 fitBounds 재시도 타이머 ID 목록 */
  const mapBoundsRetryTimeoutIdsRef = useRef<Set<number>>(new Set());
  /** 언어나 초기 중심 좌표가 바뀌면 기존 runtime과 구분해 지도를 새로 생성한다. */
  const mapSessionKey = `${appLanguage}:${mapCenter.lat}:${mapCenter.lng}`;
  const [mapStatus, setMapStatus] = useState<HomeMapStatus>({
    error: null,
    isReady: false,
    language: appLanguage,
    runtime: null,
    sessionKey: mapSessionKey,
  });
  /** 준비된 상태가 현재 세션에 속할 때만 오버레이 훅에 전달하는 지도 runtime */
  const runtime =
    mapStatus.sessionKey === mapSessionKey && mapStatus.isReady
      ? mapStatus.runtime
      : null;
  const mapReady = runtime !== null;
  /** 키 누락은 즉시 표시하고, SDK·인증 오류는 현재 언어와 세션에서 발생한 경우에만 표시한다. */
  const mapError = !NCP_KEY_ID
    ? text.home.mapMissingKey
    : mapStatus.sessionKey === mapSessionKey &&
        mapStatus.language === appLanguage
      ? mapStatus.error
      : null;
  const isCurrentLocationLookupPending =
    currentLocationStatus === "idle" || currentLocationStatus === "loading";

  /** 진행 중인 경계 맞춤 이동을 무효화하고 예약된 모든 재시도 타이머를 해제한다. */
  const cancelPendingMapBoundsMove = useCallback(() => {
    mapBoundsMoveRequestRef.current += 1;
    mapBoundsRetryTimeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    mapBoundsRetryTimeoutIdsRef.current.clear();
  }, []);

  /**
   * 지도 runtime이 있으면 관광지 좌표로 500ms 이동을 요청한다.
   * panTo를 제공하지 않는 지도 구현에서는 중심 좌표만 즉시 변경하며, 이동 완료를 기다리지 않는다.
   */
  const focusAttraction = useCallback((attraction: GangwonAttraction) => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;

    if (!mapInstance || !naverMaps) {
      return;
    }

    const position = new naverMaps.LatLng(attraction.lat, attraction.lng);
    if (typeof mapInstance.panTo === "function") {
      mapInstance.panTo(position, { duration: 500 });
    } else {
      mapInstance.setCenter(position);
    }
  }, []);

  /**
   * 저장된 현재 위치가 있고 forceRefresh가 아니면 해당 좌표를 반환한다.
   * 좌표가 없거나 강제 갱신이면 위치 Store에 조회를 요청하고, 요청이 실패하면 null을 반환한다.
   * 이 함수는 지도 중심을 이동하지 않는다.
   */
  const refreshCurrentLocation = useCallback(async ({
    forceRefresh = false,
  }: {
    forceRefresh?: boolean;
  } = {}) => {
    let nextLocation = currentLocation;

    if (!nextLocation || forceRefresh) {
      try {
        nextLocation = await requestCurrentPosition({ forceRefresh });
      } catch {
        return null;
      }
    }

    return nextLocation;
  }, [currentLocation, requestCurrentPosition]);

  /**
   * 지도 runtime이 준비된 경우 이전 경계 맞춤 이동을 취소하고 전달받은 좌표로 이동한다.
   * 현재 줌이 14보다 낮으면 14로 높인다. 지도 이동 요청을 실행하면 true,
   * runtime이 없어 실행하지 못하면 false를 반환하며 애니메이션 완료 여부는 나타내지 않는다.
   */
  const focusLocation = useCallback((location: CurrentLocation) => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    if (!mapInstance || !naverMaps) {
      return false;
    }

    cancelPendingMapBoundsMove();
    const position = new naverMaps.LatLng(location.lat, location.lng);
    if (mapInstance.getZoom() < 14) {
      mapInstance.setZoom(14);
    }
    if (typeof mapInstance.panTo === "function") {
      mapInstance.panTo(position, { duration: 500 });
    } else {
      mapInstance.setCenter(position);
    }

    return true;
  }, [cancelPendingMapBoundsMove]);

  const {
    clearBoundaryPolygons,
    drawSelectedRegionBoundary,
  } = useHomeRegionBoundaryOverlay({
    boundaryBySigunguCode,
    runtime,
    selectedSigunguCode,
  });
  const { clearCurrentLocationOverlays } =
    useHomeCurrentLocationOverlay({
      currentLocation,
      currentLocationTitle: text.home.currentLocation,
      runtime,
    });
  const { clearMarkers, isRenderingMarkers } =
    useHomeAttractionMarkerOverlay({
      attractionData,
      focusAttraction,
      isUpdatingPlaceLabelsRef,
      onSelectAttraction,
      runtime,
      searchFilter,
      selectedSigunguCode,
      topRankByAttractionId,
      trendNameByAttractionId,
    });

  /**
   * 요청 ID가 현재 이동 요청과 일치할 때 지도를 경계 영역에 맞춘다.
   * 네이버 지도 내부 모델이 아직 준비되지 않은 오류만 120ms 간격으로 최대 6회 추가 재시도하고,
   * 요청이 교체되거나 취소되면 더 이상 이동하지 않는다.
   */
  const moveMapToBounds = useCallback(
    (bounds: HomeMapBounds, requestId: number) => {
      const move = (attempt: number) => {
        const mapInstance = mapInstanceRef.current;
        if (
          !mapInstance ||
          mapBoundsMoveRequestRef.current !== requestId
        ) {
          return;
        }

        try {
          mapInstance.fitBounds(bounds);
        } catch (error) {
          if (
            attempt < MAP_BOUNDS_RETRY_LIMIT &&
            isNaverMapModelPendingError(error)
          ) {
            const timeoutId = window.setTimeout(
              () => {
                mapBoundsRetryTimeoutIdsRef.current.delete(timeoutId);
                move(attempt + 1);
              },
              MAP_BOUNDS_RETRY_DELAY_MS
            );
            mapBoundsRetryTimeoutIdsRef.current.add(timeoutId);
            return;
          }

          console.warn("[routeone-web] failed to move map bounds", error);
        }
      };

      move(0);
    },
    []
  );

  /**
   * 선택한 시·군·구 경계를 다시 그리고 경계 전체가 보이도록 지도를 맞춘다.
   * 경계 좌표를 만들 수 없으면 선택 지역 또는 첫 지역의 중심 좌표와 줌 10을 적용한다.
   */
  const fitMapToSelectedRegion = useCallback(() => {
    if (!runtime) {
      return;
    }

    const currentRegion =
      regions.find(
        (region) => region.sigunguCode === selectedSigunguCode
      ) ?? regions[0];
    if (!currentRegion) {
      return;
    }

    cancelPendingMapBoundsMove();
    const moveRequestId = mapBoundsMoveRequestRef.current + 1;
    mapBoundsMoveRequestRef.current = moveRequestId;
    const regionBounds = drawSelectedRegionBoundary();
    if (regionBounds) {
      moveMapToBounds(regionBounds, moveRequestId);
      return;
    }

    const center = new runtime.naverMaps.LatLng(
      currentRegion.center.lat,
      currentRegion.center.lng
    );
    runtime.map.setCenter(center);
    runtime.map.setZoom(10);
  }, [
    cancelPendingMapBoundsMove,
    drawSelectedRegionBoundary,
    moveMapToBounds,
    regions,
    runtime,
    selectedSigunguCode,
  ]);

  /** 훅이 처음 연결될 때 현재 위치 조회를 시작하며, 실패 상태 처리는 위치 Store에 맡긴다. */
  useEffect(() => {
    void requestCurrentPosition().catch(() => undefined);
  }, [requestCurrentPosition]);

  /**
   * 지도 컨테이너와 NCP 키가 준비되면 현재 세션의 네이버 지도 SDK와 인스턴스를 초기화한다.
   * init 이벤트 또는 650ms 대기 후 runtime을 준비 상태로 전환하고, 컨테이너 크기 변화마다
   * resize 이벤트를 전달한다. 인증·SDK 오류는 현재 세션의 mapError로 저장한다.
   *
   * 세션 교체나 정리 시 지도 이동 재시도, resize 예약·리스너, 모든 오버레이와 지도 ref,
   * 인증 실패 콜백을 해제하고 열린 장소 시트를 닫은 뒤 컨테이너 내용을 비운다.
   */
  useEffect(() => {
    const container = mapRef.current;
    if (!container || !NCP_KEY_ID) {
      return;
    }

    let isDisposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;
    let mapReadyListener: unknown = null;
    let readyFallbackTimeoutId: number | null = null;
    let resizeFrameId: number | null = null;
    let hasAuthFailed = false;
    const resizeTimeoutIds: number[] = [];
    let initializedRuntime: HomeMapRuntime | null = null;

    container.innerHTML = "";
    const handleMapAuthFailure = () => {
      if (isDisposed) {
        return;
      }

      hasAuthFailed = true;
      if (readyFallbackTimeoutId !== null) {
        window.clearTimeout(readyFallbackTimeoutId);
        readyFallbackTimeoutId = null;
      }
      if (mapReadyListener) {
        initializedRuntime?.naverMaps.Event?.removeListener(
          mapReadyListener
        );
        mapReadyListener = null;
      }
      const authOrigin = getNaverMapAuthOrigin();
      const authHref = getNaverMapAuthHref();

      setMapStatus({
        error: text.home.mapAuthError(authOrigin, authHref),
        isReady: false,
        language: appLanguage,
        runtime: null,
        sessionKey: mapSessionKey,
      });
    };
    window.navermap_authFailure = handleMapAuthFailure;

    const markMapReady = () => {
      if (isDisposed || hasAuthFailed || !initializedRuntime) {
        return;
      }

      setMapStatus({
        error: null,
        isReady: true,
        language: appLanguage,
        runtime: initializedRuntime,
        sessionKey: mapSessionKey,
      });
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapSdk(NCP_KEY_ID, appLanguage);
        if (isDisposed || hasAuthFailed) {
          return;
        }

        const naverMaps = window.naver?.maps;
        if (!naverMaps) {
          setMapStatus({
            error: text.home.mapSdkMissing,
            isReady: false,
            language: appLanguage,
            runtime: null,
            sessionKey: mapSessionKey,
          });
          return;
        }

        naverMapsRef.current = naverMaps;
        const shouldUseDarkMap = useUiThemeStore.getState().mode === "dark";
        const mapInstance = new naverMaps.Map(container, {
          center: new naverMaps.LatLng(mapCenter.lat, mapCenter.lng),
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
        }) as HomeMapInstance;

        mapInstanceRef.current = mapInstance;
        initializedRuntime = {
          map: mapInstance,
          naverMaps,
          sessionKey: mapSessionKey,
        };
        applyNaverMapTheme(mapInstance, shouldUseDarkMap);
        enableNaverMapPointerInteractions(mapInstance);
        if (hasAuthFailed) {
          return;
        }

        const forceResize = () => {
          if (mapInstanceRef.current === mapInstance) {
            naverMaps.Event.trigger(mapInstance, "resize");
          }
        };

        mapReadyListener = naverMaps.Event.once(
          mapInstance,
          "init",
          () => {
            forceResize();
            markMapReady();
          }
        );
        resizeFrameId = window.requestAnimationFrame(forceResize);
        readyFallbackTimeoutId = window.setTimeout(
          markMapReady,
          MAP_READY_FALLBACK_DELAY_MS
        );
        resizeTimeoutIds.push(
          window.setTimeout(forceResize, 120),
          window.setTimeout(forceResize, 360)
        );

        handleResize = forceResize;
        window.addEventListener("resize", handleResize);
        resizeObserver = new ResizeObserver(forceResize);
        resizeObserver.observe(container);
      } catch {
        if (!isDisposed && !hasAuthFailed) {
          setMapStatus({
            error: text.home.mapLoadError,
            isReady: false,
            language: appLanguage,
            runtime: null,
            sessionKey: mapSessionKey,
          });
        }
      }
    };

    void initializeMap();

    return () => {
      isDisposed = true;
      cancelPendingMapBoundsMove();
      if (readyFallbackTimeoutId !== null) {
        window.clearTimeout(readyFallbackTimeoutId);
      }
      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
      }
      resizeTimeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      clearMarkers();
      clearBoundaryPolygons();
      clearCurrentLocationOverlays();
      if (mapReadyListener) {
        initializedRuntime?.naverMaps.Event?.removeListener(mapReadyListener);
      }
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      resizeObserver?.disconnect();
      if (mapInstanceRef.current === initializedRuntime?.map) {
        mapInstanceRef.current = null;
      }
      if (naverMapsRef.current === initializedRuntime?.naverMaps) {
        naverMapsRef.current = null;
      }
      closeSheet();
      if (window.navermap_authFailure === handleMapAuthFailure) {
        window.navermap_authFailure = undefined;
      }
      container.innerHTML = "";
    };
  }, [
    appLanguage,
    cancelPendingMapBoundsMove,
    clearBoundaryPolygons,
    clearCurrentLocationOverlays,
    clearMarkers,
    closeSheet,
    mapCenter.lat,
    mapCenter.lng,
    mapSessionKey,
    text,
  ]);

  /** 준비된 지도에 현재 테마를 적용하고 포인터·터치 상호작용을 다시 활성화한다. */
  useEffect(() => {
    applyNaverMapTheme(runtime?.map ?? null, isDarkMode);
    enableNaverMapPointerInteractions(runtime?.map ?? null);
  }, [isDarkMode, runtime]);

  /**
   * runtime과 경계 데이터가 준비되면 선택 지역 경계를 기준으로 지도를 이동한다.
   * 조건이 바뀌거나 정리될 때 이전 경계 이동과 재시도를 취소한다.
   */
  useEffect(() => {
    if (runtime && isBoundaryDataReady) {
      fitMapToSelectedRegion();
    }

    return () => {
      cancelPendingMapBoundsMove();
    };
  }, [
    cancelPendingMapBoundsMove,
    fitMapToSelectedRegion,
    isBoundaryDataReady,
    runtime,
  ]);

  return {
    /** 위치 Store가 보관하는 최근 현재 위치. 아직 조회되지 않았거나 사용할 수 없으면 null */
    currentLocation,
    focusAttraction,
    focusLocation,
    /** 최초 상태이거나 위치 조회 중이어서 초기 지역 판정을 기다려야 하는지 여부 */
    isCurrentLocationLookupPending,
    /** 현재 지역의 관광지 마커를 프레임 단위로 나누어 생성 중인지 여부 */
    isRenderingMarkers,
    /** NCP 키 누락, 지도 인증 실패 또는 SDK 로드 실패 시 화면에 표시할 메시지 */
    mapError,
    /** 현재 언어와 중심 좌표에 해당하는 지도 runtime이 준비됐는지 여부 */
    mapReady,
    /** HomePage가 네이버 지도 컨테이너 요소에 연결하는 ref */
    mapRef,
    refreshCurrentLocation,
  };
}
