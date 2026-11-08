
import {
  useCallback,
  useMemo,
  useReducer,
  useRef,
  useState,
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
  type RouteCheckoutAction,
  type RouteStartLocationSource,
} from "../models/routeCheckoutState";
import { RouteCheckoutContext } from "../hooks/useRouteCheckout";

type RouteCheckoutProviderProps = {

  children: ReactNode;
  /** Provider를 처음 만들 때 표시할 일정 만들기 단계 */
  initialStep?: CartFlowStep;
  /** 일정 상태를 처음 만들 때 적용할 여행 시작일. null과 빈 문자열은 미선택 상태로 정규화된다. */
  initialTravelStartDate?: string | null;

  initialTripDays?: number;
  /** 추천 일정 계산에 사용할 최초 출발지. 없으면 출발지 선택 단계에서 정한다. */
  initialStartLocation?: RouteStartLocation | null;
  /** 공유 코스를 가져올 때는 기존 코스의 출발지로 표시한다. */
  initialStartLocationSource?: RouteStartLocationSource;
};

export function RouteCheckoutProvider({
  children,
  initialStep = "cart",
  initialTravelStartDate = "",
  initialTripDays = 1,
  initialStartLocation = null,
  initialStartLocationSource,
}: RouteCheckoutProviderProps) {
  const text = useUiText();
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const isSaveRequestInFlightRef = useRef(false);
  const [state, dispatch] = useReducer(
    routeCheckoutReducer,
    {
      initialStep,
      initialTravelStartDate,
      initialTripDays,
      initialStartLocation,
      initialStartLocationSource,
    },
    createRouteCheckoutState
  );
  const isRouteSaveInFlight = useCallback(
    () => isSaveRequestInFlightRef.current,
    []
  );
  const startSavingRoute = useCallback(() => {
    if (isSaveRequestInFlightRef.current) {
      return false;
    }

    isSaveRequestInFlightRef.current = true;
    setIsSavingRoute(true);
    return true;
  }, []);
  const finishSavingRoute = useCallback(() => {
    isSaveRequestInFlightRef.current = false;
    setIsSavingRoute(false);
  }, []);
  const dispatchWhenEditable = useCallback((action: RouteCheckoutAction) => {
    if (!isSaveRequestInFlightRef.current) {
      dispatch(action);
    }
  }, []);
  const {
    step,
    travelStartDate,
    tripDays,
    dailyStartTime,
    scheduleEndTime,
    tempo,
    startLocationSelection,
  } = state;
  const setStep = useCallback(
    (value: CartFlowStep) => dispatchWhenEditable({ type: "set-step", value }),
    [dispatchWhenEditable]
  );
  const setTravelStartDate = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-travel-start-date", value }),
    [dispatchWhenEditable]
  );
  const setTripDays = useCallback(
    (value: number) => dispatchWhenEditable({ type: "set-trip-days", value }),
    [dispatchWhenEditable]
  );
  const setDailyStartTime = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-daily-start-time", value }),
    [dispatchWhenEditable]
  );
  const setScheduleEndTime = useCallback(
    (value: string) =>
      dispatchWhenEditable({ type: "set-schedule-end-time", value }),
    [dispatchWhenEditable]
  );
  const setTempo = useCallback(
    (value: TravelTempo | null) =>
      dispatchWhenEditable({ type: "set-tempo", value }),
    [dispatchWhenEditable]
  );
  const setStartLocation = useCallback(
    (location: RouteStartLocation, source: RouteStartLocationSource) =>
      dispatchWhenEditable({
        type: "set-start-location",
        value: { location, source },
      }),
    [dispatchWhenEditable]
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
      isSavingRoute,
      isRouteSaveInFlight,
      startSavingRoute,
      finishSavingRoute,
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
      startLocation: startLocationSelection?.location ?? null,
      startLocationSource: startLocationSelection?.source ?? null,
      setStartLocation,
      dailyStartMinutes,
      scheduleEndMinutes,
      isScheduleValid,
      scheduleValidationMessage,
    }),
    [
      dailyStartMinutes,
      dailyStartTime,
      finishSavingRoute,
      isRouteSaveInFlight,
      isSavingRoute,
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
      startSavingRoute,
      startLocationSelection,
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
