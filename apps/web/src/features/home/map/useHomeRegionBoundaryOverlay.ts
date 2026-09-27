/** 선택한 시·군·구의 경계 좌표를 네이버 지도 도형으로 변환하고 오버레이 생명주기를 관리한다. */
import { useCallback, useEffect, useRef } from "react";
import {
  convertUtmkToWgs84,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type {
  HomeMapBounds,
  HomeMapOverlay,
  HomeMapRuntime,
} from "./homeMapTypes";

type CoordinateLike = {
  lat?: (() => number) | number;
  lng?: (() => number) | number;
  x?: number;
  y?: number;
  _lat?: number;
  _lng?: number;
};

type UseHomeRegionBoundaryOverlayOptions = {
  /** 시·군·구 코드를 키로 갖는 원본 다중 폴리곤 좌표 */
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  /** 경계 도형과 영역 Bounds를 생성할 지도 runtime */
  runtime: HomeMapRuntime | null;
  /** boundaryBySigunguCode에서 그릴 경계를 선택하는 현재 시·군·구 코드 */
  selectedSigunguCode: string;
};

/**
 * WGS84 좌표는 그대로 사용하고, 투영 좌표는 네이버 변환 API와 로컬 UTMK 변환을 차례로 시도한다.
 * 국내 범위를 벗어나거나 해석할 수 없는 좌표는 제외하며, 그린 도형이 있으면 지도 이동에 사용할
 * 전체 Bounds를 반환한다. runtime 변경 또는 훅 정리 시 생성한 폴리곤과 선을 모두 제거한다.
 */
export function useHomeRegionBoundaryOverlay({
  boundaryBySigunguCode,
  runtime,
  selectedSigunguCode,
}: UseHomeRegionBoundaryOverlayOptions) {
  const boundaryPolygonRefs = useRef<HomeMapOverlay[]>([]);

  /** 현재 지도에 추가한 경계 면·외곽선·강조선을 모두 제거한다. */
  const clearBoundaryPolygons = useCallback(() => {
    boundaryPolygonRefs.current.forEach((polygon) => polygon.setMap(null));
    boundaryPolygonRefs.current = [];
  }, []);

  /** 선택 지역 경계를 다시 그린 뒤 유효한 모든 좌표를 포함하는 Bounds를 반환한다. */
  const drawSelectedRegionBoundary = useCallback(() => {
    if (!runtime) {
      return null;
    }

    const { map: mapInstance, naverMaps } = runtime;

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
            .filter(
              (point): point is NonNullable<typeof point> => point != null
            )
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
    runtime,
    selectedSigunguCode,
  ]);

  useEffect(() => {
    return () => {
      clearBoundaryPolygons();
    };
  }, [clearBoundaryPolygons, runtime]);

  return {
    clearBoundaryPolygons,
    drawSelectedRegionBoundary,
  };
}
