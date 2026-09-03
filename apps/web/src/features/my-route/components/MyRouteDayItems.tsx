import { Fragment } from "react";
import {
  MdArrowForward,
  MdCheckCircle,
  MdChevronRight,
  MdFlag,
  MdMyLocation,
  MdOutlinePlace,
} from "react-icons/md";
import {
  getDayCompletedStopCount,
  getDayDateLabel,
  getDayProgressPercent,
  getDaySummary,
  getCurrentRouteStop,
  getRouteDayState,
} from "../routeDisplay";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";
import type { MyRouteDay } from "../types";

type RouteDayState = ReturnType<typeof getRouteDayState>;

function getDayStateLabel(
  day: MyRouteDay,
  dayState: RouteDayState,
  text: UiText
) {
  const completedStopCount = getDayCompletedStopCount(day);
  const isCompleted =
    day.stops.length > 0 && completedStopCount === day.stops.length;

  if (dayState === "past") {
    return isCompleted
      ? text.myRouteCard.completed
      : text.myRouteCard.pastSchedule;
  }

  if (dayState === "today") {
    return text.home.today;
  }

  if (dayState === "upcoming") {
    return text.myRouteCard.scheduled;
  }

  return text.dayRoute.dateUnknown;
}

export function MyRouteDayItem({
  day,
  dayState,
  onSelect,
}: {
  day: MyRouteDay;
  dayState: RouteDayState;
  onSelect: () => void;
}) {
  const text = useUiText();
  const completedStopCount = getDayCompletedStopCount(day);
  const isCompleted =
    day.stops.length > 0 && completedStopCount === day.stops.length;
  const stateLabel = getDayStateLabel(day, dayState, text);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-20 w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 active:scale-[0.99]"
    >
      <span className="flex size-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
        {isCompleted ? (
          <MdCheckCircle className="text-xl" />
        ) : (
          <>
            <span className="font-trip text-xs leading-none">DAY</span>
            <span className="text-sm font-black leading-none">
              {day.dayIndex}
            </span>
          </>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          DAY {day.dayIndex} · {getDaySummary(day, text)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-400">
          <span>
            {getDayDateLabel(day, text)} ·{" "}
            {text.myRouteCard.placeCount(day.stops.length)}
          </span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>{stateLabel}</span>
          {day.stops.length > 0 ? (
            <>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span>
                {text.myRouteCard.completedPlaceCount(
                  completedStopCount,
                  day.stops.length
                )}
              </span>
            </>
          ) : null}
        </div>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg text-white shadow-sm">
        <MdArrowForward />
      </span>
    </button>
  );
}

export function MyRouteDayMiniItem({
  day,
  dayState,
  onSelect,
}: {
  day: MyRouteDay;
  dayState: RouteDayState;
  onSelect: () => void;
}) {
  const text = useUiText();
  const completedStopCount = getDayCompletedStopCount(day);
  const isCompleted =
    day.stops.length > 0 && completedStopCount === day.stops.length;
  const stateLabel = getDayStateLabel(day, dayState, text);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-44 shrink-0 rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100 active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-brand-700 shadow-sm">
          {isCompleted ? (
            <MdCheckCircle className="text-lg" />
          ) : (
            <>
              <span className="font-trip text-[10px] leading-none">DAY</span>
              <span className="text-sm font-black leading-none">
                {day.dayIndex}
              </span>
            </>
          )}
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-base text-white shadow-sm">
          <MdArrowForward />
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-black text-slate-900">
        DAY {day.dayIndex}
      </p>
      <p className="mt-0.5 truncate text-xs font-bold text-slate-500">
        {getDaySummary(day, text)}
      </p>
      <p className="mt-1 truncate text-[11px] font-bold text-slate-400">
        {getDayDateLabel(day, text)} · {stateLabel} · {completedStopCount}/
        {day.stops.length}
      </p>
    </button>
  );
}

function TodayRoutePreview({ day }: { day: MyRouteDay }) {
  const text = useUiText();
  const previewStops = day.stops.slice(0, 4);
  const hiddenStopCount = Math.max(0, day.stops.length - previewStops.length);

  if (previewStops.length === 0) {
    return (
      <div className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-xs font-semibold text-white/80">
        {text.myRouteCard.noVisitsToday}
      </div>
    );
  }

  return (
    <div className="scrollbar-hide mt-3 overflow-x-auto rounded-2xl bg-white/15 px-3 py-2">
      <div className="flex w-max items-center gap-1.5">
        {previewStops.map((stop, index) => (
          <Fragment key={stop.id}>
            <span className="max-w-[8rem] truncate rounded-full bg-slate-950/45 px-2.5 py-1 text-[11px] font-bold text-brand-100 shadow-sm ring-1 ring-white/10">
              {index + 1}. {stop.place.title}
            </span>
            {index < previewStops.length - 1 ? (
              <MdChevronRight className="shrink-0 text-lg text-white/70" />
            ) : null}
          </Fragment>
        ))}
        {hiddenStopCount > 0 ? (
          <span className="rounded-full bg-slate-900/20 px-2.5 py-1 text-[11px] font-bold text-white">
            +{text.myRouteCard.placeCount(hiddenStopCount)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TodayCurrentStopCard({ day }: { day: MyRouteDay }) {
  const text = useUiText();
  const currentStop = getCurrentRouteStop(day);
  const isCheckedIn = Boolean(currentStop?.checkedInAt);

  if (!currentStop) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-950/35 px-3 py-2.5 text-white shadow-sm ring-1 ring-white/10">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-400/15 text-xl text-brand-100">
          <MdCheckCircle />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-brand-100">
            {text.myRouteCard.completed}
          </p>
          <p className="truncate text-sm font-black">
            {text.myRouteCard.todayRouteCompleted}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-950/35 px-3 py-2.5 text-white shadow-sm ring-1 ring-white/10">
      <div className="size-10 shrink-0 overflow-hidden rounded-2xl bg-brand-400/15">
        {currentStop.place.imageUrl ? (
          <img
            src={currentStop.place.imageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl text-brand-600">
            <MdOutlinePlace />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-[11px] font-bold text-brand-700">
          {isCheckedIn ? (
            <MdMyLocation className="text-sm" />
          ) : (
            <MdFlag className="text-sm" />
          )}
          {isCheckedIn
            ? text.dayRoute.visiting
            : text.dayRoute.currentDestination}
        </p>
        <p className="truncate text-sm font-black text-white">
          {currentStop.place.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-white/70">
          {localizePlaceCategoryLabel(
            currentStop.place.categoryLabel ?? currentStop.place.categoryName,
            text
          )}
        </p>
      </div>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg text-white shadow-sm">
        <MdArrowForward />
      </span>
    </div>
  );
}

export function TodayRouteDayCard({
  day,
  onSelect,
}: {
  day: MyRouteDay;
  onSelect: () => void;
}) {
  const text = useUiText();
  const completedStopCount = getDayCompletedStopCount(day);
  const progressPercent = getDayProgressPercent(day);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-500 p-3 text-left text-white shadow-lg shadow-brand-600/20 transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-slate-950/45 text-brand-100 shadow-sm ring-1 ring-white/10">
            <span className="font-trip text-xs leading-none">DAY</span>
            <span className="text-lg font-black leading-none">
              {day.dayIndex}
            </span>
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-slate-950/45 px-2.5 py-1 text-[11px] font-black text-brand-100 shadow-sm ring-1 ring-white/10">
                {text.home.today}
              </span>
              <span className="text-xs font-bold text-white/80">
                {getDayDateLabel(day, text)}
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-base font-black">
              DAY {day.dayIndex} · {getDaySummary(day, text)}
            </h3>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-slate-950/20 px-2.5 py-1 text-[11px] font-black text-white">
          {text.myRouteCard.todaySchedule}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs font-bold text-white/85">
          <span>{text.myRouteCard.todayProgress}</span>
          <span>
            {text.myRouteCard.completedPlaceCount(
              completedStopCount,
              day.stops.length
            )}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
          <div
            className="h-full rounded-full bg-brand-100/85"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <TodayRoutePreview day={day} />
      <TodayCurrentStopCard day={day} />
    </button>
  );
}
