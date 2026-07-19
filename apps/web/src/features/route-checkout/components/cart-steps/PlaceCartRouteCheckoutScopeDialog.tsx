import { IoClose } from "react-icons/io5";
import type { UiText } from "@/lib/uiText";
import { formatRouteMapDate } from "../../models/routeMapModel";
import type { PlannedRouteDay } from "../../models/routePlanTypes";

type CheckoutDayOption = {
  id: string;
  label: string;
  summary: string;
  day: PlannedRouteDay;
};

type PlaceCartRouteCheckoutScopeDialogProps = {
  text: UiText;
  dayOptions: CheckoutDayOption[];
  routePlanLength: number;
  placeCount: number;
  selectedDayIdSet: ReadonlySet<string>;
  selectedRoutePlanLength: number;
  selectedPlaceCount: number;
  isAllSelected: boolean;
  currentDayOptionId: string | null;
  onClose: () => void;
  onToggleDay: (dayId: string) => void;
  onToggleAll: () => void;
  onConfirm: () => void;
};

function PlaceCartRouteCheckoutScopeDialog({
  text,
  dayOptions,
  routePlanLength,
  placeCount,
  selectedDayIdSet,
  selectedRoutePlanLength,
  selectedPlaceCount,
  isAllSelected,
  currentDayOptionId,
  onClose,
  onToggleDay,
  onToggleAll,
  onConfirm,
}: PlaceCartRouteCheckoutScopeDialogProps) {
  return (
    <div
      className="absolute inset-0 z-[2147483600] flex items-end bg-slate-950/50 px-4 pb-4 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={text.dayRoute.checkoutScopeAria}
        className="flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-[28px] border border-brand-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-brand-700">
              {text.dayRoute.checkoutScope}
            </p>
            <h2 className="mt-1 text-lg font-black text-slate-950">
              {text.dayRoute.checkoutScopeTitle}
            </h2>
          </div>
          <button
            type="button"
            aria-label={text.dayRoute.checkoutScopeCloseAria}
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-500 transition hover:bg-slate-200"
          >
            <IoClose />
          </button>
        </div>

        <button
          type="button"
          aria-pressed={isAllSelected}
          onClick={onToggleAll}
          className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left transition hover:border-brand-400 hover:bg-brand-100"
        >
          <span className="inline-flex min-w-0 items-center gap-3">
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                isAllSelected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-transparent"
              }`}
            >
              ✓
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-950">
                {text.dayRoute.selectAll}
              </span>
              <span className="mt-0.5 block text-xs font-bold text-slate-500">
                {text.dayRoute.daySchedule(routePlanLength)} ·{" "}
                {text.dayRoute.placeCount(placeCount)}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xs font-black text-brand-700">
            {isAllSelected ? text.dayRoute.selected : text.dayRoute.select}
          </span>
        </button>

        <div className="scrollbar-hide mt-3 grid max-h-[40dvh] gap-2 overflow-y-auto pr-1">
          {dayOptions.map((option) => {
            const isCurrentRouteDay = option.id === currentDayOptionId;
            const isSelected = selectedDayIdSet.has(option.id);
            const daySummary =
              option.summary || text.dayRoute.placeCount(option.day.items.length);

            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onToggleDay(option.id)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-brand-500 bg-white shadow-[0_10px_26px_rgba(20,184,166,0.16)]"
                    : "border-slate-200 bg-white hover:border-brand-200 hover:bg-brand-50"
                }`}
              >
                <span
                  className={`inline-flex h-10 min-w-16 shrink-0 items-center justify-center rounded-full px-3 text-xs font-black ${
                    isSelected
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.label}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-slate-950">
                    {option.day.date
                      ? formatRouteMapDate(option.day.date)
                      : `DAY ${option.day.day}`}
                  </span>
                  <span className="mt-0.5 block text-xs font-bold text-slate-500">
                    {daySummary}
                  </span>
                </span>
                <span
                  className={`ml-auto inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-black ${
                    isSelected
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-200 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                {isCurrentRouteDay ? (
                  <span className="sr-only">
                    {text.dayRoute.currentViewingDaySr}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-brand-700">
              {text.dayRoute.selectedDays(selectedRoutePlanLength)}
            </p>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              {text.dayRoute.addPlacesSummary(selectedPlaceCount)}
            </p>
          </div>
          <button
            type="button"
            onClick={onConfirm}
            disabled={selectedRoutePlanLength === 0}
            className="inline-flex h-12 min-w-28 shrink-0 items-center justify-center rounded-full bg-brand-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
          >
            {text.common.confirm}
          </button>
        </div>
      </section>
    </div>
  );
}

export default PlaceCartRouteCheckoutScopeDialog;
