import {
  useCallback,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { useUiText } from "@/lib/uiText";
import type {
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";
import {
  getTodayDate,
  parseDateValue,
  toTimeMinutes,
  type CartFlowStep,
} from "../models/routeCheckoutFlow";
import {
  createRouteCheckoutState,
  routeCheckoutReducer,
} from "../models/routeCheckoutState";
import { RouteCheckoutContext } from "../hooks/useRouteCheckout";

type RouteCheckoutProviderProps = {
  children: ReactNode;
  initialStep?: CartFlowStep;
  initialTravelStartDate?: string | null;
  initialTripDays?: number;
  initialStartLocation?: RouteStartLocation | null;
};

export function RouteCheckoutProvider({
  children,
  initialStep = "cart",
  initialTravelStartDate = "",
  initialTripDays = 1,
  initialStartLocation = null,
}: RouteCheckoutProviderProps) {
  const text = useUiText();
  const [state, dispatch] = useReducer(
    routeCheckoutReducer,
    {
      initialStep,
      initialTravelStartDate,
      initialTripDays,
      initialStartLocation,
    },
    createRouteCheckoutState
  );
  const {
    step,
    travelStartDate,
    tripDays,
    dailyStartTime,
    scheduleEndTime,
    tempo,
    startLocation,
  } = state;
  const setStep = useCallback(
    (value: CartFlowStep) => dispatch({ type: "set-step", value }),
    []
  );
  const setTravelStartDate = useCallback(
    (value: string) => dispatch({ type: "set-travel-start-date", value }),
    []
  );
  const setTripDays = useCallback(
    (value: number) => dispatch({ type: "set-trip-days", value }),
    []
  );
  const setDailyStartTime = useCallback(
    (value: string) => dispatch({ type: "set-daily-start-time", value }),
    []
  );
  const setScheduleEndTime = useCallback(
    (value: string) => dispatch({ type: "set-schedule-end-time", value }),
    []
  );
  const setTempo = useCallback(
    (value: TravelTempo | null) => dispatch({ type: "set-tempo", value }),
    []
  );
  const setStartLocation = useCallback(
    (value: RouteStartLocation | null) =>
      dispatch({ type: "set-start-location", value }),
    []
  );

  const startDate = parseDateValue(travelStartDate);
  const hasValidStartDate = Boolean(startDate);
  const isFutureStartDate = startDate ? startDate >= getTodayDate() : false;
  const hasValidTripDays = Number.isFinite(tripDays) && tripDays >= 1;
  const dailyStartMinutes = toTimeMinutes(dailyStartTime);
  const scheduleEndMinutes = toTimeMinutes(scheduleEndTime);
  const hasValidTimes = dailyStartMinutes >= 0 && scheduleEndMinutes >= 0;
  const isDailyTimeOrderValid = scheduleEndMinutes > dailyStartMinutes;
  const isScheduleValid =
    hasValidStartDate &&
    isFutureStartDate &&
    hasValidTripDays &&
    hasValidTimes &&
    isDailyTimeOrderValid;
  const scheduleValidationMessage = !hasValidStartDate
    ? text.cart.validationStartDateRequired
    : !isFutureStartDate
      ? text.cart.validationStartDateFuture
      : !hasValidTripDays
        ? text.cart.validationTripDaysRequired
        : !hasValidTimes
          ? text.cart.validationTimeInvalid
          : !isDailyTimeOrderValid
            ? text.cart.validationTimeOrder
            : "";

  const value = useMemo(
    () => ({
      step,
      setStep,
      travelStartDate,
      setTravelStartDate,
      tripDays,
      setTripDays,
      dailyStartTime,
      setDailyStartTime,
      scheduleEndTime,
      setScheduleEndTime,
      tempo,
      setTempo,
      startLocation,
      setStartLocation,
      dailyStartMinutes,
      scheduleEndMinutes,
      isScheduleValid,
      scheduleValidationMessage,
    }),
    [
      dailyStartMinutes,
      dailyStartTime,
      isScheduleValid,
      scheduleEndMinutes,
      scheduleEndTime,
      scheduleValidationMessage,
      setDailyStartTime,
      setScheduleEndTime,
      setStartLocation,
      setStep,
      setTempo,
      setTravelStartDate,
      setTripDays,
      startLocation,
      step,
      tempo,
      travelStartDate,
      tripDays,
    ]
  );

  return (
    <RouteCheckoutContext.Provider value={value}>
      {children}
    </RouteCheckoutContext.Provider>
  );
}
