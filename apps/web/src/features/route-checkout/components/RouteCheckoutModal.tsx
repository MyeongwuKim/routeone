/**
 * 진입 경로: 지도에서 담은 장소 또는 공유 루트 담기 → 일정 만들기
 * 장소·날짜·템포·출발지·추천 일정 단계를 연결하고, 단계별 안내와 저장 상태를 관리한다.
 */
import { useLayoutEffect, useRef, useState, type SyntheticEvent } from "react";
import { IoArrowBack, IoTrashOutline } from "react-icons/io5";
import {
  RouteCheckoutProvider,
} from "./RouteCheckoutContext";
import { useRouteCheckout } from "../hooks/useRouteCheckout";
import { useRouteCheckoutDraftSession } from "../hooks/useRouteCheckoutDraftSession";
import { getCheckoutPlacesKey, type RouteCheckoutDraftContext } from "../models/routeCheckoutDraft";
import { useAuthUserStore } from "@/stores/authUserStore";
import TodayStartScheduleConfirmDialog from "./TodayStartScheduleConfirmDialog";
import RouteCheckoutSavingOverlay from "./RouteCheckoutSavingOverlay";
import RouteCheckoutHelpButton from "./RouteCheckoutHelpButton";
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
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
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
  /** 새 일정·공유 복사·기존 DAY 추가의 저장 문맥. 홈 재개 링크는 저장된 문맥을 복원한다. */
  draftContext?: RouteCheckoutDraftContext;
  resumeDraft?: boolean;

  isOpen: boolean;

  savedPlaces: SavedPlaceItem[];

  insertCandidatePlaces: MapSheetPlace[];

  currentLocation: RouteStartLocation | null;
  /** 기존 경로에 DAY를 추가하는 흐름에서 배너에 표시할 대상 경로명 */
  appendRouteTitle?: string | null;

  headerLabel?: string;

  contextBanner?: string | null;
  /** 모달을 열었을 때 시작할 일정 만들기 단계 */
  initialStep?: CartFlowStep;
  /** 기존 경로 편집·DAY 추가 흐름에서 결과 단계에 먼저 표시할 일정 */
  initialRoutePlan?: PlannedRouteDay[] | null;
  /** 모달을 열 때 일정 상태에 적용할 여행 시작일 */
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
  headerLabel,
  contextBanner,
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
    isSavingRoute,
    isRouteSaveInFlight,
    step,
    setStep,
    tempo,
    startLocation,
    travelStartDate,
    tripDays,
    dailyStartTime,
    setDailyStartTime,
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const showToast = useUiToastStore((state) => state.showToast);
  const lastFocusedElementRef = useRef<HTMLElement | null>(null);
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
    if (isRouteSaveInFlight()) {
      return;
    }

    const previousStep = getPreviousCheckoutStep(step, visibleSteps);
    if (previousStep) {
      setStep(previousStep);
      return;
    }

    onClose();
  };

  const handleRestartCheckout = () => {
    if (isRouteSaveInFlight()) {
      return;
    }

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
    if (isRouteSaveInFlight()) {
      return;
    }

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

  const handleUseCurrentTime = () => {
    setDailyStartTime(getCurrentTimeValue());
    setConfirmedTodayStartScheduleKey(null);
    setIsTodayStartConfirmOpen(false);
    showToast(text.cart.currentTimeAppliedToast);
  };

  const blockInteractionWhileSaving = (event: SyntheticEvent) => {
    if (isRouteSaveInFlight()) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const nextDisabled =
    (step === "cart" && savedPlaces.length === 0) ||
    (step === "tempo" && !tempo) ||
    (step === "start-location" && !startLocation);
  const stepTitle =
    step === "cart"
      ? text.cart.savedPlacesTitle(savedPlaces.length)
      : text.cart.stepTitles[step];
  const progressLabel = `${stepIndex} / ${totalStepCount}`;

  return (
    <section
      className={`route-checkout-modal-enter fixed inset-0 ${UI_LAYER_CLASS.routeCheckout} h-dvh overflow-hidden bg-white`}
    >
      <div
        inert={isSavingRoute}
        aria-busy={isSavingRoute}
        onFocusCapture={(event) => {
          lastFocusedElementRef.current = event.target;
        }}
        onClickCapture={blockInteractionWhileSaving}
        onPointerDownCapture={blockInteractionWhileSaving}
        onKeyDownCapture={blockInteractionWhileSaving}
        className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col"
      >
        <header className="app-safe-area-header flex shrink-0 items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
          <div className="flex min-w-0 items-center">
            <button
              type="button"
              aria-label={text.cart.backAria}
              onClick={handleBack}
              disabled={isSavingRoute}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
            >
              <IoArrowBack />
            </button>
            <div className="ml-3 min-w-0">
              <p className="font-trip truncate text-sm text-brand-700">
                {headerLabel ? `${progressLabel} · ${headerLabel}` : progressLabel}
              </p>
              <h2 className="truncate text-base font-semibold text-slate-900">
                {stepTitle}
              </h2>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {step === "cart" ? (
              <button
                type="button"
                onClick={onClearPlaces}
                disabled={savedPlaces.length === 0}
                aria-label={text.common.clearAll}
                title={text.common.clearAll}
                className="inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-base text-slate-500 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 dark:border-brand-400/20 dark:bg-[#0b211f] dark:text-slate-300 dark:hover:border-rose-400/30 dark:hover:bg-rose-400/10 dark:hover:text-rose-300"
              >
                <IoTrashOutline aria-hidden="true" />
              </button>
            ) : canRestartCheckout ? (
              <button
                type="button"
                aria-label={text.cart.restartCheckoutAria}
                onClick={handleRestartCheckout}
                disabled={isSavingRoute}
                className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
              >
                {text.cart.restartCheckout}
              </button>
            ) : null}
            <RouteCheckoutHelpButton step={step} disabled={isSavingRoute} />
          </div>
        </header>

        {appendRouteTitle ? (
          <div className="shrink-0 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700">
            {text.cart.appendRouteBanner(appendRouteTitle)}
          </div>
        ) : contextBanner ? (
          <div className="shrink-0 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs font-bold text-brand-700">
            {contextBanner}
          </div>
        ) : null}

        {step === "result" && tempo ? (
          <PlaceCartRouteResultStep
            key={getCheckoutPlacesKey(savedPlaces)}
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

                {step === "schedule" ? (
                  <PlaceCartScheduleStep
                    recommendationPlaces={
                      appendRouteTitle || initialRoutePlan
                        ? undefined
                        : savedPlaces
                    }
                  />
                ) : null}

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
                className="min-h-11 w-full whitespace-nowrap rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {text.cart.nextStepLabels[step]}
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
        />
      ) : null}

      {isSavingRoute ? (
        <RouteCheckoutSavingOverlay returnFocusRef={lastFocusedElementRef} />
      ) : null}
    </section>
  );
}

function RouteCheckoutSession({
  initialStep = "cart",
  initialTravelStartDate,
  initialTripDays,
  draftContext = { mode: "new" },
  resumeDraft = false,
  ...contentProps
}: RouteCheckoutModalProps) {
  const session = useRouteCheckoutDraftSession({
    context: draftContext,
    resumeDraft,
    initialStep,
    initialTravelStartDate,
    initialTripDays,
    ...contentProps,
  });
  const userId = useAuthUserStore((state) => state.user?.id ?? null);
  const sessionOwnerId = useRef(session.draft.ownerUserId);
  const { onClose } = contentProps;
  // 로그인 중인 작성 화면은 유지하되 다른 계정으로 바뀐 경우 이전 작성 화면을 닫는다.
  useLayoutEffect(() => {
    if (userId && sessionOwnerId.current && userId !== sessionOwnerId.current) onClose();
    else if (userId) sessionOwnerId.current = userId;
  }, [userId, onClose]);
  const appendRouteTitle = session.draft.context.mode === "append"
    ? session.draft.context.target.routeTitle : null;

  return (
    <RouteCheckoutProvider
      key={session.draft.id}
      draft={session.draft}
      savedPlaces={session.savedPlaces}
    >
      <RouteCheckoutModalContent
        {...contentProps}
        savedPlaces={session.savedPlaces}
        initialStep={session.draft.initialStep}
        initialRoutePlan={session.draft.initialRoutePlan}
        appendRouteTitle={appendRouteTitle}
        onRemovePlace={session.removePlace}
        onClearPlaces={session.clearPlaces}
      />
    </RouteCheckoutProvider>
  );
}

/** 모달을 닫으면 UI만 해제하고 입력·결과는 초안에 남겨 다음 진입에서 복원한다. */
function RouteCheckoutModal(props: RouteCheckoutModalProps) {
  return props.isOpen ? <RouteCheckoutSession {...props} /> : null;
}

export default RouteCheckoutModal;
