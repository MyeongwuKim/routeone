import { useEffect, useMemo, useState } from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText, type UiText } from "@/lib/uiText";

type DateInputProps = {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
};

type CalendarCell = {
  dateValue: string;
  dayNumber: number;
  inCurrentMonth: boolean;
};

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

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function formatDateLabel(value: string, text: UiText) {
  const parsedDate = parseDateValue(value);
  if (!parsedDate) {
    return "";
  }

  const weekday = text.inputs.weekdayLabels[parsedDate.getDay()];
  return text.inputs.formatDateLabel(
    parsedDate.getFullYear(),
    parsedDate.getMonth() + 1,
    parsedDate.getDate(),
    weekday
  );
}

function DateInput({ value, placeholder, onChange }: DateInputProps) {
  const text = useUiText();
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const parsedDate = parseDateValue(value);
    const now = new Date();
    return new Date(parsedDate?.getFullYear() ?? now.getFullYear(), parsedDate?.getMonth() ?? now.getMonth(), 1);
  });
  const openCalendar = () => {
    const parsedDate = parseDateValue(value);
    const now = new Date();
    setVisibleMonth(
      new Date(parsedDate?.getFullYear() ?? now.getFullYear(), parsedDate?.getMonth() ?? now.getMonth(), 1),
    );
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const selectedDate = parseDateValue(value);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const firstWeekday = firstDayOfMonth.getDay();
    const startDate = new Date(year, month, 1 - firstWeekday);

    return Array.from({ length: 42 }).map((_, index) => {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + index);
      return {
        dateValue: toDateValue(cellDate),
        dayNumber: cellDate.getDate(),
        inCurrentMonth: cellDate.getMonth() === month,
      };
    });
  }, [visibleMonth]);

  return (
    <>
      <button
        type="button"
        onClick={openCalendar}
        className="w-full rounded-2xl border border-brand-200 bg-white px-3 py-3 text-left text-sm text-slate-700"
      >
        {selectedDate ? (
          formatDateLabel(value, text)
        ) : (
          <span className="text-slate-400">
            {placeholder ?? text.inputs.datePlaceholder}
          </span>
        )}
      </button>

      {isOpen ? (
        <div
          className={`center-modal-backdrop-enter fixed inset-0 ${UI_LAYER_CLASS.inputDialog} flex items-center justify-center bg-slate-900/55 px-4`}
          onClick={() => setIsOpen(false)}
        >
          <div
            className="center-modal-panel-enter w-full max-w-sm rounded-3xl border border-brand-200 bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1),
                  )
                }
                className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                aria-label={text.inputs.previousMonthAria}
              >
                <IoChevronBack />
              </button>

              <p className="text-base font-semibold text-slate-900">
                {text.inputs.formatMonthTitle(
                  visibleMonth.getFullYear(),
                  visibleMonth.getMonth() + 1
                )}
              </p>

              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1),
                  )
                }
                className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                aria-label={text.inputs.nextMonthAria}
              >
                <IoChevronForward />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
              {text.inputs.weekdayLabels.map((label) => (
                <p key={label} className="py-2">
                  {label}
                </p>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((cell) => {
                const parsedCellDate = parseDateValue(cell.dateValue);
                const isSelected = selectedDate && parsedCellDate ? isSameDay(selectedDate, parsedCellDate) : false;
                const isToday = parsedCellDate ? isSameDay(new Date(), parsedCellDate) : false;
                const cellAriaLabel = parsedCellDate
                  ? text.inputs.formatDateLabel(
                      parsedCellDate.getFullYear(),
                      parsedCellDate.getMonth() + 1,
                      parsedCellDate.getDate(),
                      text.inputs.weekdayLabels[parsedCellDate.getDay()]
                    )
                  : undefined;

                return (
                  <button
                    key={cell.dateValue}
                    type="button"
                    aria-label={cellAriaLabel}
                    onClick={() => {
                      onChange(cell.dateValue);
                      setIsOpen(false);
                    }}
                    className={`h-10 rounded-xl text-sm font-semibold transition ${
                      isSelected
                        ? "bg-brand-600 text-white"
                        : cell.inCurrentMonth
                          ? "bg-white text-slate-700 hover:bg-brand-50"
                          : "bg-white text-slate-300"
                    } ${!isSelected && isToday ? "border border-brand-300" : "border border-transparent"}`}
                  >
                    {cell.dayNumber}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600"
              >
                {text.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  onChange(toDateValue(new Date(now.getFullYear(), now.getMonth(), now.getDate())));
                  setIsOpen(false);
                }}
                className="rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white"
              >
                {text.inputs.selectToday}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default DateInput;
