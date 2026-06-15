import type { MapSheetPlace } from "@/stores/mapSheetStore";

export type RouteInsertPoint = {
  title: string;
  subtitle: string;
  lat: number;
  lng: number;
};

export type RouteInsertRequest = {
  day: number;
  insertIndex: number;
  from: RouteInsertPoint;
  to: RouteInsertPoint;
};

export type PlannedRouteItem = {
  id: string;
  place: MapSheetPlace;
  stayMinutes: number;
  recommendedStayMinutes: number;
  startMinutes: number;
  endMinutes: number;
  travelMinutesFromPrevious: number;
  isOverSchedule: boolean;
};

export type PlannedRouteDay = {
  day: number;
  date: string;
  startsFromCurrentLocation: boolean;
  startLocation: {
    lat: number;
    lng: number;
  } | null;
  items: PlannedRouteItem[];
};
