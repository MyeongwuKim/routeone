/** 서버 경로의 날짜·상태·DAY·방문 수를 카드와 상세 화면에서 사용하는 정렬값과 표시 문구로 계산한다. */
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

type RouteStopProgress = {
  visitStatus?: MyRouteDay["stops"][number]["visitStatus"];
  visitedAt?: string | null;
};

/** SKIPPED 상태를 우선해 이전 방문 시각이 남아 있어도 방문 집계와 기록에서 제외한다. */
export function isSkippedStop(stop: RouteStopProgress) {
  return stop.visitStatus === "SKIPPED";
}

/** 방문 상태 또는 예전 응답의 방문 시각을 확인하되 명시적으로 건너뛴 장소는 방문으로 세지 않는다. */
export function isVisitedStop(stop: RouteStopProgress) {
  return !isSkippedStop(stop) && (stop.visitStatus === "VISITED" || Boolean(stop.visitedAt));
}

/** 방문과 건너뜀을 모두 일정에서 처리한 장소로 판단한다. 실제 방문 기록 여부와는 구분한다. */
export function isResolvedStop(stop: RouteStopProgress) {
  return isVisitedStop(stop) || isSkippedStop(stop);
}

export function getDayCompletedStopCount(day: MyRouteDay) {
  return day.stops.filter(isVisitedStop).length;
}

/** 해당 DAY에서 방문 없이 건너뛴 장소 수를 반환한다. */
export function getDaySkippedStopCount(day: MyRouteDay) {
  return day.stops.filter(isSkippedStop).length;
}

/** 해당 DAY의 진행률·완료 판정에 사용할 방문 또는 건너뜀 장소 수를 반환한다. */
export function getDayResolvedStopCount(day: MyRouteDay) {
  return day.stops.filter(isResolvedStop).length;
}

/** 상세·공유 목록의 전체 장소에서 건너뛴 수를 계산한다. 예전 요약 응답에 장소가 없으면 0이다. */
export function getRouteSkippedStopCount(route: { stops?: readonly RouteStopProgress[] }) {
  return route.stops?.filter(isSkippedStop).length ?? 0;
}

/** 서버의 실제 방문 수에 건너뜀 수를 합쳐 처리한 장소 수를 계산하고 전체 수를 넘지 않게 한다. */
export function getRouteResolvedStopCount(route: {
  stops?: readonly RouteStopProgress[];
  totalStopCount: number;
  completedStopCount: number;
}) {
  return Math.min(route.totalStopCount, route.completedStopCount + getRouteSkippedStopCount(route));
}

/** 실제 방문율과 구분해 방문·건너뜀을 모두 처리한 일정 진행률(0~100)을 반환한다. */
export function getRouteProgressPercent(route: Parameters<typeof getRouteResolvedStopCount>[0]) {
  return route.totalStopCount > 0
    ? Math.max(0, Math.round(getRouteResolvedStopCount(route) / route.totalStopCount * 100))
    : 0;
}

/** DAY의 방문과 건너뜀을 합친 처리 진행률을 반환하며, 빈 DAY는 0이다. */
export function getDayProgressPercent(day: MyRouteDay) {
  if (day.stops.length === 0) {
    return 0;
  }

  return Math.round((getDayResolvedStopCount(day) / day.stops.length) * 100);
}

export function getCurrentRouteStop(day: MyRouteDay) {
  return day.stops.find((stop) => !isResolvedStop(stop)) ?? null;
}
