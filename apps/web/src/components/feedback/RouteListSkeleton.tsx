type RouteListSkeletonVariant = "my-route" | "history" | "shared";

type RouteCardSkeletonProps = {
  variant?: RouteListSkeletonVariant;
};

type RouteListSkeletonProps = {
  variant?: RouteListSkeletonVariant;
  itemCount?: number;
  className?: string;
};

const DEFAULT_SKELETON_ITEMS = ["first", "second", "third"];

function joinClassNames(...classNames: Array<string | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

function RouteSummarySkeleton() {
  return (
    <article className="animate-pulse overflow-hidden rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-brand-50 dark:bg-brand-400/15" />
            <div className="h-6 w-14 rounded-full bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="mt-3 h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="size-11 shrink-0 rounded-2xl bg-brand-100 dark:bg-brand-400/20" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-12 rounded-xl bg-brand-50 dark:bg-brand-400/15" />
        <div className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50" />
        <div className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950/50" />
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-7 flex-1 rounded-full bg-brand-50 dark:bg-brand-400/15" />
        <div className="h-7 flex-1 rounded-full bg-slate-100 dark:bg-slate-800" />
      </div>
    </article>
  );
}

function SharedRouteSkeleton() {
  return (
    <article className="min-h-[156px] animate-pulse rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/35 dark:bg-[#071f1d]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-4 w-3/4 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="h-9 w-16 shrink-0 rounded-full bg-brand-50 dark:bg-brand-400/15" />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <div className="h-7 w-20 rounded-full bg-slate-50 dark:bg-slate-900" />
        <div className="h-7 w-16 rounded-full bg-slate-50 dark:bg-slate-900" />
        <div className="h-7 w-24 rounded-full bg-slate-50 dark:bg-slate-900" />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <div className="h-7 w-24 rounded-full bg-brand-50 dark:bg-brand-400/15" />
        <div className="h-7 w-20 rounded-full bg-brand-50 dark:bg-brand-400/15" />
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
        <div className="h-full w-2/3 rounded-full bg-brand-200 dark:bg-brand-400/35" />
      </div>
    </article>
  );
}

function RouteCardSkeleton({ variant = "my-route" }: RouteCardSkeletonProps) {
  if (variant === "shared") {
    return <SharedRouteSkeleton />;
  }

  return <RouteSummarySkeleton />;
}

export default function RouteListSkeleton({
  variant = "my-route",
  itemCount = DEFAULT_SKELETON_ITEMS.length,
  className,
}: RouteListSkeletonProps) {
  const items = Array.from(
    { length: itemCount },
    (_, index) => DEFAULT_SKELETON_ITEMS[index] ?? `item-${index}`
  );

  return (
    <div
      aria-busy="true"
      className={joinClassNames("space-y-3 px-px pb-1 pt-1", className)}
    >
      {items.map((item) => (
        <RouteCardSkeleton key={item} variant={variant} />
      ))}
    </div>
  );
}
