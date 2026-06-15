import { useCallback, useEffect, useMemo, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartTempoStep, { type TravelTempo } from "./cart-steps/PlaceCartTempoStep";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
  RouteInsertRequest,
} from "./cart-steps/routePlanTypes";
import {
  getRoutePlaceCategory,
  type RoutePlaceCategory,
} from "@/lib/placeCategory";
import type { MapSheetPlace, SavedPlaceItem } from "@/stores/mapSheetStore";

type RouteCheckoutModalProps = {
  isOpen: boolean;
  savedPlaces: SavedPlaceItem[];
  insertCandidatePlaces: MapSheetPlace[];
  currentLocation: RouteStartLocation | null;
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
  onRequestSearchPlace: () => void;
};

type CartFlowStep = "cart" | "schedule" | "tempo" | "result";

type RouteStartLocation = {
  lat: number;
  lng: number;
};

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

type ManualRouteInsertion = {
  request: RouteInsertRequest;
  place: MapSheetPlace;
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
const DEFAULT_TRIP_DAYS = 1;
const DEFAULT_DAILY_START_TIME = "09:00";
const DEFAULT_SCHEDULE_END_TIME = "18:00";

function toMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }
  return hour * 60 + minute;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
  const [yearText, monthText, dayText] = dateValue.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
  date.setDate(date.getDate() + days);
  return toDateValue(date);
}

function getRecommendedStayMinutes(place: MapSheetPlace, tempo: TravelTempo) {
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

function estimateTravelMinutes(from: RouteStartLocation, to: RouteStartLocation) {
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
      isWithinTimeWindow(startMinutes, LUNCH_START_MINUTES - 20, LUNCH_END_MINUTES)
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

function recalculateRouteDay(options: {
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

function applyManualRouteInsertions(options: {
  routePlan: PlannedRouteDay[];
  insertions: ManualRouteInsertion[];
  dailyStartMinutes: number;
  dailyEndMinutes: number;
  tempo: TravelTempo;
  stayOverrides: Record<string, number>;
  currentLocation: RouteStartLocation | null;
}) {
  const {
    routePlan,
    insertions,
    dailyStartMinutes,
    dailyEndMinutes,
    tempo,
    stayOverrides,
    currentLocation,
  } = options;

  if (insertions.length === 0) {
    return routePlan;
  }

  return routePlan.map((day) => {
    const dayInsertions = insertions
      .filter((insertion) => insertion.request.day === day.day)
      .sort((a, b) => a.request.insertIndex - b.request.insertIndex);

    if (dayInsertions.length === 0) {
      return day;
    }

    const nextItems = [...day.items];
    dayInsertions.forEach((insertion, offset) => {
      if (nextItems.some((item) => item.place.id === insertion.place.id)) {
        return;
      }

      const recommendedStayMinutes = getRecommendedStayMinutes(
        insertion.place,
        tempo
      );
      const insertIndex = Math.min(
        insertion.request.insertIndex + offset,
        nextItems.length
      );
      nextItems.splice(insertIndex, 0, {
        id: insertion.place.id,
        place: insertion.place,
        stayMinutes:
          stayOverrides[insertion.place.id] ?? recommendedStayMinutes,
        recommendedStayMinutes,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
      });
    });

    return recalculateRouteDay({
      day: {
        ...day,
        items: nextItems,
      },
      dailyStartMinutes,
      dailyEndMinutes,
      tempo,
      stayOverrides,
      currentLocation,
    });
  });
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
  const hasFoodRemaining = remainingPlaces.some((item) => item.category === "food");
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
  const unusedMinutes = Math.max(0, options.dailyEndMinutes - options.currentMinutes);

  return 35 + Math.max(0, 120 - usedMinutes) * 0.7 + unusedMinutes * 0.07;
}

function buildRoutePlan(options: {
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

function RouteCheckoutModal({
  isOpen,
  savedPlaces,
  insertCandidatePlaces,
  currentLocation,
  onClose,
  onSelectPlace,
  onRemovePlace,
  onClearPlaces,
  onRequestSearchPlace,
}: RouteCheckoutModalProps) {
  const [step, setStep] = useState<CartFlowStep>("cart");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [tripDays, setTripDays] = useState(DEFAULT_TRIP_DAYS);
  const [dailyStartTime, setDailyStartTime] = useState(DEFAULT_DAILY_START_TIME);
  const [scheduleEndTime, setScheduleEndTime] = useState(
    DEFAULT_SCHEDULE_END_TIME
  );
  const [tempo, setTempo] = useState<TravelTempo | null>(null);
  const [stayOverrides, setStayOverrides] = useState<Record<string, number>>({});
  const [manualInsertions, setManualInsertions] = useState<
    ManualRouteInsertion[]
  >([]);

  const resetCheckoutState = useCallback(() => {
    setStep("cart");
    setTravelStartDate("");
    setTripDays(DEFAULT_TRIP_DAYS);
    setDailyStartTime(DEFAULT_DAILY_START_TIME);
    setScheduleEndTime(DEFAULT_SCHEDULE_END_TIME);
    setTempo(null);
    setStayOverrides({});
    setManualInsertions([]);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetCheckoutState();
    }
  }, [isOpen, resetCheckoutState]);

  const hasValidStartDate = Boolean(travelStartDate);
  const hasValidTripDays = Number.isFinite(tripDays) && tripDays >= 1;
  const dailyStartMinutes = toMinutes(dailyStartTime);
  const scheduleEndMinutes = toMinutes(scheduleEndTime);
  const hasValidTimes = dailyStartMinutes >= 0 && scheduleEndMinutes >= 0;
  const isSingleDayTimeOrderValid = tripDays > 1 || scheduleEndMinutes > dailyStartMinutes;
  const isScheduleValid = hasValidStartDate && hasValidTripDays && hasValidTimes && isSingleDayTimeOrderValid;

  const scheduleValidationMessage = !hasValidStartDate
    ? "여행 시작일을 선택해 주세요."
    : !hasValidTripDays
      ? "여행 일수를 1일 이상으로 선택해 주세요."
      : !hasValidTimes
        ? "출발/종료 시간을 다시 선택해 주세요."
        : !isSingleDayTimeOrderValid
          ? "당일치기는 일정 종료 시간이 출발 시간보다 늦어야 합니다."
          : "";

  const routePlan = useMemo(() => {
    if (!tempo || !isScheduleValid) {
      return [];
    }

    const baseRoutePlan = buildRoutePlan({
      savedPlaces,
      travelStartDate,
      tripDays,
      dailyStartMinutes,
      dailyEndMinutes: scheduleEndMinutes,
      tempo,
      stayOverrides,
      currentLocation,
    });

    return applyManualRouteInsertions({
      routePlan: baseRoutePlan,
      insertions: manualInsertions,
      dailyStartMinutes,
      dailyEndMinutes: scheduleEndMinutes,
      tempo,
      stayOverrides,
      currentLocation,
    });
  }, [
    currentLocation,
    dailyStartMinutes,
    isScheduleValid,
    manualInsertions,
    savedPlaces,
    scheduleEndMinutes,
    stayOverrides,
    tempo,
    travelStartDate,
    tripDays,
  ]);

  if (!isOpen) {
    return null;
  }

  const stepIndex =
    step === "cart" ? 1 : step === "schedule" ? 2 : step === "tempo" ? 3 : 4;

  const handleBack = () => {
    if (step === "tempo") {
      setStep("schedule");
      return;
    }

    if (step === "result") {
      setStep("tempo");
      return;
    }

    if (step === "schedule") {
      setStep("cart");
      return;
    }

    onClose();
  };

  const handleInsertPlace = (
    request: RouteInsertRequest,
    place: MapSheetPlace
  ) => {
    setManualInsertions((previous) => [
      ...previous.filter((insertion) => insertion.place.id !== place.id),
      {
        request,
        place,
      },
    ]);
  };

  const handleNext = () => {
    if (step === "cart") {
      setStep("schedule");
      return;
    }

    if (step === "schedule") {
      setStep("tempo");
      return;
    }

    if (step === "tempo") {
      setStep("result");
      return;
    }

    onClose();
  };

  const nextDisabled =
    (step === "cart" && savedPlaces.length === 0) ||
    (step === "schedule" && !isScheduleValid) ||
    (step === "tempo" && !tempo);

  const nextButtonLabel =
    step === "tempo" ? "루트 짜기" : step === "result" ? "완료" : "다음";

  return (
    <section className="route-checkout-modal-enter fixed inset-0 z-[1700] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="뒤로가기"
              onClick={handleBack}
              className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
            >
              <IoArrowBack />
            </button>
            <div className="ml-3">
              <p className="font-trip text-sm text-brand-700">ROUTE CHECKOUT</p>
              <p className="text-base font-semibold text-slate-900">{stepIndex} / 4</p>
            </div>
          </div>

          {step === "cart" ? (
            <button
              type="button"
              onClick={onClearPlaces}
              disabled={savedPlaces.length === 0}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              전체 비우기
            </button>
          ) : null}
        </header>

        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div key={step} className="route-checkout-step-enter">
            {step === "cart" ? (
              <PlaceCartItemsStep
                savedPlaces={savedPlaces}
                onSelectPlace={onSelectPlace}
                onRemovePlace={onRemovePlace}
              />
            ) : null}

            {step === "schedule" ? (
              <PlaceCartScheduleStep
                travelStartDate={travelStartDate}
                tripDays={tripDays}
                dailyStartTime={dailyStartTime}
                scheduleEndTime={scheduleEndTime}
                isScheduleValid={isScheduleValid}
                validationMessage={scheduleValidationMessage}
                onChangeTravelStartDate={setTravelStartDate}
                onChangeTripDays={setTripDays}
                onChangeDailyStartTime={setDailyStartTime}
                onChangeScheduleEndTime={setScheduleEndTime}
              />
            ) : null}

            {step === "tempo" ? (
              <PlaceCartTempoStep tempo={tempo} onSelectTempo={setTempo} />
            ) : null}

            {step === "result" && tempo ? (
              <PlaceCartRouteResultStep
                routePlan={routePlan}
                tempo={tempo}
                dailyEndMinutes={scheduleEndMinutes}
                candidatePlaces={insertCandidatePlaces}
                onChangeStayMinutes={(placeId, minutes) => {
                  setStayOverrides((previous) => ({
                    ...previous,
                    [placeId]: minutes,
                  }));
                }}
                onInsertPlace={handleInsertPlace}
                onRequestSearchPlace={onRequestSearchPlace}
              />
            ) : null}
          </div>
        </div>

        <footer className="border-t border-brand-100 px-4 py-4">
          <button
            type="button"
            onClick={handleNext}
            disabled={nextDisabled}
            className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {nextButtonLabel}
          </button>
        </footer>
      </div>
    </section>
  );
}

export default RouteCheckoutModal;
