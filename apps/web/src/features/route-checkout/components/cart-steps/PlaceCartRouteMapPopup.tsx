import { useEffect, useMemo, useRef, useState } from "react";
import { IoClose } from "react-icons/io5";
import {
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

type RoutePathPoint = {
  lat: number;
  lng: number;
};

type RouteMapSegment = {
  id: string;
  from: RouteMapPoint;
  to: RouteMapPoint;
  path: RoutePathPoint[];
};

type PlaceCartRouteMapPopupProps = {
  day: PlannedRouteDay;
  comparisonDay?: PlannedRouteDay | null;
  onClose: () => void;
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

type RouteDisplayVariant = "current" | "comparison";
type RouteMapViewMode = "all" | "comparison" | "current";

const ROUTE_VIEW_OPTIONS: Array<{ id: RouteMapViewMode; label: string }> = [
  { id: "all", label: "전체" },
  { id: "comparison", label: "원래 순서" },
  { id: "current", label: "현재 순서" },
];

const ROUTE_SEGMENT_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
] as const;

const ROUTE_ORIGINAL_COLOR = "#6366f1";
const ROUTE_CURRENT_COLOR = "#14b8a6";

function escapeMarkerHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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

function getRouteSegmentColor(index: number) {
  return ROUTE_SEGMENT_COLORS[index % ROUTE_SEGMENT_COLORS.length];
}

function buildFallbackRouteSegments(points: RouteMapPoint[]): RouteMapSegment[] {
  if (points.length < 2) {
    return [];
  }

  return points.slice(0, -1).map((point, index) => {
    const nextPoint = points[index + 1];

    return {
      id: `${point.id}-${nextPoint.id}`,
      from: point,
      to: nextPoint,
      path: [
        { lat: point.lat, lng: point.lng },
        { lat: nextPoint.lat, lng: nextPoint.lng },
      ],
    };
  });
}

async function fetchRouteMapSegments(points: RouteMapPoint[]) {
  if (points.length < 2) {
    return [];
  }

  const segments: RouteMapSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const goal = points[index + 1];
    const route = await fetchDrivingRouteFromCurrentLocation({
      startLat: start.lat,
      startLng: start.lng,
      goalLat: goal.lat,
      goalLng: goal.lng,
    });

    segments.push({
      id: `${start.id}-${goal.id}`,
      from: start,
      to: goal,
      path:
        route.path.length > 0
          ? route.path
          : [
              { lat: start.lat, lng: start.lng },
              { lat: goal.lat, lng: goal.lng },
            ],
    });
  }

  return segments;
}

function createRoutePointBubbleMarkerIconHtml({
  point,
  variant,
  showVariantBadge,
}: {
  point: RouteMapPoint;
  variant: RouteDisplayVariant;
  showVariantBadge: boolean;
}) {
  const isStart = point.variant === "start";
  const isComparison = variant === "comparison";
  const toneColor = isComparison ? "#94a3b8" : "#14b8a6";
  const toneDarkColor = isComparison ? "#475569" : "#0f766e";
  const borderColor = isStart ? "#cbd5e1" : toneColor;
  const labelBackground = isStart
    ? "#f1f5f9"
    : isComparison
      ? "#f1f5f9"
      : "#ccfbf1";
  const labelText = isStart ? "#334155" : toneDarkColor;
  const shadowColor = isComparison
    ? "rgba(71,85,105,0.18)"
    : isStart
      ? "rgba(15,23,42,0.12)"
      : "rgba(15,118,110,0.18)";
  const badgeLabel = isComparison ? "원래" : "현재";

  return `
    <div style="
      position:relative;
      width:${PLACE_BUBBLE_MARKER_SIZE.width}px;
      height:${PLACE_BUBBLE_MARKER_SIZE.height}px;
      pointer-events:auto;
      user-select:none;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    ">
      <div style="
        position:absolute;
        top:0;
        left:0;
        width:100%;
        height:52px;
        border:2px solid ${borderColor};
        border-radius:14px;
        background:#ffffff;
        color:#0f172a;
        display:flex;
        align-items:center;
        gap:9px;
        padding:7px 11px 7px 9px;
        box-sizing:border-box;
        box-shadow:0 8px 18px ${shadowColor};
      ">
        ${
          showVariantBadge
            ? `<span style="
                position:absolute;
                top:-9px;
                right:10px;
                border-radius:9999px;
                background:${toneDarkColor};
                color:#ffffff;
                padding:2px 6px;
                font-size:9px;
                font-weight:900;
                line-height:1;
              ">${badgeLabel}</span>`
            : ""
        }
        <span style="
          width:30px;
          height:30px;
          border-radius:9999px;
          background:${labelBackground};
          color:${labelText};
          display:flex;
          align-items:center;
          justify-content:center;
          flex:0 0 30px;
          font-size:14px;
          font-weight:800;
          line-height:1;
        ">${escapeMarkerHtml(point.sequenceLabel)}</span>
        <span style="
          min-width:0;
          flex:1 1 auto;
          display:flex;
          flex-direction:column;
          gap:2px;
        ">
          <span style="
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            font-size:13px;
            font-weight:800;
            line-height:1.15;
          ">${escapeMarkerHtml(point.title)}</span>
          <span style="
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
            color:#64748b;
            font-size:11px;
            font-weight:700;
            line-height:1.1;
          ">${escapeMarkerHtml(point.subtitle)}</span>
        </span>
      </div>
      <div style="
        position:absolute;
        left:50%;
        top:49px;
        width:0;
        height:0;
        transform:translateX(-50%);
        border-left:10px solid transparent;
        border-right:10px solid transparent;
        border-top:12px solid ${borderColor};
        filter:drop-shadow(0 5px 5px ${shadowColor});
      "></div>
    </div>
  `;
}


function PlaceCartRouteMapPopup({
  day,
  comparisonDay,
  onClose,
}: PlaceCartRouteMapPopupProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRefs = useRef<any[]>([]);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const routePoints = useMemo(() => buildRouteMapPoints(day), [day]);
  const comparisonRoutePoints = useMemo(
    () => (comparisonDay ? buildRouteMapPoints(comparisonDay) : []),
    [comparisonDay]
  );
  const fallbackSegments = useMemo(
    () => buildFallbackRouteSegments(routePoints),
    [routePoints]
  );
  const comparisonFallbackSegments = useMemo(
    () => buildFallbackRouteSegments(comparisonRoutePoints),
    [comparisonRoutePoints]
  );
  const [routeSegments, setRouteSegments] = useState(fallbackSegments);
  const [comparisonRouteSegments, setComparisonRouteSegments] = useState(
    comparisonFallbackSegments
  );
  const hasComparisonRoute = Boolean(
    comparisonDay && comparisonRoutePoints.length > 1
  );
  const [routeViewMode, setRouteViewMode] =
    useState<RouteMapViewMode>("all");
  const shouldShowComparisonRoute =
    hasComparisonRoute && routeViewMode !== "current";
  const shouldShowCurrentRoute =
    !hasComparisonRoute || routeViewMode !== "comparison";
  const visibleRoutePointGroups = useMemo(() => {
    const groups: Array<{
      key: RouteDisplayVariant;
      label: string;
      points: RouteMapPoint[];
      segments: RouteMapSegment[];
    }> = [];

    if (shouldShowComparisonRoute) {
      groups.push({
        key: "comparison",
        label: "원래 순서",
        points: comparisonRoutePoints,
        segments: comparisonRouteSegments,
      });
    }

    if (shouldShowCurrentRoute) {
      groups.push({
        key: "current",
        label: "현재 순서",
        points: routePoints,
        segments: routeSegments,
      });
    }

    return groups;
  }, [
    comparisonRoutePoints,
    comparisonRouteSegments,
    routePoints,
    routeSegments,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
  ]);

  const clearOverlays = () => {
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
  };

  useEffect(() => {
    if (!hasComparisonRoute && routeViewMode !== "all") {
      setRouteViewMode("all");
    }
  }, [hasComparisonRoute, routeViewMode]);

  useEffect(() => {
    setRouteSegments(fallbackSegments);
    setComparisonRouteSegments(comparisonFallbackSegments);
  }, [comparisonFallbackSegments, fallbackSegments]);

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

    setIsRouteLoading(true);
    setRouteError(null);

    const loadSegments = async (
      points: RouteMapPoint[],
      fallback: RouteMapSegment[]
    ) => {
      if (points.length < 2) {
        return fallback;
      }

      const segments = await fetchRouteMapSegments(points);
      return segments.length > 0 ? segments : fallback;
    };

    Promise.allSettled([
      loadSegments(routePoints, fallbackSegments),
      comparisonRoutePoints.length > 1
        ? loadSegments(comparisonRoutePoints, comparisonFallbackSegments)
        : Promise.resolve(comparisonFallbackSegments),
    ])
      .then(([currentResult, comparisonResult]) => {
        if (isActive) {
          setRouteSegments(
            currentResult.status === "fulfilled"
              ? currentResult.value
              : fallbackSegments
          );
          setComparisonRouteSegments(
            comparisonResult.status === "fulfilled"
              ? comparisonResult.value
              : comparisonFallbackSegments
          );

          if (
            currentResult.status === "rejected" ||
            comparisonResult.status === "rejected"
          ) {
            setRouteError("일부 도로 경로를 불러오지 못해 직선으로 표시했습니다.");
          }
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
  }, [
    comparisonFallbackSegments,
    comparisonRoutePoints,
    fallbackSegments,
    routePoints,
  ]);

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
    const createPath = (path: Array<{ lat: number; lng: number }>) =>
      path.map((point) => {
        const latLng = new naverMaps.LatLng(point.lat, point.lng);
        bounds.extend(latLng);
        return latLng;
      });

    const createPlaceMarkers = (
      points: RouteMapPoint[],
      variant: RouteDisplayVariant
    ) => {
      points.forEach((point, index) => {
        const position = new naverMaps.LatLng(point.lat, point.lng);
        bounds.extend(position);

        const marker = new naverMaps.Marker({
          map: routeMap,
          position,
          title: point.title,
          zIndex:
            variant === "comparison"
              ? point.variant === "start"
                ? 1160
                : 1320 + index
              : point.variant === "start"
                ? 1220
                : 1520 + index,
          icon: {
            content: createRoutePointBubbleMarkerIconHtml({
              point,
              variant,
              showVariantBadge: hasComparisonRoute && routeViewMode === "all",
            }),
            anchor: new naverMaps.Point(
              PLACE_BUBBLE_MARKER_SIZE.anchorX,
              PLACE_BUBBLE_MARKER_SIZE.anchorY
            ),
          },
        });
        overlayRefs.current.push(marker);
      });
    };

    const createSegmentLines = (
      segments: RouteMapSegment[],
      variant: RouteDisplayVariant
    ) => {
      segments.forEach((segment, index) => {
        const path = createPath(segment.path);
        const isAllComparisonView = hasComparisonRoute && routeViewMode === "all";
        const shouldUseSegmentColor = !isAllComparisonView;
        const isComparisonLine = variant === "comparison";
        const routeLine = new naverMaps.Polyline({
          map: routeMap,
          path,
          strokeColor: shouldUseSegmentColor
            ? getRouteSegmentColor(index)
            : isComparisonLine
              ? ROUTE_ORIGINAL_COLOR
              : ROUTE_CURRENT_COLOR,
          strokeWeight:
            isAllComparisonView && isComparisonLine
              ? 7
              : isAllComparisonView
                ? 6
                : 5,
          strokeOpacity:
            isAllComparisonView && isComparisonLine
              ? 0.7
              : isAllComparisonView
                ? 0.56
                : 0.9,
          strokeStyle:
            isAllComparisonView && isComparisonLine
              ? "shortdash"
              : "solid",
          strokeLineCap: "round",
          strokeLineJoin: "round",
          zIndex: variant === "comparison" ? 380 + index : 430 + index,
        });

        overlayRefs.current.push(routeLine);
      });
    };

    if (shouldShowComparisonRoute) {
      createSegmentLines(comparisonRouteSegments, "comparison");
    }
    if (shouldShowCurrentRoute) {
      createSegmentLines(routeSegments, "current");
    }

    if (shouldShowComparisonRoute) {
      createPlaceMarkers(comparisonRoutePoints, "comparison");
    }
    if (shouldShowCurrentRoute) {
      createPlaceMarkers(routePoints, "current");
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
  }, [
    comparisonRoutePoints,
    comparisonRouteSegments,
    hasComparisonRoute,
    isSdkReady,
    routePoints,
    routeSegments,
    routeViewMode,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
  ]);

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
              {hasComparisonRoute ? " · 원래 순서 비교" : ""}
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
          {hasComparisonRoute ? (
            <div className="absolute inset-x-4 top-4 rounded-2xl border border-brand-100 bg-white/95 p-1 shadow-sm backdrop-blur">
              <div className="grid grid-cols-3 gap-1">
                {ROUTE_VIEW_OPTIONS.map((option) => {
                  const isSelected = routeViewMode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setRouteViewMode(option.id)}
                      className={`rounded-xl px-2 py-2 text-xs font-bold transition ${
                        isSelected
                          ? "bg-brand-600 text-white shadow-sm"
                          : "text-slate-500"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {!isSdkReady || isRouteLoading ? (
            <div
              className={`absolute inset-x-4 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur ${
                hasComparisonRoute ? "top-20" : "top-4"
              }`}
            >
              {isSdkReady ? "도로 경로를 불러오는 중" : "지도를 불러오는 중"}
            </div>
          ) : routeError ? (
            <div
              className={`absolute inset-x-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur ${
                hasComparisonRoute ? "top-20" : "top-4"
              }`}
            >
              {routeError}
            </div>
          ) : null}
          {hasComparisonRoute && routeViewMode === "all" ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-bold shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-indigo-600">
                  <span className="h-1.5 w-8 rounded-full border-t-[4px] border-dashed border-indigo-500/70" />
                  원래 순서 점선
                </span>
                <span className="inline-flex items-center gap-1.5 text-teal-700">
                  <span className="h-1.5 w-8 rounded-full bg-teal-500/70" />
                  현재 순서 실선
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-brand-100 bg-white px-4 py-3">
          <div className="space-y-2">
            {visibleRoutePointGroups.map((group) => {
              return (
                <div key={group.key}>
                  {hasComparisonRoute ? (
                    <p
                      className={`mb-1 text-[10px] font-black ${
                        group.key === "comparison"
                          ? "text-slate-500"
                          : "text-brand-700"
                      }`}
                    >
                      {group.label}
                    </p>
                  ) : null}
                  <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
                    {group.points.map((point) => (
                      <div
                        key={`${group.key}-${point.id}`}
                        className={`min-w-[136px] rounded-2xl border px-3 py-2 ${
                          group.key === "comparison"
                            ? "border-slate-200 bg-slate-50"
                            : "border-brand-100 bg-brand-50"
                        }`}
                      >
                        <p
                          className={`text-[10px] font-bold ${
                            group.key === "comparison"
                              ? "text-slate-500"
                              : "text-brand-700"
                          }`}
                        >
                          {point.variant === "start"
                            ? "START"
                            : `${point.sequenceLabel}번째`}
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
                  {group.segments.length > 0 ? (
                    <div className="scrollbar-hide mt-1 flex gap-2 overflow-x-auto pb-1">
                      {group.segments.map((segment, segmentIndex) => {
                        const segmentColor =
                          hasComparisonRoute && routeViewMode === "all"
                            ? group.key === "comparison"
                              ? ROUTE_ORIGINAL_COLOR
                              : ROUTE_CURRENT_COLOR
                            : getRouteSegmentColor(segmentIndex);

                        return (
                          <div
                            key={`${group.key}-${segment.id}`}
                            className={`min-w-[180px] rounded-2xl border px-3 py-2 ${
                              group.key === "comparison"
                                ? "border-slate-200 bg-white"
                                : "border-brand-100 bg-white"
                            }`}
                          >
                            <span
                              className="mb-2 block h-1.5 w-10 rounded-full"
                              style={{
                                backgroundColor: segmentColor,
                              }}
                            />
                            <p
                              className={`text-[10px] font-black ${
                                group.key === "comparison"
                                  ? "text-slate-500"
                                  : "text-brand-700"
                              }`}
                            >
                              {segment.from.sequenceLabel} →{" "}
                              {segment.to.sequenceLabel}
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-slate-900">
                              {segment.from.title} → {segment.to.title}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlaceCartRouteMapPopup;
