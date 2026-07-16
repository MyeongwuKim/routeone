import { useCallback, useEffect, useRef, useState } from "react";
import { PLACE_BUBBLE_MARKER_SIZE } from "@/components/map/NaverMapMarkerIcon";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import {
  createRoutePointBubbleMarkerIconHtml,
  getRouteSegmentDisplayColor,
  getRouteSegmentKey,
  readRouteMapLatLng,
  type RouteDisplayVariant,
  type RouteMapPoint,
  type RouteMapSegment,
  type RouteMapViewMode,
  type RouteSegmentSelection,
} from "../models/routeMapModel";
import type { RouteStartLocation } from "../models/routePlanTypes";

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

type RouteMapInstance = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  setCenter?: (center: unknown) => void;
  setZoom?: (zoom: number) => void;
  getZoom?: () => number;
};

type RouteMapOverlay = {
  setMap: (map: null) => void;
};

type SelectedRouteSegmentView = {
  segment: RouteMapSegment;
  color: string;
} | null;

type UseRouteMapRendererOptions = {
  comparisonRoutePoints: RouteMapPoint[];
  comparisonRouteSegments: RouteMapSegment[];
  displayDayKey: string;
  enableStartPreview: boolean;
  hasComparisonRoute: boolean;
  hasDaySelector: boolean;
  isStartPreviewDirty: boolean;
  mapAutoFitKey: string;
  moveStartPreviewTo: (location: RouteStartLocation) => void;
  routePoints: RouteMapPoint[];
  routeSegments: RouteMapSegment[];
  routeViewMode: RouteMapViewMode;
  selectedSegment: RouteSegmentSelection | null;
  selectedRouteSegmentView: SelectedRouteSegmentView;
  shouldShowComparisonRoute: boolean;
  shouldShowCurrentRoute: boolean;
};

type MapSdkState = {
  language: string;
  isReady: boolean;
  error: string | null;
};

export function useRouteMapRenderer({
  comparisonRoutePoints,
  comparisonRouteSegments,
  displayDayKey,
  enableStartPreview,
  hasComparisonRoute,
  hasDaySelector,
  isStartPreviewDirty,
  mapAutoFitKey,
  moveStartPreviewTo,
  routePoints,
  routeSegments,
  routeViewMode,
  selectedSegment,
  selectedRouteSegmentView,
  shouldShowComparisonRoute,
  shouldShowCurrentRoute,
}: UseRouteMapRendererOptions) {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<RouteMapInstance | null>(null);
  const renderedDayKeyRef = useRef<string | null>(null);
  const autoFitKeyRef = useRef<string | null>(null);
  const overlayRefs = useRef<RouteMapOverlay[]>([]);
  const overlayCleanupRefs = useRef<Array<() => void>>([]);
  const [sdkState, setSdkState] = useState<MapSdkState>({
    language: appLanguage,
    isReady: false,
    error: null,
  });
  const isSdkReady =
    sdkState.language === appLanguage && sdkState.isReady;
  const mapError =
    sdkState.language === appLanguage ? sdkState.error : null;

  const clearOverlays = useCallback(() => {
    overlayCleanupRefs.current.forEach((cleanup) => cleanup());
    overlayCleanupRefs.current = [];
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
  }, []);

  useEffect(() => {
    let isActive = true;

    loadNaverMapSdk(NCP_KEY_ID, appLanguage)
      .then(() => {
        if (isActive) {
          setSdkState({
            language: appLanguage,
            isReady: true,
            error: null,
          });
        }
      })
      .catch(() => {
        if (isActive) {
          setSdkState({
            language: appLanguage,
            isReady: false,
            error: text.home.mapLoadError,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [appLanguage, text]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const container = mapRef.current;
    if (!isSdkReady || !naverMaps || !container || routePoints.length === 0) {
      return;
    }

    const previousRenderedDayKey = renderedDayKeyRef.current;
    const previousAutoFitKey = autoFitKeyRef.current;
    let routeMap = mapInstanceRef.current;
    if (!routeMap) {
      routeMap = new naverMaps.Map(container, {
        center: new naverMaps.LatLng(routePoints[0].lat, routePoints[0].lng),
        zoom: 11,
        minZoom: 7,
        mapTypeId: naverMaps.MapTypeId.NORMAL,
        zoomControl: false,
        draggable: true,
        pinchZoom: true,
        scrollWheel: true,
        mapDataControl: false,
        scaleControl: false,
        logoControl: false,
        ...getNaverMapThemeOptions(isDarkMode),
      }) as RouteMapInstance;
      mapInstanceRef.current = routeMap;
    } else {
      naverMaps.Event.trigger(routeMap, "resize");
    }

    applyNaverMapTheme(routeMap, isDarkMode);
    enableNaverMapPointerInteractions(routeMap);

    const bounds = new naverMaps.LatLngBounds();
    const selectedRouteSegment = selectedRouteSegmentView?.segment ?? null;
    const selectedSegmentColor = selectedRouteSegmentView?.color;
    const shouldShowPointMarker = (
      point: RouteMapPoint,
      variant: RouteDisplayVariant
    ) => {
      if (!selectedSegment || !selectedRouteSegment) {
        return true;
      }

      if (selectedSegment.variant !== variant) {
        return false;
      }

      return (
        point.id === selectedRouteSegment.from.id ||
        point.id === selectedRouteSegment.to.id
      );
    };
    const createPath = (path: Array<{ lat: number; lng: number }>) =>
      path.map((point) => new naverMaps.LatLng(point.lat, point.lng));
    const extendBoundsWithPoints = (points: RouteMapPoint[]) => {
      points.forEach((point) => {
        bounds.extend(new naverMaps.LatLng(point.lat, point.lng));
      });
    };
    const extendBoundsWithSegments = (segments: RouteMapSegment[]) => {
      segments.forEach((segment) => {
        segment.path.forEach((pathPoint) => {
          bounds.extend(new naverMaps.LatLng(pathPoint.lat, pathPoint.lng));
        });
      });
    };

    const createPlaceMarkers = (
      points: RouteMapPoint[],
      variant: RouteDisplayVariant
    ) => {
      points.forEach((point, index) => {
        if (!shouldShowPointMarker(point, variant)) {
          return;
        }

        const position = new naverMaps.LatLng(point.lat, point.lng);
        const isStartPreviewMarker =
          enableStartPreview &&
          variant === "current" &&
          point.variant === "start";
        const marker = new naverMaps.Marker({
          map: routeMap,
          position,
          title: point.title,
          draggable: isStartPreviewMarker,
          zIndex:
            variant === "comparison"
              ? point.variant === "start"
                ? 1160
                : 1320 + index
              : point.variant === "start"
                ? 1900
                : 1520 + index,
          icon: {
            content: createRoutePointBubbleMarkerIconHtml({
              point,
              variant,
              showVariantBadge: hasComparisonRoute && routeViewMode === "all",
              text,
              focusColor:
                selectedSegment?.variant === variant
                  ? selectedSegmentColor
                  : undefined,
            }),
            anchor: new naverMaps.Point(
              PLACE_BUBBLE_MARKER_SIZE.anchorX,
              PLACE_BUBBLE_MARKER_SIZE.anchorY
            ),
          },
        });

        if (isStartPreviewMarker) {
          const dragEndListener = naverMaps.Event.addListener(
            marker,
            "dragend",
            () => {
              const nextLocation = readRouteMapLatLng(marker.getPosition?.());
              if (nextLocation) {
                moveStartPreviewTo(nextLocation);
              }
            }
          );
          overlayCleanupRefs.current.push(() => {
            naverMaps.Event.removeListener?.(dragEndListener);
          });
        }

        overlayRefs.current.push(marker);
      });
    };

    const createSegmentLines = (
      segments: RouteMapSegment[],
      variant: RouteDisplayVariant
    ) => {
      segments.forEach((segment, index) => {
        const path = createPath(segment.path);
        const isAllComparisonView =
          hasComparisonRoute && routeViewMode === "all";
        const isComparisonLine = variant === "comparison";
        const segmentColor = getRouteSegmentDisplayColor({
          index,
          variant,
          hasComparisonRoute,
          routeViewMode,
        });
        const segmentKey = getRouteSegmentKey(variant, segment.id);
        const isSelectedSegment =
          selectedSegment &&
          getRouteSegmentKey(
            selectedSegment.variant,
            selectedSegment.segmentId
          ) === segmentKey;
        const hasSelectedSegment = Boolean(selectedSegment);
        const strokeWeight = isSelectedSegment
          ? 11
          : isAllComparisonView && isComparisonLine
            ? 6
            : isAllComparisonView
              ? 7
              : 5;
        const strokeOpacity = isSelectedSegment
          ? 1
          : hasSelectedSegment
            ? 0.12
            : isAllComparisonView && isComparisonLine
              ? 0.76
              : isAllComparisonView
                ? 0.66
                : 0.9;
        const strokeStyle =
          isAllComparisonView && isComparisonLine ? "shortdash" : "solid";
        const lineZIndex = isSelectedSegment
          ? 1000
          : isAllComparisonView && isComparisonLine
            ? 620 + index
            : isAllComparisonView
              ? 560 + index
              : variant === "comparison"
                ? 380 + index
                : 430 + index;

        if (isSelectedSegment) {
          const highlightLine = new naverMaps.Polyline({
            map: routeMap,
            path,
            strokeColor: segmentColor,
            strokeWeight: 18,
            strokeOpacity: 0.24,
            strokeStyle: "solid",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            zIndex: 980,
          });
          overlayRefs.current.push(highlightLine);
        }

        const shouldRenderCasingLine =
          !isAllComparisonView || hasSelectedSegment || isSelectedSegment;
        const routeCasingLine = shouldRenderCasingLine
          ? new naverMaps.Polyline({
              map: routeMap,
              path,
              strokeColor: "#ffffff",
              strokeWeight: strokeWeight + (isAllComparisonView ? 4 : 6),
              strokeOpacity: hasSelectedSegment ? 0.36 : 0.86,
              strokeStyle,
              strokeLineCap: "round",
              strokeLineJoin: "round",
              zIndex: lineZIndex - 1,
            })
          : null;
        const routeLine = new naverMaps.Polyline({
          map: routeMap,
          path,
          strokeColor: segmentColor,
          strokeWeight,
          strokeOpacity,
          strokeStyle,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          zIndex: lineZIndex,
        });

        if (routeCasingLine) {
          overlayRefs.current.push(routeCasingLine);
        }
        overlayRefs.current.push(routeLine);
      });
    };

    if (shouldShowComparisonRoute) {
      extendBoundsWithSegments(comparisonRouteSegments);
      extendBoundsWithPoints(comparisonRoutePoints);
    }
    if (shouldShowCurrentRoute) {
      extendBoundsWithSegments(routeSegments);
      extendBoundsWithPoints(routePoints);
    }

    const shouldPreserveStartPreviewViewport =
      enableStartPreview &&
      isStartPreviewDirty &&
      previousRenderedDayKey === displayDayKey;
    const shouldAutoFitBounds =
      !selectedSegment &&
      !shouldPreserveStartPreviewViewport &&
      previousAutoFitKey !== mapAutoFitKey;

    try {
      if (shouldAutoFitBounds) {
        routeMap.fitBounds(bounds, {
          top: hasDaySelector ? 136 : 56,
          right: 92,
          bottom: hasComparisonRoute && routeViewMode === "all" ? 104 : 56,
          left: 92,
        });
      }
    } catch {
      if (shouldAutoFitBounds) {
        routeMap.fitBounds(bounds);
      }
    }

    if (shouldAutoFitBounds) {
      autoFitKeyRef.current = mapAutoFitKey;
    }

    clearOverlays();
    if (shouldShowCurrentRoute) {
      createSegmentLines(routeSegments, "current");
    }
    if (shouldShowComparisonRoute) {
      createSegmentLines(comparisonRouteSegments, "comparison");
      createPlaceMarkers(comparisonRoutePoints, "comparison");
    }
    if (shouldShowCurrentRoute) {
      createPlaceMarkers(routePoints, "current");
    }

    renderedDayKeyRef.current = displayDayKey;
    window.requestAnimationFrame(() => {
      naverMaps.Event.trigger(routeMap, "resize");
    });
  }, [
    clearOverlays,
    comparisonRoutePoints,
    comparisonRouteSegments,
    displayDayKey,
    enableStartPreview,
    hasComparisonRoute,
    hasDaySelector,
    isDarkMode,
    isSdkReady,
    isStartPreviewDirty,
    mapAutoFitKey,
    moveStartPreviewTo,
    routePoints,
    routeSegments,
    routeViewMode,
    selectedSegment,
    selectedRouteSegmentView,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
    text,
  ]);

  useEffect(() => {
    return () => {
      clearOverlays();
      mapInstanceRef.current = null;
    };
  }, [clearOverlays]);

  return {
    isSdkReady,
    mapError,
    mapRef,
  };
}
