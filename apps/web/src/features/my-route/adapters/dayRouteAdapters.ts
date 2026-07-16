import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
} from "@/lib/placeCategory";
import type { MapSheetPlace } from "@/types/place";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

function normalizeRouteDayDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function getRegionCodes(regionLabelKey: string | null, regionCode: string | null) {
  const [areaCode, signguCode] = regionLabelKey?.split(":") ?? [];

  return {
    areaCode: areaCode ?? "",
    signguCode: signguCode ?? regionCode ?? "",
  };
}

function createMapSheetPlace(stop: MyRouteStop): MapSheetPlace {
  const contentTypeId = stop.place.contentTypeId ?? "";
  const contentTypeLabel = getPlaceCategoryLabel({
    title: stop.place.title,
    contentTypeId,
    contentTypeLabel: stop.place.categoryLabel ?? undefined,
    categoryName: stop.place.categoryName ?? undefined,
  });
  const regionCodes = getRegionCodes(
    stop.place.regionLabelKey,
    stop.place.regionCode
  );

  return {
    id: stop.place.externalId ?? stop.place.contentId ?? stop.id,
    contentId: stop.place.contentId ?? stop.place.externalId ?? stop.id,
    contentTypeId,
    ...regionCodes,
    touristTrendName: stop.place.title,
    topRank: null,
    title: stop.place.title,
    address: stop.place.address ?? "",
    lat: stop.place.lat,
    lng: stop.place.lng,
    contentTypeLabel,
    categoryName: stop.place.categoryName ?? contentTypeLabel,
    icon: getPlaceCategoryIcon(contentTypeLabel),
    images: stop.place.imageUrl ? [stop.place.imageUrl] : [],
  };
}

export function createMapSheetPlaceFromRouteStop(stop: MyRouteStop) {
  return createMapSheetPlace(stop);
}

export function createPlannedRouteDay(
  day: MyRouteDay,
  stops: MyRouteStop[],
  startLocation: MyRoute["startLocation"] = null
): PlannedRouteDay {
  return {
    day: day.dayIndex,
    date: normalizeRouteDayDate(day.date),
    startsFromCurrentLocation: Boolean(startLocation),
    startLocation: startLocation
      ? {
          lat: startLocation.lat,
          lng: startLocation.lng,
        }
      : null,
    items: stops.map((stop) => {
      const stayMinutes = stop.stayMinutes ?? 60;

      return {
        id: stop.id,
        stayMinutes,
        recommendedStayMinutes: stayMinutes,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
        place: createMapSheetPlace(stop),
      };
    }),
  };
}
