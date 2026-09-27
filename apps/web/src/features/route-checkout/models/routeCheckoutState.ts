/**
 * 경로 생성 과정의 선택값을 보관하는 상태와 각 입력·이동·초기화 액션을 정의한다.
 */
import type { CartFlowStep } from "./routeCheckoutFlow";
import type { RouteStartLocation, TravelTempo } from "./routePlanTypes";

const DEFAULT_TRIP_DAYS = 1;
const DEFAULT_DAILY_START_TIME = "09:00";
const DEFAULT_SCHEDULE_END_TIME = "18:00";

export type RouteCheckoutState = {
  step: CartFlowStep;
  travelStartDate: string;
  tripDays: number;
  dailyStartTime: string;
  scheduleEndTime: string;
  tempo: TravelTempo | null;
  startLocation: RouteStartLocation | null;
};

export type RouteCheckoutAction =
  | { type: "set-step"; value: CartFlowStep }
  | { type: "set-travel-start-date"; value: string }
  | { type: "set-trip-days"; value: number }
  | { type: "set-daily-start-time"; value: string }
  | { type: "set-schedule-end-time"; value: string }
  | { type: "set-tempo"; value: TravelTempo | null }
  | { type: "set-start-location"; value: RouteStartLocation | null };

type CreateRouteCheckoutStateOptions = {
  /** 생성할 상태에서 처음 표시할 일정 만들기 단계 */
  initialStep?: CartFlowStep;
  /** 생성할 상태에 적용할 여행 시작일. null은 빈 문자열로 정규화된다. */
  initialTravelStartDate?: string | null;

  initialTripDays?: number;
  /** 생성할 상태에 적용할 추천 일정 출발지 */
  initialStartLocation?: RouteStartLocation | null;
};

export function createRouteCheckoutState({
  initialStep = "cart",
  initialTravelStartDate = "",
  initialTripDays = DEFAULT_TRIP_DAYS,
  initialStartLocation = null,
}: CreateRouteCheckoutStateOptions): RouteCheckoutState {
  return {
    step: initialStep,
    travelStartDate: initialTravelStartDate ?? "",
    tripDays: initialTripDays,
    dailyStartTime: DEFAULT_DAILY_START_TIME,
    scheduleEndTime: DEFAULT_SCHEDULE_END_TIME,
    tempo: null,
    startLocation: initialStartLocation,
  };
}

export function routeCheckoutReducer(
  state: RouteCheckoutState,
  action: RouteCheckoutAction
): RouteCheckoutState {
  switch (action.type) {
    case "set-step":
      return { ...state, step: action.value };
    case "set-travel-start-date":
      return { ...state, travelStartDate: action.value };
    case "set-trip-days":
      return { ...state, tripDays: action.value };
    case "set-daily-start-time":
      return { ...state, dailyStartTime: action.value };
    case "set-schedule-end-time":
      return { ...state, scheduleEndTime: action.value };
    case "set-tempo":
      return { ...state, tempo: action.value };
    case "set-start-location":
      return { ...state, startLocation: action.value };
    default:
      return state;
  }
}
