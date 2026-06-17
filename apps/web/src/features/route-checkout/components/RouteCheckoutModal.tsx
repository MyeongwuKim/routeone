import { IoArrowBack } from "react-icons/io5";
import {
  RouteCheckoutProvider,
  useRouteCheckout,
} from "./RouteCheckoutContext";
import PlaceCartItemsStep from "./cart-steps/PlaceCartItemsStep";
import PlaceCartRouteResultStep from "./cart-steps/PlaceCartRouteResultStep";
import PlaceCartScheduleStep from "./cart-steps/PlaceCartScheduleStep";
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
  onClose: () => void;
  onSelectPlace: (place: MapSheetPlace) => void;
  onRemovePlace: (placeId: string) => void;
  onClearPlaces: () => void;
  onRequestSearchPlace: () => void;
};

type RouteCheckoutModalContentProps = Omit<
  RouteCheckoutModalProps,
  "isOpen"
>;

function RouteCheckoutModalContent({
  savedPlaces,
  insertCandidatePlaces,
  currentLocation,
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
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const showToast = useUiToastStore((state) => state.showToast);

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
      if (!isScheduleValid) {
        showToast(scheduleValidationMessage);
        return;
      }

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
    (step === "tempo" && !tempo);
  const nextButtonLabel = step === "tempo" ? "루트 짜기" : "다음";

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
                {stepIndex} / 4
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

        {step === "result" && tempo ? (
          <PlaceCartRouteResultStep
            savedPlaces={savedPlaces}
            candidatePlaces={insertCandidatePlaces}
            currentLocation={currentLocation}
            onClose={onClose}
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

function RouteCheckoutModal({ isOpen, ...contentProps }: RouteCheckoutModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <RouteCheckoutProvider>
      <RouteCheckoutModalContent {...contentProps} />
    </RouteCheckoutProvider>
  );
}

export default RouteCheckoutModal;
