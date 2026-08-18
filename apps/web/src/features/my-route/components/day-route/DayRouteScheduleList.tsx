import DayRouteAccordionItem from "./DayRouteAccordionItem";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";
import { getRouteDateKey, getTodayDateKey } from "../../routeDisplay";

type DayRouteScheduleListProps = {
  controller: DayRoutePopupController["schedule"];
};

function DayRouteScheduleList({ controller }: DayRouteScheduleListProps) {
  const todayKey = getTodayDateKey();
  const {
    sortedDays,
    activeDay,
    expandedDayIds,
    orderedStops,
    startLocation,
    dailyStartMinutes,
    isOrderEditing,
    activeDropIndex,
    draggedStopId,
    visitSavingStopId,
    staySavingStopId,
    isReadOnly,
    canEditVisitTimes,
    canEditDayStartTime,
    canEditStartLocation,
    isRetrospectiveCompletion,
    canEditVerificationPhoto,
    canToggleVisitStatus,
    visitEnabledDayIds,
    enableVerificationPhotoPreview,
    isGpsTestEnabled,
    gpsTestLocationStopId,
    directionsOpeningStopId,
    travelSegmentByKey,
    registerDropZone,
    startDragStop,
    handleSelectDay,
    setDayStartTimeTarget,
    openStartLocationPicker,
    setStayMinutesEditTarget,
    setVisitTimesEditTarget,
    handleToggleStopVisited,
    handleOpenPlaceDetail,
    handleOpenStopDirections,
    handleReplaceVerificationPhoto,
    setGpsTestTarget,
    setVerificationPhotoPreviewTarget,
  } = controller;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-3">
        {sortedDays.map((routeDay) => {
          const isRouteDayActive = routeDay.id === activeDay.id;
          const routeDayStops = isRouteDayActive
            ? orderedStops
            : routeDay.stops;

          return (
            <DayRouteAccordionItem
              key={routeDay.id}
              routeDay={routeDay}
              isExpanded={expandedDayIds.has(routeDay.id)}
              orderedStops={routeDayStops}
              startLocation={startLocation}
              dailyStartMinutes={dailyStartMinutes}
              isOrderEditing={isRouteDayActive && isOrderEditing}
              activeDropIndex={isRouteDayActive ? activeDropIndex : null}
              draggedStopId={isRouteDayActive ? draggedStopId : null}
              visitSavingStopId={visitSavingStopId}
              staySavingStopId={staySavingStopId}
              isReadOnly={isReadOnly}
              canEditVisitTimes={canEditVisitTimes}
              canEditDayStartTime={canEditDayStartTime}
              canEditStartLocation={canEditStartLocation}
              canStartDay={
                canEditDayStartTime &&
                !isRetrospectiveCompletion &&
                !routeDay.startedAt &&
                visitEnabledDayIds.has(routeDay.id)
              }
              canRecordDayStart={
                canEditDayStartTime &&
                !routeDay.startedAt &&
                (isRetrospectiveCompletion ||
                  (getRouteDateKey(routeDay.date) ?? todayKey) < todayKey)
              }
              canEditVerificationPhoto={canEditVerificationPhoto}
              canToggleVisited={
                canToggleVisitStatus &&
                (isRetrospectiveCompletion || Boolean(routeDay.startedAt))
              }
              isVisitDateAllowed={visitEnabledDayIds.has(routeDay.id)}
              showActiveDestination={
                !isReadOnly &&
                !isRetrospectiveCompletion &&
                Boolean(routeDay.startedAt) &&
                visitEnabledDayIds.has(routeDay.id)
              }
              enableVerificationPhotoPreview={
                enableVerificationPhotoPreview
              }
              isGpsTestEnabled={isGpsTestEnabled}
              gpsTestLocationStopId={gpsTestLocationStopId}
              directionsOpeningStopId={directionsOpeningStopId}
              travelSegmentByKey={travelSegmentByKey}
              onSelect={handleSelectDay}
              onRequestDayStart={(selectedDay) =>
                setDayStartTimeTarget({
                  routeDay: selectedDay,
                  mode: "start",
                })
              }
              onRequestPlannedStartEdit={(selectedDay) =>
                setDayStartTimeTarget({
                  routeDay: selectedDay,
                  mode: "planned",
                })
              }
              onRequestActualStartEdit={(selectedDay) =>
                setDayStartTimeTarget({
                  routeDay: selectedDay,
                  mode: "actual",
                })
              }
              onRequestStartLocationEdit={openStartLocationPicker}
              onRegisterDropZone={
                isRouteDayActive ? registerDropZone : () => undefined
              }
              onStartDrag={(stop, fromIndex, event) => {
                if (isRouteDayActive) {
                  startDragStop({ stop, fromIndex, event });
                }
              }}
              onRequestStayMinutesEdit={(stop) => {
                if (!isReadOnly) {
                  setStayMinutesEditTarget({ routeDay, stop });
                }
              }}
              onRequestVisitTimesEdit={(stop) => {
                setVisitTimesEditTarget({ routeDay, stop });
              }}
              onToggleVisited={(stop) =>
                handleToggleStopVisited(routeDay, stop)
              }
              onOpenPlace={handleOpenPlaceDetail}
              onOpenDirections={(stop) => {
                void handleOpenStopDirections(stop);
              }}
              onEditVerificationPhoto={(stop) =>
                handleReplaceVerificationPhoto({ routeDay, stop })
              }
              onOpenGpsTest={(stop) =>
                setGpsTestTarget({ routeDay, stop })
              }
              onOpenVerificationPhoto={setVerificationPhotoPreviewTarget}
            />
          );
        })}
      </div>
    </div>
  );
}

export default DayRouteScheduleList;
