import { useUiText } from "@/lib/uiText";

type PlaceResultCardProps = {
  title: string;
  address: string;
  categoryLabel: string;
  thumbnailUrl?: string;
  fallbackIcon: string;
  distanceLabel?: string | null;
  badgeLabel?: string | null;
  onClick: () => void;
  surface?: "white" | "tinted";
};

function PlaceResultCard({
  title,
  address,
  categoryLabel,
  thumbnailUrl,
  fallbackIcon,
  distanceLabel,
  badgeLabel,
  onClick,
  surface = "white",
}: PlaceResultCardProps) {
  const text = useUiText();

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-2xl border border-brand-100 px-3 py-2.5 text-left ${
        surface === "tinted"
          ? "bg-brand-50/60 dark:border-brand-400/30 dark:bg-slate-950/40"
          : "bg-white shadow-[0_4px_14px_rgba(15,23,42,0.04)] dark:border-brand-400/25 dark:bg-slate-900/80"
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-brand-100 bg-brand-50">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={text.placeSheet.thumbnailAlt(title)}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base text-slate-400">
              {fallbackIcon}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-50">
            {title}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-200">
              {categoryLabel}
            </p>
            {badgeLabel ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:border-rose-400/50 dark:bg-rose-400/15 dark:text-rose-200">
                {badgeLabel}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {address}
          </p>
        </div>
      </div>

      {distanceLabel ? (
        <div className="ml-3 shrink-0 text-right">
          <p className="text-[11px] font-semibold text-brand-700 dark:text-brand-200">
            {distanceLabel}
          </p>
        </div>
      ) : null}
    </button>
  );
}

export default PlaceResultCard;
