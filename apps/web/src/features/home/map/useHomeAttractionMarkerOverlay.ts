import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createBadgeMarkerIconHtml } from "@/components/map/NaverMapMarkerIcon";
import {
  buildSpreadMarkerPositionMap,
  getAttractionMarkerKey,
  matchesPlaceFilter,
  resolveMarkerType,
  type OpenPlaceSheetFromAttractionOptions,
  type SearchFilter,
} from "@/lib/gangwonAttractionMap";
import { useUiText } from "@/lib/uiText";
import type { GangwonAttraction } from "@/lib/visitKoreaTourApi";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import type { HomeAttractionQueryData } from "../useHomeAttractionData";
import type {
  HomeMapOverlay,
  HomeMapRuntime,
  HomeNaverMaps,
} from "./homeMapTypes";

const MARKER_RENDER_CHUNK_SIZE = 80;

type MarkerListenerRecord = {
  listener: unknown;
  naverMaps: HomeNaverMaps;
};

type UseHomeAttractionMarkerOverlayOptions = {
  attractionData: HomeAttractionQueryData | undefined;
  focusAttraction: (attraction: GangwonAttraction) => void;
  isUpdatingPlaceLabelsRef: RefObject<boolean>;
  onSelectAttraction: (
    options: OpenPlaceSheetFromAttractionOptions
  ) => void;
  runtime: HomeMapRuntime | null;
  searchFilter: SearchFilter;
  selectedSigunguCode: string;
  topRankByAttractionId: Map<string, number>;
  trendNameByAttractionId: Map<string, string>;
};

export function useHomeAttractionMarkerOverlay({
  attractionData,
  focusAttraction,
  isUpdatingPlaceLabelsRef,
  onSelectAttraction,
  runtime,
  searchFilter,
  selectedSigunguCode,
  topRankByAttractionId,
  trendNameByAttractionId,
}: UseHomeAttractionMarkerOverlayOptions) {
  const text = useUiText();
  const closeSheet = useMapSheetStore((state) => state.closeSheet);
  const markerRefs = useRef<HomeMapOverlay[]>([]);
  const markerListenerRefs = useRef<MarkerListenerRecord[]>([]);
  const markerRenderRequestIdRef = useRef(0);
  const hasRenderedAttractionMarkersRef = useRef(false);
  const onSelectAttractionRef = useRef(onSelectAttraction);
  const [renderingMarkerScope, setRenderingMarkerScope] = useState<
    string | null
  >(null);
  const markerScope = runtime
    ? `${runtime.sessionKey}:${selectedSigunguCode}`
    : null;
  const activeAttractionData =
    attractionData?.sigunguCode === selectedSigunguCode
      ? attractionData
      : undefined;

  useEffect(() => {
    onSelectAttractionRef.current = onSelectAttraction;
  }, [onSelectAttraction]);

  const clearMarkers = useCallback(() => {
    markerListenerRefs.current.forEach(({ listener, naverMaps }) => {
      naverMaps.Event?.removeListener(listener);
    });
    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    markerListenerRefs.current = [];
  }, []);

  useEffect(() => {
    markerRenderRequestIdRef.current += 1;
    hasRenderedAttractionMarkersRef.current = false;
    clearMarkers();
    if (runtime) {
      closeSheet();
    }

    return () => {
      markerRenderRequestIdRef.current += 1;
      clearMarkers();
    };
  }, [clearMarkers, closeSheet, runtime, selectedSigunguCode]);

  useEffect(() => {
    if (!runtime || !activeAttractionData || !markerScope) {
      markerRenderRequestIdRef.current += 1;
      clearMarkers();
      isUpdatingPlaceLabelsRef.current = false;
      return;
    }

    const { map: mapInstance, naverMaps } = runtime;
    const renderingScope = markerScope;
    const renderRequestId = markerRenderRequestIdRef.current + 1;
    markerRenderRequestIdRef.current = renderRequestId;
    const isPlaceLabelUpdate =
      isUpdatingPlaceLabelsRef.current &&
      hasRenderedAttractionMarkersRef.current;
    if (!isPlaceLabelUpdate) {
      hasRenderedAttractionMarkersRef.current = false;
    }

    clearMarkers();
    let isCancelled = false;
    let frameId: number | null = null;
    const visibleAttractions = activeAttractionData.allAttractions
      .map((attraction) => ({
        attraction,
        markerType: resolveMarkerType(
          attraction,
          activeAttractionData.lclsNameByCode
        ),
      }))
      .filter(({ attraction, markerType }) =>
        matchesPlaceFilter(attraction, markerType, searchFilter)
      );
    const spreadPositionByMarkerKey = buildSpreadMarkerPositionMap(
      visibleAttractions.map(({ attraction }) => attraction)
    );

    const isCurrentRender = () =>
      !isCancelled &&
      markerRenderRequestIdRef.current === renderRequestId;

    const completeMarkerRendering = () => {
      if (!isCurrentRender()) {
        return;
      }

      hasRenderedAttractionMarkersRef.current = true;
      setRenderingMarkerScope(null);
      isUpdatingPlaceLabelsRef.current = false;
    };

    let markerIndex = 0;
    const renderMarkerChunk = () => {
      if (!isCurrentRender()) {
        return;
      }

      const nextIndex = Math.min(
        markerIndex + MARKER_RENDER_CHUNK_SIZE,
        visibleAttractions.length
      );

      try {
        for (; markerIndex < nextIndex; markerIndex += 1) {
          const markerItem = visibleAttractions[markerIndex];
          if (!markerItem) {
            continue;
          }

          const { attraction, markerType } = markerItem;
          const spreadPosition =
            spreadPositionByMarkerKey.get(
              getAttractionMarkerKey(attraction)
            ) ?? {
              lat: attraction.lat,
              lng: attraction.lng,
            };
          const position = new naverMaps.LatLng(
            spreadPosition.lat,
            spreadPosition.lng
          );
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
                  highlightLabel: text.home.ongoing,
                }
              ),
              anchor: new naverMaps.Point(markerAnchor, markerAnchor),
            },
          }) as HomeMapOverlay;

          markerRefs.current.push(marker);
          const listener = naverMaps.Event.addListener(
            marker,
            "click",
            () => {
              focusAttraction(attraction);
              onSelectAttractionRef.current({
                attraction,
                markerType,
                touristTrendName,
                rank,
              });
            }
          );
          markerListenerRefs.current.push({ listener, naverMaps });
        }
      } catch (error) {
        console.warn("[routeone-web] failed to render map markers", error);
        completeMarkerRendering();
        return;
      }

      if (markerIndex < visibleAttractions.length) {
        frameId = window.requestAnimationFrame(renderMarkerChunk);
      } else {
        completeMarkerRendering();
      }
    };

    frameId = window.requestAnimationFrame(() => {
      if (!isCurrentRender()) {
        return;
      }
      if (!isPlaceLabelUpdate) {
        setRenderingMarkerScope(renderingScope);
      }
      renderMarkerChunk();
    });

    return () => {
      isCancelled = true;
      if (markerRenderRequestIdRef.current === renderRequestId) {
        markerRenderRequestIdRef.current += 1;
      }
      if (isPlaceLabelUpdate) {
        isUpdatingPlaceLabelsRef.current = false;
      }
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [
    activeAttractionData,
    clearMarkers,
    focusAttraction,
    isUpdatingPlaceLabelsRef,
    markerScope,
    runtime,
    searchFilter,
    text,
    topRankByAttractionId,
    trendNameByAttractionId,
  ]);

  return {
    clearMarkers,
    isRenderingMarkers:
      activeAttractionData !== undefined &&
      markerScope !== null &&
      renderingMarkerScope === markerScope,
  };
}
