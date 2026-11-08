/**
 * 사용 위치: 추천 루트 결과 화면 → 이동시간 계산 중
 * 용도: 여러 DAY를 계산할 때 화면 중앙에 공통 진행 안내를 하나만 표시한다.
 */
import { createPortal } from "react-dom";
import { AppLoadingCard } from "@/components/feedback/AppLoadingOverlay";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useUiText } from "@/lib/uiText";

export default function RouteCalculationOverlay() {
  const text = useUiText();

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`pointer-events-none fixed inset-0 ${UI_LAYER_CLASS.routeCheckoutDialog} flex items-center justify-center bg-slate-950/15 px-4`}
    >
      <AppLoadingCard
        title={text.dayRoute.routeCalculating}
        description={text.cart.routeTravelCalculatingDescription}
        animation="running"
        layout="stacked"
      />
    </div>,
    document.body
  );
}
