import { IoArrowBack } from "react-icons/io5";
import {
  RouteCheckoutProvider,
  useRouteCheckout,
} from "./RouteCheckoutContext";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
import PlaceCartStartLocationStep from "./cart-steps/PlaceCartStartLocationStep";
import PlaceCartTempoStep from "./cart-steps/PlaceCartTempoStep";
import type { RouteStartLocation } from "./cart-steps/routePlanTypes";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MapSheetPlace } from "@/types/place";

type RouteCheckoutModalProps = {
  isOpen: boolean;
  savedPlaces: SavedPlaceItem[];
  insertCandidatePlaces: MapSheetPlace[];
  currentLocation: RouteStartLocation | null;
  appendRouteTitle?: string | null;
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

  const stepIndex =
    step === "cart"
      ? 1
      : step === "schedule"
        ? 2
        : step === "tempo"
          ? 3
          : step === "start-location"
            ? 4
            : 5;

  const handleBack = () => {
    if (step === "start-location") {
      setStep("tempo");
      return;
    }

    if (step === "tempo") {
      setStep("schedule");
      return;
    }

    if (step === "result") {
      setStep("start-location");
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
      if (!isScheduleValid) {
        showToast(scheduleValidationMessage);
        return;
      }

      setStep("tempo");
      return;
    }

    if (step === "tempo") {
      setStep("start-location");
      return;
    }

    if (step === "start-location") {
      setStep("result");
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
    <section className="route-checkout-modal-enter fixed inset-0 z-[1700] h-dvh overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
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
              <p className="text-base font-semibold text-slate-900">
                {stepIndex} / 5
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
  initialTravelStartDate,
  initialTripDays,
  ...contentProps
}: RouteCheckoutModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <RouteCheckoutProvider
      initialTravelStartDate={initialTravelStartDate}
      initialTripDays={initialTripDays}
      initialStartLocation={contentProps.currentLocation}
    >
      <RouteCheckoutModalContent {...contentProps} />
    </RouteCheckoutProvider>
  );
}

export default RouteCheckoutModal;
