import {
  MdAdd,
  MdArrowForward,
  MdDeleteOutline,
  MdEventAvailable,
  MdOutlineCalendarToday,
  MdOutlinePlace,
  MdRoute,
} from "react-icons/md";
import {
  MyRouteDayItem,
  MyRouteDayMiniItem,
  TodayRouteDayCard,
} from "./MyRouteDayItems";
import {
  formatRouteDate,
  getRouteDayState,
  getRouteTimelineLabel,
  getSelectableRouteDay,
  getRouteSubtitle,
  getRouteTitle,
  getSortedRouteDays,
  getTodayDateKey,
  getTodayRouteDay,
} from "../routeDisplay";
import type { MyRoute, MyRouteDay } from "../types";

type MyRouteCardProps = {
  route: MyRoute;
  variant?: "featured" | "compact" | "upcoming";
  hideTimelineBadge?: boolean;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestAppendDay?: (route: MyRoute) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
};

function MyRouteUpcomingCard({
  route,
  todayKey,
  onSelectDay,
  onRequestDeleteRoute,
}: {
  route: MyRoute;
  todayKey: string;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
}) {
  const selectableDay = getSelectableRouteDay(route, todayKey);
  const startDateLabel = formatRouteDate(route.travelStartDate) ?? "미정";

  return (
    <article className="w-full overflow-hidden rounded-2xl border border-brand-100 bg-white text-left shadow-sm transition hover:border-brand-200">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (selectableDay) {
              onSelectDay(route, selectableDay);
            }
          }}
          disabled={!selectableDay}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99] disabled:cursor-default"
        >
          <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <span className="text-[10px] font-black leading-none">START</span>
            <span className="mt-1 text-sm font-black leading-none">
              {startDateLabel}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">
              {getRouteTitle(route)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <MdEventAvailable className="text-sm text-brand-600" />
              {getRouteTimelineLabel(route, todayKey)}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg text-white shadow-sm">
            <MdArrowForward />
          </span>
        </button>
        {onRequestDeleteRoute ? (
          <button
            type="button"
            aria-label={`${getRouteTitle(route)} 삭제`}
            onClick={() => onRequestDeleteRoute(route)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-lg text-rose-500 transition hover:bg-rose-50 active:scale-95"
          >
            <MdDeleteOutline />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-brand-50 bg-brand-50/60 px-4 py-2 text-[11px] font-bold text-slate-500">
        <span>{getRouteSubtitle(route)}</span>
        <span className="h-1 w-1 rounded-full bg-slate-300" />
        <span>DAY {route.tripDays}</span>
      </div>
    </article>
  );
}

function MyRouteCompactCard({
  route,
  todayKey,
  hideTimelineBadge,
  onSelectDay,
  onRequestDeleteRoute,
}: {
  route: MyRoute;
  todayKey: string;
  hideTimelineBadge?: boolean;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
}) {
  const selectableDay = getSelectableRouteDay(route, todayKey);
  const progressPercent =
    route.totalStopCount > 0
      ? Math.round((route.completedStopCount / route.totalStopCount) * 100)
      : 0;

  return (
    <article className="w-full rounded-2xl border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition hover:border-brand-200 hover:bg-brand-50/40">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (selectableDay) {
              onSelectDay(route, selectableDay);
            }
          }}
          disabled={!selectableDay}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition active:scale-[0.99] disabled:cursor-default disabled:opacity-70"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700">
            <MdRoute />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {hideTimelineBadge ? null : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-600">
                  {getRouteTimelineLabel(route, todayKey)}
                </span>
              )}
              <span className="text-xs font-bold text-slate-400">
                {route.totalStopCount}곳
              </span>
            </div>
            <p className="mt-1.5 truncate text-sm font-black text-slate-900">
              {getRouteTitle(route)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <MdOutlineCalendarToday className="text-sm" />
              {getRouteSubtitle(route)}
            </p>
          </div>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg text-white shadow-sm">
            <MdArrowForward />
          </span>
        </button>
        {onRequestDeleteRoute ? (
          <button
            type="button"
            aria-label={`${getRouteTitle(route)} 삭제`}
            onClick={() => onRequestDeleteRoute(route)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-white text-lg text-rose-500 transition hover:bg-rose-50 active:scale-95"
          >
            <MdDeleteOutline />
          </button>
        ) : null}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </article>
  );
}

function MyRouteCard({
  route,
  variant = "featured",
  hideTimelineBadge = false,
  onSelectDay,
  onRequestAppendDay,
  onRequestDeleteRoute,
}: MyRouteCardProps) {
  const todayKey = getTodayDateKey();

  if (variant === "upcoming") {
    return (
      <MyRouteUpcomingCard
        route={route}
        todayKey={todayKey}
        onSelectDay={onSelectDay}
        onRequestDeleteRoute={onRequestDeleteRoute}
      />
    );
  }

  if (variant === "compact") {
    return (
      <MyRouteCompactCard
        route={route}
        todayKey={todayKey}
        hideTimelineBadge={hideTimelineBadge}
        onSelectDay={onSelectDay}
        onRequestDeleteRoute={onRequestDeleteRoute}
      />
    );
  }

  const todayRouteDay = getTodayRouteDay(route, todayKey);
  const sortedDays = getSortedRouteDays(route);
  const visibleDays = todayRouteDay
    ? sortedDays.filter((day) => day.id !== todayRouteDay.id).slice(0, 3)
    : sortedDays.slice(0, 4);
  const visibleDayCount = visibleDays.length + (todayRouteDay ? 1 : 0);
  const extraDayCount = Math.max(0, route.tripDays - visibleDayCount);
  const statusLabel = getRouteTimelineLabel(route, todayKey);

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white p-4 shadow-sm ${
        todayRouteDay
          ? "border-brand-300 shadow-brand-100"
          : "border-brand-100"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {hideTimelineBadge ? null : (
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  todayRouteDay
                    ? "bg-brand-600 text-white"
                    : "bg-brand-50 text-brand-700"
                }`}
              >
                {statusLabel}
              </span>
            )}
            <span className="text-xs font-semibold text-slate-400">
              {route.totalStopCount}곳
            </span>
          </div>
          <h2 className="mt-2 truncate text-base font-bold text-slate-900">
            {getRouteTitle(route)}
          </h2>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
            <MdOutlineCalendarToday className="text-sm" />
            {getRouteSubtitle(route)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRequestDeleteRoute ? (
            <button
              type="button"
              aria-label={`${getRouteTitle(route)} 삭제`}
              onClick={() => onRequestDeleteRoute(route)}
              className="flex size-9 items-center justify-center rounded-full border border-rose-100 bg-white text-lg text-rose-500 transition hover:bg-rose-50 active:scale-95"
            >
              <MdDeleteOutline />
            </button>
          ) : null}
          <span
            className={`flex size-10 items-center justify-center rounded-full text-xl text-white ${
              todayRouteDay ? "bg-slate-900" : "bg-brand-600"
            }`}
          >
            <MdRoute />
          </span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {todayRouteDay ? (
          <TodayRouteDayCard
            day={todayRouteDay}
            onSelect={() => onSelectDay(route, todayRouteDay)}
          />
        ) : null}

        {todayRouteDay && (visibleDays.length > 0 || onRequestAppendDay) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1 pt-1">
              <p className="text-xs font-black text-slate-500">나머지 Day</p>
              <p className="text-[11px] font-bold text-slate-400">
                좌우로 넘겨보기
              </p>
            </div>
            <div className="scrollbar-hide -mx-1 overflow-x-auto px-1">
              <div className="flex w-max gap-2 pr-1">
                {visibleDays.map((day) => (
                  <MyRouteDayMiniItem
                    key={day.id}
                    day={day}
                    dayState={getRouteDayState(day, todayKey)}
                    onSelect={() => onSelectDay(route, day)}
                  />
                ))}
                {onRequestAppendDay ? (
                  <button
                    type="button"
                    onClick={() => onRequestAppendDay(route)}
                    className="flex w-36 shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-3 py-3 text-xs font-black text-brand-700 transition hover:bg-brand-100 active:scale-[0.99]"
                  >
                    <MdAdd className="text-xl" />
                    DAY 추가
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : visibleDays.length > 0 ? (
          <div className="space-y-2">
            {visibleDays.map((day) => (
              <MyRouteDayItem
                key={day.id}
                day={day}
                dayState={getRouteDayState(day, todayKey)}
                onSelect={() => onSelectDay(route, day)}
              />
            ))}
          </div>
        ) : null}
        {extraDayCount > 0 ? (
          <div className="flex h-10 items-center gap-2 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700">
            <MdOutlinePlace className="text-base" />
            +{extraDayCount}일 더 있음
          </div>
        ) : null}
        {!todayRouteDay && onRequestAppendDay ? (
          <button
            type="button"
            onClick={() => onRequestAppendDay(route)}
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-brand-300 bg-brand-50 text-xs font-black text-brand-700 transition hover:bg-brand-100 active:scale-[0.99]"
          >
            <MdAdd className="text-lg" />
            DAY 추가
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default MyRouteCard;
