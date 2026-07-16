import { createContext, useContext } from "react";
import type {
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";
import type { CartFlowStep } from "../models/routeCheckoutFlow";

export type RouteCheckoutContextValue = {
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

export function useRouteCheckout() {
  const context = useContext(RouteCheckoutContext);
  if (!context) {
    throw new Error("useRouteCheckout must be used within RouteCheckoutProvider");
  }
  return context;
}
