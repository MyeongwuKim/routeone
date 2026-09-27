/** 내 경로에서 위치 권한 확인·도착 알림 준비·시작 API 처리 단계에 맞는 문구와 애니메이션을 차단형 오버레이로 표시한다. */
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { useUiText } from "@/lib/uiText";

function RouteStartProgressOverlay() {
  const text = useUiText();

  return (
    <div className="fixed inset-0 z-[3400] flex items-center justify-center bg-slate-900/35 px-4">
      <div role="status" aria-live="polite" className="w-full max-w-sm">
        <PotatoLoadingCard
          title={text.myRoute.startPendingTitle}
          description={text.myRoute.startPendingDescription}
          animation="running"
          layout="stacked"
        />
      </div>
    </div>
  );
}

export default RouteStartProgressOverlay;
