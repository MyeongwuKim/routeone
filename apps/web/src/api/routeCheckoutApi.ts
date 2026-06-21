import { routeApi } from "./routeApi";
import type {
  AppendRouteDaysInput,
  CreateRouteInput,
  PlaceProvider,
} from "@/generated/graphql";
import type { MapSheetPlace } from "@/types/place";

type RouteCheckoutPlanDay = {
  day: number;
  items: Array<{
    stayMinutes: number;
    place: MapSheetPlace;
  }>;
};

type SaveRoutePlanInput = {
  routePlan: RouteCheckoutPlanDay[];
  travelStartDate: string;
  tripDays: number;
};

const ROUTE_PLACE_PROVIDER: PlaceProvider = "TOUR_API";

function getPlaceRegionCode(place: MapSheetPlace) {
  return place.signguCode || place.areaCode || null;
}

function getPlaceRegionLabelKey(place: MapSheetPlace) {
  if (place.areaCode && place.signguCode) {
    return `${place.areaCode}:${place.signguCode}`;
  }

  return place.areaCode || place.signguCode || null;
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

function buildCreateRouteInput(input: SaveRoutePlanInput): CreateRouteInput {
  const routeStops = input.routePlan.flatMap((day) =>
    day.items.map((item) => ({
      day,
      item,
    }))
  );
  const primaryRegionCode = getMostFrequentValue(
    routeStops.map(({ item }) => getPlaceRegionCode(item.place))
  );
  const primaryRegionLabelKey = getMostFrequentValue(
    routeStops.map(({ item }) => getPlaceRegionLabelKey(item.place))
  );

  return {
    countryCode: "KR",
    primaryRegionCode,
    primaryRegionLabelKey,
    tripDays: input.tripDays,
    travelStartDate: input.travelStartDate,
    stops: routeStops.map(({ day, item }, index) => ({
      dayIndex: day.day,
      order: index + 1,
      stayMinutes: item.stayMinutes,
      place: {
        provider: ROUTE_PLACE_PROVIDER,
        externalId: item.place.id,
        contentId: item.place.contentId,
        contentTypeId: item.place.contentTypeId,
        title: item.place.title,
        address: item.place.address,
        lat: item.place.lat,
        lng: item.place.lng,
        categoryLabel: item.place.contentTypeLabel,
        categoryName: item.place.categoryName,
        imageUrl: item.place.images[0] ?? null,
        regionCode: getPlaceRegionCode(item.place),
        regionLabelKey: getPlaceRegionLabelKey(item.place),
      },
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
    stops: routeInput.stops,
  };
}

export const routeCheckoutApi = {
  saveRoutePlan(input: SaveRoutePlanInput) {
    return routeApi.createRoute(buildCreateRouteInput(input));
  },
  appendRouteDays(routeId: string, input: SaveRoutePlanInput) {
    return routeApi.appendRouteDays(buildAppendRouteDaysInput(routeId, input));
  },
};
