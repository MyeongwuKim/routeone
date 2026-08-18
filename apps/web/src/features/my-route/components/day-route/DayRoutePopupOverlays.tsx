import { MdDragIndicator } from "react-icons/md";
import PlaceCartRouteMapPopup from "@/features/route-checkout/components/cart-steps/PlaceCartRouteMapPopup";
import StartLocationPickerPopup from "@/features/route-checkout/components/cart-steps/StartLocationPickerPopup";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";
import GpsTestLocationPopup from "./GpsTestLocationPopup";
import {
  ActualStayMinutesPopup,
  DayStartTimePopup,
  EarlyRouteCompletionPopup,
  PhotoPublicationPopup,
  StayMinutesPopup,
  VerificationPhotoPreviewPopup,
  VisitCompletionPopup,
  VisitTimesEditPopup,
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
    isStartLocationPickerOpen,
    startLocation,
    closeStartLocationPicker,
    handleApplyStartLocation,
    draggedStop,
    dayStartTimeTarget,
    defaultDayStartMinutes,
    isUpdatingRouteDayStart,
    setDayStartTimeTarget,
    handleApplyDayStartTime,
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
    visitTimesEditTarget,
    visitSavingStopId,
    visitCompletionMode,
    setVisitCompletionTarget,
    setVisitTimesEditTarget,
    handleUpdateVisitTimes,
    handleCompleteStopVisitWithGps,
    handleCompleteStopVisitWithPhoto,
    handleCompleteStopVisitManually,
    actualStayMinutesTarget,
    setActualStayMinutesTarget,
    handleCancelStopCheckIn,
    handleSaveActualStayMinutes,
    verificationPhotoPreviewTarget,
    canManageVerificationPhoto,
    canReplaceVerificationPhoto,
    setVerificationPhotoPreviewTarget,
    photoPublicationTarget,
    handleSetPhotoPublication,
    handleDeleteVerificationPhoto,
    handleReplaceVerificationPhoto,
    handleKeepPhotoPrivate,
    gpsTestTarget,
    gpsTestLocation,
    isGpsTestApplying,
    setGpsTestTarget,
    handleApplyGpsTestLocation,
    handleClearGpsTestLocation,
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
      {isStartLocationPickerOpen && startLocation ? (
        <StartLocationPickerPopup
          routePlan={routeMapDayOptions.map((option) => option.day)}
          initialLocation={startLocation}
          onClose={closeStartLocationPicker}
          onApply={handleApplyStartLocation}
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
      {dayStartTimeTarget ? (
        <DayStartTimePopup
          key={`${dayStartTimeTarget.routeDay.id}:${dayStartTimeTarget.mode}`}
          target={dayStartTimeTarget}
          defaultStartMinutes={defaultDayStartMinutes}
          isSaving={isUpdatingRouteDayStart}
          onClose={() => {
            if (!isUpdatingRouteDayStart) {
              setDayStartTimeTarget(null);
            }
          }}
          onApply={(target, value) => {
            void handleApplyDayStartTime(target, value);
          }}
        />
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
      {visitTimesEditTarget ? (
        <VisitTimesEditPopup
          key={visitTimesEditTarget.stop.id}
          target={visitTimesEditTarget}
          isSaving={visitSavingStopId === visitTimesEditTarget.stop.id}
          onClose={() => {
            if (!visitSavingStopId) {
              setVisitTimesEditTarget(null);
            }
          }}
          onApply={(target, checkedInAt, checkedOutAt) => {
            void handleUpdateVisitTimes(target, checkedInAt, checkedOutAt);
          }}
        />
      ) : null}
      {actualStayMinutesTarget ? (
        <ActualStayMinutesPopup
          key={actualStayMinutesTarget.stop.id}
          target={actualStayMinutesTarget}
          isSaving={visitSavingStopId === actualStayMinutesTarget.stop.id}
          onClose={() => setActualStayMinutesTarget(null)}
          onCancelCheckIn={(target) => {
            void handleCancelStopCheckIn(target);
          }}
          onApply={(target, actualStayMinutes) => {
            void handleSaveActualStayMinutes(target, actualStayMinutes);
          }}
        />
      ) : null}
      {verificationPhotoPreviewTarget ? (
        <VerificationPhotoPreviewPopup
          target={verificationPhotoPreviewTarget}
          canManage={canManageVerificationPhoto}
          canReplace={canReplaceVerificationPhoto}
          isSaving={visitSavingStopId === verificationPhotoPreviewTarget.stop.id}
          onClose={() => {
            if (!visitSavingStopId) {
              setVerificationPhotoPreviewTarget(null);
            }
          }}
          onChangePublication={handleSetPhotoPublication}
          onDelete={handleDeleteVerificationPhoto}
          onReplace={handleReplaceVerificationPhoto}
        />
      ) : null}
      {photoPublicationTarget ? (
        <PhotoPublicationPopup
          target={photoPublicationTarget}
          isSaving={visitSavingStopId === photoPublicationTarget.stop.id}
          onKeepPrivate={() => {
            if (!visitSavingStopId) {
              handleKeepPhotoPrivate();
            }
          }}
          onPublish={(target) => handleSetPhotoPublication(target, true)}
        />
      ) : null}
      {gpsTestTarget ? (
        <GpsTestLocationPopup
          key={gpsTestTarget.stop.id}
          target={gpsTestTarget}
          activeLocation={gpsTestLocation}
          isApplying={isGpsTestApplying}
          onApply={handleApplyGpsTestLocation}
          onClear={handleClearGpsTestLocation}
          onClose={() => {
            if (!isGpsTestApplying) {
              setGpsTestTarget(null);
            }
          }}
        />
      ) : null}
    </>
  );
}

export default DayRoutePopupOverlays;
