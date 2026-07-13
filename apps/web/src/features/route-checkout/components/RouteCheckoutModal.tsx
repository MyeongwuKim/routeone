import { useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import {
  RouteCheckoutProvider,
  useRouteCheckout,
  type CartFlowStep,
} from "./RouteCheckoutContext";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartStartLocationStep from "./cart-steps/PlaceCartStartLocationStep";
import PlaceCartTempoStep from "./cart-steps/PlaceCartTempoStep";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "./cart-steps/routePlanTypes";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MapSheetPlace } from "@/types/place";
import { useUiText } from "@/lib/uiText";

type RouteCheckoutModalProps = {
  isOpen: boolean;
  savedPlaces: SavedPlaceItem[];
  insertCandidatePlaces: MapSheetPlace[];
  currentLocation: RouteStartLocation | null;
  appendRouteTitle?: string | null;
  initialStep?: CartFlowStep;
  initialRoutePlan?: PlannedRouteDay[] | null;
  initialTravelStartDate?: string | null;
  initialTripDays?: number;
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
  onRequestSearchPlace: () => void;
};

type RouteCheckoutModalContentProps = Omit<
  RouteCheckoutModalProps,
  "isOpen" | "initialTravelStartDate" | "initialTripDays"
>;

const ROUTE_CHECKOUT_STEPS: CartFlowStep[] = [
  "cart",
  "schedule",
  "tempo",
  "start-location",
  "result",
];

function getVisibleCheckoutSteps(initialStep: CartFlowStep) {
  const initialIndex = ROUTE_CHECKOUT_STEPS.indexOf(initialStep);

  if (initialIndex < 0) {
    return ROUTE_CHECKOUT_STEPS;
  }

  return ROUTE_CHECKOUT_STEPS.slice(initialIndex);
}

function getNextCheckoutStep(step: CartFlowStep, visibleSteps: CartFlowStep[]) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex >= 0 ? (visibleSteps[currentIndex + 1] ?? null) : null;
}

function getPreviousCheckoutStep(
  step: CartFlowStep,
  visibleSteps: CartFlowStep[]
) {
  const currentIndex = visibleSteps.indexOf(step);
  return currentIndex > 0 ? visibleSteps[currentIndex - 1] : null;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateValue() {
  const now = new Date();
  return toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function isTodayStartSchedule(travelStartDate: string) {
  return travelStartDate === getTodayDateValue();
}

function toMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }

  return hour * 60 + minute;
}

function getCurrentTimeValue() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function isPastTodayStartTime(travelStartDate: string, dailyStartTime: string) {
  if (!isTodayStartSchedule(travelStartDate)) {
    return false;
  }

  const startMinutes = toMinutes(dailyStartTime);
  const currentMinutes = toMinutes(getCurrentTimeValue());
  return startMinutes >= 0 && currentMinutes >= 0 && startMinutes < currentMinutes;
}

function getTodayStartScheduleKey(
  travelStartDate: string,
  tripDays: number,
  dailyStartTime: string
) {
  return `${travelStartDate}:${tripDays}:${dailyStartTime}`;
}

type TodayStartScheduleConfirmDialogProps = {
  tripDays: number;
  hasPastStartTime: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onUseCurrentTime: () => void;
  onChangeToTwoDays: () => void;
};

function TodayStartScheduleConfirmDialog({
  tripDays,
  hasPastStartTime,
  onClose,
  onConfirm,
  onUseCurrentTime,
  onChangeToTwoDays,
}: TodayStartScheduleConfirmDialogProps) {
  const isOneDayTrip = tripDays === 1;

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[2700] flex items-center justify-center bg-slate-950/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-start-schedule-title"
        className="center-modal-panel-enter w-full max-w-[360px] rounded-[1.5rem] border border-brand-200 bg-white p-5 shadow-2xl dark:border-brand-400/30 dark:bg-[#102a27]"
      >
        <p className="font-trip text-sm text-brand-700 dark:text-brand-200">
          SCHEDULE CHECK
        </p>
        <h2
          id="today-start-schedule-title"
          className="mt-2 text-xl font-bold text-slate-900 dark:text-white"
        >
          {hasPastStartTime
            ? "출발시간이 이미 지난 시간이에요"
            : isOneDayTrip
              ? "오늘 당일 일정이 맞나요?"
              : "오늘 바로 시작하는 일정인가요?"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {hasPastStartTime
            ? "선택한 출발시간이 현재 시간보다 이전이에요. 오늘 일정으로 진행하려면 출발시간을 한 번 더 확인해주세요."
            : isOneDayTrip
              ? "오늘 시작해서 오늘 끝나는 1일 일정으로 저장돼요. 실제로 당일 여행이 맞는지 한 번 더 확인해주세요."
              : `${tripDays}일 일정이지만 시작일이 오늘이에요. 실제로 오늘부터 시작하는 여행이 맞는지 한 번 더 확인해주세요.`}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {hasPastStartTime ? (
            <>
              <button
                type="button"
                onClick={onUseCurrentTime}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
              >
                현재 시간으로 변경
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
                >
                  그대로 계속
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
                >
                  다시 선택
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
              >
                오늘 시작으로 계속
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 ${
                    isOneDayTrip ? "" : "col-span-2"
                  } dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200`}
                >
                  다시 선택
                </button>
                {isOneDayTrip ? (
                  <button
                    type="button"
                    onClick={onChangeToTwoDays}
                    className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
                  >
                    2일로 변경
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function RouteCheckoutModalContent({
  savedPlaces,
  insertCandidatePlaces,
  appendRouteTitle,
  initialStep = "cart",
  initialRoutePlan,
  onClose,
  onSelectPlace,
  onRemovePlace,
  onClearPlaces,
  onRequestSearchPlace,
}: RouteCheckoutModalContentProps) {
  const text = useUiText();
  const {
    step,
    setStep,
    tempo,
    startLocation,
    travelStartDate,
    tripDays,
    setTripDays,
    dailyStartTime,
    setDailyStartTime,
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const showToast = useUiToastStore((state) => state.showToast);
  const [isTodayStartConfirmOpen, setIsTodayStartConfirmOpen] = useState(false);
  const [confirmedTodayStartScheduleKey, setConfirmedTodayStartScheduleKey] =
    useState<string | null>(null);
  const visibleSteps = getVisibleCheckoutSteps(initialStep);
  const stepIndex = Math.max(visibleSteps.indexOf(step), 0) + 1;
  const totalStepCount = visibleSteps.length;
  const todayStartScheduleKey = getTodayStartScheduleKey(
    travelStartDate,
    tripDays,
    dailyStartTime
  );
  const hasPastTodayStartTime = isPastTodayStartTime(
    travelStartDate,
    dailyStartTime
  );

  const handleBack = () => {
    const previousStep = getPreviousCheckoutStep(step, visibleSteps);
    if (previousStep) {
      setStep(previousStep);
      return;
    }

    onClose();
  };

  const moveToNextStep = () => {
    const nextStep = getNextCheckoutStep(step, visibleSteps);
    if (nextStep) {
      setStep(nextStep);
      return;
    }

    onClose();
  };

  const handleNext = () => {
    if (step === "schedule") {
      if (!isScheduleValid) {
        showToast(scheduleValidationMessage);
        return;
      }

      if (
        isTodayStartSchedule(travelStartDate) &&
        confirmedTodayStartScheduleKey !== todayStartScheduleKey
      ) {
        setIsTodayStartConfirmOpen(true);
        return;
      }
    }

    moveToNextStep();
  };

  const handleConfirmTodayStartSchedule = () => {
    setConfirmedTodayStartScheduleKey(todayStartScheduleKey);
    setIsTodayStartConfirmOpen(false);
    moveToNextStep();
  };

  const handleChangeToTwoDays = () => {
    setTripDays(2);
    setConfirmedTodayStartScheduleKey(
      getTodayStartScheduleKey(travelStartDate, 2, dailyStartTime)
    );
    setIsTodayStartConfirmOpen(false);
  };

  const handleUseCurrentTime = () => {
    setDailyStartTime(getCurrentTimeValue());
    setConfirmedTodayStartScheduleKey(null);
    setIsTodayStartConfirmOpen(false);
  };

  const nextDisabled =
    (step === "cart" && savedPlaces.length === 0) ||
    (step === "tempo" && !tempo) ||
    (step === "start-location" && !startLocation);
  const nextButtonLabel = step === "start-location" ? "루트 짜기" : "다음";

  return (
    <section className="route-checkout-modal-enter fixed inset-0 z-[2600] h-dvh overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="뒤로가기"
              onClick={handleBack}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              <IoArrowBack />
            </button>
            <div className="ml-3">
              <p className="font-trip text-sm text-brand-700">ROUTE CHECKOUT</p>
              <p className="text-base font-semibold text-slate-900">
                {stepIndex} / {totalStepCount}
              </p>
            </div>
          </div>

          {step === "cart" ? (
            <button
              type="button"
              onClick={onClearPlaces}
              disabled={savedPlaces.length === 0}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40"
            >
              {text.common.clearAll}
            </button>
          ) : null}
        </header>

        {appendRouteTitle ? (
          <div className="shrink-0 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700">
            {appendRouteTitle}에 새 DAY를 추가하는 중
          </div>
        ) : null}

        {step === "result" && tempo ? (
          <PlaceCartRouteResultStep
            savedPlaces={savedPlaces}
            candidatePlaces={insertCandidatePlaces}
            initialRoutePlan={initialRoutePlan}
            currentLocation={startLocation}
            onClose={onClose}
            onClearPlaces={onClearPlaces}
            onRequestSearchPlace={onRequestSearchPlace}
          />
        ) : (
          <>
            <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div key={step} className="route-checkout-step-enter">
                {step === "cart" ? (
                  <PlaceCartItemsStep
                    savedPlaces={savedPlaces}
                    onSelectPlace={onSelectPlace}
                    onRemovePlace={onRemovePlace}
                  />
                ) : null}

                {step === "schedule" ? <PlaceCartScheduleStep /> : null}

                {step === "tempo" ? <PlaceCartTempoStep /> : null}

                {step === "start-location" ? (
                  <PlaceCartStartLocationStep savedPlaces={savedPlaces} />
                ) : null}
              </div>
            </div>

            <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 px-4 py-4">
              <button
                type="button"
                onClick={handleNext}
                disabled={nextDisabled}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {nextButtonLabel}
              </button>
            </footer>
          </>
        )}
      </div>

      {isTodayStartConfirmOpen ? (
        <TodayStartScheduleConfirmDialog
          tripDays={tripDays}
          hasPastStartTime={hasPastTodayStartTime}
          onClose={() => setIsTodayStartConfirmOpen(false)}
          onConfirm={handleConfirmTodayStartSchedule}
          onUseCurrentTime={handleUseCurrentTime}
          onChangeToTwoDays={handleChangeToTwoDays}
        />
      ) : null}
    </section>
  );
}

function RouteCheckoutModal({
  isOpen,
  initialStep = "cart",
  initialTravelStartDate,
  initialTripDays,
  ...contentProps
}: RouteCheckoutModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <RouteCheckoutProvider
      initialStep={initialStep}
      initialTravelStartDate={initialTravelStartDate}
      initialTripDays={initialTripDays}
      initialStartLocation={contentProps.currentLocation}
    >
      <RouteCheckoutModalContent {...contentProps} initialStep={initialStep} />
    </RouteCheckoutProvider>
  );
}

export default RouteCheckoutModal;
