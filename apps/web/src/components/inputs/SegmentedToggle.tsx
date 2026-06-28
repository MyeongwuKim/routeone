import type { ReactNode } from "react";

export type SegmentedToggleOption<TValue extends string> = {
  value: TValue;
  label: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type SegmentedToggleProps<TValue extends string> = {
  options: ReadonlyArray<SegmentedToggleOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  ariaLabel?: string;
  className?: string;
  itemClassName?: string;
  selectedItemClassName?: string;
  idleItemClassName?: string;
  fullWidth?: boolean;
  size?: "xs" | "sm";
};

const SIZE_CLASS = {
  xs: "px-2.5 py-1.5 text-[11px]",
  sm: "px-3 py-2 text-xs",
} as const;

function mergeClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SegmentedToggle<TValue extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
  itemClassName,
  selectedItemClassName,
  idleItemClassName,
  fullWidth = false,
  size = "sm",
}: SegmentedToggleProps<TValue>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={mergeClasses(
        "inline-flex rounded-full border border-brand-200 bg-brand-50 p-1",
        fullWidth && "w-full",
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            onClick={() => {
              if (!isSelected) {
                onChange(option.value);
              }
            }}
            className={mergeClasses(
              "rounded-full font-black transition disabled:pointer-events-none disabled:opacity-40",
              SIZE_CLASS[size],
              fullWidth && "flex-1 justify-center",
              itemClassName,
              isSelected
                ? (selectedItemClassName ?? "bg-brand-600 text-white shadow-sm")
                : (idleItemClassName ?? "text-brand-700 hover:bg-white/60")
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedToggle;
