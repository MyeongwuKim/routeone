import type { ReactNode } from "react";

type RoutePageHeaderProps = {
  icon: ReactNode;
  title: string;
  description?: string;
};

function RoutePageHeader({ icon, title, description }: RoutePageHeaderProps) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-sm font-bold text-slate-900 dark:text-white">
            {title}
          </h1>
          {description ? (
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RoutePageHeader;
