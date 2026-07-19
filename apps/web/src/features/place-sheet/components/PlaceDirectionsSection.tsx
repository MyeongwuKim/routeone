import { useCallback, useEffect, useRef, useState } from "react";
import { IoCarSportOutline, IoNavigate } from "react-icons/io5";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import type { UiText } from "@/lib/uiText";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetPlace } from "@/types/place";
import type { PlaceSheetCoordinates } from "../placeSheetModel";
import { RouteInfoSkeleton, SkeletonBar } from "./PlaceSheetPrimitives";

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const NAVER_MAP_SCHEME_APP_NAME = "routeone.web";

type PreviewMapInstance = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
};

type PreviewMapOverlay = {
  setMap: (map: null) => void;
};

type PlaceDirectionsSectionProps = {
  appLanguage: AppLanguage;
  currentLocation: PlaceSheetCoordinates;
  isDarkMode: boolean;
  isRouteLoading: boolean;
  routeDistanceText: string | null;
  routeDurationText: string | null;
  routeError: string | null;
  routePathPoints: PlaceSheetCoordinates[];
  selectedPlace: MapSheetPlace;
  text: UiText;
};

function PlaceDirectionsSection({
  appLanguage,
  currentLocation,
  isDarkMode,
  isRouteLoading,
  routeDistanceText,
  routeDurationText,
  routeError,
  routePathPoints,
  selectedPlace,
  text,
}: PlaceDirectionsSectionProps) {
  const [isPreviewMapSdkReady, setIsPreviewMapSdkReady] = useState(false);
  const [previewMapError, setPreviewMapError] = useState<string | null>(null);
  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const previewMapInstanceRef = useRef<PreviewMapInstance | null>(null);
  const previewMapContainerRef = useRef<HTMLDivElement | null>(null);
  const previewOverlaysRef = useRef<PreviewMapOverlay[]>([]);
  const selectedPlaceKey = `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`;

  const clearPreviewOverlays = useCallback(() => {
    previewOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    previewOverlaysRef.current = [];
  }, []);

  useEffect(() => {
    let isActive = true;
    const resetPreviewMapState = () => {
      if (!isActive) {
        return;
      }

      setIsPreviewMapSdkReady(false);
      setPreviewMapError(null);
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      if (previewMapContainerRef.current) {
        previewMapContainerRef.current.innerHTML = "";
      }
      previewMapContainerRef.current = null;
    };

    queueMicrotask(resetPreviewMapState);

    loadNaverMapSdk(NCP_KEY_ID, appLanguage)
      .then(() => {
        if (isActive) {
          setIsPreviewMapSdkReady(true);
        }
      })
      .catch(() => {
        if (isActive) {
          setPreviewMapError(text.placeSheet.mapLoadError);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    appLanguage,
    clearPreviewOverlays,
    selectedPlace,
    selectedPlaceKey,
    text.placeSheet.mapLoadError,
  ]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const container = previewMapRef.current;

    if (!isPreviewMapSdkReady || !container || !naverMaps) {
      return;
    }

    let previewMap = previewMapInstanceRef.current;
    const shouldRecreatePreviewMap =
      !previewMap || previewMapContainerRef.current !== container;

    if (shouldRecreatePreviewMap) {
      previewMap = new naverMaps.Map(container, {
        center: new naverMaps.LatLng(selectedPlace.lat, selectedPlace.lng),
        zoom: 11,
        minZoom: 9,
        mapTypeId: naverMaps.MapTypeId.NORMAL,
        ...getNaverMapThemeOptions(isDarkMode),
        draggable: false,
        pinchZoom: false,
        scrollWheel: false,
        keyboardShortcuts: false,
        disableDoubleTapZoom: true,
        disableDoubleClickZoom: true,
        zoomControl: false,
        mapDataControl: false,
        scaleControl: false,
        logoControl: false,
      });
      previewMapInstanceRef.current = previewMap;
      previewMapContainerRef.current = container;
    } else {
      naverMaps.Event.trigger(previewMap, "resize");
    }

    if (!previewMap) {
      return;
    }

    applyNaverMapTheme(previewMap, isDarkMode);
    clearPreviewOverlays();

    const bounds = new naverMaps.LatLngBounds();
    const destinationLatLng = new naverMaps.LatLng(
      selectedPlace.lat,
      selectedPlace.lng
    );
    bounds.extend(destinationLatLng);

    const destinationMarker = new naverMaps.Marker({
      map: previewMap,
      position: destinationLatLng,
      title: selectedPlace.title,
    });
    previewOverlaysRef.current.push(destinationMarker);

    const originLatLng = new naverMaps.LatLng(
      currentLocation.lat,
      currentLocation.lng
    );
    bounds.extend(originLatLng);

    const originMarker = new naverMaps.Marker({
      map: previewMap,
      position: originLatLng,
      title: text.placeSheet.currentLocation,
    });
    previewOverlaysRef.current.push(originMarker);

    if (routePathPoints.length > 0) {
      const path = routePathPoints.map((point) => {
        const latLng = new naverMaps.LatLng(point.lat, point.lng);
        bounds.extend(latLng);
        return latLng;
      });

      const routeLine = new naverMaps.Polyline({
        map: previewMap,
        path,
        strokeColor: "#2563eb",
        strokeWeight: 5,
        strokeOpacity: 0.86,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
      previewOverlaysRef.current.push(routeLine);
    }

    try {
      naverMaps.Event.trigger(previewMap, "resize");
      previewMap.fitBounds(bounds, {
        top: 24,
        right: 24,
        bottom: 40,
        left: 24,
      });
    } catch {
      previewMap.fitBounds(bounds);
    }

    requestAnimationFrame(() => {
      naverMaps.Event.trigger(previewMap, "resize");
    });
  }, [
    clearPreviewOverlays,
    currentLocation,
    isDarkMode,
    isPreviewMapSdkReady,
    routePathPoints,
    selectedPlace,
    text.placeSheet.currentLocation,
  ]);

  useEffect(() => {
    return () => {
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      previewMapContainerRef.current = null;
    };
  }, [clearPreviewOverlays]);

  const handleOpenDirections = () => {
    const params = new URLSearchParams({
      slat: `${currentLocation.lat}`,
      slng: `${currentLocation.lng}`,
      sname: text.placeSheet.currentLocation,
      dlat: `${selectedPlace.lat}`,
      dlng: `${selectedPlace.lng}`,
      dname: selectedPlace.title,
      appname: NAVER_MAP_SCHEME_APP_NAME,
    });
    window.location.href = `nmap://route/car?${params.toString()}`;
  };

  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-trip text-sm text-brand-700">PLACE DIRECTIONS</p>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
        <div
          ref={previewMapRef}
          className="pointer-events-none h-48 w-full touch-none select-none"
        />
        {!isPreviewMapSdkReady && !previewMapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 px-6 backdrop-blur-[1px] dark:bg-slate-950/45">
            <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 text-xs font-bold text-brand-700 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/80 dark:text-brand-100">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
              {text.placeSheet.mapPreparing}
            </div>
          </div>
        ) : previewMapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center backdrop-blur-[1px] dark:bg-slate-950/45">
            <p className="rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-xs font-bold text-rose-600 shadow-sm dark:border-rose-400/30 dark:bg-slate-950/80 dark:text-rose-200">
              {previewMapError}
            </p>
          </div>
        ) : isRouteLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/55 px-6 backdrop-blur-[1px] dark:bg-slate-950/35">
            <div className="w-full max-w-[220px] space-y-3 rounded-2xl border border-brand-100 bg-white/85 p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/80">
              <SkeletonBar className="h-3 w-2/3" />
              <SkeletonBar className="h-3 w-full" />
              <SkeletonBar className="h-3 w-1/2" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">{text.placeSheet.address}</p>
        <p className="mt-1">{selectedPlace.address}</p>
      </div>

      <div className="mt-3 rounded-2xl border border-brand-100 bg-white px-3 py-3">
        {isRouteLoading ? (
          <RouteInfoSkeleton />
        ) : routeDurationText && routeDistanceText ? (
          <div className="flex items-center gap-2 text-sm">
            <IoCarSportOutline className="text-brand-600" />
            <p className="font-semibold text-slate-900">
              {text.placeSheet.routeFromCurrentLocation(routeDurationText)}
            </p>
            <span className="text-slate-400">·</span>
            <p className="text-slate-600">{routeDistanceText}</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {routeError ?? text.placeSheet.routeLoadError}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleOpenDirections}
        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
      >
        <IoNavigate className="mr-2 text-base" />
        {text.placeSheet.directions}
      </button>
    </section>
  );
}

export default PlaceDirectionsSection;
