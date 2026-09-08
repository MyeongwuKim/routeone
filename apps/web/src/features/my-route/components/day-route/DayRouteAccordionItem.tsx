import { type PointerEvent as ReactPointerEvent } from "react";
import {
  MdAccessTime,
  MdCheckCircle,
  MdDirectionsCar,
  MdDeleteOutline,
  MdEdit,
  MdExpandMore,
  MdMyLocation,
} from "react-icons/md";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { useUiText, type UiText } from "@/lib/uiText";
import { isVisitedStop } from "../../routeDisplay";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../../types";
import type { VerificationPhotoPreviewTarget } from "../../models/dayRouteDialogTypes";
import {
  formatClock,
  formatTravelMinutes,
  getLocalizedDayDateLabel,
  getLocalizedDaySummary,
  getTravelSegmentLabel,
} from "../../utils/dayRouteFormatting";
import RouteStopNode from "./RouteStopNode";
import {
  getStoredTravelSegment,
  getTravelSegmentKey,
  type RouteLatLng,
  type TravelSegmentState,
} from "../../hooks/useDayRouteTravelSegments";

type RouteStopSchedule = {
  startMinutes: number;
  endMinutes: number;
  kind: "actual" | "ongoing" | "estimated";
};

const DEFAULT_ROUTE_DAY_START_MINUTES = 9 * 60;

function getStopStayMinutes(stop: MyRouteStop) {
  return stop.stayMinutes ?? 60;
}

function getDateTimeClockMinutes(
  value: string | null,
  referenceMinutes: number
) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  let minutes = date.getHours() * 60 + date.getMinutes();

  while (minutes < referenceMinutes - 12 * 60) {
    minutes += 24 * 60;
  }

  return minutes;
}

function getStopTravelMinutes(
  stop: MyRouteStop,
  index: number,
  startLocation: MyRoute["startLocation"],
  firstTravelMinutes: number | null
) {
  if (index === 0 && !startLocation) {
    return 0;
  }

  if (index === 0 && firstTravelMinutes != null) {
    return firstTravelMinutes;
  }

  return Math.max(0, stop.travelMinutesFromPrevious ?? 0);
}

function buildRouteStopSchedules(
  stops: MyRouteStop[],
  startLocation: MyRoute["startLocation"],
  dailyStartMinutes: number,
  firstTravelMinutes: number | null
) {
  let currentMinutes = dailyStartMinutes;

  return stops.map((stop, index): RouteStopSchedule => {
    const actualEndMinutes = getDateTimeClockMinutes(
      stop.checkedOutAt ?? stop.visitedAt,
      currentMinutes
    );
    const checkedInMinutes = getDateTimeClockMinutes(
      stop.checkedInAt,
      actualEndMinutes ?? currentMinutes
    );

    if (isVisitedStop(stop) && actualEndMinutes != null) {
      const actualStartMinutes =
        checkedInMinutes ??
        (stop.actualStayMinutes
          ? actualEndMinutes - stop.actualStayMinutes
          : null);

      if (actualStartMinutes != null) {
        currentMinutes = actualEndMinutes;

        return {
          startMinutes: actualStartMinutes,
          endMinutes: actualEndMinutes,
          kind: "actual",
        };
      }
    }

    if (!isVisitedStop(stop) && checkedInMinutes != null) {
      const endMinutes = checkedInMinutes + getStopStayMinutes(stop);
      currentMinutes = endMinutes;

      return {
        startMinutes: checkedInMinutes,
        endMinutes,
        kind: "ongoing",
      };
    }

    currentMinutes += getStopTravelMinutes(
      stop,
      index,
      startLocation,
      firstTravelMinutes
    );

    const startMinutes = currentMinutes;
    const endMinutes = startMinutes + getStopStayMinutes(stop);
    currentMinutes = endMinutes;

    return {
      startMinutes,
      endMinutes,
      kind: "estimated",
    };
  });
}

function formatRouteStopSchedule(schedule: RouteStopSchedule, text: UiText) {
  const start = formatClock(schedule.startMinutes, text);
  const end = formatClock(schedule.endMinutes, text);

  if (schedule.kind === "actual") {
    return text.dayRoute.actualTimeRange(start, end);
  }

  if (schedule.kind === "ongoing") {
    return text.dayRoute.ongoingTimeRange(start);
  }

  return text.dayRoute.estimatedTimeRange(start, end);
}

type DayRouteAccordionItemProps = {
  routeDay: MyRouteDay;
  isExpanded: boolean;
  orderedStops: MyRouteStop[];
  startLocation: MyRoute["startLocation"];
  dailyStartMinutes: MyRoute["dailyStartMinutes"];
  isOrderEditing: boolean;
  activeDropIndex: number | null;
  draggedStopId: string | null;
  visitSavingStopId: string | null;
  staySavingStopId: string | null;
  isReadOnly: boolean;
  canEditVisitTimes: boolean;
  canEditDayStartTime: boolean;
  canEditStartLocation: boolean;
  canRecordDayStart: boolean;
  canEditVerificationPhoto: boolean;
  canToggleVisited: boolean;
  isVisitDateAllowed: boolean;
  showActiveDestination: boolean;
  enableVerificationPhotoPreview: boolean;
  isGpsTestEnabled: boolean;
  gpsTestLocationStopId: string | null;
  focusedStopId: string | null;
  travelSegmentByKey: Record<string, TravelSegmentState>;
  canDeleteDay: boolean;
  previousDay: MyRouteDay | null;
  nextDay: MyRouteDay | null;
  onSelect: (day: MyRouteDay) => void;
  onRequestDeleteDay: (day: MyRouteDay) => void;
  onRequestPlannedStartEdit: (day: MyRouteDay) => void;
  onRequestActualStartEdit: (day: MyRouteDay) => void;
  onRequestStartLocationEdit: (day: MyRouteDay) => void;
  onRegisterDropZone: (index: number, node: HTMLDivElement | null) => void;
  onStartDrag: (
    stop: MyRouteStop,
    fromIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onMoveStopToDay: (stopId: string, targetDayId: string) => void;
  onRemoveStop: (stopId: string) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onRequestVisitTimesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
  onOpenDirections: (stop: MyRouteStop) => void;
  onEditVerificationPhoto: (stop: MyRouteStop) => void;
  onOpenGpsTest: (stop: MyRouteStop) => void;
  onOpenVerificationPhoto: (target: VerificationPhotoPreviewTarget) => void;
};

function DayRouteAccordionItem({
  routeDay,
  isExpanded,
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
  canRecordDayStart,
  canEditVerificationPhoto,
  canToggleVisited,
  isVisitDateAllowed,
  showActiveDestination,
  enableVerificationPhotoPreview,
  isGpsTestEnabled,
  gpsTestLocationStopId,
  focusedStopId,
  travelSegmentByKey,
  canDeleteDay,
  previousDay,
  nextDay,
  onSelect,
  onRequestDeleteDay,
  onRequestPlannedStartEdit,
  onRequestActualStartEdit,
  onRequestStartLocationEdit,
  onRegisterDropZone,
  onStartDrag,
  onMoveStopToDay,
  onRemoveStop,
  onRequestStayMinutesEdit,
  onRequestVisitTimesEdit,
  onToggleVisited,
  onOpenPlace,
  onOpenDirections,
  onEditVerificationPhoto,
  onOpenGpsTest,
  onOpenVerificationPhoto,
}: DayRouteAccordionItemProps) {
  const text = useUiText();
  const dayStops = orderedStops;
  const hasDayStops = dayStops.length > 0;
  const firstStop = dayStops[0] ?? null;
  const getFallbackTravelSegment = (
    from: RouteLatLng | null | undefined,
    to: RouteLatLng | null | undefined
  ) => {
    const key = getTravelSegmentKey(from, to);

    return key ? (travelSegmentByKey[key] ?? { status: "loading" }) : null;
  };
  const firstTravelSegment = startLocation
    ? getFallbackTravelSegment(startLocation, firstStop?.place)
    : getStoredTravelSegment(firstStop);
  const firstTravelMinutes =
    firstTravelSegment?.status === "success" ||
    firstTravelSegment?.status === "fallback"
      ? firstTravelSegment.minutes
      : null;
  const plannedDayStartMinutes =
    typeof routeDay.plannedStartMinutes === "number"
      ? routeDay.plannedStartMinutes
      : typeof dailyStartMinutes === "number"
        ? dailyStartMinutes
        : DEFAULT_ROUTE_DAY_START_MINUTES;
  const actualDayStartMinutes = getDateTimeClockMinutes(
    routeDay.startedAt,
    plannedDayStartMinutes
  );
  const routeDayStartMinutes =
    actualDayStartMinutes ?? plannedDayStartMinutes;
  const stopSchedules = buildRouteStopSchedules(
    dayStops,
    startLocation,
    routeDayStartMinutes,
    firstTravelMinutes
  );
  const firstStopSchedule = stopSchedules[0] ?? null;
  const lastStopSchedule = stopSchedules.at(-1) ?? null;
  const scheduleStartMinutes =
    firstStopSchedule?.kind === "actual" ||
    firstStopSchedule?.kind === "ongoing"
      ? firstStopSchedule.startMinutes
      : routeDayStartMinutes;
  const totalScheduleMinutes = lastStopSchedule
    ? Math.max(0, lastStopSchedule.endMinutes - scheduleStartMinutes)
    : 0;
  const dayStartTitle = firstStop?.place.title ?? text.dayRoute.noStartPlace;
  const firstTravelLabel = firstTravelSegment
    ? getTravelSegmentLabel(firstTravelSegment, text)
    : null;
  const firstTravelSummary =
    firstTravelLabel &&
    firstTravelSegment?.status !== "loading" &&
    firstTravelSegment?.status !== "error"
      ? text.dayRoute.firstPlaceTravel(firstTravelLabel)
      : firstTravelLabel;
  const completedStopCount = dayStops.filter(isVisitedStop).length;
  const startTitlePrefix = startLocation ? "START" : text.dayRoute.firstPlace;
  const progressPercent = hasDayStops
    ? Math.round((completedStopCount / dayStops.length) * 100)
    : 0;
  const isDayCleared = hasDayStops && completedStopCount === dayStops.length;
  const activeDestinationStopId = showActiveDestination
    ? (dayStops.find((stop) => !isVisitedStop(stop))?.id ?? null)
    : null;
  const hasActualStart = actualDayStartMinutes != null;
  const hasActualEnd =
    isDayCleared && lastStopSchedule?.kind === "actual";
  const startRouteCard = (
    <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-brand-700">
          <MdMyLocation />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-brand-700">
            {startTitlePrefix}
            {startLocation && firstStop
              ? ` → ${dayStartTitle}`
              : ` · ${dayStartTitle}`}
          </p>
          {firstTravelSummary ? (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700">
              <MdDirectionsCar className="text-sm" />
              {firstTravelSummary}
            </p>
          ) : startLocation || !hasDayStops ? null : (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
              <MdDirectionsCar className="text-sm" />
              {text.dayRoute.noStartGps}
            </p>
          )}
        </div>
        {canEditStartLocation ? (
          <button
            type="button"
            aria-label={`DAY ${routeDay.dayIndex} ${text.dayRoute.editStartLocationAria}`}
            onClick={() => onRequestStartLocationEdit(routeDay)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-200 bg-white px-3 py-2 text-[11px] font-black text-brand-700"
          >
            <MdEdit className="text-sm" />
            {startLocation ? text.common.edit : text.dayRoute.setStartLocation}
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    <section
      className={`overflow-hidden rounded-2xl border transition ${
        isExpanded
          ? "border-brand-200 bg-white shadow-sm"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => onSelect(routeDay)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                isDayCleared
                  ? "bg-brand-600 text-white"
                  : isExpanded
                    ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                    : "bg-white text-slate-500 ring-1 ring-slate-200"
              }`}
            >
              {isDayCleared ? (
                <MdCheckCircle className="text-xl" />
              ) : (
                routeDay.dayIndex
              )}
            </div>
            <div className="min-w-0">
              <p className="font-trip text-sm text-slate-900">
                DAY {routeDay.dayIndex}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                {getLocalizedDayDateLabel(routeDay, text)} ·{" "}
                {getLocalizedDaySummary(
                  { ...routeDay, stops: dayStops },
                  text
                )}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-brand-700">
                <MdMyLocation className="shrink-0 text-sm" />
                <span className="truncate">
                  {startLocation
                    ? `START → ${dayStartTitle}${firstTravelSummary ? ` · ${firstTravelSummary}` : ""}`
                    : `${text.dayRoute.firstPlace}: ${dayStartTitle}`}
                </span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
                isDayCleared
                  ? "bg-brand-600 text-white"
                  : "bg-white text-brand-700 ring-1 ring-brand-100"
              }`}
            >
              {completedStopCount}/{dayStops.length}
            </span>
            <MdExpandMore
              className={`text-xl text-brand-700 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </div>
        </button>
        {canDeleteDay ? (
          <button
            type="button"
            aria-label={`DAY ${routeDay.dayIndex} 삭제`}
            onClick={() => onRequestDeleteDay(routeDay)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition active:scale-95"
          >
            <MdDeleteOutline />
          </button>
        ) : null}
      </div>

      {isExpanded ? (
        <div className="route-day-accordion-enter border-t border-brand-100 px-4 py-4">
          {hasDayStops ? (
            <>
              <div
                className={`mb-4 rounded-2xl border px-4 py-3 ${
                  isDayCleared
                    ? "border-brand-200 bg-brand-600 text-white"
                    : "border-brand-100 bg-brand-50 text-brand-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-trip text-sm">
                      {isDayCleared ? "DAY CLEAR" : `DAY ${routeDay.dayIndex}`}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-bold ${
                        isDayCleared ? "text-white/85" : "text-brand-700"
                      }`}
                    >
                      {isDayCleared
                        ? text.dayRoute.allPlacesCompleted
                        : text.dayRoute.remainingPlaces(
                            dayStops.length - completedStopCount
                          )}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-brand-700">
                    {completedStopCount}/{dayStops.length}
                  </span>
                </div>
                <div
                  className={`mt-3 h-2 overflow-hidden rounded-full ${
                    isDayCleared ? "bg-white/25" : "bg-white"
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      isDayCleared ? "bg-white" : "bg-brand-600"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canEditDayStartTime && !hasActualStart ? (
                    <button
                      type="button"
                      aria-label={text.dayRoute.editPlannedStartAria(
                        routeDay.dayIndex
                      )}
                      onClick={() => onRequestPlannedStartEdit(routeDay)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700"
                    >
                      <MdAccessTime className="text-sm" />
                      {text.dayRoute.plannedDeparture}{" "}
                      {formatClock(plannedDayStartMinutes, text)}
                      <MdEdit className="text-xs" />
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700">
                      <MdAccessTime className="text-sm" />
                      {text.dayRoute.plannedDeparture}{" "}
                      {formatClock(plannedDayStartMinutes, text)}
                    </span>
                  )}
                  {hasActualStart ? (
                    canEditDayStartTime ? (
                      <button
                        type="button"
                        aria-label={text.dayRoute.editActualStartAria(
                          routeDay.dayIndex
                        )}
                        onClick={() => onRequestActualStartEdit(routeDay)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700"
                      >
                        <MdMyLocation className="text-sm" />
                        {text.dayRoute.actualStart}{" "}
                        {formatClock(actualDayStartMinutes, text)}
                        <MdEdit className="text-xs" />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700">
                        <MdMyLocation className="text-sm" />
                        {text.dayRoute.actualStart}{" "}
                        {formatClock(actualDayStartMinutes, text)}
                      </span>
                    )
                  ) : canRecordDayStart ? (
                    <button
                      type="button"
                      onClick={() => onRequestActualStartEdit(routeDay)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700"
                    >
                      <MdEdit className="text-xs" />
                      {text.dayRoute.recordActualStart}
                    </button>
                  ) : null}
                </div>
              </div>

              {isOrderEditing ? (
                <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
                  {text.dayRoute.dragGuide}
                </div>
              ) : null}
              {firstStopSchedule && lastStopSchedule ? (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {text.dayRoute.expectedStart}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatClock(routeDayStartMinutes, text)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {text.dayRoute.expectedEnd}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatClock(lastStopSchedule.endMinutes, text)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {hasActualEnd
                        ? text.dayRoute.actualTotalDuration
                        : text.dayRoute.totalDuration}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatTravelMinutes(totalScheduleMinutes, text)}
                    </p>
                  </div>
                </div>
              ) : null}
              {startRouteCard}
              {dayStops.map((stop, index) => (
                <div
                  key={stop.id}
                  ref={(node) => onRegisterDropZone(index, node)}
                  className="relative"
                >
                  {isOrderEditing && activeDropIndex === index ? (
                    <div className="mb-2 rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                      {text.dayRoute.dropHere}
                    </div>
                  ) : null}
                  <RouteStopNode
                    stop={stop}
                    index={index}
                    isLast={index === dayStops.length - 1}
                    isOrderEditing={isOrderEditing}
                    isDragging={draggedStopId === stop.id}
                    isVisitSaving={visitSavingStopId === stop.id}
                    isStaySaving={staySavingStopId === stop.id}
                    isReadOnly={isReadOnly}
                    isActiveDestination={activeDestinationStopId === stop.id}
                    canToggleVisited={
                      canToggleVisited &&
                      (isVisitDateAllowed ||
                        (isGpsTestEnabled &&
                          gpsTestLocationStopId === stop.id))
                    }
                    enableVerificationPhotoPreview={
                      enableVerificationPhotoPreview
                    }
                    isGpsTestEnabled={isGpsTestEnabled}
                    isGpsTestLocationActive={
                      gpsTestLocationStopId === stop.id
                    }
                    isNotificationFocused={focusedStopId === stop.id}
                    travelSegmentToNext={
                      getStoredTravelSegment(dayStops[index + 1]) ??
                      (dayStops[index + 1]
                        ? getFallbackTravelSegment(
                            stop.place,
                            dayStops[index + 1].place
                          )
                        : null)
                    }
                    scheduleLabel={
                      stopSchedules[index]
                        ? formatRouteStopSchedule(stopSchedules[index], text)
                        : null
                    }
                    canEditVisitTimes={canEditVisitTimes}
                    canEditVerificationPhoto={canEditVerificationPhoto}
                    previousDayIndex={previousDay?.dayIndex ?? null}
                    nextDayIndex={nextDay?.dayIndex ?? null}
                    onStartDrag={(event) => onStartDrag(stop, index, event)}
                    onMoveToPreviousDay={
                      previousDay
                        ? () => onMoveStopToDay(stop.id, previousDay.id)
                        : undefined
                    }
                    onMoveToNextDay={
                      nextDay
                        ? () => onMoveStopToDay(stop.id, nextDay.id)
                        : undefined
                    }
                    onRemoveFromRoute={() => onRemoveStop(stop.id)}
                    onRequestStayMinutesEdit={onRequestStayMinutesEdit}
                    onRequestVisitTimesEdit={onRequestVisitTimesEdit}
                    onToggleVisited={onToggleVisited}
                    onOpenPlace={onOpenPlace}
                    onOpenDirections={onOpenDirections}
                    onEditVerificationPhoto={onEditVerificationPhoto}
                    onOpenGpsTest={onOpenGpsTest}
                    onOpenVerificationPhoto={(selectedStop) =>
                      onOpenVerificationPhoto({
                        routeDay,
                        stop: selectedStop,
                      })
                    }
                  />
                </div>
              ))}
              {isOrderEditing ? (
                <div
                  ref={(node) => onRegisterDropZone(dayStops.length, node)}
                  className="min-h-8"
                >
                  {activeDropIndex === dayStops.length ? (
                    <div className="rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                      {text.dayRoute.dropToEnd}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {startRouteCard}
              <PotatoLoadingCard
                title={text.dayRoute.emptyDayTitle}
                description={text.dayRoute.emptyDayDescription}
                animation="empty"
                compact
                className="shadow-sm"
              />
              {isOrderEditing ? (
                <div
                  ref={(node) => onRegisterDropZone(0, node)}
                  className={`mt-3 rounded-2xl border border-dashed px-3 py-3 text-center text-xs font-black ${
                    activeDropIndex === 0
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-brand-200 bg-white text-brand-500"
                  }`}
                >
                  {text.dayRoute.dropHere}
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

export default DayRouteAccordionItem;
