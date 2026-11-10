/**
 * 사용 위치: 장소 상세 → 길찾기 영역
 *
 * 용도:
 * 출발지별 경로를 미리 보여주고 네이버 지도 길찾기로 연결한다.
 * 자동차는 기존 네이버 경로를, 도보는 공개 보행로를 자체 계산한 결과를 같은 지도에 표시한다.
 * 현재 위치 출발은 실행 시 권한을 다시 확인해 이전 좌표 사용을 막는다.
 * 권한이 꺼지면 현재 위치 경로를 숨기되 지도에서 출발지를 직접 선택할 수 있다.
 */
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  IoCarSportOutline,
  IoFootstepsOutline,
  IoInformationCircleOutline,
  IoNavigate,
} from "react-icons/io5";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import MapLoadingSkeleton from "@/components/map/MapLoadingSkeleton";
import LocationPermissionNotice from "@/components/map/LocationPermissionNotice";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import type { UiText } from "@/lib/uiText";
import type { AppLanguage } from "@/stores/appLanguageStore";
import {
  useMapSheetStore,
  type MapSheetDirectionOrigin,
} from "@/stores/mapSheetStore";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { isNativeTestAccountMode } from "@/native-bridge/runtime";
import { useLocationPermissionDenied } from "@/native-bridge/useLocationPermissionDenied";
import type { MapSheetPlace } from "@/types/place";
import type { PlaceSheetCoordinates } from "../placeSheetModel";
import type { PlaceDirectionMode } from "../placeSheetModel";
import type { WalkingRouteResult } from "@/features/walking/walkingTypes";
import { getWalkingRouteText } from "@/features/walking/walkingRouteText";
import WalkingRouteNotice from "@/features/walking/WalkingRouteNotice";
import { RouteInfoSkeleton } from "./PlaceSheetPrimitives";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";

const StartLocationPickerPopup = lazy(() => import("@/features/route-checkout/components/cart-steps/StartLocationPickerPopup"));
const EMPTY_PICKER_PLAN: PlannedRouteDay[] = [];

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const NAVER_MAP_SCHEME_APP_NAME = "com.routeone.app";
const PREVIEW_MAP_RESIZE_RETRY_MS = [0, 80, 240, 600] as const;

type PreviewMapInstance = {
  destroy: () => void;
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
};

type PreviewMapOverlay = {
  setMap: (map: null) => void;
};

type PreviewNaverMapsApi = NonNullable<Window["naver"]>["maps"];

type PlaceDirectionsSectionProps = {

  appLanguage: AppLanguage;

  routeMode: PlaceDirectionMode;
  onRouteModeChange: (mode: PlaceDirectionMode) => void;
  onOriginChange: (coordinates: PlaceSheetCoordinates) => void;
  walkingRoute: WalkingRouteResult | null;

  currentLocation: PlaceSheetCoordinates;

  directionOrigin: MapSheetDirectionOrigin;

  isCurrentLocationLookupPending: boolean;

  isDarkMode: boolean;

  isRouteLoading: boolean;

  routeDistanceText: string | null;

  routeDurationText: string | null;

  routeError: string | null;

  routePathPoints: PlaceSheetCoordinates[];
  /** 미리보기 지도와 외부 길찾기의 도착지로 사용할 장소 */
  selectedPlace: MapSheetPlace;

  text: UiText;
};

function fitPreviewMapToBounds(
  naverMaps: PreviewNaverMapsApi,
  previewMap: PreviewMapInstance,
  bounds: unknown
) {
  naverMaps.Event.trigger(previewMap, "resize");

  try {
    previewMap.fitBounds(bounds, {
      top: 40,
      right: 32,
      bottom: 48,
      left: 32,
    });
  } catch {
    previewMap.fitBounds(bounds);
  }
}

function PlaceDirectionsContent({
  appLanguage,
  routeMode,
  onRouteModeChange,
  walkingRoute,
  currentLocation,
  directionOrigin,
  isCurrentLocationLookupPending,
  isDarkMode,
  isRouteLoading,
  routeDistanceText,
  routeDurationText,
  routeError,
  routePathPoints,
  selectedPlace,
  text,
  originControl,
  isReferenceOrigin,
}: PlaceDirectionsSectionProps & { originControl: ReactNode; isReferenceOrigin: boolean }) {
  const [isPreviewMapSdkReady, setIsPreviewMapSdkReady] = useState(false);
  const [isOpeningDirections, setIsOpeningDirections] = useState(false);
  const [previewMapError, setPreviewMapError] = useState<string | null>(null);
  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const previewMapInstanceRef = useRef<PreviewMapInstance | null>(null);
  const previewMapContainerRef = useRef<HTMLDivElement | null>(null);
  const previewOverlaysRef = useRef<PreviewMapOverlay[]>([]);
  const selectedPlaceKey = `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`;
  const walkingText = getWalkingRouteText(appLanguage);
  const originLabel = directionOrigin.isCurrentLocation
    ? text.placeSheet.currentLocation
    : directionOrigin.label;

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
        minZoom: 5,
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
      title: originLabel,
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

    let isCancelled = false;
    const animationFrameIds: number[] = [];
    const timeoutIds: number[] = [];
    const refitPreviewMap = () => {
      if (isCancelled || !previewMap) {
        return;
      }

      fitPreviewMapToBounds(naverMaps, previewMap, bounds);
    };
    const queueRefitPreviewMap = (delayMs: number) => {
      if (delayMs === 0) {
        animationFrameIds.push(window.requestAnimationFrame(refitPreviewMap));
        return;
      }

      timeoutIds.push(
        window.setTimeout(() => {
          animationFrameIds.push(window.requestAnimationFrame(refitPreviewMap));
        }, delayMs)
      );
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => queueRefitPreviewMap(0));

    fitPreviewMapToBounds(naverMaps, previewMap, bounds);
    PREVIEW_MAP_RESIZE_RETRY_MS.forEach(queueRefitPreviewMap);
    resizeObserver?.observe(container);

    return () => {
      isCancelled = true;
      resizeObserver?.disconnect();
      animationFrameIds.forEach((frameId) =>
        window.cancelAnimationFrame(frameId)
      );
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [
    clearPreviewOverlays,
    currentLocation,
    isDarkMode,
    isPreviewMapSdkReady,
    routePathPoints,
    selectedPlace,
    originLabel,
  ]);

  // 시트를 닫을 때 지도 SDK에 정리를 맡긴다. SDK에서 예외가 발생해도 목록 복귀는 계속한다.
  useLayoutEffect(() => {
    return () => {
      const previewMap = previewMapInstanceRef.current;
      previewOverlaysRef.current = [];
      previewMapInstanceRef.current = null;
      previewMapContainerRef.current = null;
      try {
        previewMap?.destroy();
      } catch (error) {
        console.warn("Could not dispose the place direction preview map.", error);
      }
    };
  }, []);

  const handleOpenDirections = async () => {
    if (isCurrentLocationLookupPending || isOpeningDirections) {
      return;
    }
    setIsOpeningDirections(true);
    try {
      const origin =
        directionOrigin.isCurrentLocation && !isNativeTestAccountMode()
          ? await useCurrentPositionStore.getState().requestCurrentPosition()
          : currentLocation;
      const params = new URLSearchParams({
        dlat: `${selectedPlace.lat}`,
        dlng: `${selectedPlace.lng}`,
        dname: selectedPlace.title,
        slat: `${origin.lat}`,
        slng: `${origin.lng}`,
        sname: originLabel,
        appname: NAVER_MAP_SCHEME_APP_NAME,
      });

      window.location.href = `nmap://route/${routeMode === "walking" ? "walk" : "car"}?${params.toString()}`;
    } catch {
      useUiToastStore
        .getState()
        .showToast(text.placeSheet.currentLocationUnavailableTitle);
    } finally {
      setIsOpeningDirections(false);
    }
  };

  return (
    <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-trip text-sm text-brand-700">{text.placeSheet.directions}</p>
      </div>

      <div role="group" aria-label={appLanguage === "en" ? "Travel mode" : "이동수단"} className="mb-3 grid grid-cols-2 gap-2">
        {(["driving", "walking"] as const).map(mode => <button
          type="button" key={mode} aria-pressed={routeMode === mode} onClick={() => onRouteModeChange(mode)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-brand-200 px-3 text-sm font-bold text-brand-800 aria-pressed:border-brand-600 aria-pressed:bg-brand-100 dark:border-brand-400/25 dark:text-brand-100 dark:aria-pressed:bg-brand-900"
        >{mode === "walking" ? <IoFootstepsOutline /> : <IoCarSportOutline />}{walkingText[mode]}</button>)}
      </div>
      {originControl}
      <div aria-live="polite" className="mb-3 rounded-2xl border border-brand-100 bg-white px-3 py-3">
        {isCurrentLocationLookupPending || isRouteLoading ? (
          <RouteInfoSkeleton />
        ) : routeDurationText && routeDistanceText ? (
          <div className="text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {routeMode === "walking" ? <IoFootstepsOutline className="shrink-0 text-brand-600" /> : <IoCarSportOutline className="shrink-0 text-brand-600" />}
              <p className="font-semibold text-slate-900">
                {routeMode === "walking"
                  ? directionOrigin.isCurrentLocation
                    ? walkingText.fromCurrentLocation(routeDurationText)
                    : isReferenceOrigin
                      ? walkingText.fromReferenceLocation(originLabel, routeDurationText)
                      : walkingText.fromSelectedLocation(originLabel, routeDurationText)
                  : directionOrigin.isCurrentLocation
                  ? text.placeSheet.routeFromCurrentLocation(routeDurationText)
                  : isReferenceOrigin ? text.placeSheet.routeFromReferenceLocation(
                      originLabel,
                      routeDurationText
                    ) : walkingText.drivingFromSelectedLocation(originLabel, routeDurationText)}
              </p>
              <p className="text-slate-600">{routeDistanceText}</p>
            </div>
            {isReferenceOrigin ? (
              <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                {text.placeSheet.referenceRouteNotice}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            {routeError ?? text.placeSheet.routeLoadError}
          </p>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
        <div ref={previewMapRef} className="pointer-events-none h-48 w-full touch-none select-none" />
        {previewMapError ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center backdrop-blur-[1px] dark:bg-slate-950/45">
            <p className="rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-xs font-bold text-rose-600 shadow-sm dark:border-rose-400/30 dark:bg-slate-950/80 dark:text-rose-200">{previewMapError}</p>
          </div>
        ) : !isPreviewMapSdkReady || isCurrentLocationLookupPending || isRouteLoading ? (
          <MapLoadingSkeleton label={isPreviewMapSdkReady && !isCurrentLocationLookupPending ? text.dayRoute.routeCalculating : text.placeSheet.mapPreparing} />
        ) : null}
      </div>

      {!isCurrentLocationLookupPending && isReferenceOrigin ? (
        <div className="mt-3 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">
          <IoInformationCircleOutline className="mt-0.5 shrink-0 text-base text-amber-600" />
          <div>
            <p className="font-bold">{text.placeSheet.currentLocationUnavailableTitle}</p>
            <p className="mt-0.5 font-semibold text-amber-800/80">{text.placeSheet.currentLocationUnavailableDescription(originLabel)}</p>
          </div>
        </div>
      ) : null}
      {routeMode === "walking" ? <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{walkingText.coverage}</p> : null}
      {routeMode === "walking" ? <div className="mt-3"><WalkingRouteNotice language={appLanguage} result={walkingRoute} /></div> : null}

      <button
        type="button"
        onClick={handleOpenDirections}
        disabled={isCurrentLocationLookupPending || isOpeningDirections}
        className="mt-3 flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
      >
        <IoNavigate className="mr-2 text-base" />
        {walkingText.openNaver}
      </button>
    </section>
  );
}

function PlaceDirectionsSection(props: PlaceDirectionsSectionProps) {
  const [isOriginPickerOpen, setIsOriginPickerOpen] = useState(false);
  const isPermissionDenied = useLocationPermissionDenied();
  const explicitOrigin = useMapSheetStore((state) => state.directionOrigin);
  const requiresCurrentLocation =
    !explicitOrigin || explicitOrigin.isCurrentLocation;
  const walkingText = getWalkingRouteText(props.appLanguage);
  const originControl = <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-brand-50 px-3 py-2 dark:bg-brand-900/30">
    <div className="min-w-0 text-xs">
      <p className="text-slate-500 dark:text-slate-400">{walkingText.start}</p>
      <p className="mt-1 truncate font-bold text-slate-800 dark:text-slate-100">{props.directionOrigin.isCurrentLocation ? props.text.placeSheet.currentLocation : props.directionOrigin.label}</p>
    </div>
    <button type="button" onClick={() => setIsOriginPickerOpen(true)} className="min-h-11 shrink-0 rounded-xl border border-brand-200 bg-white px-3 text-xs font-bold text-brand-700 dark:border-brand-400/30 dark:bg-brand-900 dark:text-brand-100">{walkingText.changeOrigin}</button>
  </div>;

  return <>
    {isPermissionDenied && requiresCurrentLocation ? (
      <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
        <p className="mb-3 font-trip text-sm text-brand-700">
          {props.text.placeSheet.directions}
        </p>
        {originControl}
        <LocationPermissionNotice text={props.text} />
      </section>
    ) : <PlaceDirectionsContent {...props} originControl={originControl} isReferenceOrigin={!props.directionOrigin.isCurrentLocation && !explicitOrigin} />}
    {isOriginPickerOpen ? <div className={`fixed inset-0 ${UI_LAYER_CLASS.appDialog}`}>
      <Suspense fallback={<div className="flex h-full items-center justify-center bg-white text-sm text-brand-700">{props.text.placeSheet.mapPreparing}</div>}>
        <StartLocationPickerPopup title={walkingText.chooseStart} routePlan={EMPTY_PICKER_PLAN} initialLocation={props.currentLocation} onClose={() => setIsOriginPickerOpen(false)} onApply={props.onOriginChange} />
      </Suspense>
    </div> : null}
  </>;
}

export default PlaceDirectionsSection;
