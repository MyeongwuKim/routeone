/** 일정 만들기 단계와 입력값, 저장 잠금을 하위 단계 컴포넌트에 전달하는 Context 진입점이다. */
import { createContext, useContext } from "react";
import type {
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";
import type { CartFlowStep } from "../models/routeCheckoutFlow";

export type RouteCheckoutContextValue = {
  isSavingRoute: boolean;
  isRouteSaveInFlight: () => boolean;
  startSavingRoute: () => boolean;
  finishSavingRoute: () => void;
  step: CartFlowStep;
  setStep: (step: CartFlowStep) => void;
  travelStartDate: string;
  setTravelStartDate: (value: string) => void;
  tripDays: number;
  setTripDays: (value: number) => void;
  dailyStartTime: string;
  setDailyStartTime: (value: string) => void;
  scheduleEndTime: string;
  setScheduleEndTime: (value: string) => void;
  tempo: TravelTempo | null;
  setTempo: (value: TravelTempo | null) => void;
  startLocation: RouteStartLocation | null;
  setStartLocation: (value: RouteStartLocation | null) => void;
  dailyStartMinutes: number;
  scheduleEndMinutes: number;
  isScheduleValid: boolean;
  scheduleValidationMessage: string;
};

export const RouteCheckoutContext =
  createContext<RouteCheckoutContextValue | null>(null);

/** RouteCheckoutProvider 내부의 일정 편집 상태를 반환하며 Provider 밖에서 호출하면 즉시 예외를 던진다. */
export function useRouteCheckout() {
  const context = useContext(RouteCheckoutContext);
  if (!context) {
    throw new Error("useRouteCheckout must be used within RouteCheckoutProvider");
  }
  return context;
}
