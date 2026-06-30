import { useEffect, useState } from "react";
import { DateInput, TimeWheelInput } from "@/components/inputs";
import { useRouteCheckout } from "../RouteCheckoutContext";

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

function PlaceCartScheduleStep() {
  const {
    travelStartDate,
    setTravelStartDate,
    tripDays,
    setTripDays,
    dailyStartTime,
    setDailyStartTime,
    scheduleEndTime,
    setScheduleEndTime,
    isScheduleValid,
    scheduleValidationMessage,
  } = useRouteCheckout();
  const [isCustomTripDaysOpen, setIsCustomTripDaysOpen] = useState(false);
  const [customTripDaysInput, setCustomTripDaysInput] = useState(String(tripDays));

  useEffect(() => {
    if (!isCustomTripDaysOpen) {
      setCustomTripDaysInput(String(tripDays));
    }
  }, [isCustomTripDaysOpen, tripDays]);

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

  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="font-trip text-sm text-brand-700">TRAVEL SCHEDULE</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">여행 일정 정보를 정해주세요</p>
        </div>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">여행 시작일</p>
          <DateInput value={travelStartDate} onChange={setTravelStartDate} />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">여행 일수</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((dayCount) => (
              <button
                key={dayCount}
                type="button"
                onClick={() => setTripDays(dayCount)}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  tripDays === dayCount
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white text-slate-600"
                }`}
              >
                {dayCount}일
              </button>
            ))}
            <button
              type="button"
              onClick={() => setIsCustomTripDaysOpen(true)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                tripDays > 7
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-brand-200 bg-white text-slate-600"
              }`}
            >
              직접 입력
            </button>
          </div>
          {travelStartDate ? (
            <p className="mt-2 text-xs text-slate-500">
              일정 범위: {formatDateLabel(travelStartDate)} ~ {formatDateLabel(endDate)}
            </p>
          ) : null}
          {isTodayStartTrip ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
              {isPastTodayStartTime
                ? "선택한 출발시간이 이미 지난 시간이에요. 오늘 일정이라면 출발시간을 한 번 더 확인해주세요."
                : isOneDayTrip
                  ? "오늘 시작해서 오늘 끝나는 당일 일정이에요. 다음 단계로 가기 전에 한 번 더 확인해주세요."
                  : `오늘 바로 시작하는 ${tripDays}일 일정이에요. 다음 단계로 가기 전에 한 번 더 확인해주세요.`}
            </div>
          ) : null}
        </div>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">매일 출발시간</p>
          <TimeWheelInput
            value={dailyStartTime}
            title="매일 출발시간 설정"
            description="여행하는 날마다 이 시간에 일정을 시작해요."
            onChange={setDailyStartTime}
          />
        </label>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">일정 종료 희망시간</p>
          <TimeWheelInput
            value={scheduleEndTime}
            title="일정 종료 희망시간 설정"
            description="하루 일정을 마무리하고 싶은 시각이에요."
            onChange={setScheduleEndTime}
          />
        </label>

        {!isScheduleValid ? <p className="text-xs text-rose-600">{scheduleValidationMessage}</p> : null}
      </div>

      {isCustomTripDaysOpen ? (
        <div className="fixed inset-0 z-[1800] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[340px] rounded-3xl border border-brand-200 bg-white p-4 shadow-2xl">
            <p className="text-lg font-bold text-slate-900">여행 일수 입력</p>
            <p className="mt-1 text-sm text-slate-500">1일 이상 숫자를 입력해 주세요.</p>

            <input
              type="number"
              min={1}
              step={1}
              value={customTripDaysInput}
              onChange={(event) => setCustomTripDaysInput(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-brand-200 px-3 py-2.5 text-base text-slate-800 outline-none"
              placeholder="예: 10"
            />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsCustomTripDaysOpen(false)}
                className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                취소
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
                적용
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default PlaceCartScheduleStep;
