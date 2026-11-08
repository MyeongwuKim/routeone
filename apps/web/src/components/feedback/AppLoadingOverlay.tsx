import { useUiLoadingStore, type AppLoadingAnimation } from "@/stores/uiLoadingStore";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import AppStatusIcon from "./AppStatusIcon";

type AppLoadingCardProps = {
  title: string;
  description?: string;
  footerText?: string;
  /** 기존 작업 단계 값은 유지하며, empty일 때만 공통 나침반의 움직임을 멈춘다. */
  animation?: AppLoadingAnimation;
  compact?: boolean;
  layout?: "inline" | "stacked";
  className?: string;
};

/** 로딩과 빈 화면의 제목·설명을 같은 아이콘과 카드로 표시한다. 화면 조작 차단은 부모가 결정한다. */
export function AppLoadingCard({
  title,
  description,
  footerText,
  animation = "generic",
  compact = false,
  layout = "inline",
  className = "",
}: AppLoadingCardProps) {
  const isStacked = layout === "stacked";

  return (
    <div className={`w-full rounded-3xl border border-brand-200 bg-white/95 shadow-sm backdrop-blur dark:border-brand-400/30 dark:bg-[#0b211f]/95 ${compact ? "max-w-none px-4 py-4" : isStacked ? "max-w-sm px-6 py-6" : "max-w-sm px-5 py-4"} ${className}`}>
      <div className={`flex gap-3 ${isStacked ? "flex-col items-center text-center" : "items-center"}`}>
        <AppStatusIcon animated={animation !== "empty"} compact={compact} />
        <div className={`min-w-0 ${isStacked ? "max-w-xs" : ""}`}>
          <p className={`${isStacked ? "text-base font-bold" : "text-sm font-semibold"} text-slate-800 dark:text-slate-100`}>{title}</p>
          {description ? <p className={`${isStacked ? "mt-2" : "mt-1"} text-xs leading-5 text-slate-500 dark:text-slate-300`}>{description}</p> : null}
          {footerText ? <p className={`${compact ? "mt-1.5 text-[11px]" : "mt-2 text-xs"} text-brand-700 dark:text-brand-200`}>{footerText}</p> : null}
        </div>
      </div>
    </div>
  );
}

/** 진행 중인 작업의 전역 안내를 표시한다. 배경 가림·터치 차단은 기존 로딩 Store의 설정을 따른다. */
export default function AppLoadingOverlay() {
  const { isOpen, title, description, footerText, animation, dimmed, blocking } = useUiLoadingStore();
  if (!isOpen) return null;

  return (
    <div aria-busy="true" aria-live="polite" className={`${blocking ? "pointer-events-auto touch-none" : "pointer-events-none"} fixed inset-0 ${UI_LAYER_CLASS.loadingOverlay} flex items-center justify-center px-4`}>
      {dimmed ? <div className="absolute inset-0 bg-slate-900/5" /> : null}
      <AppLoadingCard title={title} description={description} footerText={footerText} animation={animation} className="shadow-xl" />
    </div>
  );
}
