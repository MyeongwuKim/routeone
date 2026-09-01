/**
 * 사용 위치: 내 일정 화면 → 여행 시작 처리
 *
 * 용도:
 * 위치 권한 확인, 도착 알림 준비, 여행 시작 API가 끝날 때까지
 * 사용자가 시작 처리 중임을 알 수 있도록 보여주는 차단형 안내다.
 *
 * 구조:
 * 로딩 표시와 진행 안내 문구로 구성되어 있다.
 */
import { useUiText } from "@/lib/uiText";

function RouteStartProgressOverlay() {
  const text = useUiText();

  return (
    <div className="fixed inset-0 z-[3400] flex items-center justify-center bg-slate-900/35 px-4">
      <section
        role="status"
        aria-live="polite"
        className="w-full max-w-xs rounded-[1.4rem] border border-brand-100 bg-white px-5 py-6 text-center shadow-2xl"
      >
        <span className="mx-auto block size-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
        <p className="mt-4 text-base font-bold text-slate-900">
          {text.myRoute.startPendingTitle}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {text.myRoute.startPendingDescription}
        </p>
      </section>
    </div>
  );
}

export default RouteStartProgressOverlay;
