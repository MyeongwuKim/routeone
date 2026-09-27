/** 현재 위치 좌표와 정확도 범위를 네이버 지도 오버레이로 표시하고 생명주기를 관리한다. */
import { useCallback, useEffect, useRef } from "react";
import {
  createCurrentLocationMarkerIconHtml,
  CURRENT_LOCATION_MARKER_SIZE,
} from "@/components/map/NaverMapMarkerIcon";
import type { RouteOnePosition } from "@/lib/currentPosition";
import type {
  HomeMapOverlay,
  HomeMapRuntime,
} from "./homeMapTypes";

type UseHomeCurrentLocationOverlayOptions = {
  /** 마커를 표시할 현재 위치. null이면 기존 현재 위치 오버레이만 제거한다. */
  currentLocation: RouteOnePosition | null;
  /** 네이버 지도 현재 위치 마커의 접근성 제목 */
  currentLocationTitle: string;
  /** 마커와 정확도 원을 생성할 지도 인스턴스와 네이버 지도 API */
  runtime: HomeMapRuntime | null;
};

/**
 * runtime과 현재 위치가 모두 있으면 위치 마커를 만들고, 유효한 양수 accuracyMeters가 있으면
 * 같은 좌표에 정확도 원도 표시한다. 좌표·제목·runtime이 바뀌거나 정리될 때 이전 오버레이를 제거한다.
 */
export function useHomeCurrentLocationOverlay({
  currentLocation,
  currentLocationTitle,
  runtime,
}: UseHomeCurrentLocationOverlayOptions) {
  const currentLocationOverlayRefs = useRef<HomeMapOverlay[]>([]);

  /** 생성한 정확도 원과 현재 위치 마커를 지도에서 제거하고 참조 목록을 비운다. */
  const clearCurrentLocationOverlays = useCallback(() => {
    currentLocationOverlayRefs.current.forEach((overlay) =>
      overlay.setMap(null)
    );
    currentLocationOverlayRefs.current = [];
  }, []);

  useEffect(() => {
    clearCurrentLocationOverlays();
    if (!runtime || !currentLocation) {
      return;
    }

    const { map: mapInstance, naverMaps } = runtime;

    const position = new naverMaps.LatLng(
      currentLocation.lat,
      currentLocation.lng
    );
    const accuracyMeters = currentLocation.accuracyMeters;

    if (
      typeof accuracyMeters === "number" &&
      Number.isFinite(accuracyMeters) &&
      accuracyMeters > 0
    ) {
      const accuracyCircle = new naverMaps.Circle({
        map: mapInstance,
        center: position,
        radius: accuracyMeters,
        strokeColor: "#2563eb",
        strokeWeight: 1,
        strokeOpacity: 0.45,
        fillColor: "#60a5fa",
        fillOpacity: 0.14,
        clickable: false,
        zIndex: 1000,
      }) as HomeMapOverlay;
      currentLocationOverlayRefs.current.push(accuracyCircle);
    }

    const marker = new naverMaps.Marker({
      map: mapInstance,
      position,
      title: currentLocationTitle,
      zIndex: 2800,
      icon: {
        content: createCurrentLocationMarkerIconHtml(),
        anchor: new naverMaps.Point(
          CURRENT_LOCATION_MARKER_SIZE / 2,
          CURRENT_LOCATION_MARKER_SIZE / 2
        ),
      },
    }) as HomeMapOverlay;
    currentLocationOverlayRefs.current.push(marker);

    return clearCurrentLocationOverlays;
  }, [
    clearCurrentLocationOverlays,
    currentLocation,
    currentLocationTitle,
    runtime,
  ]);

  return {
    clearCurrentLocationOverlays,
  };
}
