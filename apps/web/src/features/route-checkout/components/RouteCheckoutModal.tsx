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
  const {
    step,
    setStep,
    tempo,
    startLocation,
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const showToast = useUiToastStore((state) => state.showToast);
  const visibleSteps = getVisibleCheckoutSteps(initialStep);
  const stepIndex = Math.max(visibleSteps.indexOf(step), 0) + 1;
  const totalStepCount = visibleSteps.length;

  const handleBack = () => {
    const previousStep = getPreviousCheckoutStep(step, visibleSteps);
    if (previousStep) {
      setStep(previousStep);
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
    }

    const nextStep = getNextCheckoutStep(step, visibleSteps);
    if (nextStep) {
      setStep(nextStep);
      return;
    }

    onClose();
  };

  const nextDisabled =
    (step === "cart" && savedPlaces.length === 0) ||
    (step === "tempo" && !tempo) ||
    (step === "start-location" && !startLocation);
  const nextButtonLabel = step === "start-location" ? "루트 짜기" : "다음";

  return (
    <section className="route-checkout-modal-enter fixed inset-0 z-[2600] h-dvh overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
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
              전체 비우기
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

            <footer className="shrink-0 border-t border-brand-100 px-4 py-4">
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
