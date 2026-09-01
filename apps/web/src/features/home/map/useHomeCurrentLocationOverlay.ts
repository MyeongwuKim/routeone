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
  currentLocation: RouteOnePosition | null;
  currentLocationTitle: string;
  runtime: HomeMapRuntime | null;
};

export function useHomeCurrentLocationOverlay({
  currentLocation,
  currentLocationTitle,
  runtime,
}: UseHomeCurrentLocationOverlayOptions) {
  const currentLocationOverlayRefs = useRef<HomeMapOverlay[]>([]);

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
