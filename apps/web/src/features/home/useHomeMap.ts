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
  error: string | null;
  isReady: boolean;
  language: string;
  runtime: HomeMapRuntime | null;
  sessionKey: string;
};

type UseHomeMapOptions = {
  attractionData: HomeAttractionQueryData | undefined;
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  isBoundaryDataReady: boolean;
  isUpdatingPlaceLabelsRef: RefObject<boolean>;
  onSelectAttraction: (
    options: OpenPlaceSheetFromAttractionOptions
  ) => void;
  searchFilter: SearchFilter;
  mapCenter: CurrentLocation;
  regions: readonly ServiceRegion[];
  selectedSigunguCode: string;
  topRankByAttractionId: Map<string, number>;
  trendNameByAttractionId: Map<string, string>;
};

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
  const mapInstanceRef = useRef<HomeMapInstance | null>(null);
  const naverMapsRef = useRef<HomeNaverMaps | null>(null);
  const mapBoundsMoveRequestRef = useRef(0);
  const mapBoundsRetryTimeoutIdsRef = useRef<Set<number>>(new Set());
  const mapSessionKey = `${appLanguage}:${mapCenter.lat}:${mapCenter.lng}`;
  const [mapStatus, setMapStatus] = useState<HomeMapStatus>({
    error: null,
    isReady: false,
    language: appLanguage,
    runtime: null,
    sessionKey: mapSessionKey,
  });
  const runtime =
    mapStatus.sessionKey === mapSessionKey && mapStatus.isReady
      ? mapStatus.runtime
      : null;
  const mapReady = runtime !== null;
  const mapError = !NCP_KEY_ID
    ? text.home.mapMissingKey
    : mapStatus.sessionKey === mapSessionKey &&
        mapStatus.language === appLanguage
      ? mapStatus.error
      : null;
  const isCurrentLocationLookupPending =
    currentLocationStatus === "idle" || currentLocationStatus === "loading";

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

  const focusCurrentLocation = useCallback(async ({
    forceRefresh = false,
  }: {
    forceRefresh?: boolean;
  } = {}) => {
    let nextLocation = currentLocation;

    if (!nextLocation || forceRefresh) {
      try {
        nextLocation = await requestCurrentPosition({ forceRefresh });
      } catch {
        return false;
      }
    }

    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    if (!mapInstance || !naverMaps) {
      return false;
    }

    const position = new naverMaps.LatLng(
      nextLocation.lat,
      nextLocation.lng
    );
    if (mapInstance.getZoom() < 14) {
      mapInstance.setZoom(14);
    }
    if (typeof mapInstance.panTo === "function") {
      mapInstance.panTo(position, { duration: 500 });
    } else {
      mapInstance.setCenter(position);
    }

    return true;
  }, [currentLocation, requestCurrentPosition]);

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

  const cancelPendingMapBoundsMove = useCallback(() => {
    mapBoundsMoveRequestRef.current += 1;
    mapBoundsRetryTimeoutIdsRef.current.forEach((timeoutId) => {
      window.clearTimeout(timeoutId);
    });
    mapBoundsRetryTimeoutIdsRef.current.clear();
  }, []);

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

  useEffect(() => {
    void requestCurrentPosition().catch(() => undefined);
  }, [requestCurrentPosition]);

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

  useEffect(() => {
    applyNaverMapTheme(runtime?.map ?? null, isDarkMode);
    enableNaverMapPointerInteractions(runtime?.map ?? null);
  }, [isDarkMode, runtime]);

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
    currentLocation,
    focusAttraction,
    focusCurrentLocation,
    isCurrentLocationLookupPending,
    isRenderingMarkers,
    mapError,
    mapReady,
    mapRef,
  };
}
