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
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  runtime: HomeMapRuntime | null;
  selectedSigunguCode: string;
};

export function useHomeRegionBoundaryOverlay({
  boundaryBySigunguCode,
  runtime,
  selectedSigunguCode,
}: UseHomeRegionBoundaryOverlayOptions) {
  const boundaryPolygonRefs = useRef<HomeMapOverlay[]>([]);

  const clearBoundaryPolygons = useCallback(() => {
    boundaryPolygonRefs.current.forEach((polygon) => polygon.setMap(null));
    boundaryPolygonRefs.current = [];
  }, []);

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
