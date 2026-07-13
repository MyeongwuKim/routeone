import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { IoClose } from "react-icons/io5";
import { MdAdd } from "react-icons/md";
import {
  SegmentedToggle,
  type SegmentedToggleOption,
} from "@/components/inputs";
import {
  PLACE_BUBBLE_MARKER_SIZE,
  type PlaceBubbleMarkerVariant,
} from "@/components/map/NaverMapMarkerIcon";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteStartLocation,
} from "./routePlanTypes";

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
  durationMs?: number;
  distanceM?: number;
};

type RouteMapInstance = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  setCenter?: (center: unknown) => void;
  setZoom?: (zoom: number) => void;
  getZoom?: () => number;
};

type RouteMapOverlay = {
  setMap: (map: null) => void;
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
  enableStartPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
  onClose: () => void;
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

type RouteDisplayVariant = "current" | "comparison";
type RouteMapViewMode = "all" | "comparison" | "current";
type StartPreviewMode = "original" | "changed";
type RouteSegmentSelection = {
  variant: RouteDisplayVariant;
  segmentId: string;
};

type RouteMapViewState = {
  selectedDayOptionId: string | null;
  selectedSegment: RouteSegmentSelection | null;
  routeViewMode: RouteMapViewMode;
};

type RouteMapViewAction =
  | { type: "sync-day-option"; dayOptionId: string | null }
  | { type: "select-day-option"; dayOptionId: string }
  | { type: "select-segment"; segment: RouteSegmentSelection }
  | { type: "clear-selected-segment" }
  | { type: "set-route-view-mode"; routeViewMode: RouteMapViewMode }
  | { type: "reset-route-view" }
  | { type: "ensure-all-route-view" };

type RouteMapViewInitializer = {
  initialDayOptionId?: string;
  dayOptions: RouteMapDayOption[];
};

function createInitialRouteMapViewState({
  initialDayOptionId,
  dayOptions,
}: RouteMapViewInitializer): RouteMapViewState {
  return {
    selectedDayOptionId: initialDayOptionId ?? dayOptions[0]?.id ?? null,
    selectedSegment: null,
    routeViewMode: "all",
  };
}

function routeMapViewReducer(
  state: RouteMapViewState,
  action: RouteMapViewAction
): RouteMapViewState {
  switch (action.type) {
    case "sync-day-option":
      return {
        ...state,
        selectedDayOptionId: action.dayOptionId,
        selectedSegment: null,
        routeViewMode: "all",
      };
    case "select-day-option":
      return {
        selectedDayOptionId: action.dayOptionId,
        selectedSegment: null,
        routeViewMode: "all",
      };
    case "select-segment":
      return {
        ...state,
        selectedSegment: action.segment,
      };
    case "clear-selected-segment":
      return {
        ...state,
        selectedSegment: null,
      };
    case "set-route-view-mode":
      return {
        ...state,
        selectedSegment: null,
        routeViewMode: action.routeViewMode,
      };
    case "reset-route-view":
      return {
        ...state,
        selectedSegment: null,
        routeViewMode: "all",
      };
    case "ensure-all-route-view":
      return state.routeViewMode === "all"
        ? state
        : {
            ...state,
            routeViewMode: "all",
          };
    default:
      return state;
  }
}

const ROUTE_ORIGINAL_LABEL = "기존 경로";
const ROUTE_CURRENT_LABEL = "재계산 경로";
const ROUTE_ORIGINAL_DETAIL_LABEL = "기존 경로";
const ROUTE_CURRENT_DETAIL_LABEL = "재계산 경로";

const ROUTE_VIEW_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "comparison", label: ROUTE_ORIGINAL_LABEL },
  { value: "current", label: ROUTE_CURRENT_LABEL },
] satisfies ReadonlyArray<SegmentedToggleOption<RouteMapViewMode>>;

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
const EMPTY_COMPLETED_ITEM_IDS: string[] = [];
const EMPTY_DAY_OPTIONS: RouteMapDayOption[] = [];
const DEFAULT_START_PREVIEW_OFFSET = {
  lat: -0.012,
  lng: -0.012,
};

const START_PREVIEW_MODE_OPTIONS = [
  { value: "original", label: ROUTE_ORIGINAL_LABEL },
  { value: "changed", label: ROUTE_CURRENT_LABEL },
] satisfies ReadonlyArray<SegmentedToggleOption<StartPreviewMode>>;

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

function formatDurationMs(value: number, text: UiText) {
  const minutes = Math.max(1, Math.round(value / 60000));

  if (minutes < 60) {
    return text.dayRoute.minutes(minutes);
  }

  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;

  return minute > 0
    ? text.dayRoute.hoursMinutes(hour, minute)
    : text.dayRoute.hours(hour);
}

function formatDistanceM(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`;
  }

  return `${Math.max(1, Math.round(value))}m`;
}

function getRouteDayKey(day: PlannedRouteDay) {
  return `${day.day}:${day.date}:${day.items.map((item) => item.id).join(",")}`;
}

function getInitialStartPreviewLocation(
  day: PlannedRouteDay
): RouteStartLocation | null {
  if (day.startLocation) {
    return day.startLocation;
  }

  const firstPlace = day.items[0]?.place;

  if (!firstPlace) {
    return null;
  }

  return {
    lat: firstPlace.lat + DEFAULT_START_PREVIEW_OFFSET.lat,
    lng: firstPlace.lng + DEFAULT_START_PREVIEW_OFFSET.lng,
  };
}

function createStartPreviewDay({
  day,
  startLocation,
  shouldReorder = false,
}: {
  day: PlannedRouteDay;
  startLocation: RouteStartLocation;
  shouldReorder?: boolean;
}) {
  return {
    ...day,
    startsFromCurrentLocation: false,
    startLocation,
    items: shouldReorder
      ? reorderRouteItemsFromStart(day.items, startLocation)
      : day.items,
  } satisfies PlannedRouteDay;
}

function calculateRouteMapDistanceKm(
  from: RouteStartLocation,
  to: RouteStartLocation
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function reorderRouteItemsFromStart(
  items: PlannedRouteItem[],
  startLocation: RouteStartLocation
) {
  const remainingItems = [...items];
  const reorderedItems: PlannedRouteItem[] = [];
  let currentPoint = startLocation;

  while (remainingItems.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remainingItems.forEach((item, index) => {
      const distance = calculateRouteMapDistanceKm(currentPoint, item.place);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nearestItem] = remainingItems.splice(nearestIndex, 1);
    reorderedItems.push(nearestItem);
    currentPoint = nearestItem.place;
  }

  return reorderedItems;
}

function readLatLng(value: unknown): RouteStartLocation | null {
  const point = value as {
    lat?: number | (() => number);
    lng?: number | (() => number);
    x?: number;
    y?: number;
  } | null;
  const lat =
    typeof point?.lat === "function"
      ? point.lat()
      : typeof point?.lat === "number"
        ? point.lat
        : typeof point?.y === "number"
          ? point.y
          : null;
  const lng =
    typeof point?.lng === "function"
      ? point.lng()
      : typeof point?.lng === "number"
        ? point.lng
        : typeof point?.x === "number"
          ? point.x
          : null;

  if (lat == null || lng == null) {
    return null;
  }

  return {
    lat,
    lng,
  };
}

function buildRouteMapPoints(
  day: PlannedRouteDay,
  completedItemIdSet: Set<string>,
  text: UiText
): RouteMapPoint[] {
  return [
    ...(day.startLocation
      ? [
          {
            id: "current-location",
            title: text.dayRoute.savedStartLocation,
            subtitle: text.dayRoute.start,
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
      const categoryLabel = localizePlaceCategoryLabel(
        item.place.contentTypeLabel,
        text
      );

      return {
        id: item.id,
        title: item.place.title,
        subtitle: isCompleted
          ? `${categoryLabel} · ${text.dayRoute.visited}`
          : categoryLabel,
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

async function fetchRouteMapSegments(
  points: RouteMapPoint[],
  language: "ko" | "en"
) {
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
      language,
    });

    segments.push({
      id: `${start.id}-${goal.id}`,
      from: start,
      to: goal,
      durationMs: route.durationMs,
      distanceM: route.distanceM,
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
  const borderColor = isStart && !focusColor ? "#14b8a6" : toneColor;
  const labelBackground = point.isCompleted
    ? "#0f766e"
    : focusColor
    ? `${focusColor}1f`
    : isStart
      ? "#0f766e"
      : isComparison
        ? "#f1f5f9"
        : "#ccfbf1";
  const labelText = point.isCompleted
    ? "#ffffff"
    : focusColor
    ? toneDarkColor
    : isStart
      ? "#ffffff"
      : toneDarkColor;
  const shadowColor = focusColor
    ? `${focusColor}3d`
    : isComparison
      ? "rgba(71,85,105,0.18)"
      : isStart
        ? "rgba(20,184,166,0.30)"
        : "rgba(15,118,110,0.18)";
  const badgeLabel = isComparison ? ROUTE_ORIGINAL_LABEL : ROUTE_CURRENT_LABEL;

  return `
    <div style="
      position:relative;
      width:${PLACE_BUBBLE_MARKER_SIZE.width}px;
      height:${PLACE_BUBBLE_MARKER_SIZE.height}px;
      pointer-events:auto;
      user-select:none;
      cursor:${isStart ? "grab" : "default"};
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    ">
      ${
        isStart
          ? `<span style="
              position:absolute;
              top:2px;
              right:10px;
              z-index:3;
              border-radius:9999px;
              background:#0f766e;
              color:#ffffff;
              padding:3px 8px;
              font-size:9px;
              font-weight:900;
              line-height:1;
              box-shadow:0 8px 18px rgba(15,118,110,0.22);
            ">START</span>`
          : ""
      }
      <div style="
        position:absolute;
        top:0;
        left:0;
        z-index:2;
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
      ${
        isStart
          ? `<div style="
              position:absolute;
              left:50%;
              top:42px;
              z-index:1;
              width:24px;
              height:24px;
              transform:translateX(-50%);
              border-radius:9999px;
              border:3px solid #ffffff;
              background:#14b8a6;
              box-shadow:0 12px 24px rgba(20,184,166,0.32), 0 4px 10px rgba(15,23,42,0.18);
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <span style="
                width:7px;
                height:7px;
                border-radius:9999px;
                background:#ffffff;
              "></span>
            </div>
            <div style="
              position:absolute;
              left:50%;
              top:59px;
              z-index:0;
              width:0;
              height:0;
              transform:translateX(-50%);
              border-left:6px solid transparent;
              border-right:6px solid transparent;
              border-top:7px solid #0f766e;
              filter:drop-shadow(0 6px 6px rgba(15,118,110,0.24));
            "></div>`
          : `<div style="
              position:absolute;
              left:50%;
              top:42px;
              z-index:1;
              width:24px;
              height:24px;
              transform:translateX(-50%);
              border-radius:9999px;
              border:3px solid #ffffff;
              background:${borderColor};
              box-shadow:0 12px 24px ${shadowColor}, 0 4px 10px rgba(15,23,42,0.18);
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              <span style="
                width:7px;
                height:7px;
                border-radius:9999px;
                background:#ffffff;
              "></span>
            </div>
            <div style="
              position:absolute;
              left:50%;
              top:59px;
              z-index:0;
              width:0;
              height:0;
              transform:translateX(-50%);
              border-left:6px solid transparent;
              border-right:6px solid transparent;
              border-top:7px solid ${borderColor};
              filter:drop-shadow(0 6px 6px ${shadowColor});
            "></div>`
      }
    </div>
  `;
}

function getRouteSegmentKey(
  variant: RouteDisplayVariant,
  segmentId: string
) {
  return `${variant}:${segmentId}`;
}

type RouteSegmentSelectCardProps = {
  segment: RouteMapSegment;
  segmentColor: string;
  variant: RouteDisplayVariant;
  isSelected: boolean;
  text: UiText;
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
  text,
  onSelect,
}: RouteSegmentSelectCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(variant, segment, isSelected)}
      className={`h-[76px] min-w-[180px] rounded-2xl border px-3 py-2 text-left transition ${
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
        className={`mb-1.5 block h-1.5 rounded-full ${
          isSelected ? "w-14" : "w-10"
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
      <p className="mt-1 min-h-4 truncate text-[10px] font-bold text-slate-500">
        {segment.durationMs && segment.distanceM ? (
          <>
            {text.dayRoute.travelByCar(
              formatDurationMs(segment.durationMs, text)
            )} ·{" "}
            {formatDistanceM(segment.distanceM)}
          </>
        ) : null}
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
  enableStartPreview = false,
  onRequestCheckout,
  onClose,
}: PlaceCartRouteMapPopupProps) {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<RouteMapInstance | null>(null);
  const renderedDayKeyRef = useRef<string | null>(null);
  const autoFitKeyRef = useRef<string | null>(null);
  const overlayRefs = useRef<RouteMapOverlay[]>([]);
  const overlayCleanupRefs = useRef<Array<() => void>>([]);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [isRouteLoading, setIsRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [startPreviewDraftByDayKey, setStartPreviewDraftByDayKey] = useState<
    Record<string, RouteStartLocation>
  >({});
  const [startPreviewModeByDayKey, setStartPreviewModeByDayKey] = useState<
    Record<string, StartPreviewMode>
  >({});
  const [routeMapViewState, dispatchRouteMapView] = useReducer(
    routeMapViewReducer,
    { initialDayOptionId, dayOptions },
    createInitialRouteMapViewState
  );
  const { selectedDayOptionId, selectedSegment, routeViewMode } =
    routeMapViewState;
  const [isCheckoutScopeOpen, setIsCheckoutScopeOpen] = useState(false);
  const [selectedCheckoutDayIds, setSelectedCheckoutDayIds] = useState<
    string[]
  >([]);
  const selectedDayOption = useMemo(
    () =>
      selectedDayOptionId
        ? dayOptions.find((option) => option.id === selectedDayOptionId) ?? null
        : null,
    [dayOptions, selectedDayOptionId]
  );
  const displayDay = selectedDayOption?.day ?? day;
  const displayCompletedItemIds =
    selectedDayOption?.completedItemIds ?? completedItemIds;
  const displayDayKey = useMemo(() => getRouteDayKey(displayDay), [displayDay]);
  const initialStartPreviewLocation = useMemo(
    () =>
      enableStartPreview ? getInitialStartPreviewLocation(displayDay) : null,
    [displayDay, enableStartPreview]
  );
  const changedStartPreviewLocation = enableStartPreview
    ? (startPreviewDraftByDayKey[displayDayKey] ?? null)
    : null;
  const isStartPreviewDirty =
    enableStartPreview && Boolean(changedStartPreviewLocation);
  const startPreviewMode = isStartPreviewDirty
    ? (startPreviewModeByDayKey[displayDayKey] ?? "changed")
    : "changed";
  const previewStartLocation =
    enableStartPreview
      ? startPreviewMode === "original"
        ? initialStartPreviewLocation
        : (changedStartPreviewLocation ?? initialStartPreviewLocation)
      : initialStartPreviewLocation;
  const createStartPreviewRouteDay = useCallback(
    (routeDay: PlannedRouteDay) => {
      const routeDayKey = getRouteDayKey(routeDay);
      const initialLocation = getInitialStartPreviewLocation(routeDay);
      const changedLocation = enableStartPreview
        ? (startPreviewDraftByDayKey[routeDayKey] ?? null)
        : null;
      const isDirty = enableStartPreview && Boolean(changedLocation);
      const mode = isDirty
        ? (startPreviewModeByDayKey[routeDayKey] ?? "changed")
        : "changed";
      const startLocation =
        enableStartPreview
          ? mode === "original"
            ? initialLocation
            : (changedLocation ?? initialLocation)
          : initialLocation;

      return enableStartPreview && startLocation
        ? createStartPreviewDay({
            day: routeDay,
            startLocation,
            shouldReorder: isDirty && mode === "changed",
          })
        : routeDay;
    },
    [
      enableStartPreview,
      startPreviewDraftByDayKey,
      startPreviewModeByDayKey,
    ]
  );
  const displayRouteDay = useMemo(
    () =>
      enableStartPreview && previewStartLocation
        ? createStartPreviewRouteDay(displayDay)
        : displayDay,
    [
      createStartPreviewRouteDay,
      displayDay,
      enableStartPreview,
      previewStartLocation,
    ]
  );
  const checkoutDayOptions = useMemo(() => {
    const routeDayOptions =
      dayOptions.length > 0
        ? dayOptions
        : [
            {
              id: displayDayKey,
              label: `DAY ${displayDay.day}`,
              summary: displayDay.date
                ? formatDateLabel(displayDay.date)
                : text.dayRoute.placeCount(displayDay.items.length),
              day: displayDay,
            },
          ];

    return routeDayOptions
      .map((option) => {
        const routeDay = createStartPreviewRouteDay(option.day);

        return {
          id: option.id,
          label: option.label,
          summary: option.summary,
          day: routeDay,
        };
      })
      .filter((option) => option.day.items.length > 0);
  }, [createStartPreviewRouteDay, dayOptions, displayDay, displayDayKey, text]);
  const checkoutRoutePlan = useMemo(
    () => checkoutDayOptions.map((option) => option.day),
    [checkoutDayOptions]
  );
  const checkoutPlaceCount = useMemo(
    () =>
      checkoutRoutePlan.reduce(
        (totalCount, routeDay) => totalCount + routeDay.items.length,
        0
      ),
    [checkoutRoutePlan]
  );
  const selectedCheckoutDayIdSet = useMemo(
    () => new Set(selectedCheckoutDayIds),
    [selectedCheckoutDayIds]
  );
  const selectedCheckoutDayOptions = useMemo(
    () =>
      checkoutDayOptions.filter((option) =>
        selectedCheckoutDayIdSet.has(option.id)
      ),
    [checkoutDayOptions, selectedCheckoutDayIdSet]
  );
  const selectedCheckoutRoutePlan = useMemo(
    () => selectedCheckoutDayOptions.map((option) => option.day),
    [selectedCheckoutDayOptions]
  );
  const selectedCheckoutPlaceCount = useMemo(
    () =>
      selectedCheckoutRoutePlan.reduce(
        (totalCount, routeDay) => totalCount + routeDay.items.length,
        0
      ),
    [selectedCheckoutRoutePlan]
  );
  const isAllCheckoutDaysSelected =
    checkoutDayOptions.length > 0 &&
    checkoutDayOptions.every((option) =>
      selectedCheckoutDayIdSet.has(option.id)
    );
  const displayComparisonDay = selectedDayOption?.comparisonDay ?? comparisonDay;
  const completedItemIdSet = useMemo(
    () => new Set(displayCompletedItemIds),
    [displayCompletedItemIds]
  );
  const routePoints = useMemo(
    () => buildRouteMapPoints(displayRouteDay, completedItemIdSet, text),
    [completedItemIdSet, displayRouteDay, text]
  );
  const comparisonRoutePoints = useMemo(
    () =>
      displayComparisonDay
        ? buildRouteMapPoints(displayComparisonDay, completedItemIdSet, text)
        : [],
    [displayComparisonDay, completedItemIdSet, text]
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
    displayComparisonDay && comparisonRoutePoints.length > 1
  );
  const hasDaySelector = dayOptions.length > 1;
  const canResetStartPreview =
    enableStartPreview && Boolean(initialStartPreviewLocation);
  const comparisonControlTopClass = hasDaySelector ? "top-16" : "top-4";
  const floatingPanelTopClass = hasDaySelector
    ? hasComparisonRoute
      ? "top-28"
      : "top-16"
    : hasComparisonRoute
      ? "top-20"
      : "top-4";
  const fallbackPanelTopClass = hasDaySelector ? "top-28" : "top-24";
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
        label: ROUTE_ORIGINAL_DETAIL_LABEL,
        points: comparisonRoutePoints,
        segments: comparisonRouteSegments,
      });
    }

    if (shouldShowCurrentRoute) {
      groups.push({
        key: "current",
        label: ROUTE_CURRENT_DETAIL_LABEL,
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
  const mapAutoFitKey = useMemo(() => {
    const serializePoint = (point: RouteMapPoint) =>
      `${point.id}:${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;

    return [
      displayDayKey,
      routeViewMode,
      shouldShowComparisonRoute ? "comparison" : "",
      shouldShowCurrentRoute ? "current" : "",
      routePoints.map(serializePoint).join("|"),
      comparisonRoutePoints.map(serializePoint).join("|"),
    ].join("::");
  }, [
    comparisonRoutePoints,
    displayDayKey,
    routePoints,
    routeViewMode,
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
    overlayCleanupRefs.current.forEach((cleanup) => cleanup());
    overlayCleanupRefs.current = [];
    overlayRefs.current.forEach((overlay) => overlay.setMap(null));
    overlayRefs.current = [];
  };

  const focusRouteSegment = useCallback(
    (
      variant: RouteDisplayVariant,
      segment: RouteMapSegment,
      isAlreadySelected: boolean
    ) => {
      if (isAlreadySelected) {
        dispatchRouteMapView({ type: "clear-selected-segment" });
        return;
      }

      dispatchRouteMapView({
        type: "select-segment",
        segment: {
          variant,
          segmentId: segment.id,
        },
      });
    },
    []
  );

  const moveStartPreviewTo = useCallback(
    (location: RouteStartLocation) => {
      setStartPreviewDraftByDayKey((currentDrafts) => ({
        ...currentDrafts,
        [displayDayKey]: location,
      }));
      setStartPreviewModeByDayKey((currentModes) => ({
        ...currentModes,
        [displayDayKey]: "changed",
      }));
      dispatchRouteMapView({ type: "clear-selected-segment" });
    },
    [displayDayKey]
  );
  const requestCheckout = useCallback(
    (routePlan: PlannedRouteDay[]) => {
      if (routePlan.length === 0) {
        return;
      }

      setIsCheckoutScopeOpen(false);
      onRequestCheckout?.(routePlan);
    },
    [onRequestCheckout]
  );
  const toggleCheckoutDay = useCallback((dayId: string) => {
    setSelectedCheckoutDayIds((currentDayIds) =>
      currentDayIds.includes(dayId)
        ? currentDayIds.filter((currentDayId) => currentDayId !== dayId)
        : [...currentDayIds, dayId]
    );
  }, []);
  const toggleAllCheckoutDays = useCallback(() => {
    setSelectedCheckoutDayIds((currentDayIds) =>
      checkoutDayOptions.every((option) => currentDayIds.includes(option.id))
        ? []
        : checkoutDayOptions.map((option) => option.id)
    );
  }, [checkoutDayOptions]);
  const handleCheckoutButtonClick = useCallback(() => {
    if (!onRequestCheckout || checkoutRoutePlan.length === 0) {
      return;
    }

    setSelectedCheckoutDayIds(checkoutDayOptions.map((option) => option.id));
    setIsCheckoutScopeOpen(true);
  }, [
    checkoutDayOptions,
    checkoutRoutePlan,
    onRequestCheckout,
  ]);

  useEffect(() => {
    if (dayOptions.length === 0) {
      dispatchRouteMapView({
        type: "sync-day-option",
        dayOptionId: null,
      });
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
      dispatchRouteMapView({
        type: "sync-day-option",
        dayOptionId: nextInitialDayOptionId,
      });
    }
  }, [dayOptions, initialDayOptionId, selectedDayOptionId]);

  useEffect(() => {
    dispatchRouteMapView({ type: "reset-route-view" });
  }, [displayComparisonDay, displayDay]);

  useEffect(() => {
    if (!hasComparisonRoute && routeViewMode !== "all") {
      dispatchRouteMapView({ type: "ensure-all-route-view" });
    }
  }, [hasComparisonRoute, routeViewMode]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setRouteSegments(fallbackSegments);
      setComparisonRouteSegments(comparisonFallbackSegments);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [comparisonFallbackSegments, fallbackSegments]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isCheckoutScopeOpen) {
          setIsCheckoutScopeOpen(false);
          return;
        }

        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCheckoutScopeOpen, onClose]);

  useEffect(() => {
    let isActive = true;

    setIsSdkReady(false);
    setRouteError(null);

    loadNaverMapSdk(NCP_KEY_ID, appLanguage)
      .then(() => {
        if (isActive) {
          setIsSdkReady(true);
        }
      })
      .catch(() => {
        if (isActive) {
          setRouteError(text.home.mapLoadError);
        }
      });

    return () => {
      isActive = false;
    };
  }, [appLanguage, text]);

  useEffect(() => {
    let isActive = true;
    queueMicrotask(() => {
      if (isActive) {
        setIsRouteLoading(true);
        setRouteError(null);
      }
    });

    const loadSegments = async (
      points: RouteMapPoint[],
      fallback: RouteMapSegment[]
    ) => {
      if (points.length < 2) {
        return fallback;
      }

      const segments = await fetchRouteMapSegments(points, appLanguage);
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
            setRouteError(text.dayRoute.routeMapPartialLoadError);
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
    appLanguage,
    routePoints,
    text,
  ]);

  useEffect(() => {
    const naverMaps = window.naver?.maps;
    const container = mapRef.current;

    if (!isSdkReady || !naverMaps || !container || routePoints.length === 0) {
      return;
    }

    const previousRenderedDayKey = renderedDayKeyRef.current;
    const previousAutoFitKey = autoFitKeyRef.current;
    let routeMap = mapInstanceRef.current;
    if (!routeMap) {
      routeMap = new naverMaps.Map(container, {
        center: new naverMaps.LatLng(routePoints[0].lat, routePoints[0].lng),
        zoom: 11,
        minZoom: 7,
        mapTypeId: naverMaps.MapTypeId.NORMAL,
        zoomControl: false,
        draggable: true,
        pinchZoom: true,
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

    if (!routeMap) {
      return;
    }

    applyNaverMapTheme(routeMap, isDarkMode);
    enableNaverMapPointerInteractions(routeMap);

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
      path.map((point) => new naverMaps.LatLng(point.lat, point.lng));

    const extendBoundsWithPoints = (points: RouteMapPoint[]) => {
      points.forEach((point) => {
        bounds.extend(new naverMaps.LatLng(point.lat, point.lng));
      });
    };

    const extendBoundsWithSegments = (segments: RouteMapSegment[]) => {
      segments.forEach((segment) => {
        segment.path.forEach((pathPoint) => {
          bounds.extend(new naverMaps.LatLng(pathPoint.lat, pathPoint.lng));
        });
      });
    };

    const createPlaceMarkers = (
      points: RouteMapPoint[],
      variant: RouteDisplayVariant
    ) => {
      points.forEach((point, index) => {
        if (!shouldShowPointMarker(point, variant)) {
          return;
        }

        const position = new naverMaps.LatLng(point.lat, point.lng);
        const isStartPreviewMarker =
          enableStartPreview &&
          variant === "current" &&
          point.variant === "start";

        const marker = new naverMaps.Marker({
          map: routeMap,
          position,
          title: point.title,
          draggable: isStartPreviewMarker,
          zIndex:
            variant === "comparison"
              ? point.variant === "start"
                ? 1160
                : 1320 + index
              : point.variant === "start"
                ? 1900
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

        if (isStartPreviewMarker) {
          const dragEndListener = naverMaps.Event.addListener(
            marker,
            "dragend",
            () => {
              const nextLocation = readLatLng(marker.getPosition?.());

              if (!nextLocation) {
                return;
              }

              moveStartPreviewTo(nextLocation);
            }
          );

          overlayCleanupRefs.current.push(() => {
            naverMaps.Event.removeListener?.(dragEndListener);
          });
        }

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
        const strokeWeight = isSelectedSegment
          ? 11
          : isAllComparisonView && isComparisonLine
            ? 6
            : isAllComparisonView
              ? 7
              : 5;
        const strokeOpacity = isSelectedSegment
          ? 1
          : hasSelectedSegment
            ? 0.12
          : isAllComparisonView && isComparisonLine
            ? 0.76
            : isAllComparisonView
              ? 0.66
              : 0.9;
        const strokeStyle =
          isAllComparisonView && isComparisonLine
            ? "shortdash"
            : "solid";
        const lineZIndex = isSelectedSegment
          ? 1000
          : isAllComparisonView && isComparisonLine
            ? 620 + index
            : isAllComparisonView
              ? 560 + index
              : variant === "comparison"
                ? 380 + index
                : 430 + index;

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

        const shouldRenderCasingLine =
          !isAllComparisonView || hasSelectedSegment || isSelectedSegment;
        const routeCasingLine = shouldRenderCasingLine
          ? new naverMaps.Polyline({
              map: routeMap,
              path,
              strokeColor: "#ffffff",
              strokeWeight: strokeWeight + (isAllComparisonView ? 4 : 6),
              strokeOpacity: hasSelectedSegment ? 0.36 : 0.86,
              strokeStyle,
              strokeLineCap: "round",
              strokeLineJoin: "round",
              zIndex: lineZIndex - 1,
            })
          : null;
        const routeLine = new naverMaps.Polyline({
          map: routeMap,
          path,
          strokeColor: segmentColor,
          strokeWeight,
          strokeOpacity,
          strokeStyle,
          strokeLineCap: "round",
          strokeLineJoin: "round",
          zIndex: lineZIndex,
        });

        if (routeCasingLine) {
          overlayRefs.current.push(routeCasingLine);
        }
        overlayRefs.current.push(routeLine);
      });
    };

    if (shouldShowComparisonRoute) {
      extendBoundsWithSegments(comparisonRouteSegments);
      extendBoundsWithPoints(comparisonRoutePoints);
    }
    if (shouldShowCurrentRoute) {
      extendBoundsWithSegments(routeSegments);
      extendBoundsWithPoints(routePoints);
    }

    const shouldPreserveStartPreviewViewport =
      enableStartPreview &&
      isStartPreviewDirty &&
      previousRenderedDayKey === displayDayKey;
    const shouldAutoFitBounds =
      !selectedSegment &&
      !shouldPreserveStartPreviewViewport &&
      previousAutoFitKey !== mapAutoFitKey;

    try {
      if (shouldAutoFitBounds) {
        routeMap.fitBounds(bounds, {
          top: hasDaySelector ? 136 : 56,
          right: 92,
          bottom: hasComparisonRoute && routeViewMode === "all" ? 104 : 56,
          left: 92,
        });
      }
    } catch {
      if (shouldAutoFitBounds) {
        routeMap.fitBounds(bounds);
      }
    }

    if (shouldAutoFitBounds) {
      autoFitKeyRef.current = mapAutoFitKey;
    }

    clearOverlays();

    if (shouldShowCurrentRoute) {
      createSegmentLines(routeSegments, "current");
    }
    if (shouldShowComparisonRoute) {
      createSegmentLines(comparisonRouteSegments, "comparison");
    }

    if (shouldShowComparisonRoute) {
      createPlaceMarkers(comparisonRoutePoints, "comparison");
    }
    if (shouldShowCurrentRoute) {
      createPlaceMarkers(routePoints, "current");
    }

    renderedDayKeyRef.current = displayDayKey;

    requestAnimationFrame(() => {
      naverMaps.Event.trigger(routeMap, "resize");
    });
  }, [
    comparisonRoutePoints,
    comparisonRouteSegments,
    displayDayKey,
    enableStartPreview,
    hasComparisonRoute,
    hasDaySelector,
    isDarkMode,
    isSdkReady,
    isStartPreviewDirty,
    mapAutoFitKey,
    moveStartPreviewTo,
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
    <div className="fixed inset-0 z-[2750] bg-white">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">
              {hasDaySelector
                ? "ROUTE MAP"
                : text.dayRoute.routeMapDayTitle(displayDay.day)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {hasDaySelector
                ? `${text.dayRoute.daySchedule(
                    dayOptions.length
                  )} · ${text.dayRoute.routeMapSelectedDay(displayDay.day)}`
                : displayDay.date
                  ? formatDateLabel(displayDay.date)
                  : text.dayRoute.selectedSchedule}{" "}
              · {text.dayRoute.placeCount(displayDay.items.length)}
              {hasComparisonRoute ? ` · ${text.dayRoute.routeMapComparison}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRequestCheckout ? (
              <button
                type="button"
                onClick={handleCheckoutButtonClick}
                disabled={checkoutRoutePlan.length === 0}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40"
              >
                <MdAdd className="text-base" />
                {text.dayRoute.addToCart}
              </button>
            ) : null}
            <button
              type="button"
              aria-label={text.dayRoute.routeMapCloseAria}
              onClick={onClose}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              <IoClose />
            </button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div
            ref={mapRef}
            className="naver-map-root h-full w-full overflow-hidden"
            style={{
              background: "#e0f2fe",
              minHeight: "100%",
              width: "100%",
            }}
          />
          {hasDaySelector ? (
            <div className="scrollbar-hide absolute inset-x-0 top-4 z-10 overflow-x-auto px-3 pb-1">
              <div className="flex w-max min-w-full gap-2 pr-3">
                {dayOptions.map((option) => {
                  const isSelected = option.id === selectedDayOptionId;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${option.label} 경로 보기`}
                      onClick={() => {
                        dispatchRouteMapView({
                          type: "select-day-option",
                          dayOptionId: option.id,
                        });
                      }}
                      className={`inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold shadow-sm transition ${
                        isSelected
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-brand-200 bg-white/95 text-slate-600 backdrop-blur"
                      }`}
                    >
                      <span className="whitespace-nowrap">
                        {option.label}
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
              <SegmentedToggle
                options={ROUTE_VIEW_OPTIONS}
                value={routeViewMode}
                onChange={(nextMode) => {
                  dispatchRouteMapView({
                    type: "set-route-view-mode",
                    routeViewMode: nextMode,
                  });
                }}
                ariaLabel="경로 표시 방식"
                fullWidth
                className="rounded-xl border-0 bg-transparent p-0"
                itemClassName="rounded-xl px-2 py-2 text-xs font-bold"
                idleItemClassName="text-slate-500 hover:bg-brand-50"
              />
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
                onClick={() =>
                  dispatchRouteMapView({ type: "clear-selected-segment" })
                }
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
              className={`absolute left-3 z-20 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full border border-brand-400/30 bg-[#071718]/90 px-3 py-2 text-xs font-black text-brand-100 shadow-[0_10px_24px_rgba(0,0,0,0.22)] backdrop-blur ${
                floatingPanelTopClass
              }`}
            >
              <span className="size-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <span className="truncate">
                {isSdkReady
                  ? text.dayRoute.routeCalculating
                  : text.dayRoute.mapPreparing}
              </span>
            </div>
          ) : null}
          {routeError && !isSdkReady ? (
            <div
              className={`absolute inset-x-6 ${fallbackPanelTopClass} rounded-2xl border border-brand-100 bg-white/95 p-4 text-sm shadow-sm backdrop-blur`}
            >
              <p className="font-black text-slate-900">
                {text.dayRoute.mapFallbackTitle}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {text.dayRoute.mapFallbackDescription}
              </p>
            </div>
          ) : null}
          {hasComparisonRoute && routeViewMode === "all" ? (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-brand-100 bg-white/95 px-4 py-3 text-xs font-bold shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5 text-indigo-600">
                  <span className="h-1.5 w-8 rounded-full border-t-[4px] border-dashed border-indigo-500/70" />
                  {text.dayRoute.originalRouteDashed}
                </span>
                <span className="inline-flex items-center gap-1.5 text-teal-700">
                  <span className="h-1.5 w-8 rounded-full bg-teal-500/70" />
                  {text.dayRoute.recalculatedRouteSolid}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="app-safe-area-footer max-h-[228px] shrink-0 overflow-hidden border-t border-brand-100 bg-white px-4 py-3">
          <div className="scrollbar-hide max-h-[204px] overflow-y-auto pr-1">
            <div className="space-y-2 pb-1">
              {isStartPreviewDirty ? (
                <div className="flex items-center justify-between gap-3 pb-1">
                  <p className="shrink-0 text-[10px] font-black text-brand-700">
                    {text.dayRoute.startBasis}
                  </p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <SegmentedToggle
                      options={START_PREVIEW_MODE_OPTIONS}
                      value={startPreviewMode}
                      onChange={(mode) => {
                        setStartPreviewModeByDayKey((currentModes) => ({
                          ...currentModes,
                          [displayDayKey]: mode,
                        }));
                        dispatchRouteMapView({
                          type: "clear-selected-segment",
                        });
                      }}
                      ariaLabel={text.dayRoute.startRouteComparisonAria}
                      size="xs"
                    />
                    {canResetStartPreview ? (
                      <button
                        type="button"
                        onClick={() => {
                          setStartPreviewDraftByDayKey((currentDrafts) => {
                            const nextDrafts = { ...currentDrafts };
                            delete nextDrafts[displayDayKey];
                            return nextDrafts;
                          });
                          setStartPreviewModeByDayKey((currentModes) => {
                            const nextModes = { ...currentModes };
                            delete nextModes[displayDayKey];
                            return nextModes;
                          });
                          dispatchRouteMapView({
                            type: "clear-selected-segment",
                          });
                        }}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black text-slate-500"
                      >
                        {text.common.reset}
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
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
                          className={`h-16 min-w-[136px] rounded-2xl border px-3 py-2 ${
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
                              : text.dayRoute.stopOrderLabel(
                                  point.sequenceLabel
                                )}
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
                              text={text}
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
      </div>
      {isCheckoutScopeOpen ? (
        <div
          className="absolute inset-0 z-[2147483600] flex items-end bg-slate-950/50 px-4 pb-4 backdrop-blur-[2px]"
          onMouseDown={() => setIsCheckoutScopeOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={text.dayRoute.checkoutScopeAria}
            className="flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-[28px] border border-brand-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-black text-brand-700">
                  {text.dayRoute.checkoutScope}
                </p>
                <h2 className="mt-1 text-lg font-black text-slate-950">
                  {text.dayRoute.checkoutScopeTitle}
                </h2>
              </div>
              <button
                type="button"
                aria-label={text.dayRoute.checkoutScopeCloseAria}
                onClick={() => setIsCheckoutScopeOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
              >
                <IoClose />
              </button>
            </div>

            <button
              type="button"
              aria-pressed={isAllCheckoutDaysSelected}
              onClick={toggleAllCheckoutDays}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left transition hover:border-brand-400 hover:bg-brand-100"
            >
              <span className="inline-flex min-w-0 items-center gap-3">
                <span
                  className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                    isAllCheckoutDaysSelected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-brand-200 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-black text-slate-950">
                    {text.dayRoute.selectAll}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-500">
                    {text.dayRoute.daySchedule(checkoutRoutePlan.length)} ·{" "}
                    {text.dayRoute.placeCount(checkoutPlaceCount)}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-xs font-black text-brand-700">
                {isAllCheckoutDaysSelected
                  ? text.dayRoute.selected
                  : text.dayRoute.select}
              </span>
            </button>

            <div className="scrollbar-hide mt-3 grid max-h-[40dvh] gap-2 overflow-y-auto pr-1">
              {checkoutDayOptions.map((option) => {
                const isCurrentRouteDay = option.id === selectedDayOptionId;
                const isSelected = selectedCheckoutDayIdSet.has(option.id);
                const daySummary =
                  option.summary ||
                  text.dayRoute.placeCount(option.day.items.length);

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCheckoutDay(option.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                      isSelected
                        ? "border-brand-500 bg-white shadow-[0_10px_26px_rgba(20,184,166,0.16)]"
                        : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50"
                    }`}
                  >
                    <span
                      className={`inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-slate-950">
                        {option.day.date
                          ? formatDateLabel(option.day.date)
                          : `DAY ${option.day.day}`}
                      </span>
                      <span className="mt-0.5 block text-xs font-bold text-slate-500">
                        {daySummary}
                      </span>
                    </span>
                    <span
                      className={`ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                        isSelected
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-slate-200 bg-white text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    {isCurrentRouteDay ? (
                      <span className="sr-only">
                        {text.dayRoute.currentViewingDaySr}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-brand-700">
                  {text.dayRoute.selectedDays(
                    selectedCheckoutRoutePlan.length
                  )}
                </p>
                <p className="mt-0.5 text-xs font-bold text-slate-500">
                  {text.dayRoute.addPlacesSummary(selectedCheckoutPlaceCount)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestCheckout(selectedCheckoutRoutePlan)}
                disabled={selectedCheckoutRoutePlan.length === 0}
                className="inline-flex h-12 min-w-28 shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {text.common.confirm}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>,
    document.body
  );
}

export default PlaceCartRouteMapPopup;
