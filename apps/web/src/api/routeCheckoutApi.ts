import { routeApi } from "./routeApi";
import type { AppendRouteDaysInput, CreateRouteInput } from "@/generated/graphql";
import {
  getMapSheetPlaceRegionCode,
  getMapSheetPlaceRegionLabelKey,
  mapSheetPlaceToPlaceSnapshotInput,
} from "@/lib/routePlaceSnapshot";
import type { MapSheetPlace } from "@/types/place";

export type RouteCheckoutPlanDay = {
  day: number;
  startLocation?: { lat: number; lng: number } | null;
  items: Array<{
    stayMinutes: number;
    travelMinutesFromPrevious?: number | null;
    place: MapSheetPlace;
  }>;
};

export type SaveRoutePlanInput = {
  routePlan: RouteCheckoutPlanDay[];
  travelStartDate: string;
  tripDays: number;
  dailyStartMinutes: number;
  scheduleEndMinutes: number;
  startLocation?: {
    lat: number;
    lng: number;
  } | null;
};

type RouteTravelPoint = {
  lat: number;
  lng: number;
};

function normalizeRoutePlanDays(routePlan: RouteCheckoutPlanDay[]) {
  const nonEmptyDays = routePlan
    .filter((day) => day.items.length > 0)
    .sort((left, right) => left.day - right.day);

  if (nonEmptyDays.length === 0) {
    return {
      routePlan: [],
      tripDays: 1,
    };
  }

  return {
    routePlan: nonEmptyDays.map((day, index) => ({
      ...day,
      day: index + 1,
    })),
    tripDays: nonEmptyDays.length,
  };
}

export function getEffectiveRoutePlanTripDays(
  routePlan: RouteCheckoutPlanDay[]
) {
  return normalizeRoutePlanDays(routePlan).tripDays;
}

function getMostFrequentValue(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return (
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null
  );
}

function hasValidTravelPoint(
  point: RouteTravelPoint | null | undefined
): point is RouteTravelPoint {
  return Boolean(
    point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
}

function toRouteStartLocation(
  point: RouteTravelPoint | null | undefined
): RouteTravelPoint | null {
  if (!hasValidTravelPoint(point)) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
  };
}

export function buildCreateRouteInput(
  input: SaveRoutePlanInput
): CreateRouteInput {
  const normalizedPlan = normalizeRoutePlanDays(input.routePlan);
  const startLocation = toRouteStartLocation(input.startLocation);
  const routeStops = normalizedPlan.routePlan.flatMap((day) =>
    day.items.map((item) => ({
      day,
      item,
    }))
  );
  const primaryRegionCode = getMostFrequentValue(
    routeStops.map(({ item }) => getMapSheetPlaceRegionCode(item.place))
  );
  const primaryRegionLabelKey = getMostFrequentValue(
    routeStops.map(({ item }) => getMapSheetPlaceRegionLabelKey(item.place))
  );

  return {
    countryCode: "KR",
    primaryRegionCode,
    primaryRegionLabelKey,
    tripDays: normalizedPlan.tripDays,
    travelStartDate: input.travelStartDate,
    dailyStartMinutes: input.dailyStartMinutes,
    scheduleEndMinutes: input.scheduleEndMinutes,
    startLocation,
    dayStartLocations: normalizedPlan.routePlan.flatMap((day) => {
      const dayStartLocation = toRouteStartLocation(
        day.startLocation ?? input.startLocation
      );

      return dayStartLocation
        ? [{ dayIndex: day.day, startLocation: dayStartLocation }]
        : [];
    }),
    stops: routeStops.map(({ day, item }, index) => ({
      dayIndex: day.day,
      order: index + 1,
      stayMinutes: item.stayMinutes,
      travelMinutesFromPrevious: item.travelMinutesFromPrevious ?? null,
      place: mapSheetPlaceToPlaceSnapshotInput(item.place),
    })),
  };
}

function buildAppendRouteDaysInput(
  routeId: string,
  input: SaveRoutePlanInput
): AppendRouteDaysInput {
  const routeInput = buildCreateRouteInput(input);

  return {
    routeId,
    tripDays: routeInput.tripDays,
    travelStartDate: routeInput.travelStartDate,
    travelEndDate: routeInput.travelEndDate,
    startLocation: routeInput.startLocation,
    dayStartLocations: routeInput.dayStartLocations,
    stops: routeInput.stops,
  };
}

export const routeCheckoutApi = {
  async saveRoutePlan(input: SaveRoutePlanInput, clientRequestId: string) {
    const routeInput = buildCreateRouteInput(input);
    routeInput.clientRequestId = clientRequestId;

    return routeApi.createRoute(routeInput);
  },
  async appendRouteDays(routeId: string, input: SaveRoutePlanInput) {
    return routeApi.appendRouteDays(buildAppendRouteDaysInput(routeId, input));
  },
};
