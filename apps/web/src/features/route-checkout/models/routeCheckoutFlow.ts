
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

/** initialStep 이전 단계를 제외한 일정 만들기 진행 순서를 반환하며, 알 수 없는 값이면 전체 단계를 반환한다. */
export function getVisibleCheckoutSteps(initialStep: CartFlowStep) {
  const initialIndex = ROUTE_CHECKOUT_STEPS.indexOf(initialStep);
  return initialIndex < 0
    ? ROUTE_CHECKOUT_STEPS
    : ROUTE_CHECKOUT_STEPS.slice(initialIndex);
}

/** visibleSteps에서 현재 단계 다음 값을 반환하며 마지막이거나 포함되지 않으면 null이다. */
export function getNextCheckoutStep(
  step: CartFlowStep,
  visibleSteps: CartFlowStep[]
) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex >= 0 ? (visibleSteps[currentIndex + 1] ?? null) : null;
}

/** visibleSteps에서 현재 단계 이전 값을 반환하며 첫 단계이거나 포함되지 않으면 null이다. */
export function getPreviousCheckoutStep(
  step: CartFlowStep,
  visibleSteps: CartFlowStep[]
) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex > 0 ? visibleSteps[currentIndex - 1] : null;
}

/** 로컬 Date의 연·월·일을 시간대 변환 없이 YYYY-MM-DD 문자열로 만든다. */
export function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 현재 로컬 날짜의 자정을 YYYY-MM-DD 문자열로 반환한다. */
export function getTodayDateValue() {
  const now = new Date();
  return toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

/** travelStartDate가 현재 로컬 날짜와 같은지 확인한다. */
export function isTodayStartSchedule(travelStartDate: string) {
  return travelStartDate === getTodayDateValue();
}

/** HH:mm 문자열을 자정 이후 분으로 변환하며 숫자로 해석할 수 없으면 -1을 반환한다. */
export function toTimeMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }

  return hour * 60 + minute;
}

/** 현재 로컬 시각을 HH:mm 문자열로 반환한다. */
export function getCurrentTimeValue() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** 여행 시작일이 오늘이고 dailyStartTime이 현재 로컬 시각보다 이전인지 확인한다. */
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

/** 오늘 시작 확인을 같은 일정 조건에서 반복 노출하지 않도록 날짜·일수·시각을 결합한 키를 만든다. */
export function getTodayStartScheduleKey(
  travelStartDate: string,
  tripDays: number,
  dailyStartTime: string
) {
  return `${travelStartDate}:${tripDays}:${dailyStartTime}`;
}

/** YYYY-MM-DD 문자열을 로컬 Date로 변환하며 연·월·일을 숫자로 해석할 수 없으면 null을 반환한다. */
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

/** 시간 값을 제거한 현재 로컬 날짜의 Date를 반환한다. */
export function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
