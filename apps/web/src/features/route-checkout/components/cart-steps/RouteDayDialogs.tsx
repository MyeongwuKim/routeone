import { useState } from "react";
import {
  IoAdd,
  IoCarSportOutline,
  IoClose,
  IoRemove,
  IoTimeOutline,
  IoTrashOutline,
} from "react-icons/io5";
import { MIN_PLACE_STAY_SUMMARY_VISIT_COUNT } from "@/lib/routePlaceSnapshot";
import { localizePlaceCategoryLabel, useUiText } from "@/lib/uiText";
import {
  clampStayMinutes,
  formatRouteClock,
  getRouteDurationText,
  type PlaceStaySummaryPreview,
} from "../../models/routeDayCardModel";
import type {
  PlannedRouteDay,
  PlannedRouteItem,
} from "../../models/routePlanTypes";

export function StayMinutesPopup({
  item,
  onClose,
  onApply,
}: {
  item: PlannedRouteItem;
  onClose: () => void;
  onApply: (placeId: string, minutes: number) => void;
}) {
  const text = useUiText();
  const [draftMinutes, setDraftMinutes] = useState(item.stayMinutes);
  const updateDraftMinutes = (nextMinutes: number) => {
    setDraftMinutes(clampStayMinutes(nextMinutes));
  };

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[2700] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label={text.cart.stayEditCloseAria}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[340px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">STAY TIME</p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {item.place.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {text.cart.stayTimeDescription}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.common.close}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <IoClose />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => updateDraftMinutes(draftMinutes - 5)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <IoRemove />
          </button>
          <label className="flex min-w-[132px] items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <input
              aria-label={text.cart.stayMinuteInputAria}
              type="number"
              min={15}
              max={360}
              step={5}
              value={draftMinutes}
              onChange={(event) => updateDraftMinutes(Number(event.target.value))}
              className="w-16 bg-transparent text-center text-2xl font-black text-slate-900 outline-none"
            />
            <span className="text-sm font-bold text-slate-500">
              {text.cart.minuteUnit}
            </span>
          </label>
          <button
            type="button"
            onClick={() => updateDraftMinutes(draftMinutes + 5)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <IoAdd />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            {text.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(item.id, draftMinutes);
              onClose();
            }}
            className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            {text.cart.apply}
          </button>
        </div>
      </section>
    </div>
  );
}

export function PlaceCartRouteItemSheet({
  item,
  currentDay,
  routePlan,
  averageStaySummary,
  onClose,
  onRemove,
  onMovePlaceToDay,
}: {
  item: PlannedRouteItem;
  currentDay: number;
  routePlan: PlannedRouteDay[];
  averageStaySummary?: PlaceStaySummaryPreview;
  onClose: () => void;
  onRemove: (placeId: string) => void;
  onMovePlaceToDay: (
    placeId: string,
    targetDayNumber: number,
    position: "first" | "last"
  ) => void;
}) {
  const text = useUiText();
  const movableDays = routePlan.filter((day) => day.day !== currentDay);
  const contentTypeLabel = localizePlaceCategoryLabel(
    item.place.contentTypeLabel,
    text
  );
  const categoryName = localizePlaceCategoryLabel(
    item.place.categoryName,
    text
  );
  const averageStayMinutesLabel =
    averageStaySummary?.averageActualStayMinutes &&
    averageStaySummary.visitCount >= MIN_PLACE_STAY_SUMMARY_VISIT_COUNT
      ? getRouteDurationText(
          averageStaySummary.averageActualStayMinutes,
          text
        )
      : null;
  const averageStayEmptyLabel =
    (averageStaySummary?.visitCount ?? 0) === 0
      ? text.placeSheet.stayEmpty
      : text.placeSheet.staySamplePending(MIN_PLACE_STAY_SUMMARY_VISIT_COUNT);

  return (
    <div className="fixed inset-0 z-[2600] flex items-end bg-slate-950/30">
      <button
        type="button"
        aria-label={text.cart.placeEditCloseAria}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="route-checkout-bottom-sheet-enter relative w-full rounded-t-[28px] border border-brand-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:border-brand-400/30 dark:bg-slate-950">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700 dark:text-brand-200">
              {text.cart.placeEditTitle}
            </p>
            <h3 className="mt-2 truncate text-lg font-bold text-slate-900 dark:text-white">
              {item.place.title}
            </h3>
            <p className="mt-1 text-sm font-semibold text-brand-700 dark:text-brand-100">
              {item.place.icon} {contentTypeLabel}
              {item.place.categoryName !== item.place.contentTypeLabel
                ? ` · ${categoryName}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.common.close}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <IoClose />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3 dark:border-brand-400/25 dark:bg-slate-900/80">
          <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-300">
            {item.place.address || text.cart.noAddress}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white px-3 py-3 dark:bg-slate-950">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                <IoTimeOutline className="text-brand-600 dark:text-brand-200" />
                {text.cart.arrivalTime}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {formatRouteClock(item.startMinutes)}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-3 dark:bg-slate-950">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
                <IoCarSportOutline className="text-brand-600 dark:text-brand-200" />
                {text.cart.travelTime}
              </p>
              <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {getRouteDurationText(item.travelMinutesFromPrevious, text)}
              </p>
            </div>
          </div>
          <div className="mt-2 rounded-2xl bg-white px-3 py-3 dark:bg-slate-950">
            <p className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-300">
              <IoTimeOutline className="text-brand-600 dark:text-brand-200" />
              {text.cart.userAverageStay}
            </p>
            {averageStayMinutesLabel && averageStaySummary ? (
              <>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {text.cart.averageStayLabel(averageStayMinutesLabel)}
                </p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                  {text.cart.averageStayVisitBasis(averageStaySummary.visitCount)}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">
                {averageStayEmptyLabel}
              </p>
            )}
          </div>
        </div>

        {movableDays.length > 0 ? (
          <section className="mt-4 rounded-2xl border border-brand-100 bg-white p-3 dark:border-brand-400/25 dark:bg-slate-900/80">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
              {text.cart.moveToAnotherDay}
            </p>
            <div className="mt-3 space-y-2">
              {movableDays.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-brand-50/70 px-3 py-2 dark:bg-brand-400/10"
                >
                  <span className="font-trip text-sm text-brand-700 dark:text-brand-100">
                    DAY {day.day}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onMovePlaceToDay(item.id, day.day, "first");
                        onClose();
                      }}
                      className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:border-brand-400/30 dark:bg-slate-950 dark:text-brand-100"
                    >
                      {text.cart.moveFirst}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMovePlaceToDay(item.id, day.day, "last");
                        onClose();
                      }}
                      className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:border-brand-400/30 dark:bg-slate-950 dark:text-brand-100"
                    >
                      {text.cart.moveLast}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => {
            onRemove(item.id);
            onClose();
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <IoTrashOutline />
          {text.cart.removeFromRoute}
        </button>
      </section>
    </div>
  );
}
