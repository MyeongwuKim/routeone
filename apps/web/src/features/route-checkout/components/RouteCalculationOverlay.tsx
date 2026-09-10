/**
 * 사용 위치: 추천 루트 결과 화면 → 이동시간 계산 중
 * 용도: 여러 DAY를 계산할 때 화면 중앙에 감자 로딩을 하나만 표시한다.
 */
import { createPortal } from "react-dom";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
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
      <PotatoLoadingCard
        title={text.dayRoute.routeCalculating}
        description={text.cart.routeTravelCalculatingDescription}
        animation="running"
        layout="stacked"
      />
    </div>,
    document.body
  );
}
