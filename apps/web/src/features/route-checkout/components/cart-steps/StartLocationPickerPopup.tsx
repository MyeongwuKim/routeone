import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoClose, IoLocationSharp } from "react-icons/io5";
import {
  type NaverMapInstance,
  type NaverMapReadyContext,
  type NaverMarkerInstance,
} from "@/components/map/NaverMapView";
import NaverMapView from "@/components/map/NaverMapView";
import type { PlannedRouteDay, RouteStartLocation } from "./routePlanTypes";

type StartLocationPickerPopupProps = {
  routePlan: PlannedRouteDay[];
  initialLocation: RouteStartLocation;
  onClose: () => void;
  onApply: (location: RouteStartLocation) => void;
};

function createStartMarkerIconHtml() {
  return `
    <div style="
      position:relative;
      width:44px;
      height:58px;
      transform:translate(-22px,-58px);
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      pointer-events:auto;
      user-select:none;
    ">
      <div style="
        width:44px;
        height:44px;
        border:3px solid #ffffff;
        border-radius:9999px;
        background:#0f766e;
        box-shadow:0 10px 22px rgba(15,118,110,0.28);
        color:#ffffff;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:17px;
        font-weight:900;
        line-height:1;
      ">
        S
      </div>
      <div style="
        position:absolute;
        left:50%;
        top:39px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:8px solid transparent;
        border-right:8px solid transparent;
        border-top:12px solid #0f766e;
        filter:drop-shadow(0 8px 8px rgba(15,118,110,0.18));
      "></div>
    </div>
  `;
}

function createPlaceMarkerIconHtml(index: number) {
  return `
    <div style="
      width:30px;
      height:30px;
      border:2px solid #ffffff;
      border-radius:9999px;
      background:#14b8a6;
      color:#ffffff;
      display:flex;
      align-items:center;
      justify-content:center;
      box-shadow:0 8px 18px rgba(15,118,110,0.22);
      font-size:12px;
      font-weight:900;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    ">${index}</div>
  `;
}

function StartLocationPickerPopup({
  routePlan,
  initialLocation,
  onClose,
  onApply,
}: StartLocationPickerPopupProps) {
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const startMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const [draftLocation, setDraftLocation] = useState(initialLocation);
  const visiblePlaces = useMemo(
    () => routePlan.flatMap((day) => day.items).slice(0, 40),
    [routePlan]
  );
  const mapResetKey = useMemo(
    () =>
      [
        initialLocation.lat,
        initialLocation.lng,
        ...visiblePlaces.map(
          (item) => `${item.place.id}:${item.place.lat}:${item.place.lng}`
        ),
      ].join("|"),
    [initialLocation.lat, initialLocation.lng, visiblePlaces]
  );

  const updateDraftLocation = useCallback(
    (nextLocation: RouteStartLocation, options: { pan?: boolean } = {}) => {
      setDraftLocation(nextLocation);

      if (!window.naver?.maps) {
        return;
      }

      const nextPosition = new window.naver.maps.LatLng(
        nextLocation.lat,
        nextLocation.lng
      );
      startMarkerRef.current?.setPosition?.(nextPosition);

      if (options.pan) {
        mapInstanceRef.current?.panTo?.(nextPosition);
      }
    },
    []
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateDraftLocation(initialLocation, { pan: true });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [initialLocation, updateDraftLocation]);

  const handleMapReady = useCallback(
    ({ map, naverMaps, center }: NaverMapReadyContext) => {
      mapInstanceRef.current = map;

      const overlays: NaverMarkerInstance[] = [];
      const bounds = new naverMaps.LatLngBounds();
      bounds.extend(center);

      const startMarker = new naverMaps.Marker({
        map,
        position: center,
        draggable: true,
        zIndex: 2600,
        icon: {
          content: createStartMarkerIconHtml(),
          anchor: new naverMaps.Point(0, 0),
        },
      }) as NaverMarkerInstance & {
        getPosition: () => { lat: () => number; lng: () => number };
      };
      startMarkerRef.current = startMarker;
      overlays.push(startMarker);

      const dragListener = naverMaps.Event.addListener(
        startMarker,
        "dragend",
        () => {
          const position = startMarker.getPosition();
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

      visiblePlaces.forEach((item, index) => {
        const position = new naverMaps.LatLng(item.place.lat, item.place.lng);
        bounds.extend(position);

        const marker = new naverMaps.Marker({
          map,
          position,
          title: item.place.title,
          zIndex: 1200 + index,
          icon: {
            content: createPlaceMarkerIconHtml(index + 1),
            anchor: new naverMaps.Point(15, 15),
          },
        }) as NaverMarkerInstance;
        overlays.push(marker);
      });

      const fitVisibleBounds = () => {
        naverMaps.Event.trigger(map, "resize");

        if (visiblePlaces.length > 0) {
          try {
            map.fitBounds?.(bounds, {
              top: 92,
              right: 28,
              bottom: 28,
              left: 28,
            });
          } catch {
            map.fitBounds?.(bounds);
          }
          return;
        }

        map.setCenter?.(center);
      };
      const frameId = window.requestAnimationFrame(fitVisibleBounds);
      const firstTimerId = window.setTimeout(fitVisibleBounds, 120);
      const secondTimerId = window.setTimeout(fitVisibleBounds, 360);

      return () => {
        window.cancelAnimationFrame(frameId);
        window.clearTimeout(firstTimerId);
        window.clearTimeout(secondTimerId);
        naverMaps.Event.removeListener(dragListener);
        naverMaps.Event.removeListener(clickListener);
        overlays.forEach((overlay) => overlay.setMap(null));
        startMarkerRef.current = null;
        mapInstanceRef.current = null;
      };
    },
    [updateDraftLocation, visiblePlaces]
  );

  return (
    <div className="fixed inset-0 z-[2800] bg-white">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">START POINT</p>
            <h2 className="mt-0.5 text-lg font-bold text-slate-900">
              출발 위치 선택
            </h2>
          </div>
          <button
            type="button"
            aria-label="출발 위치 선택 닫기"
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <IoClose />
          </button>
        </header>

        <NaverMapView
          center={initialLocation}
          className="relative min-h-0 flex-1 bg-brand-50"
          resetKey={mapResetKey}
          onReady={handleMapReady}
        >
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 shadow-sm backdrop-blur">
            지도를 탭하거나 시작 마커를 드래그해서 출발 위치를 맞춰요.
          </div>
        </NaverMapView>

        <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 bg-white px-4 py-3">
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700">
            <IoLocationSharp className="text-base" />
            <span>
              {draftLocation.lat.toFixed(5)}, {draftLocation.lng.toFixed(5)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draftLocation);
                onClose();
              }}
              className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
            >
              적용
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default StartLocationPickerPopup;
