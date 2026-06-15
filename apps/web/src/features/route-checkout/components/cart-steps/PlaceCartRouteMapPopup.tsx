import { useEffect, useMemo, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import {
  createPlaceBubbleMarkerIconHtml,
  PLACE_BUBBLE_MARKER_SIZE,
  type PlaceBubbleMarkerVariant,
} from "@/components/map/NaverMapMarkerIcon";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import type { PlannedRouteDay } from "./routePlanTypes";

type RouteMapPoint = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  sequenceLabel: string;
  variant: PlaceBubbleMarkerVariant;
  lat: number;
  lng: number;
};

type PlaceCartRouteMapPopupProps = {
  day: PlannedRouteDay;
  onClose: () => void;
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

function formatDateLabel(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

function buildRouteMapPoints(day: PlannedRouteDay): RouteMapPoint[] {
  return [
    ...(day.startLocation
      ? [
          {
            id: "current-location",
            title: "내 위치",
            subtitle: "출발",
            icon: "📍",
            sequenceLabel: "S",
            variant: "start" as const,
            lat: day.startLocation.lat,
            lng: day.startLocation.lng,
          },
        ]
      : []),
    ...day.items.map((item, index) => ({
      id: item.id,
      title: item.place.title,
      subtitle: item.place.contentTypeLabel,
      icon: item.place.icon,
      sequenceLabel: `${index + 1}`,
      variant: "place" as const,
      lat: item.place.lat,
      lng: item.place.lng,
    })),
  ];
}

async function fetchRouteMapPath(points: RouteMapPoint[]) {
  if (points.length < 2) {
    return points.map(({ lat, lng }) => ({ lat, lng }));
  }

  const path: Array<{ lat: number; lng: number }> = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const goal = points[index + 1];
    const route = await fetchDrivingRouteFromCurrentLocation({
      startLat: start.lat,
      startLng: start.lng,
      goalLat: goal.lat,
      goalLng: goal.lng,
    });

    path.push(...(index === 0 ? route.path : route.path.slice(1)));
  }

  return path;
}

function PlaceCartRouteMapPopup({ day, onClose }: PlaceCartRouteMapPopupProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRefs = useRef<any[]>([]);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routePoints = useMemo(() => buildRouteMapPoints(day), [day]);
  const fallbackPath = useMemo(
    () => routePoints.map(({ lat, lng }) => ({ lat, lng })),
    [routePoints]
  );
  const [routePath, setRoutePath] = useState(fallbackPath);

  const clearOverlays = () => {
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
  };

  useEffect(() => {
    setRoutePath(fallbackPath);
  }, [fallbackPath]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let isActive = true;

    setIsSdkReady(false);
    setRouteError(null);

    loadNaverMapSdk(NCP_KEY_ID)
      .then(() => {
        if (isActive) {
          setIsSdkReady(true);
        }
      })
      .catch(() => {
        if (isActive) {
          setRouteError("지도를 불러오지 못했습니다.");
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    if (routePoints.length < 2) {
      setRoutePath(fallbackPath);
      return () => {
        isActive = false;
      };
    }

    setIsRouteLoading(true);
    setRouteError(null);

    fetchRouteMapPath(routePoints)
      .then((path) => {
        if (isActive) {
          setRoutePath(path.length > 0 ? path : fallbackPath);
        }
      })
      .catch(() => {
        if (isActive) {
          setRoutePath(fallbackPath);
          setRouteError("도로 경로를 불러오지 못해 직선으로 표시했습니다.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsRouteLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fallbackPath, routePoints]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const container = mapRef.current;

    if (!isSdkReady || !naverMaps || !container || routePoints.length === 0) {
      return;
    }

    let routeMap = mapInstanceRef.current;
    if (!routeMap) {
      routeMap = new naverMaps.Map(container, {
        center: new naverMaps.LatLng(routePoints[0].lat, routePoints[0].lng),
        zoom: 11,
        minZoom: 7,
        mapTypeId: naverMaps.MapTypeId.NORMAL,
        zoomControl: true,
        mapDataControl: false,
        scaleControl: false,
        logoControl: false,
      });
      mapInstanceRef.current = routeMap;
    } else {
      naverMaps.Event.trigger(routeMap, "resize");
    }

    clearOverlays();

    const bounds = new naverMaps.LatLngBounds();
    routePoints.forEach((point, index) => {
      const position = new naverMaps.LatLng(point.lat, point.lng);
      bounds.extend(position);

      const marker = new naverMaps.Marker({
        map: routeMap,
        position,
        title: point.title,
        zIndex: point.variant === "start" ? 1200 : 1500 + index,
        icon: {
          content: createPlaceBubbleMarkerIconHtml({
            title: point.title,
            subtitle: point.subtitle,
            sequenceLabel: point.sequenceLabel,
            icon: point.icon,
            variant: point.variant,
          }),
          anchor: new naverMaps.Point(
            PLACE_BUBBLE_MARKER_SIZE.anchorX,
            PLACE_BUBBLE_MARKER_SIZE.anchorY
          ),
        },
      });
      overlayRefs.current.push(marker);
    });

    if (routePath.length > 1) {
      const path = routePath.map((point) => {
        const latLng = new naverMaps.LatLng(point.lat, point.lng);
        bounds.extend(latLng);
        return latLng;
      });
      const routeLine = new naverMaps.Polyline({
        map: routeMap,
        path,
        strokeColor: "#0f766e",
        strokeWeight: 6,
        strokeOpacity: 0.82,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        zIndex: 400,
      });
      overlayRefs.current.push(routeLine);
    }

    try {
      routeMap.fitBounds(bounds, {
        top: 56,
        right: 92,
        bottom: 184,
        left: 92,
      });
    } catch {
      routeMap.fitBounds(bounds);
    }

    requestAnimationFrame(() => {
      naverMaps.Event.trigger(routeMap, "resize");
    });
  }, [isSdkReady, routePath, routePoints]);

  useEffect(() => {
    return () => {
      clearOverlays();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div>
            <p className="font-trip text-sm text-brand-700">DAY {day.day} ROUTE</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {day.date ? formatDateLabel(day.date) : "선택한 일정"} ·{" "}
              {day.items.length}곳
            </p>
          </div>
          <button
            type="button"
            aria-label="루트 지도 닫기"
            onClick={onClose}
            className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
          >
            <IoClose />
          </button>
        </header>

        <div className="relative min-h-0 flex-1">
          <div ref={mapRef} className="h-full w-full" />
          {!isSdkReady || isRouteLoading ? (
            <div className="absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur">
              {isSdkReady ? "도로 경로를 불러오는 중" : "지도를 불러오는 중"}
            </div>
          ) : routeError ? (
            <div className="absolute inset-x-4 top-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur">
              {routeError}
            </div>
          ) : null}
        </div>

        <div className="border-t border-brand-100 bg-white px-4 py-3">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {routePoints.map((point) => (
              <div
                key={point.id}
                className="min-w-[136px] rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2"
              >
                <p className="text-[10px] font-bold text-brand-700">
                  {point.variant === "start" ? "START" : `${point.sequenceLabel}번째`}
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-900">
                  {point.title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {point.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceCartRouteMapPopup;
