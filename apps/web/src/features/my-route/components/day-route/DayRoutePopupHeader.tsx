import { MdClose, MdEdit } from "react-icons/md";
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
    headerIdentity,
    headerMeta,
    isRouteShared,
    shouldShowSharedStatusText,
    routeCompletedStopCount,
    routeStopCount,
    routeTitle,
    isReadOnly,
    isOrderEditing,
    isSavingOrder,
    handleStartOrderEditing,
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
        {headerIdentity ? <div className="mt-2">{headerIdentity}</div> : null}
        <h2
          className={`truncate text-lg font-bold text-slate-900 ${
            headerIdentity ? "mt-1" : "mt-0.5"
          }`}
        >
          {routeTitle}
        </h2>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {text.dayRoute.daySchedule(route.tripDays)} ·{" "}
          {text.dayRoute.fullRouteProgress(
            routeCompletedStopCount,
            routeStopCount
          )}
        </p>
        <p className="mt-1 text-[11px] font-bold text-brand-700">
          {text.dayRoute.selectedDay(
            activeDay.dayIndex,
            getLocalizedDayDateLabel(activeDay, text)
          )}
        </p>
        {headerMeta ? <div className="mt-2">{headerMeta}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!isReadOnly ? (
          <button
            type="button"
            aria-label={isOrderEditing ? "루트 편집 중" : "루트 수정"}
            title={isOrderEditing ? "루트 편집 중" : "루트 수정"}
            aria-pressed={isOrderEditing}
            onClick={handleStartOrderEditing}
            disabled={isOrderEditing || isSavingOrder}
            className={`inline-flex size-10 items-center justify-center rounded-full border text-lg shadow-sm transition disabled:cursor-default ${
              isOrderEditing
                ? "border-brand-600 bg-brand-600 text-white disabled:opacity-100"
                : "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 disabled:opacity-40"
            }`}
          >
            <MdEdit />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={text.dayRoute.closeAria}
          onClick={onClose}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdClose />
        </button>
      </div>
    </header>
  );
}

export default DayRoutePopupHeader;
