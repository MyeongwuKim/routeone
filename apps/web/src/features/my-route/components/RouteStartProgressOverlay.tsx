/**
 * 사용 위치: 내 일정 화면 → 여행 시작 처리
 *
 * 용도:
 * 위치 권한 확인, 도착 알림 준비, 여행 시작 API가 끝날 때까지
 * 사용자가 시작 처리 중임을 알 수 있도록 보여주는 차단형 안내다.
 *
 * 구조:
 * 루트를 따라 이동하는 감자 애니메이션과 진행 안내 문구로 구성되어 있다.
 */
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
