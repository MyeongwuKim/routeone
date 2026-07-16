import {
  getRoutePlaceCategory,
  type RoutePlaceCategory,
} from "@/lib/placeCategory";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import type { MapSheetPlace } from "@/types/place";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteStartLocation,
  TravelTempo,
} from "../models/routePlanTypes";

type RoutePlannerPlace = {
  place: MapSheetPlace;
  category: RoutePlaceCategory;
  stayMinutes: number;
  recommendedStayMinutes: number;
};

type RoutePlannerState = {
  days: PlannedRouteDay[];
  dayIndex: number;
  currentMinutes: number;
  previousPlace: MapSheetPlace | null;
  remainingPlaces: RoutePlannerPlace[];
  score: number;
};

const TEMPO_STAY_MINUTES: Record<TravelTempo, Record<string, number>> = {
  relaxed: {
    tourist: 120,
    food: 90,
    cafe: 70,
  },
  balanced: {
    tourist: 90,
    food: 70,
    cafe: 50,
  },
  packed: {
    tourist: 60,
    food: 50,
    cafe: 35,
  },
};

const ROUTE_BEAM_WIDTH = 80;
const LUNCH_START_MINUTES = 11 * 60 + 30;
const LUNCH_END_MINUTES = 13 * 60 + 20;
const DINNER_START_MINUTES = 17 * 60 + 30;
const DINNER_END_MINUTES = 19 * 60 + 10;

function addDays(dateValue: string, days: number) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getRecommendedStayMinutes(
  place: MapSheetPlace,
  tempo: TravelTempo
) {
  const category = getRoutePlaceCategory(place);
  return TEMPO_STAY_MINUTES[tempo][category];
}

function calculateDistanceKm(from: RouteStartLocation, to: RouteStartLocation) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function estimateTravelMinutes(
  from: RouteStartLocation,
  to: RouteStartLocation
) {
  const distanceKm = calculateDistanceKm(from, to);
  return Math.max(8, Math.round((distanceKm / 35) * 60));
}

function isWithinTimeWindow(
  value: number,
  startMinutes: number,
  endMinutes: number
) {
  return value >= startMinutes && value <= endMinutes;
}

function getTimeWindowDistance(
  value: number,
  startMinutes: number,
  endMinutes: number
) {
  if (isWithinTimeWindow(value, startMinutes, endMinutes)) {
    return 0;
  }

  return Math.min(
    Math.abs(value - startMinutes),
    Math.abs(value - endMinutes)
  );
}

function getTempoTravelWeight(tempo: TravelTempo) {
  if (tempo === "relaxed") {
    return 1.45;
  }

  if (tempo === "packed") {
    return 2.35;
  }

  return 1.8;
}

function getCafeWindow(tempo: TravelTempo) {
  if (tempo === "relaxed") {
    return {
      start: 13 * 60,
      end: 17 * 60 + 20,
    };
  }

  if (tempo === "packed") {
    return {
      start: 14 * 60 + 30,
      end: 16 * 60 + 30,
    };
  }

  return {
    start: 14 * 60,
    end: 17 * 60,
  };
}

function getCategoryTimeScore(options: {
  category: RoutePlaceCategory;
  startMinutes: number;
  tempo: TravelTempo;
  hasFoodRemaining: boolean;
  previousCategory: RoutePlaceCategory | null;
}) {
  const { category, startMinutes, tempo, hasFoodRemaining, previousCategory } =
    options;

  if (category === "food") {
    const lunchDistance = getTimeWindowDistance(
      startMinutes,
      LUNCH_START_MINUTES,
      LUNCH_END_MINUTES
    );
    const dinnerDistance = getTimeWindowDistance(
      startMinutes,
      DINNER_START_MINUTES,
      DINNER_END_MINUTES
    );
    const isMealTime = lunchDistance === 0 || dinnerDistance === 0;
    let score = Math.min(lunchDistance, dinnerDistance) * 0.8;

    if (isMealTime) {
      score -= 110;
    }

    if (startMinutes < 10 * 60 + 40) {
      score += 70;
    }

    if (previousCategory === "tourist" && isMealTime) {
      score -= 20;
    }

    return score;
  }

  if (category === "cafe") {
    const cafeWindow = getCafeWindow(tempo);
    const cafeDistance = getTimeWindowDistance(
      startMinutes,
      cafeWindow.start,
      cafeWindow.end
    );
    let score = cafeDistance * (tempo === "relaxed" ? 0.25 : 0.45);

    if (cafeDistance === 0) {
      score -= tempo === "relaxed" ? 70 : 40;
    }

    if (
      hasFoodRemaining &&
      isWithinTimeWindow(
        startMinutes,
        LUNCH_START_MINUTES - 20,
        LUNCH_END_MINUTES
      )
    ) {
      score += 90;
    }

    if (previousCategory === "food" && startMinutes >= LUNCH_END_MINUTES - 20) {
      score -= 30;
    }

    if (previousCategory === "tourist" && cafeDistance === 0) {
      score -= tempo === "relaxed" ? 35 : 20;
    }

    return score;
  }

  let score = 0;

  if (
    hasFoodRemaining &&
    isWithinTimeWindow(startMinutes, LUNCH_START_MINUTES - 10, LUNCH_END_MINUTES)
  ) {
    score += 130;
  }

  if (startMinutes >= 16 * 60 + 30) {
    score += 25;
  }

  if (previousCategory === "cafe" && startMinutes >= 14 * 60) {
    score += 20;
  }

  return score;
}

function createEmptyRouteDays(options: {
  travelStartDate: string;
  tripDays: number;
  startLocation: RouteStartLocation | null;
}) {
  return Array.from(
    { length: Math.max(1, options.tripDays) },
    (_, index) => ({
      day: index + 1,
      date: options.travelStartDate ? addDays(options.travelStartDate, index) : "",
      startsFromCurrentLocation: Boolean(options.startLocation),
      startLocation: options.startLocation,
      items: [],
    })
  );
}

function addRouteItemToDays(
  days: PlannedRouteDay[],
  dayIndex: number,
  item: PlannedRouteItem
) {
  return days.map((day, index) =>
    index === dayIndex
      ? {
          ...day,
          items: [...day.items, item],
        }
      : day
  );
}

function appendPlaceToRouteState(options: {
  state: RoutePlannerState;
  candidate: RoutePlannerPlace;
  dayIndex: number;
  dayBreakPenalty: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  currentLocation: RouteStartLocation | null;
}) {
  const {
    state,
    candidate,
    dayIndex,
    dayBreakPenalty,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    currentLocation,
  } = options;
  const isNewDay = dayIndex !== state.dayIndex;
  const previousPlace = isNewDay ? null : state.previousPlace;
  const baseMinutes = isNewDay ? dailyStartMinutes : state.currentMinutes;
  const travelStart = previousPlace ?? currentLocation;
  const travelMinutes = travelStart
    ? estimateTravelMinutes(travelStart, candidate.place)
    : 0;
  const startMinutes = baseMinutes + travelMinutes;
  const endMinutes = startMinutes + candidate.stayMinutes;
  const overMinutes = Math.max(0, endMinutes - dailyEndMinutes);
  const previousCategory = previousPlace
    ? getRoutePlaceCategory(previousPlace)
    : null;
  const remainingPlaces = state.remainingPlaces.filter(
    (item) => item.place.id !== candidate.place.id
  );
  const hasFoodRemaining = remainingPlaces.some(
    (item) => item.category === "food"
  );
  const routeItem: PlannedRouteItem = {
    id: candidate.place.id,
    place: candidate.place,
    stayMinutes: candidate.stayMinutes,
    recommendedStayMinutes: candidate.recommendedStayMinutes,
    startMinutes,
    endMinutes,
    travelMinutesFromPrevious: travelMinutes,
    isOverSchedule: overMinutes > 0,
  };
  const score =
    state.score +
    dayBreakPenalty +
    travelMinutes * getTempoTravelWeight(tempo) +
    getCategoryTimeScore({
      category: candidate.category,
      startMinutes,
      tempo,
      hasFoodRemaining,
      previousCategory,
    }) +
    overMinutes * 22 +
    (overMinutes > 0 ? 900 : 0);

  return {
    days: addRouteItemToDays(state.days, dayIndex, routeItem),
    dayIndex,
    currentMinutes: endMinutes,
    previousPlace: candidate.place,
    remainingPlaces,
    score,
  } satisfies RoutePlannerState;
}

function getDayBreakPenalty(options: {
  currentMinutes: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
}) {
  const usedMinutes = options.currentMinutes - options.dailyStartMinutes;
  const unusedMinutes = Math.max(
    0,
    options.dailyEndMinutes - options.currentMinutes
  );

  return 35 + Math.max(0, 120 - usedMinutes) * 0.7 + unusedMinutes * 0.07;
}

export function buildRoutePlan(options: {
  savedPlaces: SavedPlaceItem[];
  travelStartDate: string;
  tripDays: number;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  stayOverrides: Record<string, number>;
  currentLocation: RouteStartLocation | null;
}): PlannedRouteDay[] {
  const routePlaces: RoutePlannerPlace[] = options.savedPlaces.map((item) => {
    const recommendedStayMinutes = getRecommendedStayMinutes(
      item.place,
      options.tempo
    );

    return {
      place: item.place,
      category: getRoutePlaceCategory(item.place),
      stayMinutes: options.stayOverrides[item.place.id] ?? recommendedStayMinutes,
      recommendedStayMinutes,
    };
  });
  const emptyDays = createEmptyRouteDays({
    travelStartDate: options.travelStartDate,
    tripDays: options.tripDays,
    startLocation: options.currentLocation,
  });

  if (routePlaces.length === 0) {
    return emptyDays;
  }

  let beam: RoutePlannerState[] = [
    {
      days: emptyDays,
      dayIndex: 0,
      currentMinutes: options.dailyStartMinutes,
      previousPlace: null,
      remainingPlaces: routePlaces,
      score: 0,
    },
  ];

  for (let index = 0; index < routePlaces.length; index += 1) {
    const nextBeam: RoutePlannerState[] = [];

    beam.forEach((state) => {
      if (state.remainingPlaces.length === 0) {
        nextBeam.push(state);
        return;
      }

      state.remainingPlaces.forEach((candidate) => {
        const currentDayState = appendPlaceToRouteState({
          state,
          candidate,
          dayIndex: state.dayIndex,
          dayBreakPenalty: 0,
          dailyStartMinutes: options.dailyStartMinutes,
          dailyEndMinutes: options.dailyEndMinutes,
          tempo: options.tempo,
          currentLocation: options.currentLocation,
        });
        const canMoveToNextDay =
          state.dayIndex < emptyDays.length - 1 &&
          state.days[state.dayIndex].items.length > 0;
        const hasFoodRemaining = state.remainingPlaces.some(
          (item) => item.category === "food"
        );
        const hasCafeRemaining = state.remainingPlaces.some(
          (item) => item.category === "cafe"
        );
        const cafeWindow = getCafeWindow(options.tempo);
        const shouldTryNextDay =
          currentDayState.currentMinutes > options.dailyEndMinutes ||
          state.currentMinutes >= options.dailyEndMinutes - 120 ||
          (hasFoodRemaining && state.currentMinutes > LUNCH_END_MINUTES) ||
          (hasCafeRemaining && state.currentMinutes > cafeWindow.end);

        nextBeam.push(currentDayState);

        if (canMoveToNextDay && shouldTryNextDay) {
          nextBeam.push(
            appendPlaceToRouteState({
              state,
              candidate,
              dayIndex: state.dayIndex + 1,
              dayBreakPenalty: getDayBreakPenalty({
                currentMinutes: state.currentMinutes,
                dailyStartMinutes: options.dailyStartMinutes,
                dailyEndMinutes: options.dailyEndMinutes,
              }),
              dailyStartMinutes: options.dailyStartMinutes,
              dailyEndMinutes: options.dailyEndMinutes,
              tempo: options.tempo,
              currentLocation: options.currentLocation,
            })
          );
        }
      });
    });

    beam = nextBeam
      .sort((a, b) => a.score - b.score)
      .slice(0, ROUTE_BEAM_WIDTH);
  }

  return beam.sort((a, b) => a.score - b.score)[0]?.days ?? emptyDays;
}

export function recalculateRouteDay(options: {
  day: PlannedRouteDay;
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  stayOverrides: Record<string, number>;
  currentLocation: RouteStartLocation | null;
}) {
  const {
    day,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    stayOverrides,
    currentLocation,
  } = options;
  let currentMinutes = dailyStartMinutes;
  let previousPlace: MapSheetPlace | null = null;
  const startLocation = day.startLocation ?? currentLocation;

  return {
    ...day,
    items: day.items.map((item) => {
      const travelStart = previousPlace ?? startLocation;
      const travelMinutes = travelStart
        ? estimateTravelMinutes(travelStart, item.place)
        : 0;
      const recommendedStayMinutes = getRecommendedStayMinutes(item.place, tempo);
      const stayMinutes =
        stayOverrides[item.place.id] ?? item.stayMinutes ?? recommendedStayMinutes;
      const startMinutes = currentMinutes + travelMinutes;
      const endMinutes = startMinutes + stayMinutes;
      const nextItem: PlannedRouteItem = {
        ...item,
        stayMinutes,
        recommendedStayMinutes,
        startMinutes,
        endMinutes,
        travelMinutesFromPrevious: travelMinutes,
        isOverSchedule: endMinutes > dailyEndMinutes,
      };

      currentMinutes = endMinutes;
      previousPlace = item.place;
      return nextItem;
    }),
  };
}

export function recalculateRoutePlanDays(options: {
  routePlan: PlannedRouteDay[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  stayOverrides: Record<string, number>;
  currentLocation: RouteStartLocation | null;
}) {
  return options.routePlan.map((day) =>
    recalculateRouteDay({
      day,
      dailyStartMinutes: options.dailyStartMinutes,
      dailyEndMinutes: options.dailyEndMinutes,
      tempo: options.tempo,
      stayOverrides: options.stayOverrides,
      currentLocation: options.currentLocation,
    })
  );
}
