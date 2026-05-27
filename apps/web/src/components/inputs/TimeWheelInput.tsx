import { useEffect, useMemo, useRef, useState } from "react";

type TimeWheelInputProps = {
  value: string;
  placeholder?: string;
  title: string;
  description?: string;
  onChange: (value: string) => void;
};

type WheelValue = "오전" | "오후";

const ROW_HEIGHT = 46;
const REPEAT_COUNT = 24;

const PERIOD_OPTIONS: WheelValue[] = ["오전", "오후"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parseTimeValue(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) {
    return { period: "오전" as WheelValue, hour12: "9", minute: "00" };
  }

  const period: WheelValue = hour24 < 12 ? "오전" : "오후";
  const normalizedHour = hour24 % 12 === 0 ? 12 : hour24 % 12;

  return {
    period,
    hour12: String(normalizedHour),
    minute: String(minute).padStart(2, "0"),
  };
}

function toTimeValue(period: WheelValue, hour12Text: string, minuteText: string) {
  const hour12 = Number(hour12Text);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour12) || !Number.isFinite(minute)) {
    return "09:00";
  }

  let hour24 = hour12 % 12;
  if (period === "오후") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeLabel(timeValue: string) {
  const { period, hour12, minute } = parseTimeValue(timeValue);
  return `${period} ${hour12}:${minute}`;
}

type WheelColumnProps = {
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  loop?: boolean;
};

function WheelColumn({ options, selectedValue, onSelect, loop = true }: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollResetTimerRef = useRef<number | null>(null);

  const repeatedOptions = useMemo(() => {
    if (!loop) {
      return options.map((value, index) => ({ key: `${value}-${index}`, value }));
    }

    return Array.from({ length: options.length * REPEAT_COUNT }, (_, index) => ({
      key: `${options[index % options.length]}-${index}`,
      value: options[index % options.length],
    }));
  }, [loop, options]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const optionIndex = Math.max(options.indexOf(selectedValue), 0);
    if (loop) {
      const middleIndex = Math.floor(REPEAT_COUNT / 2) * options.length + optionIndex;
      container.scrollTop = middleIndex * ROW_HEIGHT;
      return;
    }

    container.scrollTop = optionIndex * ROW_HEIGHT;
  }, [loop, options, selectedValue]);

  useEffect(() => {
    return () => {
      if (scrollResetTimerRef.current) {
        window.clearTimeout(scrollResetTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="scrollbar-hide h-[186px] snap-y snap-mandatory overflow-y-auto"
        style={{ paddingTop: ROW_HEIGHT * 2, paddingBottom: ROW_HEIGHT * 2 }}
        onScroll={(event) => {
          if (scrollResetTimerRef.current) {
            window.clearTimeout(scrollResetTimerRef.current);
          }

          const target = event.currentTarget;
          const currentIndex = Math.round(target.scrollTop / ROW_HEIGHT);
          const normalizedIndex = loop
            ? ((currentIndex % options.length) + options.length) % options.length
            : Math.min(Math.max(currentIndex, 0), options.length - 1);
          const currentValue = options[normalizedIndex];
          onSelect(currentValue);

          if (!loop) {
            return;
          }

          scrollResetTimerRef.current = window.setTimeout(() => {
            const minIndex = options.length * 3;
            const maxIndex = options.length * (REPEAT_COUNT - 3);
            if (currentIndex > minIndex && currentIndex < maxIndex) {
              return;
            }

            const middleIndex = Math.floor(REPEAT_COUNT / 2) * options.length + normalizedIndex;
            target.scrollTo({ top: middleIndex * ROW_HEIGHT, behavior: "auto" });
          }, 60);
        }}
      >
        {repeatedOptions.map((option) => (
          <div
            key={option.key}
            className="flex h-[46px] snap-center items-center justify-center text-[26px] font-bold leading-none text-slate-500"
          >
            {option.value}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeWheelInput({
  value,
  placeholder = "시간 선택",
  title,
  description,
  onChange,
}: TimeWheelInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftPeriod, setDraftPeriod] = useState<WheelValue>("오전");
  const [draftHour, setDraftHour] = useState("9");
  const [draftMinute, setDraftMinute] = useState("00");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const parsed = parseTimeValue(value);
    setDraftPeriod(parsed.period);
    setDraftHour(parsed.hour12);
    setDraftMinute(parsed.minute);
  }, [isOpen, value]);

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

  const hasValue = Boolean(value);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-2xl border border-brand-200 bg-white px-3 py-3 text-left text-sm text-slate-700"
      >
        {hasValue ? formatTimeLabel(value) : <span className="text-slate-400">{placeholder}</span>}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-[1800] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-[360px] rounded-[26px] border border-brand-200 bg-white p-3.5 text-slate-900 shadow-2xl">
            <div className="mb-2.5">
              <p className="text-[28px] font-bold leading-tight">{title}</p>
              {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50/55">
              <div
                className="pointer-events-none absolute left-3 right-3 top-1/2 z-10 -translate-y-1/2 rounded-xl border border-brand-300 bg-brand-100/90"
                style={{ height: ROW_HEIGHT }}
              />
              <div className="flex">
                <WheelColumn
                  options={PERIOD_OPTIONS}
                  selectedValue={draftPeriod}
                  onSelect={(next) => setDraftPeriod(next as WheelValue)}
                  loop={false}
                />
                <WheelColumn options={HOUR_OPTIONS} selectedValue={draftHour} onSelect={setDraftHour} />
                <WheelColumn options={MINUTE_OPTIONS} selectedValue={draftMinute} onSelect={setDraftMinute} />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-600"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(toTimeValue(draftPeriod, draftHour, draftMinute));
                  setIsOpen(false);
                }}
                className="rounded-2xl bg-brand-600 px-4 py-2.5 text-base font-bold text-white"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default TimeWheelInput;
