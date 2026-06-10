import type { MapSheetPlace } from "../../../../stores/mapSheetStore";

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
  items: PlannedRouteItem[];
};
