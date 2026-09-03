import type { MyRoute, MyRouteDay } from "./types";
import { getUiText, type UiText } from "@/lib/uiText";

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
    return "past";
  }

  if (route.startedAt) {
    return "current";
  }

  return "current";
}

export function getRouteTimelineLabel(
  route: MyRoute,
  todayKey = getTodayDateKey(),
  text: UiText = getUiText("ko")
) {
  const state = getRouteTimelineState(route, todayKey);

  if (state === "current") {
    if (!route.startedAt) {
      return getTodayRouteDay(route, todayKey)
        ? text.myRouteCard.startsToday
        : text.myRouteCard.startRequired;
    }

    return text.myRouteCard.inProgress;
  }

  if (state === "upcoming") {
    const startDateKey = getRouteStartDateKey(route);

    if (!startDateKey) {
      return text.myRouteCard.scheduled;
    }

    const diffDays = getDateKeyDiffInDays(startDateKey, todayKey);

    if (diffDays === 1) {
      return text.myRouteCard.startsTomorrow;
    }

    return diffDays > 1
      ? text.myRouteCard.startsInDays(diffDays)
      : text.myRouteCard.scheduled;
  }

  if (state === "past") {
    return text.myRouteCard.pastRoute;
  }

  if (state === "needsReview") {
    return text.myRouteCard.startReviewRequired;
  }

  return text.dayRoute.dateUnknown;
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

export function getRouteTitle(route: MyRoute, text: UiText = getUiText("ko")) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return text.dayRoute.undatedRouteTitle;
  }

  return text.dayRoute.routeTitle(startDate, endDate);
}

export function getRouteSubtitle(
  route: MyRoute,
  text: UiText = getUiText("ko")
) {
  const durationText =
    route.tripDays <= 1
      ? text.myRouteCard.dayTrip
      : text.myRouteCard.nightTrip(route.tripDays - 1, route.tripDays);

  return `${durationText} · ${text.myRouteCard.placeCount(
    route.totalStopCount
  )}`;
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

export function getDaySummary(
  day: MyRouteDay,
  text: UiText = getUiText("ko")
) {
  const firstPlace = day.stops[0]?.place.title;
  const stopCount = day.stops.length;

  if (!firstPlace || stopCount === 0) {
    return text.myRouteCard.emptyDay;
  }

  return stopCount > 1
    ? `${firstPlace} ${text.myRouteCard.additionalPlaces(stopCount - 1)}`
    : firstPlace;
}

export function getDayDateLabel(
  day: MyRouteDay,
  text: UiText = getUiText("ko")
) {
  const date = formatRouteDate(day.date);
  return date ?? text.dayRoute.dateUnknown;
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

export function getCurrentRouteStop(day: MyRouteDay) {
  return day.stops.find((stop) => !isVisitedStop(stop)) ?? null;
}
