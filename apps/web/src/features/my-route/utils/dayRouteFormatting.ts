import type { UiText } from "@/lib/uiText";
import { formatRouteDate } from "../routeDisplay";
import type { MyRoute, MyRouteDay } from "../types";
import type { TravelSegmentState } from "../hooks/useDayRouteTravelSegments";

export function formatClock(totalMinutes: number, text: UiText) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const dayOffset = Math.floor(normalizedMinutes / (24 * 60));
  const minutesInDay = normalizedMinutes % (24 * 60);
  const hour = Math.floor(minutesInDay / 60);
  const minute = minutesInDay % 60;
  const clockText = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  if (dayOffset === 0) {
    return clockText;
  }

  return dayOffset === 1
    ? text.dayRoute.nextDayClock(clockText)
    : text.dayRoute.dayOffsetClock(dayOffset, clockText);
}

export function formatStayMinutes(value: number | null, text: UiText) {
  if (!value || value <= 0) {
    return text.dayRoute.noTime;
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  if (hour > 0 && minute > 0) {
    return text.dayRoute.hoursMinutes(hour, minute);
  }

  return hour > 0 ? text.dayRoute.hours(hour) : text.dayRoute.minutes(minute);
}

export function formatTravelMinutes(value: number, text: UiText) {
  if (value < 60) {
    return text.dayRoute.minutes(value);
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return minute > 0
    ? text.dayRoute.hoursMinutes(hour, minute)
    : text.dayRoute.hours(hour);
}

export function clampStayMinutes(value: number) {
  return Math.max(10, Math.min(480, Math.round(value / 10) * 10));
}

export function getTravelSegmentLabel(
  segment: TravelSegmentState | null,
  text: UiText
) {
  if (!segment || segment.status === "loading") {
    return text.dayRoute.travelLoading;
  }

  if (segment.status === "error") {
    return text.dayRoute.travelError;
  }

  const duration = formatTravelMinutes(segment.minutes, text);

  return segment.status === "success"
    ? text.dayRoute.travelByCar(duration)
    : text.dayRoute.travelEstimatedByCar(duration);
}

export function getLocalizedRouteTitle(route: MyRoute, text: UiText) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return text.dayRoute.undatedRouteTitle;
  }

  return text.dayRoute.routeTitle(startDate, endDate);
}

export function getLocalizedDayDateLabel(day: MyRouteDay, text: UiText) {
  return formatRouteDate(day.date) ?? text.dayRoute.dateUnknown;
}

export function getLocalizedDaySummary(day: MyRouteDay, text: UiText) {
  const firstPlace = day.stops[0]?.place.title;
  const stopCount = day.stops.length;

  if (!firstPlace || stopCount === 0) {
    return text.dayRoute.daySummaryEmpty;
  }

  return stopCount > 1
    ? text.dayRoute.daySummaryMore(firstPlace, stopCount - 1)
    : firstPlace;
}
