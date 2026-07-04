import type { ButtonHTMLAttributes, ReactNode } from "react";

type SelectablePillButtonVariant = "light" | "dark";
type SelectablePillButtonSize = "xs" | "sm";

type SelectablePillButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    selected?: boolean;
    icon?: ReactNode;
    variant?: SelectablePillButtonVariant;
    size?: SelectablePillButtonSize;
    selectedClassName?: string;
    idleClassName?: string;
  };

const BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border font-semibold shadow-sm backdrop-blur transition active:scale-95 disabled:pointer-events-none disabled:opacity-40";

const SIZE_CLASS: Record<SelectablePillButtonSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-3.5 text-xs",
};

const SELECTED_CLASS =
  "border-brand-500 bg-brand-600 text-white dark:border-brand-400 dark:bg-brand-600 dark:text-white";

const IDLE_CLASS: Record<SelectablePillButtonVariant, string> = {
  light:
    "border-brand-200 bg-white/95 text-slate-600 hover:bg-brand-50 dark:border-brand-400/30 dark:bg-slate-950/90 dark:text-slate-100 dark:hover:bg-slate-900",
  dark: "border-brand-400/25 bg-[#071718] text-slate-300 hover:bg-[#0f3431]",
};

function mergeClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SelectablePillButton({
  selected = false,
  icon,
  variant = "light",
  size = "xs",
  selectedClassName,
  idleClassName,
  className,
  children,
  ...buttonProps
}: SelectablePillButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={mergeClasses(
        BASE_CLASS,
        SIZE_CLASS[size],
        selected
          ? (selectedClassName ?? SELECTED_CLASS)
          : (idleClassName ?? IDLE_CLASS[variant]),
        className
      )}
      {...buttonProps}
    >
      {icon}
      {typeof children === "string" ? <span>{children}</span> : children}
    </button>
  );
}

export default SelectablePillButton;
