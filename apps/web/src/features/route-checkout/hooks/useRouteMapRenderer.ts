/**
 * 용도:
 * 루트 체크아웃 지도에 이동선과 장소 마커를 그리고 선택 상태를 반영한다.
 *
 * 동작 방식:
 * 경로 테두기, 일반 이동선, 선택 이동선을 서로 다른 층에 배치하고
 * 장소는 작은 핀으로 표시한 뒤 누른 장소만 상세 말풍선으로 펼친다.
 */
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
  ROUTE_POINT_COMPACT_MARKER_SIZE,
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
  const [expandedPointKey, setExpandedPointKey] = useState<string | null>(null);
  const pointExpansionScopeKey = `${displayDayKey}:${routeViewMode}:${
    selectedSegment
      ? getRouteSegmentKey(
          selectedSegment.variant,
          selectedSegment.segmentId
        )
      : "overview"
  }`;
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
    const container = mapRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    let resizeFrameId: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
      }

      resizeFrameId = window.requestAnimationFrame(() => {
        const naverMaps = window.naver?.maps;
        const routeMap = mapInstanceRef.current;
        if (naverMaps && routeMap) {
          naverMaps.Event.trigger(routeMap, "resize");
        }
        resizeFrameId = null;
      });
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
      if (resizeFrameId !== null) {
        window.cancelAnimationFrame(resizeFrameId);
      }
    };
  }, []);

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
        const pointKey = `${pointExpansionScopeKey}:${variant}:${point.id}`;
        const isExpanded = expandedPointKey === pointKey;
        const markerSize = isExpanded
          ? PLACE_BUBBLE_MARKER_SIZE
          : ROUTE_POINT_COMPACT_MARKER_SIZE;
        const marker = new naverMaps.Marker({
          map: routeMap,
          position,
          title: point.title,
          draggable: isStartPreviewMarker,
          zIndex: isExpanded
            ? 2200
            : variant === "comparison"
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
              expanded: isExpanded,
            }),
            anchor: new naverMaps.Point(
              markerSize.anchorX,
              markerSize.anchorY
            ),
          },
        });

        const clickListener = naverMaps.Event.addListener(
          marker,
          "click",
          () => {
            setExpandedPointKey((currentPointKey) =>
              currentPointKey === pointKey ? null : pointKey
            );
          }
        );
        overlayCleanupRefs.current.push(() => {
          naverMaps.Event.removeListener?.(clickListener);
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

    type RouteLineView = {
      path: unknown[];
      segmentColor: string;
      strokeOpacity: number;
      strokeStyle: string;
      strokeWeight: number;
      isSelectedSegment: boolean;
      order: number;
      variant: RouteDisplayVariant;
    };

    const routeLineViews: RouteLineView[] = [];
    const collectSegmentLines = (
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
                : 0.78;
        const strokeStyle =
          isAllComparisonView && isComparisonLine ? "shortdash" : "solid";
        routeLineViews.push({
          path,
          segmentColor,
          strokeOpacity,
          strokeStyle,
          strokeWeight,
          isSelectedSegment: Boolean(isSelectedSegment),
          order: routeLineViews.length,
          variant,
        });
      });
    };

    const createPolyline = (options: Record<string, unknown>) => {
      const line = new naverMaps.Polyline({
        map: routeMap,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        ...options,
      });
      overlayRefs.current.push(line);
    };

    const renderSegmentLines = () => {
      const hasSelectedSegment = Boolean(selectedSegment);
      const isAllComparisonView = hasComparisonRoute && routeViewMode === "all";
      const normalLineViews = routeLineViews.filter(
        (lineView) => !lineView.isSelectedSegment
      );
      const selectedLineView = routeLineViews.find(
        (lineView) => lineView.isSelectedSegment
      );

      normalLineViews.forEach((lineView) => {
        const shouldRenderCasingLine =
          !isAllComparisonView || hasSelectedSegment;
        if (!shouldRenderCasingLine) {
          return;
        }

        createPolyline({
          path: lineView.path,
          strokeColor: "#ffffff",
          strokeWeight:
            lineView.strokeWeight + (isAllComparisonView ? 4 : 6),
          strokeOpacity: hasSelectedSegment ? 0.24 : 0.74,
          strokeStyle: lineView.strokeStyle,
          zIndex: 300 + lineView.order,
        });
      });

      normalLineViews.forEach((lineView) => {
        const variantLayer = lineView.variant === "current" ? 80 : 0;
        createPolyline({
          path: lineView.path,
          strokeColor: lineView.segmentColor,
          strokeWeight: lineView.strokeWeight,
          strokeOpacity: lineView.strokeOpacity,
          strokeStyle: lineView.strokeStyle,
          zIndex: 500 + variantLayer + lineView.order,
        });
      });

      if (!selectedLineView) {
        return;
      }

      createPolyline({
        path: selectedLineView.path,
        strokeColor: selectedLineView.segmentColor,
        strokeWeight: 20,
        strokeOpacity: 0.2,
        strokeStyle: "solid",
        zIndex: 900,
      });
      createPolyline({
        path: selectedLineView.path,
        strokeColor: "#ffffff",
        strokeWeight: selectedLineView.strokeWeight + 7,
        strokeOpacity: 0.94,
        strokeStyle: selectedLineView.strokeStyle,
        zIndex: 920,
      });
      createPolyline({
        path: selectedLineView.path,
        strokeColor: selectedLineView.segmentColor,
        strokeWeight: selectedLineView.strokeWeight,
        strokeOpacity: 1,
        strokeStyle: selectedLineView.strokeStyle,
        zIndex: 940,
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
      collectSegmentLines(routeSegments, "current");
    }
    if (shouldShowComparisonRoute) {
      collectSegmentLines(comparisonRouteSegments, "comparison");
    }
    renderSegmentLines();
    if (shouldShowComparisonRoute) {
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
    expandedPointKey,
    hasComparisonRoute,
    hasDaySelector,
    isDarkMode,
    isSdkReady,
    isStartPreviewDirty,
    mapAutoFitKey,
    moveStartPreviewTo,
    pointExpansionScopeKey,
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
