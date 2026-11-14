import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useUiText } from "@/lib/uiText";
import { lockHistoryNavigation } from "@/lib/historyNavigationGuard";
import type { RouteSkippingOperation } from "../../models/routeSkipping";

/**
 * 건너뛰기·복원·DAY 마무리의 저장과 알림 처리가 진행 중임을 경로 점의 이동으로 보여준다.
 * 작업 중 배경·Escape·앱 내부 뒤로가기를 막고, 완료/실패로 해제되면 포커스와 스크롤을 복원한다.
 */
export default function RouteSkippingProgressDialog({ operation }: { operation: RouteSkippingOperation }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const text = useUiText();
  const reversing = operation.kind === "stop-skip" && !operation.skipped;
  const title = operation.kind === "day-finish" ? text.dayRoute.finishingDayProgress
    : reversing ? text.dayRoute.restoringSkippedStop : text.dayRoute.skippingStop;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const unlockHistoryNavigation = lockHistoryNavigation();
    const syncMotionVisibility = () => {
      if (dialog) dialog.dataset.motionPaused = String(document.visibilityState === "hidden");
    };
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    syncMotionVisibility();
    document.addEventListener("visibilitychange", syncMotionVisibility);
    return () => {
      unlockHistoryNavigation();
      document.removeEventListener("visibilitychange", syncMotionVisibility);
      document.body.style.overflow = previousOverflow;
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={descriptionId}
      aria-modal="true" aria-busy="true" tabIndex={-1} onCancel={event => event.preventDefault()}
      className="route-skip-progress fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-xs rounded-2xl border border-brand-200 bg-white px-6 py-7 text-center text-slate-900 outline-none backdrop:bg-slate-950/25 dark:border-brand-400/25 dark:bg-[#0b211f] dark:text-slate-100">
      <svg aria-hidden="true" viewBox="0 0 144 88" data-direction={reversing ? "backward" : "forward"}
        className="route-skip-journey mx-auto h-24 w-40 text-brand-600 dark:text-brand-200">
        <path d="M24 58H120" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" opacity=".25" />
        <path d="M24 50Q72 0 120 50" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 5" opacity=".2" />
        <circle cx="24" cy="58" r="5" fill="currentColor" opacity=".35" />
        <circle cx="72" cy="58" r="5" fill="none" stroke="currentColor" strokeWidth="2" opacity=".3" />
        <path d="M69 58H75" stroke="currentColor" strokeWidth="1.5" opacity=".4" />
        <circle cx="120" cy="58" r="5" fill="none" stroke="currentColor" strokeWidth="2" opacity=".7" />
        <g className="route-skip-motion">
          <circle cx="24" cy="58" r="9" fill="currentColor" />
          <path d="M21 54L25 58L21 62" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stroke-white dark:stroke-[#0b211f]" />
        </g>
      </svg>
      <h2 id={titleId} className="mt-2 text-base font-bold leading-6">{title}</h2>
      <p id={descriptionId} role="status" aria-live="polite" className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
        {text.dayRoute.skipProgressDescription}
      </p>
    </dialog>, document.body
  );
}
