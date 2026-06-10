import { useEffect, useMemo, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartTempoStep, { type TravelTempo } from "./cart-steps/PlaceCartTempoStep";
import type { PlannedRouteDay } from "./cart-steps/routePlanTypes";
import type { MapSheetPlace, SavedPlaceItem } from "../../../stores/mapSheetStore";

type RouteCheckoutModalProps = {
  isOpen: boolean;
  savedPlaces: SavedPlaceItem[];
  currentLocation: RouteStartLocation | null;
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
  onRequestAddPlace: () => void;
};

type CartFlowStep = "cart" | "schedule" | "tempo" | "result";

type RouteStartLocation = {
  lat: number;
  lng: number;
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

function getPlaceRouteCategory(place: MapSheetPlace) {
  if (place.contentTypeLabel === "카페") {
    return "cafe";
  }

  if (place.contentTypeId === "39") {
    return "food";
  }

  return "tourist";
}

function getRecommendedStayMinutes(place: MapSheetPlace, tempo: TravelTempo) {
  const category = getPlaceRouteCategory(place);
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

function orderPlacesByDistance(
  savedPlaces: SavedPlaceItem[],
  currentLocation: RouteStartLocation | null
) {
  const remaining = savedPlaces.map((item) => item.place);
  const ordered: MapSheetPlace[] = [];

  const firstPlaceIndex = currentLocation
    ? remaining.reduce(
        (nearestIndex, place, index) => {
          const nearestPlace = remaining[nearestIndex];
          return calculateDistanceKm(currentLocation, place) <
            calculateDistanceKm(currentLocation, nearestPlace)
            ? index
            : nearestIndex;
        },
        0
      )
    : 0;
  const [firstPlace] = remaining.splice(firstPlaceIndex, 1);

  if (!firstPlace) {
    return ordered;
  }

  ordered.push(firstPlace);

  while (remaining.length > 0) {
    const currentPlace = ordered[ordered.length - 1];
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((place, index) => {
      const distance = calculateDistanceKm(currentPlace, place);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [nearestPlace] = remaining.splice(nearestIndex, 1);
    ordered.push(nearestPlace);
  }

  return ordered;
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
  const orderedPlaces = orderPlacesByDistance(
    options.savedPlaces,
    options.currentLocation
  );
  const days: PlannedRouteDay[] = Array.from(
    { length: Math.max(1, options.tripDays) },
    (_, index) => ({
      day: index + 1,
      date: options.travelStartDate ? addDays(options.travelStartDate, index) : "",
      startsFromCurrentLocation: Boolean(options.currentLocation),
      items: [],
    })
  );
  let currentDayIndex = 0;
  let currentMinutes = options.dailyStartMinutes;
  let previousPlace: MapSheetPlace | null = null;

  orderedPlaces.forEach((place) => {
    const stayMinutes =
      options.stayOverrides[place.id] ??
      getRecommendedStayMinutes(place, options.tempo);
    let travelMinutes = previousPlace
      ? estimateTravelMinutes(previousPlace, place)
      : options.currentLocation
        ? estimateTravelMinutes(options.currentLocation, place)
        : 0;
    let startMinutes = currentMinutes + travelMinutes;
    let endMinutes = startMinutes + stayMinutes;

    if (
      days[currentDayIndex].items.length > 0 &&
      endMinutes > options.dailyEndMinutes &&
      currentDayIndex < days.length - 1
    ) {
      currentDayIndex += 1;
      currentMinutes = options.dailyStartMinutes;
      previousPlace = null;
      travelMinutes = options.currentLocation
        ? estimateTravelMinutes(options.currentLocation, place)
        : 0;
      startMinutes = currentMinutes + travelMinutes;
      endMinutes = startMinutes + stayMinutes;
    }

    days[currentDayIndex].items.push({
      id: place.id,
      place,
      stayMinutes,
      recommendedStayMinutes: getRecommendedStayMinutes(place, options.tempo),
      startMinutes,
      endMinutes,
      travelMinutesFromPrevious: travelMinutes,
      isOverSchedule: endMinutes > options.dailyEndMinutes,
    });

    currentMinutes = endMinutes;
    previousPlace = place;
  });

  return days;
}

function RouteCheckoutModal({
  isOpen,
  savedPlaces,
  currentLocation,
  onClose,
  onSelectPlace,
  onRemovePlace,
  onClearPlaces,
  onRequestAddPlace,
}: RouteCheckoutModalProps) {
  const [step, setStep] = useState<CartFlowStep>("cart");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [tripDays, setTripDays] = useState(1);
  const [dailyStartTime, setDailyStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("18:00");
  const [tempo, setTempo] = useState<TravelTempo | null>(null);
  const [stayOverrides, setStayOverrides] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      setStep("cart");
      setStayOverrides({});
    }
  }, [isOpen]);

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

    return buildRoutePlan({
      savedPlaces,
      travelStartDate,
      tripDays,
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
                onChangeStayMinutes={(placeId, minutes) => {
                  setStayOverrides((previous) => ({
                    ...previous,
                    [placeId]: minutes,
                  }));
                }}
                onRequestAddPlace={onRequestAddPlace}
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
