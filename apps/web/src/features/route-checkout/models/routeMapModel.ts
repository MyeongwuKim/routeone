import {
  PLACE_BUBBLE_MARKER_SIZE,
  type PlaceBubbleMarkerVariant,
} from "@/components/map/NaverMapMarkerIcon";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import { localizePlaceCategoryLabel, type UiText } from "@/lib/uiText";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteStartLocation,
} from "./routePlanTypes";

export type RouteMapPoint = {
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

export type RoutePathPoint = {
  lat: number;
  lng: number;
};

export type RouteMapSegment = {
  id: string;
  from: RouteMapPoint;
  to: RouteMapPoint;
  path: RoutePathPoint[];
  durationMs?: number;
  distanceM?: number;
};

export type RouteMapDayOption = {
  id: string;
  label: string;
  summary: string;
  day: PlannedRouteDay;
  completedItemIds?: string[];
  comparisonDay?: PlannedRouteDay | null;
};

export type RouteDisplayVariant = "current" | "comparison";
export type RouteMapViewMode = "all" | "comparison" | "current";
export type StartPreviewMode = "original" | "changed";
export type RouteSegmentSelection = {
  variant: RouteDisplayVariant;
  segmentId: string;
};

export type RouteMapViewState = {
  selectedDayOptionId: string | null;
  selectedSegment: RouteSegmentSelection | null;
  routeViewMode: RouteMapViewMode;
};

export type RouteMapViewAction =
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

export function createInitialRouteMapViewState({
  initialDayOptionId,
  dayOptions,
}: RouteMapViewInitializer): RouteMapViewState {
  return {
    selectedDayOptionId: initialDayOptionId ?? dayOptions[0]?.id ?? null,
    selectedSegment: null,
    routeViewMode: "all",
  };
}

export function routeMapViewReducer(
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
const DEFAULT_START_PREVIEW_OFFSET = {
  lat: -0.012,
  lng: -0.012,
};

export const EMPTY_COMPLETED_ITEM_IDS: string[] = [];
export const EMPTY_DAY_OPTIONS: RouteMapDayOption[] = [];

function escapeMarkerHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function formatRouteMapDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

export function formatRouteDuration(value: number, text: UiText) {
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

export function formatRouteDistance(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}km`;
  }

  return `${Math.max(1, Math.round(value))}m`;
}

export function getRouteDayKey(day: PlannedRouteDay) {
  return `${day.day}:${day.date}:${day.items.map((item) => item.id).join(",")}`;
}

export function getInitialStartPreviewLocation(
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

export function createStartPreviewDay({
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

export function readRouteMapLatLng(
  value: unknown
): RouteStartLocation | null {
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

  return lat == null || lng == null ? null : { lat, lng };
}

export function buildRouteMapPoints(
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

export function getRouteSegmentDisplayColor({
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
    return variant === "comparison"
      ? ROUTE_ORIGINAL_COLOR
      : ROUTE_CURRENT_COLOR;
  }

  return ROUTE_SEGMENT_COLORS[index % ROUTE_SEGMENT_COLORS.length];
}

export function buildFallbackRouteSegments(
  points: RouteMapPoint[]
): RouteMapSegment[] {
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

export async function fetchRouteMapSegments(
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

export function createRoutePointBubbleMarkerIconHtml({
  point,
  variant,
  showVariantBadge,
  focusColor,
  text,
}: {
  point: RouteMapPoint;
  variant: RouteDisplayVariant;
  showVariantBadge: boolean;
  focusColor?: string;
  text: UiText;
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
  const badgeLabel = isComparison
    ? text.cart.routeOriginal
    : text.cart.routeCurrent;

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
              position:absolute; top:2px; right:10px; z-index:3;
              border-radius:9999px; background:#0f766e; color:#ffffff;
              padding:3px 8px; font-size:9px; font-weight:900; line-height:1;
              box-shadow:0 8px 18px rgba(15,118,110,0.22);
            ">START</span>`
          : ""
      }
      <div style="
        position:absolute; top:0; left:0; z-index:2; width:100%; height:52px;
        border:2px solid ${borderColor}; border-radius:14px; background:#ffffff;
        color:#0f172a; display:flex; align-items:center; gap:9px;
        padding:7px 11px 7px 9px; box-sizing:border-box;
        box-shadow:0 8px 18px ${shadowColor};
      ">
        ${
          showVariantBadge
            ? `<span style="
                position:absolute; top:-9px; right:10px; border-radius:9999px;
                background:${toneDarkColor}; color:#ffffff; padding:2px 6px;
                font-size:9px; font-weight:900; line-height:1;
              ">${badgeLabel}</span>`
            : ""
        }
        <span style="
          width:30px; height:30px; border-radius:9999px;
          background:${labelBackground}; color:${labelText}; display:flex;
          align-items:center; justify-content:center; flex:0 0 30px;
          font-size:14px; font-weight:800; line-height:1;
        ">${escapeMarkerHtml(point.sequenceLabel)}</span>
        <span style="min-width:0; flex:1 1 auto; display:flex; flex-direction:column; gap:2px;">
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px; font-weight:800; line-height:1.15;">${escapeMarkerHtml(point.title)}</span>
          <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#64748b; font-size:11px; font-weight:700; line-height:1.1;">${escapeMarkerHtml(point.subtitle)}</span>
        </span>
      </div>
      <div style="
        position:absolute; left:50%; top:42px; z-index:1; width:24px; height:24px;
        transform:translateX(-50%); border-radius:9999px; border:3px solid #ffffff;
        background:${isStart ? "#14b8a6" : borderColor};
        box-shadow:0 12px 24px ${shadowColor}, 0 4px 10px rgba(15,23,42,0.18);
        display:flex; align-items:center; justify-content:center;
      "><span style="width:7px; height:7px; border-radius:9999px; background:#ffffff;"></span></div>
      <div style="
        position:absolute; left:50%; top:59px; z-index:0; width:0; height:0;
        transform:translateX(-50%); border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:7px solid ${isStart ? "#0f766e" : borderColor};
        filter:drop-shadow(0 6px 6px ${shadowColor});
      "></div>
    </div>
  `;
}

export function getRouteSegmentKey(
  variant: RouteDisplayVariant,
  segmentId: string
) {
  return `${variant}:${segmentId}`;
}
