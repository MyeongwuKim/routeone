import { useEffect, useMemo, useRef, useState } from "react";
import { IoClose, IoLocationSharp } from "react-icons/io5";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type { PlannedRouteDay, RouteStartLocation } from "./routePlanTypes";

type StartLocationPickerPopupProps = {
  routePlan: PlannedRouteDay[];
  initialLocation: RouteStartLocation;
  onClose: () => void;
  onApply: (location: RouteStartLocation) => void;
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

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
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const overlayRefs = useRef<Array<{ setMap: (map: null) => void }>>([]);
  const [draftLocation, setDraftLocation] = useState(initialLocation);
  const [mapError, setMapError] = useState<string | null>(null);
  const visiblePlaces = useMemo(
    () => routePlan.flatMap((day) => day.items).slice(0, 40),
    [routePlan]
  );

  useEffect(() => {
    setDraftLocation(initialLocation);
  }, [initialLocation]);

  useEffect(() => {
    let cancelled = false;

    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];

    async function setupMap() {
      if (!mapNodeRef.current) {
        return;
      }

      try {
        await loadNaverMapSdk(NCP_KEY_ID);

        if (cancelled || !mapNodeRef.current || !window.naver?.maps) {
          return;
        }

        const naverMaps = window.naver.maps;
        const center = new naverMaps.LatLng(
          initialLocation.lat,
          initialLocation.lng
        );
        const map = new naverMaps.Map(mapNodeRef.current, {
          center,
          zoom: 12,
          minZoom: 7,
          scaleControl: false,
          mapDataControl: false,
          logoControl: false,
          ...getNaverMapThemeOptions(isDarkMode),
        });
        applyNaverMapTheme(map, isDarkMode);
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
        });
        overlayRefs.current.push(startMarker);

        const dragListener = naverMaps.Event.addListener(
          startMarker,
          "dragend",
          () => {
            const position = startMarker.getPosition();
            setDraftLocation({
              lat: position.lat(),
              lng: position.lng(),
            });
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
          });
          overlayRefs.current.push(marker);
        });

        if (visiblePlaces.length > 0) {
          map.fitBounds(bounds);
        }

        overlayRefs.current.push({
          setMap: () => naverMaps.Event.removeListener(dragListener),
        });
      } catch (error) {
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "지도를 불러오지 못했어요."
          );
        }
      }
    }

    void setupMap();

    return () => {
      cancelled = true;
      overlayRefs.current.forEach((overlay) => overlay.setMap(null));
      overlayRefs.current = [];
    };
  }, [initialLocation, visiblePlaces, isDarkMode]);

  return (
    <div className="fixed inset-0 z-[2800] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
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
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <IoClose />
          </button>
        </header>

        <div className="relative min-h-0 flex-1 bg-brand-50">
          <div ref={mapNodeRef} className="naver-map-root" />
          {mapError ? (
            <div className="absolute inset-x-4 top-4 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-rose-600 shadow-sm">
              {mapError}
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 shadow-sm backdrop-blur">
            시작 마커를 길게 잡고 움직여 출발 위치를 맞춰요.
          </div>
        </div>

        <footer className="shrink-0 border-t border-brand-100 bg-white px-4 py-3">
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
