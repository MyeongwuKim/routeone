import { DateInput, TimeWheelInput } from "../../../../components/inputs";
import { useEffect, useState } from "react";

type PlaceCartScheduleStepProps = {
  travelStartDate: string;
  tripDays: number;
  dailyStartTime: string;
  scheduleEndTime: string;
  isScheduleValid: boolean;
  validationMessage: string;
  onChangeTravelStartDate: (value: string) => void;
  onChangeTripDays: (value: number) => void;
  onChangeDailyStartTime: (value: string) => void;
  onChangeScheduleEndTime: (value: string) => void;
};

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  travelStartDate,
  tripDays,
  dailyStartTime,
  scheduleEndTime,
  isScheduleValid,
  validationMessage,
  onChangeTravelStartDate,
  onChangeTripDays,
  onChangeDailyStartTime,
  onChangeScheduleEndTime,
}: PlaceCartScheduleStepProps) {
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

  return (
    <>
      <div className="space-y-4">
        <div>
          <p className="font-trip text-sm text-brand-700">TRAVEL SCHEDULE</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">여행 일정 정보를 정해주세요</p>
        </div>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">여행 시작일</p>
          <DateInput value={travelStartDate} onChange={onChangeTravelStartDate} />
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">여행 일수</p>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((dayCount) => (
              <button
                key={dayCount}
                type="button"
                onClick={() => onChangeTripDays(dayCount)}
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
        </div>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">매일 출발시간</p>
          <TimeWheelInput
            value={dailyStartTime}
            title="매일 출발시간 설정"
            description="여행하는 날마다 이 시간에 일정을 시작해요."
            onChange={onChangeDailyStartTime}
          />
        </label>

        <label className="block">
          <p className="mb-2 text-sm font-semibold text-slate-700">일정 종료 희망시간</p>
          <TimeWheelInput
            value={scheduleEndTime}
            title="일정 종료 희망시간 설정"
            description="하루 일정을 마무리하고 싶은 시각이에요."
            onChange={onChangeScheduleEndTime}
          />
        </label>

        {!isScheduleValid ? <p className="text-xs text-rose-600">{validationMessage}</p> : null}
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
                  onChangeTripDays(Math.floor(customTripDaysValue));
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
