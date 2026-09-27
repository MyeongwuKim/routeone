/** 선택 지역과 검색 필터에 맞는 관광지를 네이버 지도 마커로 나누어 렌더링하고 정리한다. */
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
  /** 선택 지역의 관광지와 장소 분류명. 데이터의 지역 코드가 다르면 렌더링하지 않는다. */
  attractionData: HomeAttractionQueryData | undefined;
  /** 마커 클릭 시 선택 관광지 좌표로 지도를 이동하는 함수 */
  focusAttraction: (attraction: GangwonAttraction) => void;
  /** 언어 변경에 따른 장소명 갱신인지 판정하고 완료 상태를 상위 훅에 알리는 ref */
  isUpdatingPlaceLabelsRef: RefObject<boolean>;
  /** 마커 클릭 결과를 장소 상세 열기 흐름에 전달하는 콜백 */
  onSelectAttraction: (
    options: OpenPlaceSheetFromAttractionOptions
  ) => void;
  /** 마커와 클릭 리스너를 생성할 현재 지도 runtime */
  runtime: HomeMapRuntime | null;
  /** 지도에 남길 장소 종류를 결정하는 필터 */
  searchFilter: SearchFilter;
  /** attractionData와 마커 렌더링 범위를 대조할 현재 시·군·구 코드 */
  selectedSigunguCode: string;
  /** 관광지 ID별 혼잡도 순위. 마커 배지와 zIndex 계산에 사용한다. */
  topRankByAttractionId: Map<string, number>;
  /** 관광지 ID별 트렌드명. 마커 선택 결과에 포함하며 없으면 관광지명을 사용한다. */
  trendNameByAttractionId: Map<string, string>;
};

/**
 * 표시 대상 관광지를 장소 종류로 거르고, 겹치는 좌표를 벌린 뒤 한 프레임에 80개씩 마커를 만든다.
 * 새 runtime·지역·필터·데이터가 들어오면 이전 렌더링 요청과 클릭 리스너를 무효화한다.
 * 마커 클릭 시 지도를 이동하고 장소 상세 콜백에 관광지, 분류, 트렌드명과 순위를 전달한다.
 */
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

  /** 등록한 마커 클릭 리스너를 해제하고 모든 관광지 마커를 지도에서 제거한다. */
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
