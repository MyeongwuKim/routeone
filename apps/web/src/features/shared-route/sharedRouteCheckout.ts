/** 공유 경로의 DAY·장소를 일정 만들기의 초기 경로와 담은 장소 목록으로 복사하며 원본 객체는 변경하지 않는다. */
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
