/**
 * 경로 생성과 편집에서 사용하는 여행 속도, 출발지, 일차별 장소와 수동 삽입 위치 구조를 정의한다.
 */
import type { MapSheetPlace } from "@/types/place";

export type TravelTempo = "relaxed" | "balanced" | "packed";

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
