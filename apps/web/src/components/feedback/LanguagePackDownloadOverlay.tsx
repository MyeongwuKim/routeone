/** 영어팩 준비 중 전역 모달과 진행률을 표시하고 탭·키보드·앱 내부 뒤로가기를 막는다. */
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import AppStatusIcon from "./AppStatusIcon";

function DownloadDialog({ progress }: { progress: number | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const historyIndex = window.history.state?.idx;

    // BrowserRouter와 HashRouter가 기록한 위치로 돌아가 화면 이탈을 취소한다.
    const preventHistoryNavigation = (event: PopStateEvent) => {
      const nextIndex = window.history.state?.idx;
      if (typeof historyIndex !== "number" || typeof nextIndex !== "number" || nextIndex === historyIndex) return;
      event.stopImmediatePropagation();
      window.history.go(historyIndex - nextIndex);
    };

    dialog?.showModal();
    document.body.style.overflow = "hidden";
    window.addEventListener("popstate", preventHistoryNavigation, true);

    return () => {
      window.removeEventListener("popstate", preventHistoryNavigation, true);
      document.body.style.overflow = previousOverflow;
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const percentage = progress === null ? null : Math.round(progress * 100);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="language-download-title"
      aria-describedby="language-download-description"
      aria-modal="true"
      aria-busy="true"
      tabIndex={-1}
      onCancel={(event) => event.preventDefault()}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-3xl border border-brand-200 bg-white p-6 text-slate-900 shadow-2xl outline-none backdrop:bg-slate-950/45 dark:border-brand-400/30 dark:bg-[#0b211f] dark:text-white"
    >
      <div className="flex flex-col items-center text-center">
        <AppStatusIcon animated />
        <h2 id="language-download-title" className="mt-3 text-base font-bold">영어 언어팩을 준비하고 있어요</h2>
        <p id="language-download-description" role="status" className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">준비가 끝나면 영어로 전환돼요. 잠시만 기다려 주세요.</p>
        <progress aria-label="영어 언어팩 준비 진행률" max={1} value={progress ?? undefined} className="mt-5 h-2 w-full accent-brand-600" />
        <p className="mt-2 min-h-5 text-sm font-bold text-brand-700 dark:text-brand-300">{percentage === null ? "불러오는 중…" : `${percentage}%`}</p>
      </div>
    </dialog>,
    document.body,
  );
}

export default function LanguagePackDownloadOverlay() {
  const download = useAppLanguageStore((state) => state.languageDownload);
  return download ? <DownloadDialog progress={download.progress} /> : null;
}
