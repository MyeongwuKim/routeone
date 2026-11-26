import type { Route, RouteDay } from "@prisma/client";
import { UserFacingError } from "../../graphql/userFacingError.js";
import { normalizeRouteStartLocation } from "./routeDayInput.js";
import type { RouteStartLocationInput } from "./route.types.js";

export type ShareRouteStartLocationInput = {
  dayId?: string | null;
  startLocation?: RouteStartLocationInput | null;
};

/** 모든 DAY의 공개 좌표가 확정되어야 한다. DAY가 없는 이전 루트는 루트 단위 출발지 하나를 받는다. */
export function createSharedStartLocations(
  days: Pick<RouteDay, "id">[],
  confirmedLocations: ShareRouteStartLocationInput[]
): NonNullable<Route["sharedStartLocations"]> {
  const locationsByDay = new Map(
    confirmedLocations.map(({ dayId, startLocation }) => [
      dayId ?? null,
      normalizeRouteStartLocation(startLocation),
    ])
  );
  const expectedDayIds = days.length ? days.map(({ id }) => id) : [null];
  if (
    confirmedLocations.length !== expectedDayIds.length ||
    expectedDayIds.some((id) => !locationsByDay.has(id))
  ) {
    throw new UserFacingError("공개할 출발지를 다시 확인해 주세요.");
  }

  const sharedDays = days.map(({ id }) => ({
    dayId: id,
    startLocation: locationsByDay.get(id) ?? null,
  }));
  return {
    // 좌표가 없는 DAY에서 루트 단위 좌표를 대신 표시하지 않도록 한다.
    startLocation: sharedDays.length
      ? (sharedDays.every((day) => day.startLocation) ? sharedDays[0]!.startLocation : null)
      : (locationsByDay.get(null) ?? null),
    days: sharedDays,
  };
}

/** 저장 당시 공개 출발지를 사용하고, 확인 절차 도입 전에 공유한 루트는 기존 출발지를 유지한다. */
export function getSharedRouteStartLocation(
  route: Pick<Route, "sharedStartLocations" | "startLocation">
) {
  return route.sharedStartLocations ? route.sharedStartLocations.startLocation : route.startLocation;
}

/** 공개 좌표가 없는 DAY에 개인 출발지를 대신 사용하지 않는다. */
export function getSharedDayStartLocation(
  route: Pick<Route, "sharedStartLocations">,
  day: Pick<RouteDay, "id" | "startLocation">
) {
  if (!route.sharedStartLocations) return day.startLocation;
  return route.sharedStartLocations.days.find(({ dayId }) => dayId === day.id)?.startLocation ?? null;
}
