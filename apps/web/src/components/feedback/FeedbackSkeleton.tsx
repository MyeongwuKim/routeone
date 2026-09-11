/**
 * 사용 위치: 내 정보 → 불편사항 보내기 화면을 불러오는 동안
 *
 * 용도:
 * 문의 화면의 구성과 비슷한 자리 표시자를 먼저 보여준다.
 *
 * 구조:
 * 상단 제목, 문의 안내 카드, 이메일 복사 카드로 구성되어 있다.
 */
import { MdArrowBack } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useUiText } from "@/lib/uiText";

function FeedbackSkeleton() {
  const navigate = useNavigate();
  const text = useUiText();

  return (
    <section
      aria-busy="true"
      aria-label={text.feedback.title}
      className="space-y-4 pb-4 text-slate-900 dark:text-slate-100"
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200"
        >
          <MdArrowBack aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeShell.appSettings}
          </p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {text.feedback.title}
          </h1>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/20 dark:bg-[#0b211f]">
        <div>
          <div className="skeleton-shimmer h-5 w-32 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="skeleton-shimmer mt-3 h-3 w-full rounded-full bg-slate-100 dark:bg-slate-800" />
          <div className="skeleton-shimmer mt-2 h-3 w-4/5 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="skeleton-shimmer h-[4.25rem] w-full rounded-xl bg-brand-50 dark:bg-brand-400/10" />
        <div className="skeleton-shimmer h-12 w-full rounded-xl bg-brand-200 dark:bg-brand-400/20" />
        <div className="skeleton-shimmer h-3 w-3/4 rounded-full bg-slate-100 dark:bg-slate-800" />
      </section>

      <section className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4 dark:border-brand-400/20 dark:bg-[#0b211f]">
        <div>
          <div className="skeleton-shimmer h-4 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="skeleton-shimmer mt-2 h-3 w-4/5 rounded-full bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="skeleton-shimmer h-11 w-full rounded-xl bg-brand-50 dark:bg-brand-400/10" />
        <div className="skeleton-shimmer h-11 w-full rounded-xl bg-slate-100 dark:bg-slate-800" />
      </section>
    </section>
  );
}

export default FeedbackSkeleton;
