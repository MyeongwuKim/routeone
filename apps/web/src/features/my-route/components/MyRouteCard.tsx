import { useState } from "react";
import {
  MdAdd,
  MdDeleteOutline,
  MdEventAvailable,
  MdOutlineCalendarToday,
  MdOutlinePlace,
  MdPlayArrow,
  MdRoute,
  MdShare,
  MdTimer,
  MdVerified,
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
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

type MyRouteCardProps = {
  route: MyRoute;
  variant?: "featured" | "compact" | "upcoming" | "history";
  hideTimelineBadge?: boolean;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestStartRoute?: (route: MyRoute) => void;
  onRequestAppendDay?: (route: MyRoute) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
};

function isRouteShared(route: MyRoute) {
  return route.visibility === "PUBLIC" || Boolean(route.sharedAt);
}

function canRequestRouteStart(route: MyRoute) {
  return route.status !== "COMPLETED" && !route.startedAt;
}

function isVisitedRouteStop(stop: MyRouteStop) {
  return stop.visitStatus === "VISITED" || Boolean(stop.visitedAt);
}

function getVerifiedRouteStopCount(stops: MyRouteStop[]) {
  return stops.filter(
    (stop) =>
      stop.verificationStatus === "GPS_PHOTO" || Boolean(stop.verifiedAt)
  ).length;
}

function getAverageActualStayMinutes(stops: MyRouteStop[]) {
  const actualStayMinutes = stops
    .map((stop) => stop.actualStayMinutes)
    .filter((value): value is number => typeof value === "number" && value > 0);

  if (actualStayMinutes.length === 0) {
    return null;
  }

  const totalMinutes = actualStayMinutes.reduce(
    (total, minutes) => total + minutes,
    0
  );

  return Math.round(totalMinutes / actualStayMinutes.length);
}

function formatStayMinutes(minutes: number | null) {
  if (!minutes) {
    return null;
  }

  if (minutes < 60) {
    return `${minutes}분`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes > 0 ? `${hours}시간 ${restMinutes}분` : `${hours}시간`;
}

function SharedRouteStatusBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[11px] font-black text-brand-700 dark:border-brand-400/35 dark:bg-brand-400/15 dark:text-brand-100">
      <MdShare className="text-xs" />
      공유됨
    </span>
  );
}

function MyRouteHistoryCard({
  route,
  todayKey,
  onSelectDay,
}: {
  route: MyRoute;
  todayKey: string;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
}) {
  const [isStopExpanded, setIsStopExpanded] = useState(false);
  const sortedDays = getSortedRouteDays(route);
  const selectableDay = getSelectableRouteDay(route, todayKey);
  const visitedStops = route.stops.filter(isVisitedRouteStop);
  const previewStopLimit = visitedStops.length > 3 ? 2 : 3;
  const visibleStops = isStopExpanded
    ? visitedStops
    : visitedStops.slice(0, previewStopLimit);
  const hiddenStopCount = Math.max(0, visitedStops.length - visibleStops.length);
  const canToggleStops = visitedStops.length > previewStopLimit;
  const verifiedStopCount = getVerifiedRouteStopCount(visitedStops);
  const averageStayLabel = formatStayMinutes(
    getAverageActualStayMinutes(visitedStops)
  );
  const visibleDays = sortedDays.slice(0, 3);
  const hiddenDayCount = Math.max(0, sortedDays.length - visibleDays.length);
  const completionText = `${visitedStops.length}/${route.totalStopCount}곳 방문`;

  return (
    <article className="relative w-full overflow-hidden rounded-2xl border border-transparent bg-white bg-clip-padding text-left shadow-sm transition after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:border after:border-brand-100 after:content-[''] hover:after:border-brand-200 dark:bg-[#071f1d] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)] dark:after:border-brand-300/50 dark:hover:after:border-brand-200/70">
      <button
        type="button"
        onClick={() => {
          if (selectableDay) {
            onSelectDay(route, selectableDay);
          }
        }}
        disabled={!selectableDay}
        className="block w-full px-4 py-3 text-left transition active:scale-[0.99] disabled:cursor-default disabled:opacity-70"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
                지난 루트
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:bg-slate-900/80 dark:text-slate-100">
                {route.tripDays <= 1
                  ? "당일치기"
                  : `${route.tripDays - 1}박 ${route.tripDays}일`}
              </span>
              {isRouteShared(route) ? <SharedRouteStatusBadge /> : null}
            </div>
            <p className="mt-2 truncate text-base font-black text-slate-900 dark:text-white">
              {getRouteTitle(route)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-200/80">
              <MdOutlineCalendarToday className="text-sm dark:text-brand-200" />
              {getRouteSubtitle(route)}
            </p>
          </div>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-xl text-white shadow-sm dark:bg-brand-500 dark:shadow-[0_10px_24px_rgba(20,184,166,0.18)]">
            <MdRoute />
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="min-w-0 rounded-xl bg-brand-50 px-3 py-2 dark:bg-brand-400/15">
            <p className="text-[10px] font-black text-brand-700 dark:text-brand-100">
              완료
            </p>
            <p className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">
              {completionText}
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
            <p className="flex items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-200/80">
              <MdVerified className="text-xs text-brand-600 dark:text-brand-200" />
              인증
            </p>
            <p className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">
              {verifiedStopCount}곳
            </p>
          </div>
          <div className="min-w-0 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
            <p className="flex items-center gap-1 text-[10px] font-black text-slate-500 dark:text-slate-200/80">
              <MdTimer className="text-xs text-brand-600 dark:text-brand-200" />
              평균
            </p>
            <p className="mt-0.5 truncate text-xs font-black text-slate-900 dark:text-white">
              {averageStayLabel ?? "-"}
            </p>
          </div>
        </div>
      </button>

      {visibleStops.length > 0 ? (
        <div className="relative px-4 py-3 before:pointer-events-none before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-brand-100 before:content-[''] dark:bg-[#071f1d] dark:before:bg-brand-400/30">
          <div
            className={
              isStopExpanded
                ? "flex min-w-0 flex-wrap items-center gap-1.5"
                : "grid min-w-0 grid-cols-3 gap-1.5"
            }
          >
            {visibleStops.map((stop, index) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => {
                  const targetDay = sortedDays.find(
                    (day) => day.id === stop.dayId
                  );

                  if (targetDay) {
                    onSelectDay(route, targetDay);
                  }
                }}
                className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 ring-1 ring-slate-200 transition hover:text-brand-700 active:scale-95 dark:bg-slate-950/35 dark:text-slate-100 dark:ring-brand-200/45 dark:hover:text-brand-100 ${
                  isStopExpanded ? "max-w-[180px]" : "w-full"
                }`}
              >
                <MdOutlinePlace className="shrink-0 text-xs text-brand-600 dark:text-brand-200" />
                <span className="shrink-0 text-slate-400 dark:text-slate-300">
                  {index + 1}
                </span>
                <span className="min-w-0 truncate">{stop.place.title}</span>
              </button>
            ))}
            {hiddenStopCount > 0 ? (
              <button
                type="button"
                aria-expanded={isStopExpanded}
                onClick={() => setIsStopExpanded(true)}
                className="inline-flex min-w-0 items-center justify-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 transition active:scale-95 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-300/30"
              >
                +{hiddenStopCount}곳
              </button>
            ) : null}
            {canToggleStops && isStopExpanded ? (
              <button
                type="button"
                aria-expanded={isStopExpanded}
                onClick={() => setIsStopExpanded(false)}
                className="inline-flex min-w-0 items-center justify-center rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200 transition active:scale-95 dark:bg-[#061b19] dark:text-slate-200 dark:ring-brand-200/45"
              >
                접기
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {visibleDays.length > 0 ? (
        <div className="relative flex flex-wrap gap-1.5 bg-brand-50/60 px-4 py-3 before:pointer-events-none before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-brand-100 before:content-[''] dark:bg-[#082b28] dark:before:bg-brand-400/30">
          {visibleDays.map((day) => {
            const completedStopCount = day.stops.filter(isVisitedRouteStop).length;

            return (
              <button
                key={day.id}
                type="button"
                onClick={() => onSelectDay(route, day)}
                className="inline-flex min-w-0 max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-200 transition hover:text-brand-700 active:scale-95 dark:bg-[#061b19] dark:text-slate-100 dark:ring-brand-200/45 dark:hover:text-brand-100"
              >
                <span className="shrink-0 text-brand-700 dark:text-brand-100">
                  DAY {day.dayIndex}
                </span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-500" />
                <span className="truncate">
                  {completedStopCount}/{day.stops.length}곳
                </span>
              </button>
            );
          })}
          {hiddenDayCount > 0 ? (
            <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200 dark:bg-[#061b19] dark:text-slate-200 dark:ring-brand-200/45">
              +{hiddenDayCount}일
            </span>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MyRouteUpcomingCard({
  route,
  todayKey,
  onSelectDay,
  onRequestStartRoute,
  onRequestDeleteRoute,
}: {
  route: MyRoute;
  todayKey: string;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestStartRoute?: (route: MyRoute) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
}) {
  const selectableDay = getSelectableRouteDay(route, todayKey);
  const startDateLabel = formatRouteDate(route.travelStartDate) ?? "미정";
  const shouldShowStartAction =
    onRequestStartRoute && canRequestRouteStart(route);

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
            <p className="text-sm font-black text-slate-900">
              {getRouteTitle(route)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <MdEventAvailable className="text-sm text-brand-600" />
              {getRouteTimelineLabel(route, todayKey)}
            </p>
          </div>
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-50 bg-brand-50/60 px-4 py-2 text-[11px] font-bold text-slate-500">
        <div className="flex min-w-0 items-center gap-2">
          <span>{getRouteSubtitle(route)}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>DAY {route.tripDays}</span>
        </div>
        {shouldShowStartAction ? (
          <button
            type="button"
            onClick={() => onRequestStartRoute?.(route)}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3 text-[11px] font-black text-white shadow-sm transition active:scale-95"
          >
            <MdPlayArrow className="text-sm" />
            여행 시작
          </button>
        ) : null}
      </div>
    </article>
  );
}

function MyRouteCompactCard({
  route,
  todayKey,
  hideTimelineBadge,
  onSelectDay,
  onRequestStartRoute,
  onRequestDeleteRoute,
}: {
  route: MyRoute;
  todayKey: string;
  hideTimelineBadge?: boolean;
  onSelectDay: (route: MyRoute, day: MyRouteDay) => void;
  onRequestStartRoute?: (route: MyRoute) => void;
  onRequestDeleteRoute?: (route: MyRoute) => void;
}) {
  const selectableDay = getSelectableRouteDay(route, todayKey);
  const shouldShowStartAction =
    onRequestStartRoute && canRequestRouteStart(route);
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
              {isRouteShared(route) ? <SharedRouteStatusBadge /> : null}
            </div>
            <p className="mt-1.5 text-sm font-black text-slate-900">
              {getRouteTitle(route)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
              <MdOutlineCalendarToday className="text-sm" />
              {getRouteSubtitle(route)}
            </p>
          </div>
        </button>
        {shouldShowStartAction ? (
          <button
            type="button"
            onClick={() => onRequestStartRoute?.(route)}
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-brand-600 px-3 text-xs font-black text-white shadow-sm transition active:scale-95"
          >
            <MdPlayArrow className="text-base" />
            시작
          </button>
        ) : null}
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
  onRequestStartRoute,
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
        onRequestStartRoute={onRequestStartRoute}
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
        onRequestStartRoute={onRequestStartRoute}
        onRequestDeleteRoute={onRequestDeleteRoute}
      />
    );
  }

  if (variant === "history") {
    return (
      <MyRouteHistoryCard
        route={route}
        todayKey={todayKey}
        onSelectDay={onSelectDay}
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
  const shouldShowStartAction =
    onRequestStartRoute && canRequestRouteStart(route);

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
            {isRouteShared(route) ? <SharedRouteStatusBadge /> : null}
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
          {shouldShowStartAction ? (
            <button
              type="button"
              onClick={() => onRequestStartRoute?.(route)}
              className="inline-flex h-9 items-center gap-1 rounded-full bg-brand-600 px-3 text-xs font-black text-white shadow-sm transition active:scale-95"
            >
              <MdPlayArrow className="text-base" />
              여행 시작
            </button>
          ) : null}
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
