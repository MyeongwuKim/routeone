import type { MyRouteStop } from "../types";

export function isSameStopOrder(left: MyRouteStop[], rightIds: string[]) {
  return (
    left.length === rightIds.length &&
    left.every((stop, index) => stop.id === rightIds[index])
  );
}

export function restoreStopOrder(stops: MyRouteStop[], stopIds: string[]) {
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const orderedStops = stopIds
    .map((stopId) => stopById.get(stopId))
    .filter((stop): stop is MyRouteStop => Boolean(stop));

  return orderedStops.length === stops.length ? orderedStops : stops;
}
