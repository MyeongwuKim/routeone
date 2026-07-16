import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "@/features/route-checkout/models/routePlanTypes";
import type { SavedPlaceItem } from "@/stores/placeCartStore";

export function createSavedPlacesFromRoutePlan(routePlan: PlannedRouteDay[]) {
  const seenPlaceIds = new Set<string>();
  const savedPlaces: SavedPlaceItem[] = [];

  routePlan.forEach((day) => {
    day.items.forEach((item) => {
      if (seenPlaceIds.has(item.place.id)) {
        return;
      }

      seenPlaceIds.add(item.place.id);
      savedPlaces.push({
        id: item.place.id,
        place: item.place,
        thumbnailUrl: item.place.images[0] ?? "",
        savedAt: Date.now() - savedPlaces.length,
      });
    });
  });

  return savedPlaces;
}

export function getRoutePlanStartLocation(
  routePlan: PlannedRouteDay[]
): RouteStartLocation | null {
  return routePlan.find((day) => day.startLocation)?.startLocation ?? null;
}

export function getRoutePlanTripDays(routePlan: PlannedRouteDay[]) {
  return Math.max(1, routePlan.length);
}
