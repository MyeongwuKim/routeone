export type CartFlowStep =
  | "cart"
  | "schedule"
  | "tempo"
  | "start-location"
  | "result";

const ROUTE_CHECKOUT_STEPS: CartFlowStep[] = [
  "cart",
  "schedule",
  "tempo",
  "start-location",
  "result",
];

export function getVisibleCheckoutSteps(initialStep: CartFlowStep) {
  const initialIndex = ROUTE_CHECKOUT_STEPS.indexOf(initialStep);
  return initialIndex < 0
    ? ROUTE_CHECKOUT_STEPS
    : ROUTE_CHECKOUT_STEPS.slice(initialIndex);
}

export function getNextCheckoutStep(
  step: CartFlowStep,
  visibleSteps: CartFlowStep[]
) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex >= 0 ? (visibleSteps[currentIndex + 1] ?? null) : null;
}

export function getPreviousCheckoutStep(
  step: CartFlowStep,
  visibleSteps: CartFlowStep[]
) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex > 0 ? visibleSteps[currentIndex - 1] : null;
}

export function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateValue() {
  const now = new Date();
  return toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function isTodayStartSchedule(travelStartDate: string) {
  return travelStartDate === getTodayDateValue();
}

export function toTimeMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }

  return hour * 60 + minute;
}

export function getCurrentTimeValue() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export function isPastTodayStartTime(
  travelStartDate: string,
  dailyStartTime: string
) {
  if (!isTodayStartSchedule(travelStartDate)) {
    return false;
  }

  const startMinutes = toTimeMinutes(dailyStartTime);
  const currentMinutes = toTimeMinutes(getCurrentTimeValue());
  return startMinutes >= 0 && currentMinutes >= 0 && startMinutes < currentMinutes;
}

export function getTodayStartScheduleKey(
  travelStartDate: string,
  tripDays: number,
  dailyStartTime: string
) {
  return `${travelStartDate}:${tripDays}:${dailyStartTime}`;
}

export function parseDateValue(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
