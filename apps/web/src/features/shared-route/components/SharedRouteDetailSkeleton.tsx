import { MdClose } from "react-icons/md";

type SharedRouteDetailSkeletonProps = {
  onClose: () => void;
};

function SharedRouteDetailSkeleton({ onClose }: SharedRouteDetailSkeletonProps) {
  return (
    <div className="fixed inset-0 z-[2300] bg-white dark:bg-[#071718]">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3 dark:border-brand-400/25">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">SHARED ROUTE</p>
            <div className="skeleton-shimmer mt-2 h-6 w-44 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="skeleton-shimmer mt-2 h-3 w-56 rounded-full bg-slate-200 dark:bg-slate-700" />
          </div>
          <button
            type="button"
            aria-label="공유 루트 상세 닫기"
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdClose />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-hidden px-4 py-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-2xl border border-brand-100 bg-white p-4 dark:border-brand-400/25 dark:bg-slate-950/40"
            >
              <div className="flex items-center gap-3">
                <div className="skeleton-shimmer size-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton-shimmer h-5 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="skeleton-shimmer h-3 w-48 rounded-full bg-slate-200 dark:bg-slate-700" />
                  <div className="skeleton-shimmer h-3 w-36 rounded-full bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SharedRouteDetailSkeleton;
