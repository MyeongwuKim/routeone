import { MdClose } from "react-icons/md";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";
import { getLocalizedDayDateLabel } from "../../utils/dayRouteFormatting";

type DayRoutePopupHeaderProps = {
  controller: DayRoutePopupController["header"];
};

function DayRoutePopupHeader({ controller }: DayRoutePopupHeaderProps) {
  const {
    text,
    route,
    activeDay,
    headerLabel,
    headerBadge,
    isRouteShared,
    shouldShowSharedStatusText,
    routeCompletedStopCount,
    routeStopCount,
    routeTitle,
    onClose,
  } = controller;

  return (
    <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-trip text-sm text-brand-700">{headerLabel}</p>
          {headerBadge ? (
            <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
              {headerBadge}
            </span>
          ) : null}
          {isRouteShared && shouldShowSharedStatusText ? (
            <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
              {text.dayRoute.routeShared}
            </span>
          ) : null}
        </div>
        <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
          {routeTitle}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {text.dayRoute.daySchedule(route.tripDays)} ·{" "}
          {text.dayRoute.fullRouteProgress(
            routeCompletedStopCount,
            routeStopCount
          )}
        </p>
        <p className="mt-0.5 text-[11px] font-bold text-brand-700">
          {text.dayRoute.selectedDay(
            activeDay.dayIndex,
            getLocalizedDayDateLabel(activeDay, text)
          )}
        </p>
      </div>
      <button
        type="button"
        aria-label={text.dayRoute.closeAria}
        onClick={onClose}
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
      >
        <MdClose />
      </button>
    </header>
  );
}

export default DayRoutePopupHeader;
