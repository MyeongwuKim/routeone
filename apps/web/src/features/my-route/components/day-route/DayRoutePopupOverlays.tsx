import { MdDragIndicator } from "react-icons/md";
import PlaceCartRouteMapPopup from "@/features/route-checkout/components/cart-steps/PlaceCartRouteMapPopup";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";
import {
  ActualStayMinutesPopup,
  EarlyRouteCompletionPopup,
  StayMinutesPopup,
  VerificationPhotoPreviewPopup,
  VisitCompletionPopup,
} from "./DayRouteDialogs";

type DayRoutePopupOverlaysProps = {
  controller: DayRoutePopupController["overlays"];
};

function DayRoutePopupOverlays({ controller }: DayRoutePopupOverlaysProps) {
  const {
    mapTargetRouteDay,
    mapTargetDayOption,
    routeMapDayOptions,
    mapTargetDayId,
    enableStartPreview,
    onRequestCheckout,
    handleRequestCheckoutFromMap,
    closeMap,
    draggedStop,
    stayMinutesEditTarget,
    closeStayMinutesEdit,
    handleChangeStayMinutes,
    earlyRouteCompletionTarget,
    plannedDays,
    earlyCompletionActualDays,
    earlyCompletionExpectedEndDateKey,
    isUpdatingRouteStartDate,
    setEarlyRouteCompletionTarget,
    handleCompleteEarlyRouteAsIs,
    handleCompleteEarlyRouteWithStartDate,
    visitCompletionTarget,
    visitSavingStopId,
    visitCompletionMode,
    setVisitCompletionTarget,
    handleCompleteStopVisitWithGps,
    handleCompleteStopVisitWithPhoto,
    handleCompleteStopVisitManually,
    actualStayMinutesTarget,
    handleSkipActualStayMinutes,
    handleSaveActualStayMinutes,
    verificationPhotoPreviewTarget,
    setVerificationPhotoPreviewTarget,
  } = controller;

  return (
    <>
      {mapTargetRouteDay ? (
        <PlaceCartRouteMapPopup
          day={mapTargetRouteDay}
          comparisonDay={mapTargetDayOption?.comparisonDay ?? null}
          completedItemIds={mapTargetDayOption?.completedItemIds}
          dayOptions={routeMapDayOptions}
          initialDayOptionId={
            mapTargetDayOption?.id ?? mapTargetDayId ?? undefined
          }
          enableStartPreview={enableStartPreview}
          onRequestCheckout={
            onRequestCheckout ? handleRequestCheckoutFromMap : undefined
          }
          onClose={closeMap}
        />
      ) : null}
      {draggedStop?.isActive ? (
        <div
          className="pointer-events-none fixed z-[3000] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-2xl"
          style={{ left: draggedStop.x, top: draggedStop.y }}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MdDragIndicator />
          </span>
          <span className="max-w-[150px] truncate">
            {draggedStop.stop.place.title}
          </span>
        </div>
      ) : null}
      {stayMinutesEditTarget ? (
        <StayMinutesPopup
          target={stayMinutesEditTarget}
          onClose={closeStayMinutesEdit}
          onApply={(target, stayMinutes) => {
            void handleChangeStayMinutes(
              target.routeDay,
              target.stop,
              stayMinutes
            );
          }}
        />
      ) : null}
      {earlyRouteCompletionTarget ? (
        <EarlyRouteCompletionPopup
          target={earlyRouteCompletionTarget}
          plannedDays={plannedDays}
          actualDays={earlyCompletionActualDays}
          expectedEndDateKey={earlyCompletionExpectedEndDateKey}
          isSaving={isUpdatingRouteStartDate}
          onChangeStartedAt={(startedAt) =>
            setEarlyRouteCompletionTarget((currentTarget) =>
              currentTarget ? { ...currentTarget, startedAt } : currentTarget
            )
          }
          onCompleteAsIs={handleCompleteEarlyRouteAsIs}
          onCompleteWithStartDate={() => {
            void handleCompleteEarlyRouteWithStartDate();
          }}
          onClose={() => {
            if (!isUpdatingRouteStartDate) {
              setEarlyRouteCompletionTarget(null);
            }
          }}
        />
      ) : null}
      {visitCompletionTarget ? (
        <VisitCompletionPopup
          target={visitCompletionTarget}
          isSaving={visitSavingStopId === visitCompletionTarget.stop.id}
          mode={visitCompletionMode}
          onClose={() => {
            if (!visitSavingStopId) {
              setVisitCompletionTarget(null);
            }
          }}
          onCompleteWithGps={(target) => {
            void handleCompleteStopVisitWithGps(target);
          }}
          onCompleteWithPhoto={(target, source) => {
            void handleCompleteStopVisitWithPhoto(target, source);
          }}
          onCompleteManually={(target) => {
            void handleCompleteStopVisitManually(target);
          }}
        />
      ) : null}
      {actualStayMinutesTarget ? (
        <ActualStayMinutesPopup
          target={actualStayMinutesTarget}
          isSaving={visitSavingStopId === actualStayMinutesTarget.stop.id}
          onSkip={handleSkipActualStayMinutes}
          onApply={(target, actualStayMinutes) => {
            void handleSaveActualStayMinutes(target, actualStayMinutes);
          }}
        />
      ) : null}
      {verificationPhotoPreviewTarget ? (
        <VerificationPhotoPreviewPopup
          target={verificationPhotoPreviewTarget}
          onClose={() => setVerificationPhotoPreviewTarget(null)}
        />
      ) : null}
    </>
  );
}

export default DayRoutePopupOverlays;
