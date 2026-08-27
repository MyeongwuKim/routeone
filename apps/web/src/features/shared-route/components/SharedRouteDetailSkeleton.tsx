import { createPortal } from "react-dom";
import { MdClose } from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import { getSharedRouteTitle, type SharedRoute } from "../sharedRouteCardModel";
import SharedRouteAuthor from "./SharedRouteAuthor";
import SharedRouteDetailMeta from "./SharedRouteDetailMeta";

type SharedRouteDetailSkeletonProps = {
  route?: SharedRoute;
  onClose: () => void;
};

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`skeleton-shimmer bg-brand-100/70 dark:bg-brand-200/10 ${className}`}
    />
  );
}

function SharedRouteDetailSkeleton({
  route,
  onClose,
}: SharedRouteDetailSkeletonProps) {
  const text = useUiText();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={text.sharedRoute.loadingDetail}
      className="fixed inset-0 z-[2300] bg-white"
    >
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between gap-3 border-b border-brand-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="font-trip text-sm text-brand-700">SHARED ROUTE</p>
            {route ? (
              <>
                <SharedRouteAuthor owner={route.owner} className="mt-2" />
                <h2 className="mt-1 truncate text-lg font-bold text-slate-900">
                  {getSharedRouteTitle(route, text)}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-slate-500">
                  {text.dayRoute.daySchedule(route.tripDays)} ·{" "}
                  {text.dayRoute.fullRouteProgress(
                    route.completedStopCount,
                    route.totalStopCount
                  )}
                </p>
              </>
            ) : (
              <div aria-hidden="true">
                <div className="mt-2 flex items-center gap-2">
                  <SkeletonBlock className="size-7 shrink-0 rounded-full" />
                  <SkeletonBlock className="h-3 w-24 max-w-full rounded" />
                </div>
                <SkeletonBlock className="mt-2 h-5 w-3/4 rounded-md" />
                <SkeletonBlock className="mt-2 h-3 w-2/3 rounded" />
              </div>
            )}
            <div aria-hidden="true" className="mt-1 flex h-4 items-center">
              <SkeletonBlock className="h-2.5 w-28 rounded" />
            </div>
            {route ? (
              <div className="mt-2">
                <SharedRouteDetailMeta route={route} />
              </div>
            ) : (
              <div aria-hidden="true" className="mt-2 flex gap-1.5">
                {["w-16", "w-20", "w-14"].map((width) => (
                  <SkeletonBlock
                    key={width}
                    className={`h-6 rounded-full ${width}`}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={text.dayRoute.closeAria}
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdClose />
          </button>
        </header>

        <div role="status" className="sr-only">
          {text.sharedRoute.loadingDetail}
        </div>
        <div aria-hidden="true" className="min-h-0 flex-1 overflow-hidden px-4 py-4">
          <div className="overflow-hidden rounded-2xl border border-brand-200">
            <div className="flex items-center gap-3 px-4 py-3">
              <SkeletonBlock className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-3.5 w-16 rounded" />
                <SkeletonBlock className="h-3 w-2/3 rounded" />
                <SkeletonBlock className="h-2.5 w-3/4 rounded" />
              </div>
              <SkeletonBlock className="h-6 w-10 rounded-full" />
            </div>
            <div className="border-t border-brand-100 p-4">
              <div className="mb-4 space-y-3 rounded-2xl border border-brand-100 p-4">
                <SkeletonBlock className="h-4 w-20 rounded" />
                <SkeletonBlock className="h-2 w-full rounded-full" />
                <div className="flex gap-2">
                  <SkeletonBlock className="h-6 w-24 rounded-full" />
                  <SkeletonBlock className="h-6 w-24 rounded-full" />
                </div>
              </div>
              <div className="relative space-y-5">
                <div className="absolute bottom-6 left-5 top-5 w-px bg-brand-100 dark:bg-brand-400/20" />
                {[0, 1, 2].map((index) => (
                  <div key={index} className="relative flex items-start gap-3">
                    <SkeletonBlock className="size-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 rounded-2xl border border-brand-100 px-4 py-3">
                      <div className="flex gap-3">
                        <SkeletonBlock className="size-12 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <SkeletonBlock className="h-3.5 w-4/5 rounded" />
                          <SkeletonBlock className="h-5 w-16 max-w-full rounded-full" />
                        </div>
                      </div>
                      <SkeletonBlock className="mt-3 h-5 w-24 max-w-full rounded-full" />
                      <SkeletonBlock className="mt-3 h-3 w-full rounded" />
                      <SkeletonBlock className="mt-2 h-3 w-2/3 rounded" />
                      <SkeletonBlock className="mt-4 h-9 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <footer aria-hidden="true" className="app-safe-area-footer grid shrink-0 grid-cols-2 gap-2 border-t border-brand-100 px-4 py-3">
          <SkeletonBlock className="h-11 rounded-2xl" />
          <SkeletonBlock className="h-11 rounded-2xl" />
        </footer>
      </div>
    </div>,
    document.body
  );
}

export default SharedRouteDetailSkeleton;
