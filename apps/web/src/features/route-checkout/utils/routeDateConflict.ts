import type { MyRoutesQuery } from "@/generated/graphql";

type MyRouteItem = MyRoutesQuery["myRoutes"][number];

export type RouteDateConflict = {
  route: MyRouteItem;
  existingRangeLabel: string;
  requestedRangeLabel: string;
};

function parseLocalDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [yearText, monthText, dayText] = value.slice(0, 10).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function formatDateRange(startDate: Date, endDate: Date) {
  const startLabel = `${startDate.getMonth() + 1}.${startDate.getDate()}`;
  const endLabel = `${endDate.getMonth() + 1}.${endDate.getDate()}`;

  return startLabel === endLabel ? startLabel : `${startLabel}~${endLabel}`;
}

function isDateRangeOverlapping(
  leftStartDate: Date,
  leftEndDate: Date,
  rightStartDate: Date,
  rightEndDate: Date
) {
  return leftStartDate <= rightEndDate && rightStartDate <= leftEndDate;
}

export function findRouteDateConflict({
  routes,
  travelStartDate,
  tripDays,
  excludeRouteId,
}: {
  routes: MyRouteItem[];
  travelStartDate: string;
  tripDays: number;
  excludeRouteId?: string | null;
}): RouteDateConflict | null {
  const requestedStartDate = parseLocalDate(travelStartDate);
  const safeTripDays = Math.max(1, Math.round(tripDays || 1));

  if (!requestedStartDate) {
    return null;
  }

  const requestedEndDate = addDays(requestedStartDate, safeTripDays - 1);
  const requestedRangeLabel = formatDateRange(
    requestedStartDate,
    requestedEndDate
  );

  for (const route of routes) {
    if (excludeRouteId && route.id === excludeRouteId) {
      continue;
    }

    if (route.status === "COMPLETED") {
      continue;
    }

    const existingStartDate = parseLocalDate(route.travelStartDate);
    const existingEndDate =
      parseLocalDate(route.travelEndDate) ??
      (existingStartDate ? addDays(existingStartDate, route.tripDays - 1) : null);

    if (!existingStartDate || !existingEndDate) {
      continue;
    }

    if (
      isDateRangeOverlapping(
        requestedStartDate,
        requestedEndDate,
        existingStartDate,
        existingEndDate
      )
    ) {
      return {
        route,
        existingRangeLabel: formatDateRange(existingStartDate, existingEndDate),
        requestedRangeLabel,
      };
    }
  }

  return null;
}
