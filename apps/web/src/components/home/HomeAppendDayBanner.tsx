/** 기존 경로에 추가할 DAY 문맥을 홈 지도 위에 표시하고 장소 목록 열기 또는 추가 취소를 전달한다. */
import type { UiText } from "@/lib/uiText";
import type { RouteAppendTarget } from "@/stores/routeEditFlowStore";

type HomeAppendDayBannerProps = {
  appendTarget: RouteAppendTarget;
  onCancel: () => void;
  onOpenCheckout: () => void;
  text: UiText;
};

export default function HomeAppendDayBanner({
  appendTarget,
  onCancel,
  onOpenCheckout,
  text,
}: HomeAppendDayBannerProps) {
  return (
    <div className="pointer-events-auto absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+9rem)] z-30 rounded-2xl border border-brand-200 bg-white/95 p-3 shadow-md backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-sm font-black text-brand-700">
          D{appendTarget.nextDayIndex}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-slate-900">
            {text.home.appendDayTitle(
              appendTarget.routeTitle,
              appendTarget.nextDayIndex
            )}
          </p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {text.home.appendDayDescription(appendTarget.nextDayIndex)}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenCheckout}
              className="rounded-xl bg-brand-600 px-3 py-2 text-xs font-bold text-white"
            >
              {text.home.checkout}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500"
            >
              {text.common.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
