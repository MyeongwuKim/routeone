import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoLocateOutline, IoLocationSharp } from "react-icons/io5";
import {
  type NaverMapInstance,
  type NaverMapReadyContext,
  type NaverMarkerInstance,
} from "@/components/map/NaverMapView";
import NaverMapView from "@/components/map/NaverMapView";
import { calculateDistanceMeters } from "@/lib/gangwonBoundaryUtils";
import { useUiText } from "@/lib/uiText";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useRouteCheckout } from "../../hooks/useRouteCheckout";
import type { RouteStartLocation } from "../../models/routePlanTypes";

type PlaceCartStartLocationStepProps = {
  savedPlaces: SavedPlaceItem[];
};

const FAR_START_DISTANCE_METERS = 30_000;

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
  const text = useUiText();
  const { startLocation, setStartLocation } = useRouteCheckout();
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const startMarkerRef = useRef<NaverMarkerInstance | null>(null);
  const [draftLocation, setDraftLocation] =
    useState<RouteStartLocation | null>(startLocation);
  const [mapInitialLocation, setMapInitialLocation] =
    useState<RouteStartLocation | null>(startLocation);
  const savedPlaceCenter = useMemo(
    () => getSavedPlaceCenter(savedPlaces),
    [savedPlaces]
  );
  const mapResetKey = useMemo(
    () =>
      mapInitialLocation
        ? [
            mapInitialLocation.lat,
            mapInitialLocation.lng,
            ...savedPlaces
              .slice(0, 40)
              .map(
                (item) =>
                  `${item.place.id}:${item.place.lat}:${item.place.lng}`
              ),
          ].join("|")
        : "empty",
    [mapInitialLocation, savedPlaces]
  );
  const distanceFromPlaces =
    draftLocation && savedPlaceCenter
      ? calculateDistanceMeters(draftLocation, savedPlaceCenter)
      : null;
  const isFarFromPlaces =
    distanceFromPlaces != null &&
    distanceFromPlaces >= FAR_START_DISTANCE_METERS;

  const updateStartLocation = useCallback(
    (nextLocation: RouteStartLocation, options: { pan?: boolean } = {}) => {
      setDraftLocation(nextLocation);
      setStartLocation(nextLocation);

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
    [setStartLocation]
  );

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (!mapInitialLocation && savedPlaceCenter) {
        setMapInitialLocation(savedPlaceCenter);
      }

      if (!startLocation && savedPlaceCenter) {
        updateStartLocation(savedPlaceCenter);
        return;
      }

      setDraftLocation(startLocation);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [mapInitialLocation, savedPlaceCenter, startLocation, updateStartLocation]);

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
        }) as NaverMarkerInstance;
        overlays.push(marker);
      });

      const fitVisibleBounds = () => {
        naverMaps.Event.trigger(map, "resize");

        if (savedPlaces.length > 0) {
          try {
            map.fitBounds?.(bounds, {
              top: 88,
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
    [savedPlaces, updateStartLocation]
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="font-trip text-sm text-brand-700">START POINT</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          {text.cart.startLocationTitle}
        </h2>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {text.cart.startLocationDescription}
        </p>
      </div>

      <section className="overflow-hidden rounded-[1.4rem] border border-brand-100 bg-white shadow-sm">
        {mapInitialLocation ? (
          <NaverMapView
            center={mapInitialLocation}
            className="relative h-[390px] bg-brand-50"
            resetKey={mapResetKey}
            onReady={handleMapReady}
          >
            <div className="pointer-events-none absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-semibold leading-5 text-slate-600 shadow-sm backdrop-blur">
              {text.cart.startLocationGuide}
            </div>
          </NaverMapView>
        ) : (
          <div className="flex h-[390px] items-center justify-center bg-brand-50 px-4 text-center text-xs font-bold text-brand-700">
            {text.cart.startLocationPreparing}
          </div>
        )}

        <div className="space-y-3 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-black text-brand-700">
                <IoLocationSharp className="text-sm" />
                {text.cart.selectedStartLocation}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-slate-500">
                {draftLocation
                  ? `${draftLocation.lat.toFixed(5)}, ${draftLocation.lng.toFixed(5)}`
                  : text.cart.startLocationUnavailable}
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
                {text.cart.nearSavedPlaces}
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
              {isFarFromPlaces
                ? text.cart.startDistanceFar(formatDistance(distanceFromPlaces))
                : text.cart.startDistanceOk(formatDistance(distanceFromPlaces))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export default PlaceCartStartLocationStep;
