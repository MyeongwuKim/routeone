import { UserFacingError } from "../../graphql/userFacingError.js";
import type {
  CreateRouteStopInput,
  RouteDayStartLocationInput,
  RouteStartLocationInput,
} from "./route.types.js";

export function normalizeRouteStartLocation(
  startLocation?: RouteStartLocationInput | null
) {
  if (!startLocation) {
    return null;
  }

  if (
    !Number.isFinite(startLocation.lat) ||
    !Number.isFinite(startLocation.lng) ||
    startLocation.lat < -90 ||
    startLocation.lat > 90 ||
    startLocation.lng < -180 ||
    startLocation.lng > 180
  ) {
    throw new UserFacingError("출발 위치 좌표가 올바르지 않습니다.");
  }

  return { lat: startLocation.lat, lng: startLocation.lng };
}

export function normalizeRouteDayInputs(
  tripDays: number,
  stops: CreateRouteStopInput[],
  dayStartLocations?: RouteDayStartLocationInput[] | null
) {
  const requestedTripDays = Math.max(1, Math.min(30, Math.round(tripDays || 1)));
  const normalizedStops = stops.map((stop) => {
    const dayIndex = Number.isFinite(stop.dayIndex)
      ? Math.round(stop.dayIndex ?? 1)
      : 1;

    return {
      ...stop,
      dayIndex: Math.max(1, Math.min(requestedTripDays, dayIndex)),
    };
  });
  const startLocationByOriginalDay = new Map<number, RouteStartLocationInput>();

  for (const input of dayStartLocations ?? []) {
    if (
      !Number.isInteger(input.dayIndex) ||
      input.dayIndex < 1 ||
      input.dayIndex > requestedTripDays
    ) {
      throw new UserFacingError("출발 위치의 DAY가 올바르지 않습니다.");
    }

    if (startLocationByOriginalDay.has(input.dayIndex)) {
      throw new UserFacingError("같은 DAY의 출발 위치가 중복되어 있습니다.");
    }

    const startLocation = normalizeRouteStartLocation(input.startLocation);
    if (!startLocation) {
      throw new UserFacingError("DAY의 스타트 지점을 선택해 주세요.");
    }
    startLocationByOriginalDay.set(input.dayIndex, startLocation);
  }

  const usedDayIndexes = normalizedStops.length
    ? [...new Set(normalizedStops.map((stop) => stop.dayIndex))].sort(
        (left, right) => left - right
      )
    : [1];
  const compactDayIndexByOriginal = new Map(
    usedDayIndexes.map((dayIndex, index) => [dayIndex, index + 1] as const)
  );

  return {
    tripDays: usedDayIndexes.length,
    stops: normalizedStops.map((stop) => ({
      ...stop,
      dayIndex: compactDayIndexByOriginal.get(stop.dayIndex) ?? 1,
    })),
    dayStartLocations: usedDayIndexes.flatMap((originalDayIndex, index) => {
      const startLocation = startLocationByOriginalDay.get(originalDayIndex);
      return startLocation ? [{ dayIndex: index + 1, startLocation }] : [];
    }),
  };
}
