import { routeApi } from "./routeApi";
import type { AppendRouteDaysInput, CreateRouteInput } from "@/generated/graphql";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import {
  getMapSheetPlaceRegionCode,
  getMapSheetPlaceRegionLabelKey,
  mapSheetPlaceToPlaceSnapshotInput,
} from "@/lib/routePlaceSnapshot";
import type { MapSheetPlace } from "@/types/place";

export type RouteCheckoutPlanDay = {
  day: number;
  items: Array<{
    stayMinutes: number;
    travelMinutesFromPrevious?: number | null;
    place: MapSheetPlace;
  }>;
};

type SaveRoutePlanInput = {
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

async function resolveTravelMinutesFromPrevious({
  from,
  to,
  fallbackMinutes,
}: {
  from: RouteTravelPoint | null;
  to: RouteTravelPoint;
  fallbackMinutes?: number | null;
}) {
  if (!hasValidTravelPoint(from) || !hasValidTravelPoint(to)) {
    return fallbackMinutes ?? null;
  }

  try {
    const route = await fetchDrivingRouteFromCurrentLocation({
      startLat: from.lat,
      startLng: from.lng,
      goalLat: to.lat,
      goalLng: to.lng,
    });

    return Math.max(1, Math.round(route.durationMs / 60000));
  } catch {
    return fallbackMinutes ?? null;
  }
}

async function buildCreateRouteInput(
  input: SaveRoutePlanInput
): Promise<CreateRouteInput> {
  const normalizedPlan = normalizeRoutePlanDays(input.routePlan);
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

  const routeInput: CreateRouteInput = {
    countryCode: "KR",
    primaryRegionCode,
    primaryRegionLabelKey,
    tripDays: normalizedPlan.tripDays,
    travelStartDate: input.travelStartDate,
    dailyStartMinutes: input.dailyStartMinutes,
    scheduleEndMinutes: input.scheduleEndMinutes,
    startLocation: input.startLocation ?? null,
    stops: [],
  };

  let order = 1;

  for (const day of normalizedPlan.routePlan) {
    let previousPoint: RouteTravelPoint | null = input.startLocation ?? null;

    for (const item of day.items) {
      const travelMinutesFromPrevious = await resolveTravelMinutesFromPrevious({
        from: previousPoint,
        to: item.place,
        fallbackMinutes: item.travelMinutesFromPrevious,
      });

      routeInput.stops?.push({
        dayIndex: day.day,
        order,
        stayMinutes: item.stayMinutes,
        travelMinutesFromPrevious,
        place: mapSheetPlaceToPlaceSnapshotInput(item.place),
      });

      previousPoint = item.place;
      order += 1;
    }
  }

  return routeInput;
}

async function buildAppendRouteDaysInput(
  routeId: string,
  input: SaveRoutePlanInput
): Promise<AppendRouteDaysInput> {
  const routeInput = await buildCreateRouteInput(input);

  return {
    routeId,
    tripDays: routeInput.tripDays,
    travelStartDate: routeInput.travelStartDate,
    travelEndDate: routeInput.travelEndDate,
    startLocation: routeInput.startLocation,
    stops: routeInput.stops,
  };
}

export const routeCheckoutApi = {
  async saveRoutePlan(input: SaveRoutePlanInput) {
    return routeApi.createRoute(await buildCreateRouteInput(input));
  },
  async appendRouteDays(routeId: string, input: SaveRoutePlanInput) {
    return routeApi.appendRouteDays(
      await buildAppendRouteDaysInput(routeId, input)
    );
  },
};
