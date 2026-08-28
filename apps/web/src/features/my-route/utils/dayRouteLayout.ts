import type { UpdateRouteLayoutInput } from "@/generated/graphql";
import type { RouteStopsByDayId } from "../hooks/useRouteStopDrag";
import type { MyRouteDay, MyRouteStop } from "../types";
import type { DayRouteStartLocations } from "./dayRouteStartLocation";

export function createRouteStopsByDayId(
  days: MyRouteDay[],
  activeDayId?: string,
  activeStops?: MyRouteStop[]
) {
  return Object.fromEntries(
    days.map((routeDay) => [
      routeDay.id,
      routeDay.id === activeDayId && activeStops
        ? activeStops
        : routeDay.stops,
    ])
  ) as RouteStopsByDayId;
}

export function createRouteLayoutSignature(
  days: MyRouteDay[],
  stopsByDayId: RouteStopsByDayId,
  deletedDayIds: Set<string>,
  startLocationsByDayId: DayRouteStartLocations = {}
) {
  return days
    .filter((routeDay) => !deletedDayIds.has(routeDay.id))
    .map((routeDay) => {
      const startLocation = startLocationsByDayId[routeDay.id];

      return [
        routeDay.id,
        ...(startLocation
          ? [`start:${startLocation.lat},${startLocation.lng}`]
          : []),
        ...(stopsByDayId[routeDay.id] ?? []).map(
          (stop) => `${stop.id}:${stop.stayMinutes ?? 60}`
        ),
      ].join("|");
    })
    .join("::");
}

export function createRouteLayoutInput({
  routeId,
  days,
  stopsByDayId,
  deletedDayIds,
  startLocationsByDayId,
}: {
  routeId: string;
  days: MyRouteDay[];
  stopsByDayId: RouteStopsByDayId;
  deletedDayIds: Set<string>;
  startLocationsByDayId: DayRouteStartLocations;
}): UpdateRouteLayoutInput {
  return {
    routeId,
    days: days
      .filter((routeDay) => !deletedDayIds.has(routeDay.id))
      .map((routeDay) => ({
        dayId: routeDay.id,
        ...(startLocationsByDayId[routeDay.id]
          ? { startLocation: startLocationsByDayId[routeDay.id] }
          : {}),
        stops: (stopsByDayId[routeDay.id] ?? []).map((stop) => ({
          stopId: stop.id,
          stayMinutes: stop.stayMinutes ?? 60,
        })),
      })),
    deletedDayIds: [...deletedDayIds],
  };
}
