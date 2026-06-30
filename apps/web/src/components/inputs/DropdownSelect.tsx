import { useEffect, useRef, useState, type ReactNode } from "react";
import { MdCheck, MdKeyboardArrowDown } from "react-icons/md";

export type DropdownSelectOption<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
};

type DropdownSelectProps<TValue extends string> = {
  options: ReadonlyArray<DropdownSelectOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

function mergeClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function DropdownSelect<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
}: DropdownSelectProps<TValue>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption =
    options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={mergeClasses("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className={mergeClasses(
          "inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2.5 text-left text-sm font-bold text-slate-700 shadow-sm transition hover:border-brand-300 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-slate-100 dark:hover:border-brand-300/70",
          buttonClassName
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption?.icon ? (
            <span className="shrink-0 text-base text-brand-600 dark:text-brand-200">
              {selectedOption.icon}
            </span>
          ) : null}
          <span className="min-w-0 truncate">{selectedOption?.label}</span>
        </span>
        <MdKeyboardArrowDown
          className={`shrink-0 text-xl transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div
          className={mergeClasses(
            "absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full min-w-[12rem] overflow-hidden rounded-2xl border border-brand-100 bg-white p-1.5 shadow-xl dark:border-brand-400/25 dark:bg-[#0b211f]",
            menuClassName
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!isSelected) {
                    onChange(option.value);
                  }
                  setIsOpen(false);
                }}
                className={mergeClasses(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition disabled:pointer-events-none disabled:opacity-40",
                  isSelected
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-400/15 dark:text-brand-100"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                )}
              >
                {option.icon ? (
                  <span className="shrink-0 text-base">{option.icon}</span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black">
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="mt-0.5 block truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <MdCheck className="shrink-0 text-lg text-brand-600 dark:text-brand-200" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default DropdownSelect;
