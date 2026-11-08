import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type { TravelTempo } from "../models/routePlanTypes";
import {
  estimateTravelMinutes,
  getRecommendedStayMinutes,
} from "./routePlanBuilder";

type TripDurationRecommendation = {
  days: 1 | 2 | 3;
  /** 추천 일수 안에 모든 장소를 해당 일일 시간 범위로 배치할 수 있는지 나타낸다. */
  fitsDailyHours: boolean;
};

type RecommendTripDurationOptions = {
  savedPlaces: readonly SavedPlaceItem[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
};

function hasValidCoordinates({ lat, lng }: MapSheetPlace) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    (lat !== 0 || lng !== 0)
  );
}

/**
 * 담은 장소의 예상 체류 시간과 같은 날 장소 간 이동시간을 일일 시간 범위에 맞춰 1~3일로 나눈다.
 * 출발지와 숙박 사이 이동은 계산하지 않는다. 세 날로도 시간이 모자라면 3일과 초과 여부를 함께 반환한다.
 * 장소가 없거나 좌표·시간으로 일정을 추정할 수 없으면 null을 반환한다.
 */
export function recommendTripDuration({
  savedPlaces,
  dailyStartMinutes,
  dailyEndMinutes,
  tempo,
}: RecommendTripDurationOptions): TripDurationRecommendation | null {
  if (
    savedPlaces.length === 0 ||
    !Number.isInteger(dailyStartMinutes) ||
    !Number.isInteger(dailyEndMinutes) ||
    dailyStartMinutes < 0 ||
    dailyEndMinutes > 24 * 60 ||
    dailyStartMinutes >= dailyEndMinutes
  ) {
    return null;
  }

  const dailyMinutes = dailyEndMinutes - dailyStartMinutes;
  const visits = [];
  let totalStayMinutes = 0;
  let longestStayMinutes = 0;

  for (const { place } of savedPlaces) {
    if (!hasValidCoordinates(place)) {
      return null;
    }

    const stayMinutes = getRecommendedStayMinutes(place, tempo);
    visits.push({ place, stayMinutes });
    totalStayMinutes += stayMinutes;
    longestStayMinutes = Math.max(longestStayMinutes, stayMinutes);
  }

  // 체류 시간만으로도 초과하면 큰 목록에서 장소 조합을 탐색할 필요가 없다.
  if (totalStayMinutes > dailyMinutes * 3 || longestStayMinutes > dailyMinutes) {
    return { days: 3, fitsDailyHours: false };
  }

  // 장소를 담은 순서와 무관하게 같은 출발 후보와 우선순위를 사용한다.
  visits.sort(
    (left, right) =>
      left.place.lng - right.place.lng ||
      left.place.lat - right.place.lat ||
      left.place.id.localeCompare(right.place.id)
  );

  const [first, ...remaining] = visits;
  let previousPlace = first.place;
  let dayMinutes = first.stayMinutes;
  let days: TripDurationRecommendation["days"] = 1;

  while (remaining.length > 0) {
    let nextIndex = 0;
    let shortestTravelMinutes = Infinity;
    let nextFits = false;

    // 오늘 안에 들어오는 장소를 우선하고, 같은 조건이면 이동이 가장 짧은 곳을 고른다.
    for (const [index, candidate] of remaining.entries()) {
      const travelMinutes = estimateTravelMinutes(previousPlace, candidate.place);
      if (!Number.isFinite(travelMinutes)) {
        return null;
      }

      const fits = dayMinutes + travelMinutes + candidate.stayMinutes <= dailyMinutes;
      if ((fits && !nextFits) || (fits === nextFits && travelMinutes < shortestTravelMinutes)) {
        nextIndex = index;
        shortestTravelMinutes = travelMinutes;
        nextFits = fits;
      }
    }

    const [next] = remaining.splice(nextIndex, 1);
    if (nextFits) {
      dayMinutes += shortestTravelMinutes + next.stayMinutes;
    } else {
      if (days === 3) {
        return { days, fitsDailyHours: false };
      }
      days = days === 1 ? 2 : 3;
      dayMinutes = next.stayMinutes;
    }
    previousPlace = next.place;
  }

  return { days, fitsDailyHours: true };
}
