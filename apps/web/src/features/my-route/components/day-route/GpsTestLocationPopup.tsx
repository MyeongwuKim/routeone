import { useCallback, useMemo, useRef, useState } from "react";
import { IoClose, IoLocationSharp } from "react-icons/io5";
import { MdGpsFixed, MdPlace } from "react-icons/md";
import NaverMapView, {
  type NaverMapInstance,
  type NaverMapReadyContext,
  type NaverMarkerInstance,
} from "@/components/map/NaverMapView";
import { calculateDistanceMeters } from "@/lib/gangwonBoundaryUtils";
import { useUiText } from "@/lib/uiText";
import type { NativeArrivalTestLocationResult } from "@/native-bridge";
import type { VisitCompletionTarget } from "../../models/dayRouteDialogTypes";

type TestLocation = {
  lat: number;
  lng: number;
};

type GpsTestLocationPopupProps = {
  target: VisitCompletionTarget;
  activeLocation: TestLocation | null;
  isApplying: boolean;
  onApply: (
    target: VisitCompletionTarget,
    position: TestLocation
  ) => Promise<NativeArrivalTestLocationResult | null>;
  onClear: () => Promise<NativeArrivalTestLocationResult | null>;
  onClose: () => void;
};

const ARRIVAL_RADIUS_METERS = 100;
const INITIAL_TEST_POSITION_OFFSET_METERS = 180;

function getInitialTestLocation(
  target: VisitCompletionTarget,
  activeLocation: TestLocation | null
) {
  if (activeLocation) {
    return activeLocation;
  }

  const latitudeRadians = (target.stop.place.lat * Math.PI) / 180;
  const longitudeOffset =
    INITIAL_TEST_POSITION_OFFSET_METERS /
    (111_320 * Math.max(0.2, Math.cos(latitudeRadians)));

  return {
    lat: target.stop.place.lat,
    lng: target.stop.place.lng + longitudeOffset,
  };
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

function createPlaceMarkerIconHtml() {
  return `
    <div style="
      width:38px;
      height:38px;
      border:3px solid #ffffff;
      border-radius:9999px;
      background:#0f766e;
      box-shadow:0 8px 20px rgba(15,118,110,0.3);
      color:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:12px;
      font-weight:900;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">P</div>
  `;
}

function createTestLocationMarkerIconHtml() {
  return `
    <div style="
      position:relative;
      width:46px;
      height:60px;
      transform:translate(-23px,-60px);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      pointer-events:auto;
      user-select:none;
    ">
      <div style="
        width:46px;
        height:46px;
        border:3px solid #ffffff;
        border-radius:9999px;
        background:#7c3aed;
        box-shadow:0 10px 24px rgba(124,58,237,0.34);
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:11px;
        font-weight:900;
        line-height:1;
      ">GPS</div>
      <div style="
        position:absolute;
        left:50%;
        top:41px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:13px solid #7c3aed;
      "></div>
    </div>
  `;
}

function GpsTestLocationPopup({
  target,
  activeLocation,
  isApplying,
  onApply,
  onClear,
  onClose,
}: GpsTestLocationPopupProps) {
  const text = useUiText();
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const testMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const initialLocation = useMemo(
    () => getInitialTestLocation(target, activeLocation),
    [activeLocation, target]
  );
  const [draftLocation, setDraftLocation] =
    useState<TestLocation>(initialLocation);
  const [lastResult, setLastResult] =
    useState<NativeArrivalTestLocationResult | null>(null);
  const placeLocation = target.stop.place;
  const distanceMeters = calculateDistanceMeters(
    draftLocation,
    placeLocation
  );
  const isInsideRadius = distanceMeters <= ARRIVAL_RADIUS_METERS;
  const mapResetKey = `${target.stop.id}:${initialLocation.lat}:${initialLocation.lng}`;

  const updateDraftLocation = useCallback(
    (nextLocation: TestLocation, options: { pan?: boolean } = {}) => {
      setDraftLocation(nextLocation);
      setLastResult(null);

      if (!window.naver?.maps) {
        return;
      }

      const nextPosition = new window.naver.maps.LatLng(
        nextLocation.lat,
        nextLocation.lng
      );
      testMarkerRef.current?.setPosition?.(nextPosition);

      if (options.pan) {
        mapInstanceRef.current?.panTo?.(nextPosition);
      }
    },
    []
  );

  const handleMapReady = useCallback(
    ({ map, naverMaps }: NaverMapReadyContext) => {
      mapInstanceRef.current = map;

      const overlays: NaverMarkerInstance[] = [];
      const placePosition = new naverMaps.LatLng(
        placeLocation.lat,
        placeLocation.lng
      );
      const testPosition = new naverMaps.LatLng(
        initialLocation.lat,
        initialLocation.lng
      );
      const bounds = new naverMaps.LatLngBounds();
      bounds.extend(placePosition);
      bounds.extend(testPosition);

      const radiusCircle = new naverMaps.Circle({
        map,
        center: placePosition,
        radius: ARRIVAL_RADIUS_METERS,
        fillColor: "#14b8a6",
        fillOpacity: 0.13,
        strokeColor: "#0f766e",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        zIndex: 500,
      }) as NaverMarkerInstance;
      overlays.push(radiusCircle);

      const placeMarker = new naverMaps.Marker({
        map,
        position: placePosition,
        title: placeLocation.title,
        zIndex: 1600,
        icon: {
          content: createPlaceMarkerIconHtml(),
          anchor: new naverMaps.Point(19, 19),
        },
      }) as NaverMarkerInstance;
      overlays.push(placeMarker);

      const testMarker = new naverMaps.Marker({
        map,
        position: testPosition,
        draggable: true,
        zIndex: 2600,
        icon: {
          content: createTestLocationMarkerIconHtml(),
          anchor: new naverMaps.Point(0, 0),
        },
      }) as NaverMarkerInstance & {
        getPosition: () => { lat: () => number; lng: () => number };
      };
      testMarkerRef.current = testMarker;
      overlays.push(testMarker);

      const dragListener = naverMaps.Event.addListener(
        testMarker,
        "dragend",
        () => {
          const position = testMarker.getPosition();
          updateDraftLocation({
            lat: position.lat(),
            lng: position.lng(),
          });
        }
      );
      const clickListener = naverMaps.Event.addListener(
        map,
        "click",
        (event: { coord: { lat: () => number; lng: () => number } }) => {
          updateDraftLocation(
            {
              lat: event.coord.lat(),
              lng: event.coord.lng(),
            },
            { pan: true }
          );
        }
      );

      const fitVisibleBounds = () => {
        naverMaps.Event.trigger(map, "resize");

        try {
          map.fitBounds?.(bounds, {
            top: 120,
            right: 48,
            bottom: 80,
            left: 48,
          });
        } catch {
          map.fitBounds?.(bounds);
        }
      };
      const frameId = window.requestAnimationFrame(fitVisibleBounds);
      const timerId = window.setTimeout(fitVisibleBounds, 160);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(timerId);
        naverMaps.Event.removeListener(dragListener);
        naverMaps.Event.removeListener(clickListener);
        overlays.forEach((overlay) => overlay.setMap(null));
        testMarkerRef.current = null;
        mapInstanceRef.current = null;
      };
    }, [initialLocation, placeLocation, updateDraftLocation]
  );

  return (
    <div className="fixed inset-0 z-[3200] bg-white dark:bg-slate-950">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-violet-100 bg-white px-4 py-3 dark:border-violet-400/20 dark:bg-slate-950">
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-trip text-sm text-violet-700 dark:text-violet-200">
              <MdGpsFixed />
              GPS TEST
            </p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900 dark:text-white">
              {text.dayRoute.gpsTestTitle(target.stop.place.title)}
            </h2>
          </div>
          <button
            type="button"
            aria-label={text.dayRoute.gpsTestCloseAria}
            onClick={onClose}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-violet-50 text-xl text-violet-700 dark:border-violet-400/30 dark:bg-violet-400/10 dark:text-violet-100"
          >
            <IoClose />
          </button>
        </header>

        <NaverMapView
          center={placeLocation}
          zoom={17}
          minZoom={10}
          resetKey={mapResetKey}
          className="relative min-h-0 flex-1 bg-violet-50 dark:bg-slate-900"
          onReady={handleMapReady}
        >
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-violet-100 bg-white/95 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 shadow-sm backdrop-blur dark:border-violet-400/20 dark:bg-slate-950/90 dark:text-slate-200">
            {text.dayRoute.gpsTestDescription}
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 flex gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-black text-brand-700 shadow-sm dark:bg-slate-950/90 dark:text-brand-100">
              <MdPlace /> {text.dayRoute.gpsTestPlaceLegend}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1.5 text-[11px] font-black text-violet-700 shadow-sm dark:bg-slate-950/90 dark:text-violet-100">
              <MdGpsFixed /> {text.dayRoute.gpsTestLocationLegend}
            </span>
          </div>
        </NaverMapView>

        <footer className="app-safe-area-footer shrink-0 border-t border-violet-100 bg-white px-4 py-3 dark:border-violet-400/20 dark:bg-slate-950">
          <div
            className={`rounded-2xl border px-3 py-2.5 ${
              isInsideRadius
                ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
            }`}
          >
            <p className="text-xs font-black">
              {isInsideRadius
                ? text.dayRoute.gpsTestInsideRadius(
                    formatDistance(distanceMeters)
                  )
                : text.dayRoute.gpsTestOutsideRadius(
                    formatDistance(distanceMeters)
                  )}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold opacity-80">
              <IoLocationSharp />
              {draftLocation.lat.toFixed(6)}, {draftLocation.lng.toFixed(6)}
            </p>
          </div>

          {lastResult ? (
            <p
              className={`mt-2 rounded-xl px-3 py-2 text-xs font-bold ${
                lastResult.notificationScheduled
                  ? "bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-100"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {lastResult.notificationScheduled
                ? text.dayRoute.gpsTestAppliedWithNotification
                : text.dayRoute.gpsTestAppliedWithoutNotification}
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                void onClear().then((result) => {
                  if (result) {
                    setLastResult(null);
                  }
                });
              }}
              disabled={isApplying}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-600 disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {text.dayRoute.gpsTestUseRealLocation}
            </button>
            <button
              type="button"
              onClick={() => {
                void onApply(target, draftLocation).then((result) => {
                  if (result) {
                    setLastResult(result);
                  }
                });
              }}
              disabled={isApplying}
              className="rounded-2xl bg-violet-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-45"
            >
              {isApplying
                ? text.dayRoute.gpsTestApplying
                : text.dayRoute.gpsTestApplyLocation}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default GpsTestLocationPopup;
