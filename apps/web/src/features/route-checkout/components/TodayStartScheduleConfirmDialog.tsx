import { useUiText } from "@/lib/uiText";

type TodayStartScheduleConfirmDialogProps = {
  tripDays: number;
  hasPastStartTime: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onUseCurrentTime: () => void;
  onChangeToTwoDays: () => void;
};

export default function TodayStartScheduleConfirmDialog({
  tripDays,
  hasPastStartTime,
  onClose,
  onConfirm,
  onUseCurrentTime,
  onChangeToTwoDays,
}: TodayStartScheduleConfirmDialogProps) {
  const text = useUiText();
  const isOneDayTrip = tripDays === 1;

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[2700] flex items-center justify-center bg-slate-950/60 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="today-start-schedule-title"
        className="center-modal-panel-enter w-full max-w-[360px] rounded-[1.5rem] border border-brand-200 bg-white p-5 shadow-2xl dark:border-brand-400/30 dark:bg-[#102a27]"
      >
        <p className="font-trip text-sm text-brand-700 dark:text-brand-200">
          SCHEDULE CHECK
        </p>
        <h2
          id="today-start-schedule-title"
          className="mt-2 text-xl font-bold text-slate-900 dark:text-white"
        >
          {hasPastStartTime
            ? text.cart.todayPastTitle
            : isOneDayTrip
              ? text.cart.todayOneDayTitle
              : text.cart.todayStartTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {hasPastStartTime
            ? text.cart.todayPastDescription
            : isOneDayTrip
              ? text.cart.todayOneDayDescription
              : text.cart.todayMultiDayDescription(tripDays)}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {hasPastStartTime ? (
            <>
              <button
                type="button"
                onClick={onUseCurrentTime}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
              >
                {text.cart.useCurrentTime}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onConfirm}
                  className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
                >
                  {text.cart.continueAnyway}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
                >
                  {text.cart.chooseAgain}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onConfirm}
                className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
              >
                {text.cart.continueToday}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 ${
                    isOneDayTrip ? "" : "col-span-2"
                  } dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200`}
                >
                  {text.cart.chooseAgain}
                </button>
                {isOneDayTrip ? (
                  <button
                    type="button"
                    onClick={onChangeToTwoDays}
                    className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
                  >
                    {text.cart.changeToTwoDays}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
