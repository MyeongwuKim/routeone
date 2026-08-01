import DayRouteAccordionItem from "./DayRouteAccordionItem";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";

type DayRouteScheduleListProps = {
  controller: DayRoutePopupController["schedule"];
};

function DayRouteScheduleList({ controller }: DayRouteScheduleListProps) {
  const {
    sortedDays,
    activeDay,
    expandedDayIds,
    orderedStops,
    startLocation,
    isOrderEditing,
    activeDropIndex,
    draggedStopId,
    visitSavingStopId,
    staySavingStopId,
    isReadOnly,
    canEditVisitTimes,
    canEditVerificationPhoto,
    canToggleVisitStatus,
    visitEnabledDayIds,
    enableVerificationPhotoPreview,
    isGpsTestEnabled,
    gpsTestLocationStopId,
    travelSegmentByKey,
    registerDropZone,
    startDragStop,
    handleSelectDay,
    setStayMinutesEditTarget,
    setVisitTimesEditTarget,
    handleToggleStopVisited,
    handleOpenPlaceDetail,
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
              isOrderEditing={isRouteDayActive && isOrderEditing}
              activeDropIndex={isRouteDayActive ? activeDropIndex : null}
              draggedStopId={isRouteDayActive ? draggedStopId : null}
              visitSavingStopId={visitSavingStopId}
              staySavingStopId={staySavingStopId}
              isReadOnly={isReadOnly}
              canEditVisitTimes={canEditVisitTimes}
              canEditVerificationPhoto={canEditVerificationPhoto}
              canToggleVisited={canToggleVisitStatus}
              isVisitDateAllowed={visitEnabledDayIds.has(routeDay.id)}
              enableVerificationPhotoPreview={
                enableVerificationPhotoPreview
              }
              isGpsTestEnabled={isGpsTestEnabled}
              gpsTestLocationStopId={gpsTestLocationStopId}
              travelSegmentByKey={travelSegmentByKey}
              onSelect={handleSelectDay}
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
