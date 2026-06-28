import { useEffect, useMemo, useRef, useState } from "react";
import { IoLocateOutline, IoLocationSharp } from "react-icons/io5";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useRouteCheckout } from "../RouteCheckoutContext";
import type { RouteStartLocation } from "./routePlanTypes";

type PlaceCartStartLocationStepProps = {
  savedPlaces: SavedPlaceItem[];
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const FAR_START_DISTANCE_METERS = 30_000;

function calculateDistanceMeters(
  from: RouteStartLocation,
  to: RouteStartLocation
) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }

  return `${(meters / 1000).toFixed(1)}km`;
}

function getSavedPlaceCenter(savedPlaces: SavedPlaceItem[]) {
  if (savedPlaces.length === 0) {
    return null;
  }

  const total = savedPlaces.reduce(
    (acc, item) => ({
      lat: acc.lat + item.place.lat,
      lng: acc.lng + item.place.lng,
    }),
    { lat: 0, lng: 0 }
  );

  return {
    lat: total.lat / savedPlaces.length,
    lng: total.lng / savedPlaces.length,
  };
}

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

function PlaceCartStartLocationStep({
  savedPlaces,
}: PlaceCartStartLocationStepProps) {
  const { startLocation, setStartLocation } = useRouteCheckout();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const initialStartLocationRef = useRef<RouteStartLocation | null>(
    startLocation
  );
  const overlayRefs = useRef<Array<{ setMap: (map: null) => void }>>([]);
  const [draftLocation, setDraftLocation] =
    useState<RouteStartLocation | null>(startLocation);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [canInitializeMap, setCanInitializeMap] = useState(false);
  const [mapContainerSize, setMapContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const savedPlaceCenter = useMemo(
    () => getSavedPlaceCenter(savedPlaces),
    [savedPlaces]
  );
  const distanceFromPlaces =
    draftLocation && savedPlaceCenter
      ? calculateDistanceMeters(draftLocation, savedPlaceCenter)
      : null;
  const isFarFromPlaces =
    distanceFromPlaces != null &&
    distanceFromPlaces >= FAR_START_DISTANCE_METERS;

  const updateStartLocation = (
    nextLocation: RouteStartLocation,
    options: { pan?: boolean } = {}
  ) => {
    setDraftLocation(nextLocation);
    setStartLocation(nextLocation);

    if (!window.naver?.maps) {
      return;
    }

    const nextPosition = new window.naver.maps.LatLng(
      nextLocation.lat,
      nextLocation.lng
    );
    startMarkerRef.current?.setPosition(nextPosition);

    if (options.pan) {
      mapInstanceRef.current?.panTo(nextPosition);
    }
  };

  useEffect(() => {
    if (!startLocation && savedPlaceCenter) {
      setStartLocation(savedPlaceCenter);
      setDraftLocation(savedPlaceCenter);
      return;
    }

    setDraftLocation(startLocation);
  }, [savedPlaceCenter, setStartLocation, startLocation]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setCanInitializeMap(true);
    }, 280);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const node = mapNodeRef.current;

    if (!node) {
      return;
    }

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setMapContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };
    const observer = new ResizeObserver(updateSize);

    updateSize();
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const initialLocation = initialStartLocationRef.current ?? savedPlaceCenter;

    if (
      !canInitializeMap ||
      !initialLocation ||
      mapContainerSize.width < 40 ||
      mapContainerSize.height < 40
    ) {
      return;
    }

    const mapInitialLocation = initialLocation;
    let cancelled = false;

    setMapError(null);
    setIsMapReady(false);
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
    startMarkerRef.current = null;
    mapInstanceRef.current = null;

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
          mapInitialLocation.lat,
          mapInitialLocation.lng
        );
        const map = new naverMaps.Map(mapNodeRef.current, {
          center,
          zoom: 12,
          minZoom: 7,
          mapTypeId: naverMaps.MapTypeId.NORMAL,
          draggable: true,
          pinchZoom: true,
          scrollWheel: true,
          zoomControl: false,
          scaleControl: false,
          mapDataControl: false,
          logoControl: false,
          ...getNaverMapThemeOptions(isDarkMode),
        });
        mapInstanceRef.current = map;
        applyNaverMapTheme(map, isDarkMode);
        enableNaverMapPointerInteractions(map);

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
        startMarkerRef.current = startMarker;
        overlayRefs.current.push(startMarker);

        const dragListener = naverMaps.Event.addListener(
          startMarker,
          "dragend",
          () => {
            const position = startMarker.getPosition();
            updateStartLocation({
              lat: position.lat(),
              lng: position.lng(),
            });
          }
        );
        const clickListener = naverMaps.Event.addListener(
          map,
          "click",
          (event: { coord: { lat: () => number; lng: () => number } }) => {
            updateStartLocation(
              {
                lat: event.coord.lat(),
                lng: event.coord.lng(),
              },
              { pan: true }
            );
          }
        );

        savedPlaces.slice(0, 40).forEach((item, index) => {
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

        const fitVisibleBounds = () => {
          if (cancelled) {
            return;
          }

          naverMaps.Event.trigger(map, "resize");

          if (savedPlaces.length > 0) {
            try {
              map.fitBounds(bounds, {
                top: 88,
                right: 28,
                bottom: 28,
                left: 28,
              });
            } catch {
              map.fitBounds(bounds);
            }
            return;
          }

          map.setCenter(center);
        };

        requestAnimationFrame(() => {
          fitVisibleBounds();
          if (!cancelled) {
            setIsMapReady(true);
          }
        });
        setTimeout(fitVisibleBounds, 120);
        setTimeout(fitVisibleBounds, 360);

        overlayRefs.current.push({
          setMap: () => {
            naverMaps.Event.removeListener(dragListener);
            naverMaps.Event.removeListener(clickListener);
          },
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
      startMarkerRef.current = null;
      mapInstanceRef.current = null;
    };
  }, [
    canInitializeMap,
    mapContainerSize.height,
    mapContainerSize.width,
    savedPlaceCenter,
    savedPlaces,
    isDarkMode,
  ]);

  useEffect(() => {
    applyNaverMapTheme(mapInstanceRef.current, isDarkMode);
  }, [isDarkMode]);

  return (
    <div className="space-y-4">
      <div>
        <p className="font-trip text-sm text-brand-700">START POINT</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          출발 위치가 맞나요?
        </h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          여행을 실제로 시작할 위치로 마커를 옮기면 그 지점 기준으로 루트를
          계산해요.
        </p>
      </div>

      <section className="overflow-hidden rounded-[1.4rem] border border-brand-100 bg-white shadow-sm">
        <div className="relative h-[390px] bg-brand-50">
          <div
            ref={mapNodeRef}
            className="naver-map-root"
            style={{
              height: "100%",
              minHeight: "390px",
              width: "100%",
            }}
          />

          {mapError ? (
            <div className="absolute inset-x-4 top-4 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-rose-600 shadow-sm">
              {mapError}
            </div>
          ) : null}

          {!mapError && !isMapReady ? (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-50">
              <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-xs font-bold text-brand-700 shadow-sm">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
                지도 불러오는 중
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 shadow-sm backdrop-blur">
            지도를 탭하거나 출발 마커를 드래그해서 위치를 맞춰요.
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-black text-brand-700">
                <IoLocationSharp className="text-sm" />
                선택한 출발 위치
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {draftLocation
                  ? `${draftLocation.lat.toFixed(5)}, ${draftLocation.lng.toFixed(5)}`
                  : "출발 위치를 확인할 수 없어요."}
              </p>
            </div>

            {savedPlaceCenter ? (
              <button
                type="button"
                onClick={() =>
                  updateStartLocation(savedPlaceCenter, {
                    pan: true,
                  })
                }
                className="flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700"
              >
                <IoLocateOutline className="text-sm" />
                장소 근처
              </button>
            ) : null}
          </div>

          {distanceFromPlaces != null ? (
            <div
              className={`rounded-2xl px-3 py-2 text-xs font-semibold leading-5 ${
                isFarFromPlaces
                  ? "border border-amber-200 bg-amber-50 text-amber-800"
                  : "bg-brand-50 text-brand-700"
              }`}
            >
              담은 장소 중심까지 약 {formatDistance(distanceFromPlaces)}
              입니다.
              {isFarFromPlaces
                ? " 실제 출발지가 여행 지역 안이라면 마커를 옮겨 주세요."
                : " 이 위치로 시작해도 괜찮아 보여요."}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default PlaceCartStartLocationStep;
