import { useState } from "react";
import { IoArrowBack } from "react-icons/io5";
import {
  RouteCheckoutProvider,
} from "./RouteCheckoutContext";
import { useRouteCheckout } from "../hooks/useRouteCheckout";
import TodayStartScheduleConfirmDialog from "./TodayStartScheduleConfirmDialog";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartStartLocationStep from "./cart-steps/PlaceCartStartLocationStep";
import PlaceCartTempoStep from "./cart-steps/PlaceCartTempoStep";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "../models/routePlanTypes";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MapSheetPlace } from "@/types/place";
import { useUiText } from "@/lib/uiText";
import {
  getCurrentTimeValue,
  getNextCheckoutStep,
  getPreviousCheckoutStep,
  getTodayStartScheduleKey,
  getVisibleCheckoutSteps,
  isPastTodayStartTime,
  isTodayStartSchedule,
  type CartFlowStep,
} from "../models/routeCheckoutFlow";

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
  const firstVisibleStep = visibleSteps[0] ?? initialStep;
  const canRestartCheckout = step !== firstVisibleStep;
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

  const handleRestartCheckout = () => {
    setStep(firstVisibleStep);
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
  const nextButtonLabel =
    step === "start-location" ? text.cart.buildRoute : text.cart.next;

  return (
    <section className="route-checkout-modal-enter fixed inset-0 z-[2600] h-dvh overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="flex items-center">
            <button
              type="button"
              aria-label={text.cart.backAria}
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
          ) : canRestartCheckout ? (
            <button
              type="button"
              aria-label={text.cart.restartCheckoutAria}
              onClick={handleRestartCheckout}
              className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              {text.cart.restartCheckout}
            </button>
          ) : null}
        </header>

        {appendRouteTitle ? (
          <div className="shrink-0 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700">
            {text.cart.appendRouteBanner(appendRouteTitle)}
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
