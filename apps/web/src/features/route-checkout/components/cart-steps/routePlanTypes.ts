import type { MapSheetPlace } from "@/types/place";

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

export type RouteStartLocation = {
  lat: number;
  lng: number;
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
  startLocation: RouteStartLocation | null;
  items: PlannedRouteItem[];
};

export type ManualRouteInsertion = {
  request: RouteInsertRequest;
  place: MapSheetPlace;
};
