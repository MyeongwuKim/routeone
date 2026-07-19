import {
  MdCheck,
  MdClose,
  MdCompareArrows,
  MdDeleteOutline,
  MdEdit,
  MdImage,
  MdMap,
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
    orderedStopCount,
    isDeletingDay,
    routeStopCount,
    handleRequestShareRoute,
    handleCancelOrderEditing,
    handleSaveOrder,
    handleRequestDeleteDay,
    handleOpenMapForDay,
    setIsOrderEditing,
  } = controller;
  const readOnlyActionIcon = readOnlyFooterAction?.icon ?? (
    <MdShare className="text-lg" />
  );
  const readOnlyActionDisabledClass = readOnlyFooterAction?.isActive
    ? "disabled:opacity-100"
    : "disabled:opacity-60";

  return (
    <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 bg-white px-4 py-3">
      {isReadOnly ? (
        <div
          className={`grid gap-2 ${
            readOnlyPosterAction ? "grid-cols-3" : "grid-cols-2"
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
            className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-bold disabled:cursor-default ${readOnlyActionDisabledClass} ${
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
              className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-2 py-3 text-xs font-bold text-amber-700 disabled:cursor-wait disabled:opacity-60"
            >
              <MdImage className="text-lg" />
              {readOnlyPosterAction.label}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => handleOpenMapForDay(activeDay)}
            disabled={routeStopCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <MdMap className="text-lg" />
            {text.dayRoute.routeMap}
          </button>
        </div>
      ) : isOrderEditing ? (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleCancelOrderEditing}
            disabled={isSavingOrder}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-600 disabled:opacity-40"
          >
            <MdClose />
            취소
          </button>
          <button
            type="button"
            onClick={() => handleOpenMapForDay(activeDay)}
            disabled={!isOrderDirty || orderedStopCount < 2}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 px-2 py-3 text-xs font-bold text-brand-700 disabled:opacity-40"
          >
            <MdCompareArrows />
            동선 비교
          </button>
          <button
            type="button"
            onClick={handleSaveOrder}
            disabled={!isOrderDirty || isSavingOrder}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <MdCheck />
            {isSavingOrder ? "저장 중" : "저장"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={handleRequestDeleteDay}
            disabled={isDeletingDay}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-rose-50 px-2 py-3 text-xs font-bold text-rose-600 disabled:opacity-40"
          >
            <MdDeleteOutline />
            {isDeletingDay ? "삭제 중" : "DAY 삭제"}
          </button>
          <button
            type="button"
            onClick={() => setIsOrderEditing(true)}
            disabled={orderedStopCount < 2}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 px-2 py-3 text-xs font-bold text-brand-700 disabled:opacity-40"
          >
            <MdEdit />
            순서 편집
          </button>
          <button
            type="button"
            onClick={() => handleOpenMapForDay(activeDay)}
            disabled={routeStopCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            <MdMap className="text-lg" />
            {text.dayRoute.routeMap}
          </button>
        </div>
      )}
    </footer>
  );
}

export default DayRoutePopupFooter;
