/** DAY 장소 순서 비교·복원과 방문 상태 정렬을 입력 배열을 변경하지 않고 수행한다. */
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
