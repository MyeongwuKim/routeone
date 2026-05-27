import { useEffect, useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartTempoStep, { type TravelTempo } from "./cart-steps/PlaceCartTempoStep";
import type { MapSheetPlace, SavedPlaceItem } from "../../../stores/mapSheetStore";

type RouteCheckoutModalProps = {
  isOpen: boolean;
  savedPlaces: SavedPlaceItem[];
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
};

type CartFlowStep = "cart" | "schedule" | "tempo";

function toMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }
  return hour * 60 + minute;
}

function RouteCheckoutModal({
  isOpen,
  savedPlaces,
  onClose,
  onSelectPlace,
  onRemovePlace,
  onClearPlaces,
}: RouteCheckoutModalProps) {
  const [step, setStep] = useState<CartFlowStep>("cart");
  const [travelStartDate, setTravelStartDate] = useState("");
  const [tripDays, setTripDays] = useState(1);
  const [dailyStartTime, setDailyStartTime] = useState("09:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("18:00");
  const [tempo, setTempo] = useState<TravelTempo | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep("cart");
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

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

  const stepIndex = step === "cart" ? 1 : step === "schedule" ? 2 : 3;

  const handleBack = () => {
    if (step === "tempo") {
      setStep("schedule");
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

    onClose();
  };

  const nextDisabled =
    (step === "cart" && savedPlaces.length === 0) ||
    (step === "schedule" && !isScheduleValid) ||
    (step === "tempo" && !tempo);

  const nextButtonLabel = step === "tempo" ? "루트 확정하기" : "다음";

  return (
    <section className="fixed inset-0 z-[1700] bg-white">
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
              <p className="text-base font-semibold text-slate-900">{stepIndex} / 3</p>
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
