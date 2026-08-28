import { useUiText } from "@/lib/uiText";

function AccountInfoSkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className="skeleton-shimmer mt-0.5 size-9 shrink-0 rounded-xl bg-brand-50 dark:bg-brand-400/10" />
      <div className="min-w-0 flex-1">
        <div className="skeleton-shimmer h-3 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="skeleton-shimmer mt-2 h-4 w-44 max-w-full rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

export function AccountLoadingState({
  variant = "summary",
}: {
  variant?: "summary" | "details";
}) {
  const text = useUiText();
  const isDetailed = variant === "details";

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={text.account.loading}
      className="space-y-4"
    >
      <div
        aria-hidden="true"
        className={`flex items-center gap-4 overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-white via-white to-brand-50 py-5 shadow-sm dark:border-brand-400/25 dark:from-[#0d2926] dark:via-[#0b211f] dark:to-[#0f3431] ${isDetailed ? "px-5" : "px-4"}`}
      >
        <div
          className={`skeleton-shimmer shrink-0 rounded-full bg-brand-100 ring-4 ring-white/80 dark:bg-brand-400/20 dark:ring-brand-950/40 ${isDetailed ? "size-20" : "size-[4.5rem]"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="skeleton-shimmer h-7 w-28 max-w-full rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="skeleton-shimmer mt-1 h-5 w-40 max-w-full rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="skeleton-shimmer mt-2 h-6 w-20 rounded-full bg-brand-100 dark:bg-brand-400/15" />
        </div>
        {!isDetailed ? (
          <div className="skeleton-shimmer size-9 shrink-0 rounded-full bg-slate-100 dark:bg-brand-400/10" />
        ) : null}
      </div>

      {isDetailed ? (
        <section
          aria-hidden="true"
          className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d]"
        >
          <div className="border-b border-brand-50 px-4 py-3 dark:border-brand-400/15">
            <p className="text-xs font-black text-brand-700 dark:text-brand-200">
              {text.account.accountSection}
            </p>
          </div>
          <div className="divide-y divide-brand-50 dark:divide-brand-400/15">
            {[0, 1, 2].map((index) => (
              <AccountInfoSkeletonRow key={index} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function AccountLoadError({ onRetry }: { onRetry: () => void }) {
  const text = useUiText();

  return (
    <section
      role="alert"
      className="rounded-3xl border border-rose-100 bg-rose-50 p-5 dark:border-rose-400/25 dark:bg-rose-950/20"
    >
      <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">
        {text.account.loadError}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-700"
      >
        {text.common.retry}
      </button>
    </section>
  );
}
