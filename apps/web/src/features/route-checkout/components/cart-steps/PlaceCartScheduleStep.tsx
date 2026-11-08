/**
 * 사용 위치: 루트 체크아웃 → 여행 일정 설정
 *
 * 용도:
 * 여행 시작일, 여행 일수와 매일의 시작·종료 시간을 정한다.
 * 적용된 여행 일수는 직접 입력 여부와 관계없이 선택 영역 상단에 표시한다.
 * 추천 기간을 누르면 해당 일수를 선택하고, 3일도 부족하다는 안내를 누르면 직접 입력 창을 연다.
 */
import { useMemo, useState } from "react";
import { MdEdit } from "react-icons/md";
import { DateInput, TimeWheelInput } from "@/components/inputs";
import { useUiText } from "@/lib/uiText";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useRouteCheckout } from "../../hooks/useRouteCheckout";
import { recommendTripDuration } from "../../utils/tripDurationRecommendation";

type PlaceCartScheduleStepProps = {
  /** 새 코스의 기간을 추천할 때 사용할 장소. 공유 코스 가져오기와 DAY 추가에서는 생략한다. */
  recommendationPlaces?: readonly SavedPlaceItem[];
};

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateValue() {
  const now = new Date();
  return toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function toMinutes(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return -1;
  }

  return hour * 60 + minute;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function parseDateValue(value: string) {
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateLabel(value: string) {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) {
    return "";
  }

  return `${parsedDate.getFullYear()}.${String(parsedDate.getMonth() + 1).padStart(2, "0")}.${String(
    parsedDate.getDate(),
  ).padStart(2, "0")}`;
}

function PlaceCartScheduleStep({
  recommendationPlaces,
}: PlaceCartScheduleStepProps) {
  const text = useUiText();
  const {
    travelStartDate,
    setTravelStartDate,
    tripDays,
    setTripDays,
    dailyStartTime,
    setDailyStartTime,
    dailyStartMinutes,
    scheduleEndTime,
    setScheduleEndTime,
    scheduleEndMinutes,
    tempo,
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const [isCustomTripDaysOpen, setIsCustomTripDaysOpen] = useState(false);
  const [customTripDaysInput, setCustomTripDaysInput] = useState(String(tripDays));

  const recommendationTempo = tempo ?? "balanced";
  const recommendation = useMemo(
    () =>
      recommendationPlaces
        ? recommendTripDuration({
            savedPlaces: recommendationPlaces,
            dailyStartMinutes,
            dailyEndMinutes: scheduleEndMinutes,
            tempo: recommendationTempo,
          })
        : null,
    [
      recommendationPlaces,
      dailyStartMinutes,
      scheduleEndMinutes,
      recommendationTempo,
    ]
  );
  const recommendationLength = recommendation
    ? recommendation.days === 1
      ? text.myRouteCard.dayTrip
      : text.myRouteCard.nightTrip(recommendation.days - 1, recommendation.days)
    : "";
  const tempoLabels = {
    relaxed: text.cart.tempoRelaxedTitle,
    balanced: text.cart.tempoBalancedTitle,
    packed: text.cart.tempoPackedTitle,
  };

  const endDate = (() => {
    const startDate = parseDateValue(travelStartDate);
    if (!startDate) {
      return "";
    }

    const computedDate = new Date(startDate);
    computedDate.setDate(startDate.getDate() + Math.max(0, tripDays - 1));
    return toDateValue(computedDate);
  })();

  const customTripDaysValue = Number(customTripDaysInput);
  const canSaveCustomTripDays = Number.isFinite(customTripDaysValue) && customTripDaysValue >= 1;
  const isTodayStartTrip = travelStartDate === getTodayDateValue();
  const isOneDayTrip = tripDays === 1;
  const startMinutes = toMinutes(dailyStartTime);
  const isPastTodayStartTime =
    isTodayStartTrip && startMinutes >= 0 && startMinutes < getCurrentMinutes();

  const openCustomTripDays = () => {
    setCustomTripDaysInput(String(tripDays));
    setIsCustomTripDaysOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="font-trip text-sm text-brand-700">TRAVEL SCHEDULE</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">
            {text.cart.scheduleTitle}
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {text.cart.startDateLabel}
          </p>
          <DateInput value={travelStartDate} onChange={setTravelStartDate} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">
              {text.cart.tripDaysLabel}
            </p>
            <span className="text-sm font-bold tabular-nums text-brand-700">
              {text.cart.dayCount(tripDays)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((dayCount) => (
              <button
                key={dayCount}
                type="button"
                aria-pressed={tripDays === dayCount}
                onClick={() => setTripDays(dayCount)}
                className={`min-w-0 whitespace-nowrap rounded-xl border px-3 py-2 text-sm font-semibold ${
                  tripDays === dayCount
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white text-slate-600"
                }`}
              >
                {text.cart.dayCount(dayCount)}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={tripDays > 7}
              aria-label={tripDays > 7
                ? `${text.cart.customTripDaysButton}: ${text.cart.dayCount(tripDays)}`
                : text.cart.customTripDaysButton}
              title={text.cart.customTripDaysButton}
              onClick={openCustomTripDays}
              className={`inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-2 py-2 text-sm font-semibold ${
                tripDays > 7
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-slate-600"
              }`}
            >
              {tripDays > 7 ? (
                <>
                  <span className="min-w-0 truncate tabular-nums">
                    {text.cart.dayCount(tripDays)}
                  </span>
                  <MdEdit aria-hidden="true" className="shrink-0 text-xs" />
                </>
              ) : (
                <span className="truncate">{text.cart.customTripDaysButton}</span>
              )}
            </button>
          </div>
          {recommendation && recommendationPlaces ? (
            <button
              aria-live="polite"
              type="button"
              aria-pressed={
                recommendation.fitsDailyHours
                  ? tripDays === recommendation.days
                  : undefined
              }
              onClick={
                recommendation.fitsDailyHours
                  ? () => setTripDays(recommendation.days)
                  : openCustomTripDays
              }
              className="mt-2 block w-full cursor-pointer rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-left text-xs leading-5"
            >
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-bold text-brand-700">
                  {recommendation.fitsDailyHours
                    ? text.cart.tripDurationRecommended(recommendationLength)
                    : text.cart.tripDurationTight(recommendationLength)}
                </span>
                <span className="text-[11px] text-slate-500">
                  {text.cart.tripDurationBasis(tempoLabels[recommendationTempo])}
                </span>
              </span>
              <span className="block text-slate-600">
                {recommendation.fitsDailyHours
                  ? text.cart.tripDurationReason(
                      recommendationPlaces.length,
                      recommendation.days
                    )
                  : text.cart.tripDurationTightReason(recommendationPlaces.length)}
              </span>
            </button>
          ) : null}
          {travelStartDate ? (
            <p className="mt-2 text-xs text-slate-500">
              {text.cart.scheduleRange(
                formatDateLabel(travelStartDate),
                formatDateLabel(endDate)
              )}
            </p>
          ) : null}
          {isTodayStartTrip ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              {isPastTodayStartTime
                ? text.cart.todayPastWarning
                : isOneDayTrip
                  ? text.cart.todayOneDayWarning
                  : text.cart.todayMultiDayWarning(tripDays)}
            </div>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {text.cart.dailyStartTimeLabel}
          </p>
          <TimeWheelInput
            value={dailyStartTime}
            title={text.cart.dailyStartTimeTitle}
            description={text.cart.dailyStartTimeDescription}
            onChange={setDailyStartTime}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            {text.cart.scheduleEndTimeLabel}
          </p>
          <TimeWheelInput
            value={scheduleEndTime}
            title={text.cart.scheduleEndTimeTitle}
            description={text.cart.scheduleEndTimeDescription}
            onChange={setScheduleEndTime}
          />
        </div>

        {!isScheduleValid ? <p className="text-xs text-rose-600">{scheduleValidationMessage}</p> : null}
      </div>

      {isCustomTripDaysOpen ? (
        <div className="center-modal-backdrop-enter fixed inset-0 z-[1800] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="center-modal-panel-enter w-full max-w-[340px] rounded-3xl border border-brand-200 bg-white p-4 shadow-2xl">
            <p className="text-lg font-bold text-slate-900">
              {text.cart.customTripDaysTitle}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {text.cart.customTripDaysDescription}
            </p>

            <input
              type="number"
              min={1}
              step={1}
              value={customTripDaysInput}
              onChange={(event) => setCustomTripDaysInput(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-brand-200 px-3 py-2.5 text-base text-slate-800 outline-none"
              placeholder={text.cart.customTripDaysPlaceholder}
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCustomTripDaysOpen(false)}
                className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                {text.common.cancel}
              </button>
              <button
                type="button"
                disabled={!canSaveCustomTripDays}
                onClick={() => {
                  if (!canSaveCustomTripDays) {
                    return;
                  }
                  setTripDays(Math.floor(customTripDaysValue));
                  setIsCustomTripDaysOpen(false);
                }}
                className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
              >
                {text.cart.apply}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default PlaceCartScheduleStep;
