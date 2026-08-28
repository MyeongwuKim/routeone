import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

export type DayRouteStartLocations = Record<
  string,
  NonNullable<MyRoute["startLocation"]>
>;

export type DayRouteStartLocationTarget = {
  routeId: string;
  dayId: string;
  dayIndex: number;
  mode: "saved" | "draft";
  initialLocation: NonNullable<MyRoute["startLocation"]>;
};

export function getDayRouteStartLocation(
  day: Pick<MyRouteDay, "startLocation">,
  routeStartLocation: MyRoute["startLocation"]
) {
  return day.startLocation ?? routeStartLocation ?? null;
}

export function createDayRouteStartLocationTarget({
  route,
  day,
  stops,
  isOrderEditing,
  fallbackLocation,
}: {
  route: Pick<MyRoute, "id" | "startLocation">;
  day: Pick<MyRouteDay, "id" | "dayIndex" | "startLocation">;
  stops: MyRouteStop[];
  isOrderEditing: boolean;
  fallbackLocation: NonNullable<MyRoute["startLocation"]>;
}): DayRouteStartLocationTarget {
  const location =
    getDayRouteStartLocation(day, route.startLocation) ??
    stops[0]?.place ??
    fallbackLocation;

  return {
    routeId: route.id,
    dayId: day.id,
    dayIndex: day.dayIndex,
    mode: isOrderEditing ? "draft" : "saved",
    initialLocation: { lat: location.lat, lng: location.lng },
  };
}

export function updateDayRouteStartLocationDraft(
  current: DayRouteStartLocations,
  day: MyRouteDay,
  routeStartLocation: MyRoute["startLocation"],
  nextLocation: NonNullable<MyRoute["startLocation"]>
): DayRouteStartLocations {
  const savedLocation = getDayRouteStartLocation(day, routeStartLocation);
  const nextDraft = { ...current };

  if (
    savedLocation?.lat === nextLocation.lat &&
    savedLocation.lng === nextLocation.lng
  ) {
    delete nextDraft[day.id];
  } else {
    nextDraft[day.id] = nextLocation;
  }

  return nextDraft;
}
