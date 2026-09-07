/**
 * 용도: 전달받은 사용법을 아이콘과 짧은 설명으로 보여주는 공통 팝업이다.
 * 동작 방식: 모달이 열리면 배경 조작과 포커스 이탈을 막고,
 * 닫기·확인·바깥 영역·Escape로 닫으면 사용법 버튼으로 포커스를 돌려준다.
 */
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import type { IconType } from "react-icons";
import { IoClose, IoInformationCircleOutline } from "react-icons/io5";
import { useUiText, type UiHelpGuide } from "@/lib/uiText";

export type HelpGuide = Omit<UiHelpGuide, "steps"> & {
  steps: (UiHelpGuide["steps"][number] & { icon: IconType })[];
};

type HelpDialogProps = {
  guide: HelpGuide;
  label: string;
  onClose: () => void;
};

function HelpStep({
  index,
  icon: Icon,
  title,
  description,
}: {
  index: number;
  icon: IconType;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3">
      <div className="relative shrink-0 self-start">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-xl text-brand-700 dark:border-brand-400/20 dark:bg-brand-400/10 dark:text-brand-200">
          <Icon aria-hidden="true" />
        </span>
        <span aria-hidden="true" className="absolute -right-1 -top-1 flex size-[18px] items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white ring-2 ring-white dark:ring-[#102a27]">
          {index + 1}
        </span>
      </div>
      <div className="min-w-0 pt-0.5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-1 text-[13px] leading-[1.65] text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </li>
  );
}

function HelpDialog({ guide, label, onClose }: HelpDialogProps) {
  const text = useUiText();
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog?.showModal();

    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;

        const targets = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex="0"]'
        );
        const first = targets[0];
        const last = targets[targets.length - 1];
        const boundary = event.shiftKey ? first : last;
        if (document.activeElement === boundary) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-transparent p-0 backdrop:bg-slate-950/45"
    >
      <div
        className="flex h-full items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:items-center sm:p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <section className="global-modal-panel-enter flex max-h-full w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-2xl dark:border-brand-400/25 dark:bg-[#102a27]">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 pb-4 pt-5 dark:border-brand-400/15">
            <div className="min-w-0">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-brand-700 dark:text-brand-200">
                <IoInformationCircleOutline aria-hidden="true" className="text-base" />
                {label}
              </p>
              <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{guide.title}</h2>
              <p id={descriptionId} className="mt-1.5 text-[13px] leading-relaxed text-slate-500 dark:text-slate-300">{guide.description}</p>
            </div>
            <button
              type="button"
              aria-label={text.common.close}
              onClick={onClose}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-300 dark:hover:bg-white/10"
            >
              <IoClose aria-hidden="true" />
            </button>
          </header>
          <div tabIndex={0} role="region" aria-labelledby={titleId} className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600 [-webkit-overflow-scrolling:touch]">
            <ol className="space-y-5">
              {guide.steps.map((step, index) => (
                <HelpStep key={index} index={index} {...step} />
              ))}
            </ol>
            <p className="mt-5 rounded-2xl bg-brand-50 px-3.5 py-3 text-xs leading-relaxed text-brand-800 dark:bg-brand-400/10 dark:text-brand-100">{guide.note}</p>
          </div>
          <footer className="shrink-0 border-t border-slate-100 px-5 py-4 dark:border-brand-400/15">
            <button type="button" onClick={onClose} className="min-h-12 w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
              {text.common.confirm}
            </button>
          </footer>
        </section>
      </div>
    </dialog>,
    document.body
  );
}

export default HelpDialog;
