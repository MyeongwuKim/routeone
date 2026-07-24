import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { createBadgeMarkerIconHtml } from "@/components/map/NaverMapMarkerIcon";
import {
  DEFAULT_GANGWON_REGION,
  GANGWON_CENTER,
  GANGWON_REGIONS,
} from "@/data/gangwonRegions";
import {
  convertUtmkToWgs84,
  type CurrentLocation,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import {
  buildSpreadMarkerPositionMap,
  getAttractionMarkerKey,
  matchesPlaceFilter,
  resolveMarkerType,
  type AttractionLoadingStage,
  type OpenPlaceSheetFromAttractionOptions,
  type SearchFilter,
} from "@/lib/gangwonAttractionMap";
import { getCurrentPosition } from "@/lib/currentPosition";
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
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type { HomeAttractionQueryData } from "./useHomeAttractionData";

const MARKER_RENDER_CHUNK_SIZE = 80;
const MAP_BOUNDS_RETRY_LIMIT = 6;
const MAP_BOUNDS_RETRY_DELAY_MS = 120;
const MAP_READY_FALLBACK_DELAY_MS = 650;

type HomeMapInstance = {
  fitBounds: (bounds: unknown) => void;
  getZoom: () => number;
  panTo?: (position: unknown, options?: { duration: number }) => void;
  panToBounds?: (bounds: unknown) => void;
  setCenter: (position: unknown) => void;
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  setZoom: (zoom: number) => void;
};

type HomeMapOverlay = {
  setMap: (map: null) => void;
};

type HomeMapBounds = {
  extend: (position: unknown) => void;
  getCenter?: () => unknown;
};

type CoordinateLike = {
  lat?: (() => number) | number;
  lng?: (() => number) | number;
  x?: number;
  y?: number;
  _lat?: number;
  _lng?: number;
};

type HomeMapStatus = {
  language: string;
  isReady: boolean;
  error: string | null;
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
  selectedSigunguCode: string;
  setAttractionLoadingStage: Dispatch<
    SetStateAction<AttractionLoadingStage>
  >;
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
  selectedSigunguCode,
  setAttractionLoadingStage,
  topRankByAttractionId,
  trendNameByAttractionId,
}: UseHomeMapOptions) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const closeSheet = useMapSheetStore((state) => state.closeSheet);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<HomeMapInstance | null>(null);
  const naverMapsRef = useRef<
    NonNullable<Window["naver"]>["maps"] | null
  >(null);
  const boundaryPolygonRefs = useRef<HomeMapOverlay[]>([]);
  const markerRefs = useRef<HomeMapOverlay[]>([]);
  const markerListenerRefs = useRef<unknown[]>([]);
  const hasRenderedAttractionMarkersRef = useRef(false);
  const onSelectAttractionRef = useRef(onSelectAttraction);
  const [currentLocation, setCurrentLocation] =
    useState<CurrentLocation | null>(null);
  const [isCurrentLocationLookupPending, setIsCurrentLocationLookupPending] =
    useState(true);
  const [mapStatus, setMapStatus] = useState<HomeMapStatus>({
    language: appLanguage,
    isReady: false,
    error: null,
  });
  const mapReady =
    mapStatus.language === appLanguage && mapStatus.isReady;
  const mapError = !NCP_KEY_ID
    ? text.home.mapMissingKey
    : mapStatus.language === appLanguage
      ? mapStatus.error
      : null;

  useEffect(() => {
    onSelectAttractionRef.current = onSelectAttraction;
  }, [onSelectAttraction]);

  const clearMarkers = useCallback(() => {
    const naverMaps = naverMapsRef.current;

    markerListenerRefs.current.forEach((listener) => {
      naverMaps?.Event?.removeListener(listener);
    });
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    markerListenerRefs.current = [];
  }, []);

  const clearBoundaryPolygons = useCallback(() => {
    boundaryPolygonRefs.current.forEach((polygon) => polygon.setMap(null));
    boundaryPolygonRefs.current = [];
  }, []);

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

  const drawSelectedRegionBoundary = useCallback(() => {
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

    const regionBounds = new naverMaps.LatLngBounds() as HomeMapBounds;
    const isKoreaLatLng = (lat: number, lng: number) =>
      lat >= 32 && lat <= 40 && lng >= 123 && lng <= 133;
    const readLatLng = (coord: unknown) => {
      if (!coord || typeof coord !== "object") {
        return null;
      }

      const value = coord as CoordinateLike;
      const lat =
        typeof value.lat === "function"
          ? value.lat()
          : typeof value.y === "number"
            ? value.y
            : typeof value._lat === "number"
              ? value._lat
              : null;
      const lng =
        typeof value.lng === "function"
          ? value.lng()
          : typeof value.x === "number"
            ? value.x
            : typeof value._lng === "number"
              ? value._lng
              : null;

      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
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
        const parsed = readLatLng(convert());
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
              if (latLng) {
                regionBounds.extend(latLng);
              }
              return latLng;
            })
            .filter((point): point is NonNullable<typeof point> => point != null)
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
      }) as HomeMapOverlay;
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
        }) as HomeMapOverlay;
        const boundaryLine = new naverMaps.Polyline({
          map: mapInstance,
          path,
          strokeColor: "#0d9488",
          strokeWeight: 4,
          strokeOpacity: 1,
          zIndex: 901,
          clickable: false,
        }) as HomeMapOverlay;

        boundaryPolygonRefs.current.push(boundaryHaloLine, boundaryLine);
      });
    });

    return boundaryPolygonRefs.current.length > 0 ? regionBounds : null;
  }, [
    boundaryBySigunguCode,
    clearBoundaryPolygons,
    selectedSigunguCode,
  ]);

  const moveMapToBounds = useCallback(
    (bounds: HomeMapBounds, smooth: boolean) => {
      const move = (attempt: number) => {
        const mapInstance = mapInstanceRef.current;
        if (!mapInstance) {
          return;
        }

        try {
          if (!smooth) {
            mapInstance.fitBounds(bounds);
            return;
          }

          if (typeof mapInstance.panToBounds === "function") {
            mapInstance.panToBounds(bounds);
            return;
          }

          const center = bounds.getCenter?.();
          if (center && typeof mapInstance.panTo === "function") {
            mapInstance.panTo(center, { duration: 450 });
            window.setTimeout(() => {
              if (mapInstanceRef.current === mapInstance) {
                try {
                  mapInstance.fitBounds(bounds);
                } catch (error) {
                  if (!isNaverMapModelPendingError(error)) {
                    console.warn(
                      "[routeone-web] failed to fit map bounds",
                      error
                    );
                  }
                }
              }
            }, 220);
            return;
          }

          mapInstance.fitBounds(bounds);
        } catch (error) {
          if (
            attempt < MAP_BOUNDS_RETRY_LIMIT &&
            isNaverMapModelPendingError(error)
          ) {
            window.setTimeout(
              () => move(attempt + 1),
              MAP_BOUNDS_RETRY_DELAY_MS
            );
            return;
          }

          console.warn("[routeone-web] failed to move map bounds", error);
        }
      };

      move(0);
    },
    []
  );

  const fitMapToSelectedRegion = useCallback(
    (options?: { smooth?: boolean; fallbackBounds?: HomeMapBounds | null }) => {
      const mapInstance = mapInstanceRef.current;
      const naverMaps = naverMapsRef.current;
      const currentRegion =
        GANGWON_REGIONS.find(
          (region) => region.sigunguCode === selectedSigunguCode
        ) ?? DEFAULT_GANGWON_REGION;

      if (!mapInstance || !naverMaps) {
        return;
      }

      const smooth = options?.smooth ?? false;
      const regionBounds = drawSelectedRegionBoundary();
      if (regionBounds) {
        moveMapToBounds(regionBounds, smooth);
        return;
      }

      if (options?.fallbackBounds) {
        moveMapToBounds(options.fallbackBounds, smooth);
        return;
      }

      const center = new naverMaps.LatLng(
        currentRegion.center.lat,
        currentRegion.center.lng
      );
      if (smooth && typeof mapInstance.panTo === "function") {
        mapInstance.panTo(center, { duration: 450 });
        window.setTimeout(() => {
          if (mapInstanceRef.current === mapInstance) {
            mapInstance.setZoom(10);
          }
        }, 220);
        return;
      }

      mapInstance.setCenter(center);
      mapInstance.setZoom(10);
    }, [
      drawSelectedRegionBoundary,
      moveMapToBounds,
      selectedSigunguCode,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    getCurrentPosition()
      .then((position) => {
        if (isMounted) {
          setCurrentLocation({ lat: position.lat, lng: position.lng });
        }
      })
      .catch(() => {
        if (isMounted) {
          setCurrentLocation(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCurrentLocationLookupPending(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
    const resizeTimeoutIds: number[] = [];
    const resetFrameId = window.requestAnimationFrame(() => {
      setMapStatus({
        language: appLanguage,
        isReady: false,
        error: null,
      });
    });

    container.innerHTML = "";
    window.navermap_authFailure = () => {
      const authOrigin = getNaverMapAuthOrigin();
      const authHref = getNaverMapAuthHref();

      setMapStatus({
        language: appLanguage,
        isReady: false,
        error: text.home.mapAuthError(authOrigin, authHref),
      });
    };

    const markMapReady = () => {
      if (isDisposed) {
        return;
      }

      setMapStatus({
        language: appLanguage,
        isReady: true,
        error: null,
      });
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapSdk(NCP_KEY_ID, appLanguage);
        if (isDisposed) {
          return;
        }

        const naverMaps = window.naver?.maps;
        if (!naverMaps) {
          setMapStatus({
            language: appLanguage,
            isReady: false,
            error: text.home.mapSdkMissing,
          });
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
        }) as HomeMapInstance;

        mapInstanceRef.current = mapInstance;
        applyNaverMapTheme(mapInstance, shouldUseDarkMap);
        enableNaverMapPointerInteractions(mapInstance);

        const forceResize = () => {
          if (mapInstanceRef.current) {
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
        resizeFrameId = window.requestAnimationFrame(() => {
          forceResize();
        });
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
        if (!isDisposed) {
          setMapStatus({
            language: appLanguage,
            isReady: false,
            error: text.home.mapLoadError,
          });
        }
      }
    };

    void initializeMap();

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(resetFrameId);
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
      if (mapReadyListener) {
        naverMapsRef.current?.Event?.removeListener(mapReadyListener);
      }
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      resizeObserver?.disconnect();
      mapInstanceRef.current = null;
      naverMapsRef.current = null;
      closeSheet();
      window.navermap_authFailure = undefined;
      container.innerHTML = "";
    };
  }, [
    appLanguage,
    clearBoundaryPolygons,
    clearMarkers,
    closeSheet,
    text,
  ]);

  useEffect(() => {
    applyNaverMapTheme(mapInstanceRef.current, isDarkMode);
    enableNaverMapPointerInteractions(mapInstanceRef.current);
  }, [isDarkMode]);

  useEffect(() => {
    if (mapReady && isBoundaryDataReady) {
      fitMapToSelectedRegion();
    }
  }, [fitMapToSelectedRegion, isBoundaryDataReady, mapReady]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    closeSheet();
    hasRenderedAttractionMarkersRef.current = false;
    clearMarkers();
  }, [clearMarkers, closeSheet, mapReady, selectedSigunguCode]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    if (!mapReady || !mapInstance || !naverMaps || !attractionData) {
      return;
    }

    const isPlaceLabelUpdate =
      isUpdatingPlaceLabelsRef.current &&
      hasRenderedAttractionMarkersRef.current;
    let stageFrameId: number | null = null;
    if (!isPlaceLabelUpdate) {
      stageFrameId = window.requestAnimationFrame(() => {
        setAttractionLoadingStage("rendering-markers");
      });
      hasRenderedAttractionMarkersRef.current = false;
    }

    clearMarkers();
    const markerBounds = new naverMaps.LatLngBounds() as HomeMapBounds;
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
      hasRenderedAttractionMarkersRef.current = true;
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
        }) as HomeMapOverlay;

        markerRefs.current.push(marker);
        const listener = naverMaps.Event.addListener(marker, "click", () => {
          focusAttraction(attraction);
          onSelectAttractionRef.current({
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
      } else {
        completeMarkerRendering();
      }
    };

    renderMarkerChunk();

    return () => {
      isCancelled = true;
      if (isPlaceLabelUpdate) {
        isUpdatingPlaceLabelsRef.current = false;
      }
      if (stageFrameId != null) {
        window.cancelAnimationFrame(stageFrameId);
      }
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    attractionData,
    clearMarkers,
    fitMapToSelectedRegion,
    focusAttraction,
    isUpdatingPlaceLabelsRef,
    mapReady,
    searchFilter,
    setAttractionLoadingStage,
    text,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  return {
    currentLocation,
    focusAttraction,
    isCurrentLocationLookupPending,
    mapError,
    mapReady,
    mapRef,
  };
}
