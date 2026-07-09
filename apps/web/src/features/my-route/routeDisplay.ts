import type { MyRoute, MyRouteDay } from "./types";

export type RouteDayState = "past" | "today" | "upcoming" | "undated";
export type RouteTimelineState =
  | "current"
  | "upcoming"
  | "past"
  | "needsReview"
  | "undated";

export const ROUTE_STATUS_LABEL: Record<MyRoute["status"], string> = {
  ACTIVE: "여행 중",
  COMPLETED: "완료",
  DRAFT: "임시",
};

export function getTodayDateKey(now = new Date()) {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getRouteDateKey(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

export function getRouteStartDateKey(route: MyRoute) {
  return getRouteDateKey(route.travelStartDate);
}

export function getRouteEndDateKey(route: MyRoute) {
  return getRouteDateKey(route.travelEndDate) ?? getRouteStartDateKey(route);
}

function getDateKeyTime(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

export function getDateKeyDiffInDays(leftDateKey: string, rightDateKey: string) {
  const dayMs = 24 * 60 * 60 * 1000;

  return Math.round(
    (getDateKeyTime(leftDateKey) - getDateKeyTime(rightDateKey)) / dayMs
  );
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(getDateKeyTime(dateKey));
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getNextRouteDayDateKey(route: MyRoute) {
  const endDateKey = getRouteEndDateKey(route);
  return endDateKey ? addDaysToDateKey(endDateKey, 1) : null;
}

export function isDateKeyInRouteRange(route: MyRoute, dateKey: string) {
  const startDateKey = getRouteStartDateKey(route);
  const endDateKey = getRouteEndDateKey(route);

  if (!startDateKey || !endDateKey) {
    return false;
  }

  return startDateKey <= dateKey && dateKey <= endDateKey;
}

export function getRouteTimelineState(
  route: MyRoute,
  todayKey = getTodayDateKey()
): RouteTimelineState {
  const startDateKey = getRouteStartDateKey(route);
  const endDateKey = getRouteEndDateKey(route);

  if (route.status === "COMPLETED") {
    return "past";
  }

  if (!startDateKey || !endDateKey) {
    return "undated";
  }

  if (todayKey < startDateKey) {
    return "upcoming";
  }

  if (todayKey > endDateKey) {
    return route.startedAt ? "past" : "needsReview";
  }

  if (route.startedAt) {
    return "current";
  }

  return "current";
}

export function getRouteTimelineLabel(
  route: MyRoute,
  todayKey = getTodayDateKey()
) {
  const state = getRouteTimelineState(route, todayKey);

  if (state === "current") {
    if (!route.startedAt) {
      return getTodayRouteDay(route, todayKey) ? "오늘 시작" : "시작 필요";
    }

    return getTodayRouteDay(route, todayKey) ? "오늘 여행 중" : "여행 중";
  }

  if (state === "upcoming") {
    const startDateKey = getRouteStartDateKey(route);

    if (!startDateKey) {
      return "예정";
    }

    const diffDays = getDateKeyDiffInDays(startDateKey, todayKey);

    if (diffDays === 1) {
      return "내일 시작";
    }

    return diffDays > 1 ? `${diffDays}일 후 시작` : "예정";
  }

  if (state === "past") {
    return "지난 루트";
  }

  if (state === "needsReview") {
    return "시작 확인 필요";
  }

  return "날짜 미정";
}

export function formatRouteDate(value: string | null) {
  const dateKey = getRouteDateKey(value);

  if (!dateKey) {
    return null;
  }

  const [, month, day] = dateKey.split("-");

  if (!month || !day) {
    return null;
  }

  return `${Number(month)}.${Number(day)}`;
}

export function getRouteTitle(route: MyRoute) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return "날짜 미정 일정";
  }

  if (!endDate || startDate === endDate) {
    return `${startDate} 일정`;
  }

  return `${startDate} ~ ${endDate} 일정`;
}

export function getRouteSubtitle(route: MyRoute) {
  const durationText =
    route.tripDays <= 1
      ? "당일치기"
      : `${route.tripDays - 1}박 ${route.tripDays}일`;

  return `${durationText} · ${route.totalStopCount}곳`;
}

export function getVisibleDays(route: MyRoute) {
  return getSortedRouteDays(route).slice(0, 4);
}

export function getSortedRouteDays(route: MyRoute) {
  return [...route.days].sort((left, right) => left.dayIndex - right.dayIndex);
}

export function getRouteDayState(
  day: MyRouteDay,
  todayKey = getTodayDateKey()
): RouteDayState {
  const dateKey = getRouteDateKey(day.date);

  if (!dateKey) {
    return "undated";
  }

  if (dateKey === todayKey) {
    return "today";
  }

  return dateKey < todayKey ? "past" : "upcoming";
}

export function getTodayRouteDay(
  route: MyRoute,
  todayKey = getTodayDateKey()
) {
  return getSortedRouteDays(route).find(
    (day) => getRouteDayState(day, todayKey) === "today"
  );
}

export function getSelectableRouteDay(
  route: MyRoute,
  todayKey = getTodayDateKey()
) {
  const sortedDays = getSortedRouteDays(route);

  return (
    getTodayRouteDay(route, todayKey) ??
    sortedDays.find((day) => getRouteDayState(day, todayKey) === "upcoming") ??
    sortedDays.at(-1) ??
    null
  );
}

export function getDaySummary(day: MyRouteDay) {
  const firstPlace = day.stops[0]?.place.title;
  const stopCount = day.stops.length;

  if (!firstPlace || stopCount === 0) {
    return "비어 있음";
  }

  return stopCount > 1 ? `${firstPlace} 외 ${stopCount - 1}곳` : firstPlace;
}

export function getDayDateLabel(day: MyRouteDay) {
  const date = formatRouteDate(day.date);
  return date ? `${date}` : "날짜 미정";
}

export function isVisitedStop(stop: MyRouteDay["stops"][number]) {
  return stop.visitStatus === "VISITED" || Boolean(stop.visitedAt);
}

export function getDayCompletedStopCount(day: MyRouteDay) {
  return day.stops.filter(isVisitedStop).length;
}

export function getDayProgressPercent(day: MyRouteDay) {
  if (day.stops.length === 0) {
    return 0;
  }

  return Math.round((getDayCompletedStopCount(day) / day.stops.length) * 100);
}

export function getNextRouteStop(day: MyRouteDay) {
  return day.stops.find((stop) => !isVisitedStop(stop)) ?? null;
}
