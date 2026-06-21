import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TravelTempo } from "./cart-steps/PlaceCartTempoStep";
import type { RouteStartLocation } from "./cart-steps/routePlanTypes";

export type CartFlowStep =
  | "cart"
  | "schedule"
  | "tempo"
  | "start-location"
  | "result";

type RouteCheckoutContextValue = {
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

const DEFAULT_TRIP_DAYS = 1;
const DEFAULT_DAILY_START_TIME = "09:00";
const DEFAULT_SCHEDULE_END_TIME = "18:00";

const RouteCheckoutContext = createContext<RouteCheckoutContextValue | null>(
  null
);

type RouteCheckoutProviderProps = {
  children: ReactNode;
  initialTravelStartDate?: string | null;
  initialTripDays?: number;
  initialStartLocation?: RouteStartLocation | null;
};

function toMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }
  return hour * 60 + minute;
}

function parseDateValue(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function RouteCheckoutProvider({
  children,
  initialTravelStartDate = "",
  initialTripDays = DEFAULT_TRIP_DAYS,
  initialStartLocation = null,
}: RouteCheckoutProviderProps) {
  const [step, setStep] = useState<CartFlowStep>("cart");
  const [travelStartDate, setTravelStartDate] = useState(
    initialTravelStartDate ?? ""
  );
  const [tripDays, setTripDays] = useState(initialTripDays);
  const [dailyStartTime, setDailyStartTime] = useState(DEFAULT_DAILY_START_TIME);
  const [scheduleEndTime, setScheduleEndTime] = useState(
    DEFAULT_SCHEDULE_END_TIME
  );
  const [tempo, setTempo] = useState<TravelTempo | null>(null);
  const [startLocation, setStartLocation] =
    useState<RouteStartLocation | null>(initialStartLocation);

  const startDate = parseDateValue(travelStartDate);
  const hasValidStartDate = Boolean(startDate);
  const isFutureStartDate = startDate ? startDate >= getTodayDate() : false;
  const hasValidTripDays = Number.isFinite(tripDays) && tripDays >= 1;
  const dailyStartMinutes = toMinutes(dailyStartTime);
  const scheduleEndMinutes = toMinutes(scheduleEndTime);
  const hasValidTimes = dailyStartMinutes >= 0 && scheduleEndMinutes >= 0;
  const isDailyTimeOrderValid = scheduleEndMinutes > dailyStartMinutes;
  const isScheduleValid =
    hasValidStartDate &&
    isFutureStartDate &&
    hasValidTripDays &&
    hasValidTimes &&
    isDailyTimeOrderValid;
  const scheduleValidationMessage = !hasValidStartDate
    ? "여행 시작일을 선택해야 해요."
    : !isFutureStartDate
      ? "여행 시작일은 오늘 이후로 선택해야 해요."
    : !hasValidTripDays
      ? "여행 일수는 1일 이상이어야 해요."
      : !hasValidTimes
        ? "출발/종료 시간을 다시 확인해요."
        : !isDailyTimeOrderValid
          ? "하루 일정의 종료 시간은 출발 시간보다 늦어야 해요."
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

export function useRouteCheckout() {
  const context = useContext(RouteCheckoutContext);
  if (!context) {
    throw new Error("useRouteCheckout must be used within RouteCheckoutProvider");
  }
  return context;
}
