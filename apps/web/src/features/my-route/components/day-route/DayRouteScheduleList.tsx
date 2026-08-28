import { MdDirectionsWalk } from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import DayRouteAccordionItem from "./DayRouteAccordionItem";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";
import { getRouteDateKey, getTodayDateKey } from "../../routeDisplay";
import { getDayRouteStartLocation } from "../../utils/dayRouteStartLocation";

type DayRouteScheduleListProps = {
  controller: DayRoutePopupController["schedule"];
};

function DayRouteScheduleList({ controller }: DayRouteScheduleListProps) {
  const text = useUiText();
  const todayKey = getTodayDateKey();
  const {
    sortedDays,
    expandedDayIds,
    stopsByDayId,
    routeStartLocation,
    dailyStartMinutes,
    isOrderEditing,
    activeDropTarget,
    draggedStopId,
    visitSavingStopId,
    staySavingStopId,
    isReadOnly,
    canEditVisitTimes,
    canEditDayStartTime,
    canEditStartLocation,
    isRetrospectiveCompletion,
    isVerificationBypassEnabled,
    canEditVerificationPhoto,
    canToggleVisitStatus,
    visitEnabledDayIds,
    enableVerificationPhotoPreview,
    isGpsTestEnabled,
    indoorTestTarget,
    gpsTestLocationStopId,
    directionsOpeningStopId,
    travelSegmentByKey,
    registerDropZone,
    startDragStop,
    handleMoveStopToDay,
    handleRemoveStopFromLayout,
    handleSelectDay,
    handleRequestDeleteDay,
    setDayStartTimeTarget,
    openStartLocationPicker,
    setStayMinutesEditTarget,
    setVisitTimesEditTarget,
    handleToggleStopVisited,
    handleOpenPlaceDetail,
    handleOpenStopDirections,
    handleReplaceVerificationPhoto,
    openIndoorTest,
    setGpsTestTarget,
    setVerificationPhotoPreviewTarget,
  } = controller;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-3">
        {isGpsTestEnabled && indoorTestTarget ? (
          <section className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm dark:border-violet-400/30 dark:from-violet-400/10 dark:to-slate-950">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-violet-600 text-xl text-white">
                <MdDirectionsWalk />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-violet-800 dark:text-violet-100">
                  {text.dayRoute.indoorTestTitle}
                </p>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                  {text.dayRoute.indoorTestDescription(
                    indoorTestTarget.stop.place.title
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openIndoorTest}
              className="mt-3 w-full rounded-xl bg-violet-600 px-3 py-3 text-sm font-black text-white transition active:scale-[0.99]"
            >
              {text.dayRoute.indoorTestAction}
            </button>
          </section>
        ) : null}
        {sortedDays.map((routeDay, dayPosition) => {
          const routeDayStops = stopsByDayId[routeDay.id] ?? [];
          const previousDay = sortedDays[dayPosition - 1] ?? null;
          const nextDay = sortedDays[dayPosition + 1] ?? null;

          return (
            <DayRouteAccordionItem
              key={routeDay.id}
              routeDay={routeDay}
              isExpanded={expandedDayIds.has(routeDay.id)}
              orderedStops={routeDayStops}
              startLocation={getDayRouteStartLocation(routeDay, routeStartLocation)}
              dailyStartMinutes={dailyStartMinutes}
              isOrderEditing={isOrderEditing}
              activeDropIndex={
                activeDropTarget?.dayId === routeDay.id
                  ? activeDropTarget.index
                  : null
              }
              draggedStopId={draggedStopId}
              visitSavingStopId={visitSavingStopId}
              staySavingStopId={staySavingStopId}
              isReadOnly={isReadOnly}
              canEditVisitTimes={canEditVisitTimes}
              canEditDayStartTime={canEditDayStartTime}
              canEditStartLocation={canEditStartLocation}
              canRecordDayStart={
                canEditDayStartTime &&
                !routeDay.startedAt &&
                (isRetrospectiveCompletion ||
                  (getRouteDateKey(routeDay.date) ?? todayKey) < todayKey)
              }
              canEditVerificationPhoto={canEditVerificationPhoto}
              canToggleVisited={
                canToggleVisitStatus &&
                (isRetrospectiveCompletion ||
                  isVerificationBypassEnabled ||
                  Boolean(routeDay.startedAt))
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
              canDeleteDay={isOrderEditing && sortedDays.length > 1}
              previousDay={previousDay}
              nextDay={nextDay}
              onSelect={handleSelectDay}
              onRequestDeleteDay={handleRequestDeleteDay}
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
              onRegisterDropZone={(index, node) =>
                registerDropZone(routeDay.id, index, node)
              }
              onStartDrag={(stop, fromIndex, event) => {
                startDragStop({
                  dayId: routeDay.id,
                  stop,
                  fromIndex,
                  event,
                });
              }}
              onMoveStopToDay={(stopId, targetDayId) =>
                handleMoveStopToDay(stopId, routeDay.id, targetDayId)
              }
              onRemoveStop={(stopId) =>
                handleRemoveStopFromLayout(routeDay.id, stopId)
              }
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
                void handleOpenStopDirections(routeDay, stop);
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
