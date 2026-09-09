/**
 * 진입 경로: 내 정보 → 불편사항 보내기
 * 용도: 문의할 내용을 안내하고 앱 버전이 채워진 메일 작성창을 연다.
 * 구조: 문의 안내, 메일 앱 열기, 이메일 주소 복사 영역으로 구성되어 있다.
 */
import { MdArrowBack, MdContentCopy, MdMailOutline } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useFeedbackEmail } from "@/features/feedback/hooks/useFeedbackEmail";
import { FEEDBACK_EMAIL } from "@/features/feedback/utils/feedbackEmail";
import { useUiText } from "@/lib/uiText";

function FeedbackPage() {
  const text = useUiText();
  const feedback = text.feedback;
  const navigate = useNavigate();
  const { emailUrl, emailInputRef, copyStatus, openFailed, handleOpenEmail, handleCopyEmail } = useFeedbackEmail();

  return (
    <section className="space-y-4 pb-4 text-slate-900 dark:text-slate-100">
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
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">{text.routeShell.appSettings}</p>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">{feedback.title}</h1>
        </div>
      </header>

      <section className="space-y-4 rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/20 dark:bg-[#0b211f]">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{feedback.heading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{feedback.description}</p>
        </div>
        <p className="rounded-xl bg-brand-50 p-3 text-xs leading-relaxed text-brand-800 dark:bg-brand-400/10 dark:text-brand-100">{feedback.detailsHint}</p>
        <a
          href={emailUrl}
          onClick={handleOpenEmail}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <MdMailOutline className="shrink-0 text-xl" aria-hidden="true" />
          {feedback.openEmail}
        </a>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{feedback.environmentNote}</p>
        {openFailed ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{feedback.openFailed}</p> : null}
      </section>

      <section className="space-y-3 rounded-2xl border border-brand-100 bg-white p-4 dark:border-brand-400/20 dark:bg-[#0b211f]">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">{feedback.fallbackTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{feedback.fallbackDescription}</p>
        </div>
        <input
          ref={emailInputRef}
          type="text"
          readOnly
          value={FEEDBACK_EMAIL}
          aria-label={feedback.recipientLabel}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-11 w-full min-w-0 select-text rounded-xl border border-brand-100 bg-brand-50 px-3 text-sm text-brand-800 focus:outline-brand-600 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-100"
        />
        <button
          type="button"
          onClick={() => void handleCopyEmail()}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-200 px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-50 dark:border-brand-400/30 dark:text-brand-200 dark:hover:bg-brand-400/10"
        >
          <MdContentCopy aria-hidden="true" />
          {feedback.copyEmail}
        </button>
        <p role="status" className="empty:hidden text-xs leading-relaxed text-brand-700 dark:text-brand-200">
          {copyStatus === "copied" ? feedback.copied : copyStatus === "manual" ? feedback.copyManually : ""}
        </p>
      </section>
    </section>
  );
}

export default FeedbackPage;
