/** 현재 시·군·구에만 강조 면과 외곽선을 표시한다. 권역 전체 외곽선은 지도 지역 선택 훅에서 관리한다. */
import { useCallback, useEffect, useRef } from "react";
import {
  convertUtmkToWgs84,
  type GeoMultiPolygon,
} from "@/lib/gangwonBoundaryUtils";
import type {
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
 * 국내 범위를 벗어나거나 해석할 수 없는 좌표는 제외한다.
 * 선택 지역이나 지도 인스턴스가 바뀌면 이전 강조 면과 외곽선을 제거한다.
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

  useEffect(() => {
    if (!runtime) {
      return;
    }

    const { map: mapInstance, naverMaps } = runtime;

    const multiPolygon = boundaryBySigunguCode[selectedSigunguCode];
    if (!multiPolygon || multiPolygon.length === 0) {
      return;
    }

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

    // 섬이 많은 지역도 모든 경로를 두 도형에 묶어 강조한다.
    const paths = multiPolygon.flatMap((polygon) => polygon.map((ring) =>
      ring.map(toLatLng).filter((point) => point != null)
    )).filter((ring) => ring.length >= 3);
    if (paths.length === 0) return;

    const boundaryHalo = new naverMaps.Polygon({
      map: mapInstance,
      paths,
      strokeColor: "#ffffff",
      strokeWeight: 8,
      strokeOpacity: 0.9,
      fillColor: "#14b8a6",
      fillOpacity: 0.1,
      clickable: false,
      zIndex: 880,
    });
    const boundaryOutline = new naverMaps.Polygon({
      map: mapInstance,
      paths,
      strokeColor: "#0d9488",
      strokeWeight: 4,
      strokeOpacity: 1,
      fillOpacity: 0,
      clickable: false,
      zIndex: 901,
    });
    boundaryPolygonRefs.current.push(boundaryHalo, boundaryOutline);

    return clearBoundaryPolygons;
  }, [
    boundaryBySigunguCode,
    clearBoundaryPolygons,
    runtime,
    selectedSigunguCode,
  ]);

  return { clearBoundaryPolygons };
}
