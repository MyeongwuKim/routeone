import {
  type PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText, type UiText } from "@/lib/uiText";

type TimeWheelInputProps = {
  value: string;
  placeholder?: string;
  title: string;
  description?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

type WheelValue = "am" | "pm";

const ROW_HEIGHT = 46;
const WHEEL_CENTER_OFFSET = ROW_HEIGHT / 2;
const REPEAT_COUNT = 24;
const SCROLL_IDLE_SNAP_DELAY_MS = 220;
const WHEEL_MOMENTUM_DECAY = 0.955;
const WHEEL_MOMENTUM_STOP_VELOCITY = 0.35;
const WHEEL_MAX_VELOCITY = ROW_HEIGHT * 2.4;
const TAP_STEP_MAX_DISTANCE = 8;
const TAP_STEP_MAX_SCROLL_DISTANCE = 2;

const PERIOD_OPTIONS: WheelValue[] = ["am", "pm"];
const HOUR_OPTIONS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

function parseTimeValue(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");
  const hour24 = Number(hourText);
  const minute = Number(minuteText);

  if (!Number.isFinite(hour24) || !Number.isFinite(minute)) {
    return { period: "am" as WheelValue, hour12: "9", minute: "00" };
  }

  const period: WheelValue = hour24 < 12 ? "am" : "pm";
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
  if (period === "pm") {
    hour24 += 12;
  }

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatTimeWheelLabel(timeValue: string, text: UiText) {
  const { period, hour12, minute } = parseTimeValue(timeValue);
  return `${period === "pm" ? text.inputs.pm : text.inputs.am} ${hour12}:${minute}`;
}

function clampWheelVelocity(value: number) {
  return Math.max(-WHEEL_MAX_VELOCITY, Math.min(WHEEL_MAX_VELOCITY, value));
}

function getWheelMomentumImpulse(deltaY: number) {
  const magnitude = Math.abs(deltaY);
  const multiplier = Math.min(5.5, 2 + magnitude / 90);

  return deltaY * multiplier * 0.12;
}

type WheelColumnProps = {
  options: string[];
  selectedValue: string;
  onSelect: (value: string) => void;
  getOptionLabel?: (value: string) => string;
  loop?: boolean;
};

type PointerStart = {
  pointerId: number;
  x: number;
  y: number;
  scrollTop: number;
};

function WheelColumn({
  options,
  selectedValue,
  onSelect,
  getOptionLabel,
  loop = true,
}: WheelColumnProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollEndTimerRef = useRef<number | null>(null);
  const wheelMomentumFrameRef = useRef<number | null>(null);
  const wheelVelocityRef = useRef(0);
  const pointerStartRef = useRef<PointerStart | null>(null);
  const isWheelMomentumActiveRef = useRef(false);
  const hasSyncedInitialValueRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const lastEmittedValueRef = useRef(selectedValue);

  const getValueScrollTop = useCallback(
    (value: string) => {
      const optionIndex = Math.max(options.indexOf(value), 0);

      if (!loop) {
        return optionIndex * ROW_HEIGHT + WHEEL_CENTER_OFFSET;
      }

      return (
        (Math.floor(REPEAT_COUNT / 2) * options.length + optionIndex) *
          ROW_HEIGHT +
        WHEEL_CENTER_OFFSET
      );
    },
    [loop, options]
  );

  const resetProgrammaticScrollFlag = () => {
    window.requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  };

  const clearScrollEndTimer = useCallback(() => {
    if (scrollEndTimerRef.current) {
      window.clearTimeout(scrollEndTimerRef.current);
      scrollEndTimerRef.current = null;
    }
  }, []);

  const cancelWheelMomentum = useCallback(() => {
    if (wheelMomentumFrameRef.current) {
      window.cancelAnimationFrame(wheelMomentumFrameRef.current);
      wheelMomentumFrameRef.current = null;
    }

    wheelVelocityRef.current = 0;
    isWheelMomentumActiveRef.current = false;
  }, []);

  const getScrollValue = useCallback(
    (scrollTop: number) => {
      const currentIndex = Math.round(
        (scrollTop - WHEEL_CENTER_OFFSET) / ROW_HEIGHT
      );
      const normalizedIndex = loop
        ? ((currentIndex % options.length) + options.length) % options.length
        : Math.min(Math.max(currentIndex, 0), options.length - 1);

      return {
        currentIndex,
        normalizedIndex,
        currentValue: options[normalizedIndex],
      };
    },
    [loop, options]
  );

  const emitSelectedValue = useCallback(
    (scrollTop: number) => {
      const { currentValue } = getScrollValue(scrollTop);

      if (currentValue !== lastEmittedValueRef.current) {
        lastEmittedValueRef.current = currentValue;
        onSelect(currentValue);
      }
    },
    [getScrollValue, onSelect]
  );

  const alignScrollToNearestValue = useCallback(
    (container: HTMLDivElement) => {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      const { currentIndex, normalizedIndex } = getScrollValue(
        container.scrollTop
      );
      const minIndex = options.length * 3;
      const maxIndex = options.length * (REPEAT_COUNT - 3);
      const nextIndex =
        loop && (currentIndex <= minIndex || currentIndex >= maxIndex)
          ? Math.floor(REPEAT_COUNT / 2) * options.length + normalizedIndex
          : currentIndex;

      isProgrammaticScrollRef.current = true;
      container.scrollTo({
        top: nextIndex * ROW_HEIGHT + WHEEL_CENTER_OFFSET,
        behavior: nextIndex === currentIndex ? "smooth" : "auto",
      });
      resetProgrammaticScrollFlag();
    },
    [getScrollValue, loop, options.length]
  );

  const moveOneStep = useCallback(
    (direction: -1 | 1) => {
      const container = containerRef.current;

      if (!container) {
        return;
      }

      const { currentIndex, normalizedIndex } = getScrollValue(
        container.scrollTop
      );
      const nextIndex = loop
        ? currentIndex + direction
        : Math.min(Math.max(normalizedIndex + direction, 0), options.length - 1);
      const nextNormalizedIndex = loop
        ? ((nextIndex % options.length) + options.length) % options.length
        : nextIndex;
      const nextValue = options[nextNormalizedIndex];

      if (!nextValue || nextValue === lastEmittedValueRef.current) {
        alignScrollToNearestValue(container);
        return;
      }

      clearScrollEndTimer();
      cancelWheelMomentum();
      lastEmittedValueRef.current = nextValue;
      onSelect(nextValue);
      isProgrammaticScrollRef.current = true;
      container.scrollTo({
        top: nextIndex * ROW_HEIGHT + WHEEL_CENTER_OFFSET,
        behavior: "smooth",
      });
      resetProgrammaticScrollFlag();
    },
    [
      alignScrollToNearestValue,
      cancelWheelMomentum,
      clearScrollEndTimer,
      getScrollValue,
      loop,
      onSelect,
      options,
    ]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const pointerStart = pointerStartRef.current;
      const container = event.currentTarget;

      pointerStartRef.current = null;

      if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
        return;
      }

      const movedDistance = Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y
      );
      const scrolledDistance = Math.abs(
        container.scrollTop - pointerStart.scrollTop
      );

      if (
        movedDistance > TAP_STEP_MAX_DISTANCE ||
        scrolledDistance > TAP_STEP_MAX_SCROLL_DISTANCE
      ) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const pointerY = event.clientY - rect.top;
      const selectedTop = rect.height / 2 - ROW_HEIGHT / 2;
      const selectedBottom = rect.height / 2 + ROW_HEIGHT / 2;

      if (pointerY < selectedTop) {
        moveOneStep(-1);
        return;
      }

      if (pointerY > selectedBottom) {
        moveOneStep(1);
      }
    },
    [moveOneStep]
  );

  const scheduleScrollEndSnap = useCallback(
    (container: HTMLDivElement) => {
      clearScrollEndTimer();

      scrollEndTimerRef.current = window.setTimeout(() => {
        alignScrollToNearestValue(container);
      }, SCROLL_IDLE_SNAP_DELAY_MS);
    },
    [alignScrollToNearestValue, clearScrollEndTimer]
  );

  const startWheelMomentum = useCallback(
    (container: HTMLDivElement) => {
      if (wheelMomentumFrameRef.current) {
        return;
      }

      isWheelMomentumActiveRef.current = true;

      const step = () => {
        const velocity = wheelVelocityRef.current;

        if (Math.abs(velocity) < WHEEL_MOMENTUM_STOP_VELOCITY) {
          wheelVelocityRef.current = 0;
          wheelMomentumFrameRef.current = null;
          isWheelMomentumActiveRef.current = false;
          alignScrollToNearestValue(container);
          return;
        }

        container.scrollTop += velocity;
        emitSelectedValue(container.scrollTop);
        wheelVelocityRef.current = velocity * WHEEL_MOMENTUM_DECAY;
        wheelMomentumFrameRef.current = window.requestAnimationFrame(step);
      };

      wheelMomentumFrameRef.current = window.requestAnimationFrame(step);
    },
    [alignScrollToNearestValue, emitSelectedValue]
  );

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

    if (hasSyncedInitialValueRef.current && lastEmittedValueRef.current === selectedValue) {
      return;
    }

    hasSyncedInitialValueRef.current = true;
    lastEmittedValueRef.current = selectedValue;
    cancelWheelMomentum();
    isProgrammaticScrollRef.current = true;
    container.scrollTop = getValueScrollTop(selectedValue);
    resetProgrammaticScrollFlag();
  }, [cancelWheelMomentum, getValueScrollTop, selectedValue]);

  useEffect(() => {
    return () => {
      clearScrollEndTimer();
      cancelWheelMomentum();
    };
  }, [cancelWheelMomentum, clearScrollEndTimer]);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="scrollbar-hide h-[186px] overflow-y-auto"
        style={{
          paddingTop: ROW_HEIGHT * 2,
          paddingBottom: ROW_HEIGHT * 2,
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
        }}
        onWheel={(event) => {
          const target = event.currentTarget;
          const impulse = getWheelMomentumImpulse(event.deltaY);
          const currentVelocity = wheelVelocityRef.current;

          event.preventDefault();
          clearScrollEndTimer();
          wheelVelocityRef.current =
            Math.sign(currentVelocity) !== 0 &&
            Math.sign(currentVelocity) !== Math.sign(impulse)
              ? impulse
              : clampWheelVelocity(currentVelocity + impulse);
          startWheelMomentum(target);
        }}
        onScroll={(event) => {
          const target = event.currentTarget;

          emitSelectedValue(target.scrollTop);
          if (!isWheelMomentumActiveRef.current) {
            scheduleScrollEndSnap(target);
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return;
          }

          pointerStartRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            scrollTop: event.currentTarget.scrollTop,
          };
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerStartRef.current = null;
        }}
      >
        {repeatedOptions.map((option) => (
          <div
            key={option.key}
            className={`relative z-10 flex h-[46px] items-center justify-center text-[26px] font-bold leading-none transition-colors ${
              option.value === selectedValue
                ? "text-slate-950 dark:text-white"
                : "text-slate-400 dark:text-slate-500"
            }`}
          >
            {getOptionLabel ? getOptionLabel(option.value) : option.value}
          </div>
        ))}
      </div>
    </div>
  );
}

type TimeWheelPickerProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function TimeWheelPicker({
  value,
  disabled = false,
  onChange,
}: TimeWheelPickerProps) {
  const text = useUiText();
  const selected = parseTimeValue(value);
  const getPeriodLabel = (period: string) =>
    period === "pm" ? text.inputs.pm : text.inputs.am;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50/55 dark:border-brand-400/30 dark:bg-slate-950/70 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      <div
        className="pointer-events-none absolute left-3 right-3 top-1/2 z-0 -translate-y-1/2 rounded-xl border border-brand-300 bg-brand-100/90 dark:border-brand-400/60 dark:bg-brand-400/20"
        style={{ height: ROW_HEIGHT }}
      />
      <div className="relative z-10 flex">
        <WheelColumn
          options={PERIOD_OPTIONS}
          selectedValue={selected.period}
          onSelect={(next) =>
            onChange(
              toTimeValue(
                next as WheelValue,
                selected.hour12,
                selected.minute
              )
            )
          }
          getOptionLabel={getPeriodLabel}
          loop={false}
        />
        <WheelColumn
          options={HOUR_OPTIONS}
          selectedValue={selected.hour12}
          onSelect={(next) =>
            onChange(toTimeValue(selected.period, next, selected.minute))
          }
        />
        <WheelColumn
          options={MINUTE_OPTIONS}
          selectedValue={selected.minute}
          onSelect={(next) =>
            onChange(toTimeValue(selected.period, selected.hour12, next))
          }
        />
      </div>
    </div>
  );
}

function TimeWheelInput({
  value,
  placeholder,
  title,
  description,
  disabled = false,
  onChange,
}: TimeWheelInputProps) {
  const text = useUiText();
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState("09:00");

  const openTimePicker = () => {
    if (disabled) {
      return;
    }

    setDraftValue(value || "09:00");
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

  const hasValue = Boolean(value);

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openTimePicker}
        className="w-full rounded-2xl border border-brand-200 bg-white px-3 py-3 text-left text-sm text-slate-700 disabled:opacity-50 dark:border-brand-400/30 dark:bg-slate-900 dark:text-white"
      >
        {hasValue ? (
          formatTimeWheelLabel(value, text)
        ) : (
          <span className="text-slate-400">
            {placeholder ?? text.inputs.timePlaceholder}
          </span>
        )}
      </button>

      {isOpen ? (
        <div
          className={`fixed inset-0 ${UI_LAYER_CLASS.inputDialog} flex items-center justify-center bg-slate-900/45 px-4`}
        >
          <div className="w-full max-w-[360px] rounded-[26px] border border-brand-200 bg-white p-3.5 text-slate-900 shadow-2xl dark:border-brand-400/30 dark:bg-[#102a27] dark:text-white">
            <div className="mb-2.5">
              <p className="text-[28px] font-bold leading-tight">{title}</p>
              {description ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                  {description}
                </p>
              ) : null}
            </div>

            <TimeWheelPicker value={draftValue} onChange={setDraftValue} />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-2xl border border-brand-200 bg-white px-4 py-2.5 text-base font-semibold text-slate-600 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-200"
              >
                {text.common.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draftValue);
                  setIsOpen(false);
                }}
                className="rounded-2xl bg-brand-600 px-4 py-2.5 text-base font-bold text-white"
              >
                {text.inputs.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default TimeWheelInput;
