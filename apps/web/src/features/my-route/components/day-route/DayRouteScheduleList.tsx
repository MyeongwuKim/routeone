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
    canToggleVisitStatus,
    enableVerificationPhotoPreview,
    travelSegmentByKey,
    registerDropZone,
    startDragStop,
    handleSelectDay,
    setStayMinutesEditTarget,
    handleToggleStopVisited,
    handleOpenPlaceDetail,
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
              canToggleVisited={canToggleVisitStatus}
              enableVerificationPhotoPreview={
                enableVerificationPhotoPreview
              }
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
              onToggleVisited={(stop) =>
                handleToggleStopVisited(routeDay, stop)
              }
              onOpenPlace={handleOpenPlaceDetail}
              onOpenVerificationPhoto={setVerificationPhotoPreviewTarget}
            />
          );
        })}
      </div>
    </div>
  );
}

export default DayRouteScheduleList;
