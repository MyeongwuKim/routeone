/** DAY 팝업의 공유·편집·시작·지도 액션과, 권한이 있는 선택 DAY의 남은 장소를 건너뛰는 마치기를 표시한다. */
import {
  MdCheck,
  MdCheckCircle,
  MdClose,
  MdImage,
  MdMap,
  MdPlayArrow,
  MdShare,
} from "react-icons/md";
import type { DayRoutePopupController } from "../../hooks/useDayRoutePopupController";

type DayRoutePopupFooterProps = {

  controller: DayRoutePopupController["footer"];
};

function DayRoutePopupFooter({ controller }: DayRoutePopupFooterProps) {
  const {
    text,
    activeDay,
    isReadOnly,
    readOnlyFooterAction,
    readOnlyPosterAction,
    readOnlyActionDisabled,
    readOnlyActionLabel,
    isRouteShared,
    routeLikeCount,
    isOrderEditing,
    isSavingOrder,
    isOrderDirty,
    routeStopCount,
    routeStatus,
    routeActionDay,
    isRouteActionDayCompleted,
    isStartingRouteDay,
    canStartRouteActionDay,
    canFinishDay = false,
    isFinishingDay = false,
    handleRequestShareRoute,
    handleCancelOrderEditing,
    handleSaveOrder,
    handleRequestRouteActionDayStart,
    handleRequestFinishDay,
    handleOpenMapForDay,
  } = controller;
  const readOnlyActionIcon = readOnlyFooterAction?.icon ?? (
    <MdShare className="shrink-0 text-lg" />
  );
  const shouldExpandShareAction = Boolean(
    readOnlyPosterAction &&
      !readOnlyFooterAction &&
      readOnlyActionLabel === text.dayRoute.shareAfterComplete
  );
  const readOnlyActionDisabledClass = readOnlyFooterAction?.isActive
    ? "disabled:opacity-100"
    : "disabled:opacity-60";

  return (
    <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 bg-white px-4 py-3">
      {isReadOnly ? (
        <div
          className={`grid gap-2 ${
            readOnlyPosterAction && !shouldExpandShareAction ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          <button
            type="button"
            aria-label={
              readOnlyFooterAction?.ariaLabel ??
              (isRouteShared
                ? text.dayRoute.sharedRouteHeartAria(routeLikeCount)
                : readOnlyActionLabel)
            }
            onClick={
              readOnlyFooterAction?.onClick ?? handleRequestShareRoute
            }
            disabled={readOnlyActionDisabled}
            className={`flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-2xl border px-1.5 py-3 text-xs font-bold sm:text-sm disabled:cursor-default ${shouldExpandShareAction ? "col-span-2" : ""} ${readOnlyActionDisabledClass} ${
              readOnlyFooterAction?.isActive
                ? "border-brand-500 bg-brand-600 text-white"
                : "border-brand-200 bg-brand-50 text-brand-700"
            }`}
          >
            {readOnlyActionIcon}
            {readOnlyActionLabel ? <span>{readOnlyActionLabel}</span> : null}
          </button>
          {readOnlyPosterAction ? (
            <button
              type="button"
              aria-label={readOnlyPosterAction.ariaLabel}
              onClick={readOnlyPosterAction.onClick}
              disabled={readOnlyPosterAction.disabled}
              className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-2xl border border-amber-200 bg-amber-50 px-1.5 py-3 text-xs font-bold text-amber-700 disabled:cursor-wait disabled:opacity-60"
            >
              <MdImage className="shrink-0 text-lg" />
              {readOnlyPosterAction.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleOpenMapForDay(activeDay)}
            disabled={routeStopCount === 0}
            className="flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-2xl bg-brand-600 px-1.5 py-3 text-xs font-bold text-white sm:text-sm disabled:opacity-40"
          >
            <MdMap className="shrink-0 text-lg" />
            {text.dayRoute.routeMap}
          </button>
        </div>
      ) : isOrderEditing ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCancelOrderEditing}
            disabled={isSavingOrder}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-600 disabled:opacity-40"
          >
            <MdClose />
            {text.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={!isOrderDirty || isSavingOrder}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <MdCheck />
            {isSavingOrder ? text.dayRoute.savingRoute : text.inputs.save}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleRequestRouteActionDayStart}
            disabled={!canStartRouteActionDay}
            className={`flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl border px-2 py-3 text-xs font-bold sm:text-sm disabled:cursor-default ${
              routeActionDay.startedAt || routeStatus === "COMPLETED"
                ? "border-brand-200 bg-brand-50 text-brand-700 disabled:opacity-100"
                : "border-brand-500 bg-brand-600 text-white disabled:opacity-40"
            }`}
          >
            {routeStatus === "COMPLETED" ? (
              <MdCheckCircle className="shrink-0" />
            ) : (
              <MdPlayArrow className="shrink-0" />
            )}
            {isStartingRouteDay
              ? text.dayRoute.startingDayAction(routeActionDay.dayIndex)
              : routeStatus === "COMPLETED"
                ? text.myRouteCard.completed
                : isRouteActionDayCompleted
                  ? text.dayRoute.dayCompletedAction(routeActionDay.dayIndex)
                  : routeActionDay.startedAt
                    ? text.dayRoute.dayInProgressAction(
                        routeActionDay.dayIndex
                      )
                    : text.dayRoute.startDayAction(routeActionDay.dayIndex)}
          </button>
          <button
            type="button"
            onClick={() => handleOpenMapForDay(activeDay)}
            disabled={routeStopCount === 0}
            className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <MdMap className="shrink-0 text-lg" />
            {text.dayRoute.routeMap}
          </button>
        </div>
      )}
      {canFinishDay || isFinishingDay ? (
        <button
          type="button"
          onClick={handleRequestFinishDay}
          disabled={!canFinishDay || isFinishingDay || isOrderEditing || isSavingOrder}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
        >
          {isFinishingDay ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <MdCheck className="shrink-0 text-base" />}
          {isFinishingDay ? text.dayRoute.finishingDay : text.dayRoute.finishDay}
        </button>
      ) : null}
    </footer>
  );
}

export default DayRoutePopupFooter;
