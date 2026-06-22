import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import {
  PLACE_BUBBLE_MARKER_SIZE,
  type PlaceBubbleMarkerVariant,
} from "@/components/map/NaverMapMarkerIcon";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiThemeStore } from "@/stores/uiThemeStore";
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
  isCompleted: boolean;
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

type RouteMapDayOption = {
  id: string;
  label: string;
  summary: string;
  day: PlannedRouteDay;
  completedItemIds?: string[];
  comparisonDay?: PlannedRouteDay | null;
};

type PlaceCartRouteMapPopupProps = {
  day: PlannedRouteDay;
  comparisonDay?: PlannedRouteDay | null;
  completedItemIds?: string[];
  dayOptions?: RouteMapDayOption[];
  initialDayOptionId?: string;
  onClose: () => void;
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

type RouteDisplayVariant = "current" | "comparison";
type RouteMapViewMode = "all" | "comparison" | "current";
type RouteSegmentSelection = {
  variant: RouteDisplayVariant;
  segmentId: string;
};

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
const ROUTE_SEGMENT_FOCUS_ZOOM = 13;
const EMPTY_COMPLETED_ITEM_IDS: string[] = [];
const EMPTY_DAY_OPTIONS: RouteMapDayOption[] = [];

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

function buildRouteMapPoints(
  day: PlannedRouteDay,
  completedItemIdSet: Set<string>
): RouteMapPoint[] {
  return [
    ...(day.startLocation
      ? [
          {
            id: "current-location",
            title: "출발 위치",
            subtitle: "출발",
            icon: "📍",
            sequenceLabel: "S",
            variant: "start" as const,
            lat: day.startLocation.lat,
            lng: day.startLocation.lng,
            isCompleted: false,
          },
        ]
      : []),
    ...day.items.map((item, index) => {
      const isCompleted = completedItemIdSet.has(item.id);

      return {
        id: item.id,
        title: item.place.title,
        subtitle: isCompleted
          ? `${item.place.contentTypeLabel} · 완료`
          : item.place.contentTypeLabel,
        icon: item.place.icon,
        sequenceLabel: `${index + 1}`,
        variant: "place" as const,
        lat: item.place.lat,
        lng: item.place.lng,
        isCompleted,
      };
    }),
  ];
}

function getRouteSegmentColor(index: number) {
  return ROUTE_SEGMENT_COLORS[index % ROUTE_SEGMENT_COLORS.length];
}

function getRouteSegmentDisplayColor({
  index,
  variant,
  hasComparisonRoute,
  routeViewMode,
}: {
  index: number;
  variant: RouteDisplayVariant;
  hasComparisonRoute: boolean;
  routeViewMode: RouteMapViewMode;
}) {
  if (hasComparisonRoute && routeViewMode === "all") {
    return variant === "comparison" ? ROUTE_ORIGINAL_COLOR : ROUTE_CURRENT_COLOR;
  }

  return getRouteSegmentColor(index);
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
  focusColor,
}: {
  point: RouteMapPoint;
  variant: RouteDisplayVariant;
  showVariantBadge: boolean;
  focusColor?: string;
}) {
  const isStart = point.variant === "start";
  const isComparison = variant === "comparison";
  const toneColor = focusColor ?? (isComparison ? "#94a3b8" : "#14b8a6");
  const toneDarkColor = focusColor ?? (isComparison ? "#475569" : "#0f766e");
  const borderColor = isStart && !focusColor ? "#cbd5e1" : toneColor;
  const labelBackground = point.isCompleted
    ? "#0f766e"
    : focusColor
    ? `${focusColor}1f`
    : isStart
      ? "#f1f5f9"
      : isComparison
        ? "#f1f5f9"
        : "#ccfbf1";
  const labelText = point.isCompleted
    ? "#ffffff"
    : focusColor
    ? toneDarkColor
    : isStart
      ? "#334155"
      : toneDarkColor;
  const shadowColor = focusColor
    ? `${focusColor}3d`
    : isComparison
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

function getRouteSegmentKey(
  variant: RouteDisplayVariant,
  segmentId: string
) {
  return `${variant}:${segmentId}`;
}

function enableRouteMapWheelZoom(routeMap: any) {
  if (typeof routeMap.setOptions !== "function") {
    return;
  }

  try {
    routeMap.setOptions({
      scrollWheel: true,
    });
  } catch {
    routeMap.setOptions("scrollWheel", true);
  }
}

function getRouteSegmentFocusPoint(path: RoutePathPoint[]) {
  if (path.length === 0) {
    return null;
  }

  if (path.length === 1) {
    return path[0];
  }

  if (path.length === 2) {
    const [start, end] = path;

    return {
      lat: (start.lat + end.lat) / 2,
      lng: (start.lng + end.lng) / 2,
    };
  }

  return path[Math.floor(path.length / 2)];
}

function moveMapToRouteSegment({
  routeMap,
  naverMaps,
  segment,
}: {
  routeMap: any;
  naverMaps: any;
  segment: RouteMapSegment;
}) {
  const focusPoint = getRouteSegmentFocusPoint(segment.path);

  if (!focusPoint) {
    return;
  }

  const center = new naverMaps.LatLng(focusPoint.lat, focusPoint.lng);

  try {
    if (typeof routeMap.morph === "function") {
      routeMap.morph(center, ROUTE_SEGMENT_FOCUS_ZOOM);
      return;
    }
  } catch {
    // 일부 환경에서 morph가 실패하면 아래 기본 이동 방식으로 보정해요.
  }

  if (typeof routeMap.setZoom === "function") {
    routeMap.setZoom(ROUTE_SEGMENT_FOCUS_ZOOM);
  }

  if (typeof routeMap.panTo === "function") {
    routeMap.panTo(center);
    return;
  }

  if (typeof routeMap.setCenter === "function") {
    routeMap.setCenter(center);
  }
}

type RouteSegmentSelectCardProps = {
  segment: RouteMapSegment;
  segmentColor: string;
  variant: RouteDisplayVariant;
  isSelected: boolean;
  onSelect: (
    variant: RouteDisplayVariant,
    segment: RouteMapSegment,
    isAlreadySelected: boolean
  ) => void;
};

const RouteSegmentSelectCard = memo(function RouteSegmentSelectCard({
  segment,
  segmentColor,
  variant,
  isSelected,
  onSelect,
}: RouteSegmentSelectCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant, segment, isSelected)}
      className={`min-w-[180px] rounded-2xl border px-3 py-2 text-left transition ${
        isSelected
          ? "bg-white shadow-sm"
          : variant === "comparison"
            ? "border-slate-200 bg-white"
            : "border-brand-100 bg-white"
      }`}
      style={
        isSelected
          ? {
              borderColor: segmentColor,
              boxShadow: `0 0 0 2px ${segmentColor}33, 0 14px 24px rgba(15, 23, 42, 0.12)`,
            }
          : undefined
      }
    >
      <span
        className={`mb-2 block rounded-full ${
          isSelected ? "h-2 w-14" : "h-1.5 w-10"
        }`}
        style={{
          backgroundColor: segmentColor,
        }}
      />
      <p
        className={`text-[10px] font-black ${
          variant === "comparison" ? "text-slate-500" : "text-brand-700"
        }`}
      >
        {segment.from.sequenceLabel} → {segment.to.sequenceLabel}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-900">
        {segment.from.title} → {segment.to.title}
      </p>
    </button>
  );
});

function PlaceCartRouteMapPopup({
  day,
  comparisonDay,
  completedItemIds = EMPTY_COMPLETED_ITEM_IDS,
  dayOptions = EMPTY_DAY_OPTIONS,
  initialDayOptionId,
  onClose,
}: PlaceCartRouteMapPopupProps) {
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlayRefs = useRef<any[]>([]);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedDayOptionId, setSelectedDayOptionId] = useState<string | null>(
    () => initialDayOptionId ?? dayOptions[0]?.id ?? null
  );
  const selectedDayOption = useMemo(
    () =>
      selectedDayOptionId
        ? dayOptions.find((option) => option.id === selectedDayOptionId) ?? null
        : null,
    [dayOptions, selectedDayOptionId]
  );
  const displayDay = selectedDayOption?.day ?? day;
  const displayComparisonDay =
    selectedDayOption?.comparisonDay ?? comparisonDay;
  const displayCompletedItemIds =
    selectedDayOption?.completedItemIds ?? completedItemIds;
  const completedItemIdSet = useMemo(
    () => new Set(displayCompletedItemIds),
    [displayCompletedItemIds]
  );
  const routePoints = useMemo(
    () => buildRouteMapPoints(displayDay, completedItemIdSet),
    [completedItemIdSet, displayDay]
  );
  const comparisonRoutePoints = useMemo(
    () =>
      displayComparisonDay
        ? buildRouteMapPoints(displayComparisonDay, completedItemIdSet)
        : [],
    [displayComparisonDay, completedItemIdSet]
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
  const [selectedSegment, setSelectedSegment] =
    useState<RouteSegmentSelection | null>(null);
  const hasComparisonRoute = Boolean(
    displayComparisonDay && comparisonRoutePoints.length > 1
  );
  const hasDaySelector = dayOptions.length > 1;
  const comparisonControlTopClass = hasDaySelector ? "top-24" : "top-4";
  const floatingPanelTopClass = hasDaySelector
    ? hasComparisonRoute
      ? "top-40"
      : "top-24"
    : hasComparisonRoute
      ? "top-20"
      : "top-4";
  const fallbackPanelTopClass = hasDaySelector ? "top-36" : "top-24";
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
  const selectedRouteSegmentView = useMemo(() => {
    if (!selectedSegment) {
      return null;
    }

    const group = visibleRoutePointGroups.find(
      (routeGroup) => routeGroup.key === selectedSegment.variant
    );

    if (!group) {
      return null;
    }

    const segmentIndex = group.segments.findIndex(
      (segment) => segment.id === selectedSegment.segmentId
    );

    if (segmentIndex < 0) {
      return null;
    }

    const segment = group.segments[segmentIndex];

    return {
      segment,
      color: getRouteSegmentDisplayColor({
        index: segmentIndex,
        variant: group.key,
        hasComparisonRoute,
        routeViewMode,
      }),
    };
  }, [
    hasComparisonRoute,
    routeViewMode,
    selectedSegment,
    visibleRoutePointGroups,
  ]);

  const clearOverlays = () => {
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
  };

  const focusRouteSegment = useCallback(
    (
      variant: RouteDisplayVariant,
      segment: RouteMapSegment,
      isAlreadySelected: boolean
    ) => {
      const naverMaps = window.naver?.maps;
      const routeMap = mapInstanceRef.current;

      if (isAlreadySelected) {
        setSelectedSegment(null);
        return;
      }

      setSelectedSegment({
        variant,
        segmentId: segment.id,
      });

      if (!naverMaps || !routeMap || segment.path.length === 0) {
        return;
      }

      moveMapToRouteSegment({
        routeMap,
        naverMaps,
        segment,
      });
    },
    []
  );

  useEffect(() => {
    if (dayOptions.length === 0) {
      setSelectedDayOptionId(null);
      return;
    }

    const hasCurrentDayOption = dayOptions.some(
      (option) => option.id === selectedDayOptionId
    );
    const nextInitialDayOptionId =
      initialDayOptionId &&
      dayOptions.some((option) => option.id === initialDayOptionId)
        ? initialDayOptionId
        : dayOptions[0].id;

    if (!hasCurrentDayOption) {
      setSelectedDayOptionId(nextInitialDayOptionId);
    }
  }, [dayOptions, initialDayOptionId, selectedDayOptionId]);

  useEffect(() => {
    setSelectedSegment(null);
    setRouteViewMode("all");
  }, [displayComparisonDay, displayDay]);

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
        scrollWheel: true,
        mapDataControl: false,
        scaleControl: false,
        logoControl: false,
        ...getNaverMapThemeOptions(isDarkMode),
      });
      mapInstanceRef.current = routeMap;
    } else {
      naverMaps.Event.trigger(routeMap, "resize");
    }
    applyNaverMapTheme(routeMap, isDarkMode);
    enableRouteMapWheelZoom(routeMap);

    clearOverlays();

    const bounds = new naverMaps.LatLngBounds();
    const selectedRouteSegment = selectedRouteSegmentView?.segment ?? null;
    const selectedSegmentColor = selectedRouteSegmentView?.color;
    const shouldShowPointMarker = (
      point: RouteMapPoint,
      variant: RouteDisplayVariant
    ) => {
      if (!selectedSegment || !selectedRouteSegment) {
        return true;
      }

      if (selectedSegment.variant !== variant) {
        return false;
      }

      return (
        point.id === selectedRouteSegment.from.id ||
        point.id === selectedRouteSegment.to.id
      );
    };
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
        if (!shouldShowPointMarker(point, variant)) {
          return;
        }

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
              focusColor:
                selectedSegment?.variant === variant
                  ? selectedSegmentColor
                  : undefined,
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
        const isComparisonLine = variant === "comparison";
        const segmentColor = getRouteSegmentDisplayColor({
          index,
          variant,
          hasComparisonRoute,
          routeViewMode,
        });
        const segmentKey = getRouteSegmentKey(variant, segment.id);
        const isSelectedSegment =
          selectedSegment &&
          getRouteSegmentKey(
            selectedSegment.variant,
            selectedSegment.segmentId
          ) === segmentKey;
        const hasSelectedSegment = Boolean(selectedSegment);

        if (isSelectedSegment) {
          const highlightLine = new naverMaps.Polyline({
            map: routeMap,
            path,
            strokeColor: segmentColor,
            strokeWeight: 18,
            strokeOpacity: 0.24,
            strokeStyle: "solid",
            strokeLineCap: "round",
            strokeLineJoin: "round",
            zIndex: 980,
          });
          overlayRefs.current.push(highlightLine);
        }

        const routeLine = new naverMaps.Polyline({
          map: routeMap,
          path,
          strokeColor: segmentColor,
          strokeWeight:
            isSelectedSegment
              ? 11
              : isAllComparisonView && isComparisonLine
              ? 7
              : isAllComparisonView
                ? 6
                : 5,
          strokeOpacity:
            isSelectedSegment
              ? 1
              : hasSelectedSegment
                ? 0.12
              : isAllComparisonView && isComparisonLine
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
          zIndex: isSelectedSegment
            ? 1000
            : variant === "comparison"
              ? 380 + index
              : 430 + index,
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
      if (!selectedSegment) {
        routeMap.fitBounds(bounds, {
          top: hasDaySelector ? 136 : 56,
          right: 92,
          bottom: 184,
          left: 92,
        });
      }
    } catch {
      if (!selectedSegment) {
        routeMap.fitBounds(bounds);
      }
    }

    requestAnimationFrame(() => {
      naverMaps.Event.trigger(routeMap, "resize");
    });
  }, [
    comparisonRoutePoints,
    comparisonRouteSegments,
    hasComparisonRoute,
    hasDaySelector,
    isDarkMode,
    isSdkReady,
    routePoints,
    routeSegments,
    routeViewMode,
    selectedSegment,
    selectedRouteSegmentView,
    shouldShowComparisonRoute,
    shouldShowCurrentRoute,
  ]);

  useEffect(() => {
    return () => {
      clearOverlays();
      mapInstanceRef.current = null;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div>
            <p className="font-trip text-sm text-brand-700">
              DAY {displayDay.day} ROUTE
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {displayDay.date
                ? formatDateLabel(displayDay.date)
                : "선택한 일정"}{" "}
              · {displayDay.items.length}곳
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
          <div
            ref={mapRef}
            className="naver-map-root h-full w-full"
            style={{
              background: "#e0f2fe",
              minHeight: "100%",
              width: "100%",
            }}
          />
          {hasDaySelector ? (
            <div className="absolute inset-x-4 top-4 z-10 rounded-2xl border border-brand-100 bg-white/95 p-2 shadow-sm backdrop-blur">
              <div className="scrollbar-hide flex gap-2 overflow-x-auto">
                {dayOptions.map((option) => {
                  const isSelected = option.id === selectedDayOptionId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedDayOptionId(option.id);
                        setSelectedSegment(null);
                        setRouteViewMode("all");
                      }}
                      className={`min-w-[116px] rounded-xl border px-3 py-2 text-left transition ${
                        isSelected
                          ? "border-brand-500 bg-brand-600 text-white shadow-sm"
                          : "border-slate-100 bg-white text-slate-600"
                      }`}
                    >
                      <span className="block font-trip text-xs">
                        {option.label}
                      </span>
                      <span
                        className={`mt-0.5 block truncate text-[10px] font-bold ${
                          isSelected ? "text-white/80" : "text-slate-400"
                        }`}
                      >
                        {option.summary}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          {hasComparisonRoute ? (
            <div
              className={`absolute inset-x-4 ${comparisonControlTopClass} rounded-2xl border border-brand-100 bg-white/95 p-1 shadow-sm backdrop-blur`}
            >
              <div className="grid grid-cols-3 gap-1">
                {ROUTE_VIEW_OPTIONS.map((option) => {
                  const isSelected = routeViewMode === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedSegment(null);
                        setRouteViewMode(option.id);
                      }}
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
          {selectedRouteSegmentView ? (
            <div
              className={`absolute left-4 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-full border bg-white/95 px-3 py-2 shadow-sm backdrop-blur ${
                floatingPanelTopClass
              }`}
              style={{
                borderColor: selectedRouteSegmentView.color,
                boxShadow: `0 12px 26px ${selectedRouteSegmentView.color}24`,
              }}
            >
              <span
                className="inline-flex min-w-0 items-center gap-2 text-xs font-black"
                style={{ color: selectedRouteSegmentView.color }}
              >
                <span
                  className="h-2 w-7 shrink-0 rounded-full"
                  style={{ backgroundColor: selectedRouteSegmentView.color }}
                />
                구간 하이라이트 중
              </span>
              <button
                type="button"
                onClick={() => setSelectedSegment(null)}
                className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-black text-slate-600"
              >
                전체 보기
              </button>
            </div>
          ) : null}
          {routeError ? (
            <div
              className={`absolute inset-x-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-semibold text-amber-800 shadow-sm backdrop-blur ${
                floatingPanelTopClass
              }`}
            >
              {routeError}
            </div>
          ) : !isSdkReady || isRouteLoading ? (
            <div
              className={`absolute inset-x-4 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 text-sm font-semibold text-brand-700 shadow-sm backdrop-blur ${
                floatingPanelTopClass
              }`}
            >
              {isSdkReady ? "도로 경로를 불러오는 중" : "지도를 불러오는 중"}
            </div>
          ) : null}
          {routeError && !isSdkReady ? (
            <div
              className={`absolute inset-x-6 ${fallbackPanelTopClass} rounded-2xl border border-brand-100 bg-white/95 p-4 text-sm shadow-sm backdrop-blur`}
            >
              <p className="font-black text-slate-900">
                지도 대신 장소 순서를 보여드려요
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                지도 SDK를 불러오지 못했지만 아래에서 방문 순서와 완료 장소를
                확인할 수 있어요.
              </p>
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
                        const isSelectedSegment =
                          selectedSegment &&
                          getRouteSegmentKey(
                            selectedSegment.variant,
                            selectedSegment.segmentId
                          ) === getRouteSegmentKey(group.key, segment.id);
                        const segmentColor =
                          getRouteSegmentDisplayColor({
                            index: segmentIndex,
                            variant: group.key,
                            hasComparisonRoute,
                            routeViewMode,
                          });

                        return (
                          <RouteSegmentSelectCard
                            key={`${group.key}-${segment.id}`}
                            segment={segment}
                            segmentColor={segmentColor}
                            variant={group.key}
                            isSelected={Boolean(isSelectedSegment)}
                            onSelect={focusRouteSegment}
                          />
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
    </div>,
    document.body
  );
}

export default PlaceCartRouteMapPopup;
