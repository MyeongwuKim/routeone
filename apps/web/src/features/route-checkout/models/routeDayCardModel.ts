import { createElement, type ReactNode } from "react";
import { IoLocationSharp } from "react-icons/io5";
import { MIN_PLACE_STAY_SUMMARY_VISIT_COUNT } from "@/lib/routePlaceSnapshot";
import { localizePlaceCategoryLabel, type UiText } from "@/lib/uiText";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteInsertPoint,
} from "./routePlanTypes";

export type PlaceStaySummaryPreview = {
  averageActualStayMinutes: number | null;
  visitCount: number;
};

export type DraggedDayItem = {
  itemIndex: number;
  item: PlannedRouteItem;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isActive: boolean;
};

export type AdjacentMoveDirection = "previous" | "next";

export type DragStartPayload = {
  itemIndex: number;
  item: PlannedRouteItem;
  clientX: number;
  clientY: number;
  button: number;
  captureTarget: HTMLElement;
  pointerId?: number;
};

export type RouteDragState = {
  draggedItem: DraggedDayItem | null;
  activeDropIndex: number | null;
  activeMoveDirection: AdjacentMoveDirection | null;
};

type RouteDragAction =
  | { type: "reset" }
  | { type: "start"; draggedItem: DraggedDayItem }
  | {
      type: "move";
      draggedItem: DraggedDayItem;
      activeDropIndex: number | null;
      activeMoveDirection: AdjacentMoveDirection | null;
    };

export const INITIAL_ROUTE_DRAG_STATE: RouteDragState = {
  draggedItem: null,
  activeDropIndex: null,
  activeMoveDirection: null,
};

export function routeDragReducer(
  state: RouteDragState,
  action: RouteDragAction
): RouteDragState {
  switch (action.type) {
    case "reset":
      return INITIAL_ROUTE_DRAG_STATE;
    case "start":
      return {
        draggedItem: action.draggedItem,
        activeDropIndex: null,
        activeMoveDirection: null,
      };
    case "move":
      return {
        draggedItem: action.draggedItem,
        activeDropIndex: action.activeDropIndex,
        activeMoveDirection: action.activeMoveDirection,
      };
    default:
      return state;
  }
}

export type LongPressPointer = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  button: number;
  captureTarget: HTMLElement;
  pointerId?: number;
};

export type RouteStation =
  | {
      id: "current-location";
      type: "start";
      icon: ReactNode;
      title: string;
      subtitle: string;
      location: RouteInsertPoint | null;
      incomingTravelMinutes: null;
      item: null;
    }
  | {
      id: string;
      type: "place";
      icon: string;
      title: string;
      subtitle: string;
      location: RouteInsertPoint;
      itemIndex: number;
      incomingTravelMinutes: number;
      item: PlannedRouteItem;
    };

export const ROUTE_STATIONS_PER_ROW = 3;
export const ROUTE_COLUMNS = [18, 50, 82] as const;
export const ROUTE_TURN_LEFT_X = 6;
export const ROUTE_TURN_RIGHT_X = 96;
export const ROUTE_ROW_HEIGHT = 142;
export const ROUTE_ROW_GAP = 18;
export const ROUTE_LINE_Y = 20;
export const ROUTE_NODE_EDGE_OFFSET_X = 6;

export type RouteRowEntry = {
  station: RouteStation;
  sequenceIndex: number;
};

export function formatRouteClock(totalMinutes: number) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatRouteDayDate(value: string) {
  if (!value) {
    return "";
  }

  const [year, month, day] = value.split("-");
  return `${year}.${month}.${day}`;
}

export function getRouteDurationText(minutes: number, text: UiText) {
  if (minutes < 60) {
    return text.dayRoute.minutes(minutes);
  }

  const hour = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0
    ? text.dayRoute.hoursMinutes(hour, restMinutes)
    : text.dayRoute.hours(hour);
}

export function getAverageStaySummaryLabel(
  summary: PlaceStaySummaryPreview | undefined,
  text: UiText
) {
  if (
    !summary ||
    !summary.averageActualStayMinutes ||
    summary.visitCount < MIN_PLACE_STAY_SUMMARY_VISIT_COUNT
  ) {
    return null;
  }

  return text.cart.averageStaySummary(
    summary.visitCount,
    getRouteDurationText(summary.averageActualStayMinutes, text)
  );
}

export function clampStayMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 30;
  }

  return Math.max(15, Math.min(360, Math.round(value)));
}

export function moveDayItem(
  items: PlannedRouteItem[],
  sourceIndex: number,
  targetIndex: number
) {
  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  if (!movedItem) {
    return items;
  }

  const adjustedTargetIndex =
    sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  nextItems.splice(
    Math.max(0, Math.min(adjustedTargetIndex, nextItems.length)),
    0,
    movedItem
  );
  return nextItems;
}

export function buildRouteStations(
  day: PlannedRouteDay,
  text: UiText
): RouteStation[] {
  const stations: RouteStation[] = day.startsFromCurrentLocation
    ? [
        {
          id: "current-location",
          type: "start",
          icon: createElement(IoLocationSharp),
          title: text.cart.startLocationLabel,
          subtitle: text.dayRoute.start,
          location: day.startLocation
            ? {
                title: text.cart.startLocationLabel,
                subtitle: text.dayRoute.start,
                lat: day.startLocation.lat,
                lng: day.startLocation.lng,
              }
            : null,
          incomingTravelMinutes: null,
          item: null,
        },
      ]
    : [];

  day.items.forEach((item, itemIndex) => {
    const categoryLabel = localizePlaceCategoryLabel(
      item.place.contentTypeLabel,
      text
    );
    stations.push({
      id: item.id,
      type: "place",
      icon: item.place.icon,
      title: item.place.title,
      subtitle: categoryLabel,
      location: {
        title: item.place.title,
        subtitle: categoryLabel,
        lat: item.place.lat,
        lng: item.place.lng,
      },
      itemIndex,
      incomingTravelMinutes: item.travelMinutesFromPrevious,
      item,
    });
  });

  return stations;
}

export function splitRouteRows(stations: RouteStation[]) {
  const rows: RouteRowEntry[][] = [];
  stations.forEach((station, sequenceIndex) => {
    const rowIndex = Math.floor(sequenceIndex / ROUTE_STATIONS_PER_ROW);
    rows[rowIndex] = rows[rowIndex] ?? [];
    rows[rowIndex].push({ station, sequenceIndex });
  });
  return rows;
}

export function getRoutePointX(sequenceIndex: number) {
  const rowIndex = Math.floor(sequenceIndex / ROUTE_STATIONS_PER_ROW);
  const indexInRow = sequenceIndex % ROUTE_STATIONS_PER_ROW;
  const visualColumnIndex =
    rowIndex % 2 === 0
      ? indexInRow
      : ROUTE_STATIONS_PER_ROW - 1 - indexInRow;
  return ROUTE_COLUMNS[visualColumnIndex];
}
