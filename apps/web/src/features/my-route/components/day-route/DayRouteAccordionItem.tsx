import { useMemo, type PointerEvent as ReactPointerEvent } from "react";
import {
  MdCheckCircle,
  MdDirectionsCar,
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
};

const DEFAULT_ROUTE_DAY_START_MINUTES = 9 * 60;

function getStopStayMinutes(stop: MyRouteStop) {
  return stop.stayMinutes ?? 60;
}

function getStopTravelMinutes(
  stop: MyRouteStop,
  index: number,
  startLocation: MyRoute["startLocation"]
) {
  if (index === 0 && !startLocation) {
    return 0;
  }

  return Math.max(0, stop.travelMinutesFromPrevious ?? 0);
}

function buildRouteStopSchedules(
  stops: MyRouteStop[],
  startLocation: MyRoute["startLocation"]
) {
  let currentMinutes = DEFAULT_ROUTE_DAY_START_MINUTES;

  return stops.map((stop, index): RouteStopSchedule => {
    currentMinutes += getStopTravelMinutes(stop, index, startLocation);

    const startMinutes = currentMinutes;
    const endMinutes = startMinutes + getStopStayMinutes(stop);
    currentMinutes = endMinutes;

    return {
      startMinutes,
      endMinutes,
    };
  });
}

function formatRouteStopSchedule(schedule: RouteStopSchedule, text: UiText) {
  return `${formatClock(schedule.startMinutes, text)}-${formatClock(
    schedule.endMinutes,
    text
  )}`;
}

function getDayStartTitle(
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"],
  text: UiText
) {
  if (startLocation) {
    return text.dayRoute.savedStartLocation;
  }

  return dayStops[0]?.place.title ?? text.dayRoute.noStartPlace;
}

function getDayStartDescription(
  routeDay: MyRouteDay,
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"],
  text: UiText
) {
  if (startLocation) {
    return text.dayRoute.startFromMapDescription(routeDay.dayIndex);
  }

  if (dayStops[0]) {
    return text.dayRoute.startFromFirstPlaceDescription(routeDay.dayIndex);
  }

  return text.dayRoute.emptyStartDescription;
}

type DayRouteAccordionItemProps = {
  routeDay: MyRouteDay;
  isExpanded: boolean;
  orderedStops: MyRouteStop[];
  startLocation: MyRoute["startLocation"];
  isOrderEditing: boolean;
  activeDropIndex: number | null;
  draggedStopId: string | null;
  visitSavingStopId: string | null;
  staySavingStopId: string | null;
  isReadOnly: boolean;
  canToggleVisited: boolean;
  enableVerificationPhotoPreview: boolean;
  travelSegmentByKey: Record<string, TravelSegmentState>;
  onSelect: (day: MyRouteDay) => void;
  onRegisterDropZone: (index: number, node: HTMLDivElement | null) => void;
  onStartDrag: (
    stop: MyRouteStop,
    fromIndex: number,
    event: ReactPointerEvent<HTMLButtonElement>
  ) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
  onOpenVerificationPhoto: (target: VerificationPhotoPreviewTarget) => void;
};

function DayRouteAccordionItem({
  routeDay,
  isExpanded,
  orderedStops,
  startLocation,
  isOrderEditing,
  activeDropIndex,
  draggedStopId,
  visitSavingStopId,
  staySavingStopId,
  isReadOnly,
  canToggleVisited,
  enableVerificationPhotoPreview,
  travelSegmentByKey,
  onSelect,
  onRegisterDropZone,
  onStartDrag,
  onRequestStayMinutesEdit,
  onToggleVisited,
  onOpenPlace,
  onOpenVerificationPhoto,
}: DayRouteAccordionItemProps) {
  const text = useUiText();
  const dayStops = orderedStops;
  const hasDayStops = dayStops.length > 0;
  const stopSchedules = useMemo(
    () => buildRouteStopSchedules(dayStops, startLocation),
    [dayStops, startLocation]
  );
  const firstStopSchedule = stopSchedules[0] ?? null;
  const lastStopSchedule = stopSchedules.at(-1) ?? null;
  const totalScheduleMinutes = lastStopSchedule
    ? lastStopSchedule.endMinutes - DEFAULT_ROUTE_DAY_START_MINUTES
    : 0;
  const dayStartTitle = getDayStartTitle(dayStops, startLocation, text);
  const dayStartDescription = getDayStartDescription(
    routeDay,
    dayStops,
    startLocation,
    text
  );
  const firstStop = dayStops[0] ?? null;
  const getFallbackTravelSegment = (
    from: RouteLatLng | null | undefined,
    to: RouteLatLng | null | undefined
  ) => {
    const key = getTravelSegmentKey(from, to);

    return key ? (travelSegmentByKey[key] ?? { status: "loading" }) : null;
  };
  const firstTravelSegment =
    getStoredTravelSegment(firstStop) ??
    (firstStop ? getFallbackTravelSegment(startLocation, firstStop.place) : null);
  const completedStopCount = dayStops.filter(isVisitedStop).length;
  const startLabel = startLocation ? text.dayRoute.start : text.dayRoute.firstPlace;
  const startTitlePrefix = startLocation ? "START" : text.dayRoute.firstPlace;
  const progressPercent = hasDayStops
    ? Math.round((completedStopCount / dayStops.length) * 100)
    : 0;
  const isDayCleared = hasDayStops && completedStopCount === dayStops.length;

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
                {getLocalizedDaySummary(routeDay, text)}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-brand-700">
                <MdMyLocation className="shrink-0 text-sm" />
                <span className="truncate">
                  {startLabel}: {dayStartTitle}
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
      </div>

      {isExpanded ? (
        <div className="route-day-accordion-enter border-t border-brand-100 px-4 py-4">
          <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-brand-700">
                <MdMyLocation />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-brand-700">
                  {startTitlePrefix} · {dayStartTitle}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                  {dayStartDescription}
                </p>
                {firstTravelSegment ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700">
                    <MdDirectionsCar className="text-sm" />
                    {text.dayRoute.firstPlaceTravel(
                      getTravelSegmentLabel(firstTravelSegment, text)
                    )}
                  </p>
                ) : startLocation || !hasDayStops ? null : (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
                    <MdDirectionsCar className="text-sm" />
                    {text.dayRoute.noStartGps}
                  </p>
                )}
              </div>
            </div>
          </div>

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
                      {formatClock(DEFAULT_ROUTE_DAY_START_MINUTES, text)}
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
                      {text.dayRoute.totalDuration}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatTravelMinutes(totalScheduleMinutes, text)}
                    </p>
                  </div>
                </div>
              ) : null}
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
                    canToggleVisited={canToggleVisited}
                    enableVerificationPhotoPreview={
                      enableVerificationPhotoPreview
                    }
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
                    onStartDrag={(event) => onStartDrag(stop, index, event)}
                    onRequestStayMinutesEdit={onRequestStayMinutesEdit}
                    onToggleVisited={onToggleVisited}
                    onOpenPlace={onOpenPlace}
                    onOpenVerificationPhoto={(selectedStop) =>
                      onOpenVerificationPhoto({
                        routeDay,
                        stop: selectedStop,
                      })
                    }
                  />
                </div>
              ))}
              {isOrderEditing && activeDropIndex === dayStops.length ? (
                <div className="rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                  {text.dayRoute.dropToEnd}
                </div>
              ) : null}
            </>
          ) : (
            <PotatoLoadingCard
              title={text.dayRoute.emptyDayTitle}
              description={text.dayRoute.emptyDayDescription}
              animation="empty"
              compact
              className="shadow-sm"
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

export default DayRouteAccordionItem;
