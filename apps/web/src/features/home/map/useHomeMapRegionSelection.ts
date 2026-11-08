import { useEffect } from "react";
import type { CurrentLocation, GeoMultiPolygon } from "@/lib/gangwonBoundaryUtils";
import type { HomeMapBounds, HomeMapRuntime } from "./homeMapTypes";

type Options = {
  runtime: HomeMapRuntime | null;
  /** 현재 시·도의 시·군·구 코드별 WGS84 경계. */
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  onFitAreaBounds: (bounds: HomeMapBounds) => void;
  onSelectLocation: (position: CurrentLocation) => void;
};

/**
 * 현재 시·도의 모든 시·군·구 경계를 그리고, 권역이나 지도 인스턴스가 바뀌면 전체 경계에 화면을 맞춘다.
 * 지도 탭 좌표를 지역 선택 처리에 전달하며, 선택한 시·군·구가 바뀌어도 권역 도형과 줌을 유지한다.
 */
export function useHomeMapRegionSelection({ runtime, boundaryBySigunguCode, onFitAreaBounds, onSelectLocation }: Options) {
  useEffect(() => {
    if (!runtime) return;
    const { map, naverMaps } = runtime;
    const areaBounds = new naverMaps.LatLngBounds();
    const overlays = Object.values(boundaryBySigunguCode).flatMap((multiPolygon) => {
      // 섬과 내부 경계도 시·군·구마다 하나의 도형에 묶어 표시한다.
      const paths = multiPolygon.flatMap((polygon) => polygon.map((ring) =>
        ring.map(([lng, lat]) => {
          const point = new naverMaps.LatLng(lat, lng);
          areaBounds.extend(point);
          return point;
        })
      ));
      return paths.length ? [new naverMaps.Polygon({
        map,
        paths,
        strokeColor: "#475569",
        strokeWeight: 1.5,
        strokeOpacity: 0.65,
        fillOpacity: 0,
        clickable: false,
        zIndex: 50,
      })] : [];
    });
    if (overlays.length) onFitAreaBounds(areaBounds);

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [runtime, boundaryBySigunguCode, onFitAreaBounds]);

  // 마커 탭은 기존 상세 동작을 유지하도록 경계 도형 대신 지도에서 탭을 받는다.
  useEffect(() => {
    if (!runtime) return;
    const { map, naverMaps } = runtime;
    const listener = naverMaps.Event.addListener(map, "click", (event: { coord?: { lat: () => number; lng: () => number } }) => {
      if (event.coord) onSelectLocation({ lat: event.coord.lat(), lng: event.coord.lng() });
    });
    return () => naverMaps.Event.removeListener(listener);
  }, [runtime, onSelectLocation]);
}
