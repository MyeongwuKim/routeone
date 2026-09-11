/**
 * 사용 위치: 장소 상세 → 사용자 사진 → 신고하기
 *
 * 용도:
 * 사진 신고 사유를 한 가지 선택하고 기타 사유를 입력하는 팝업이다.
 *
 * 구조:
 * 사유 선택 목록, 기타 입력칸, 취소·신고 버튼으로 구성되어 있다.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdFlag } from "react-icons/md";
import type { PlacePhotoReportReason } from "@/generated/graphql";
import type { UiText } from "@/lib/uiText";

type PhotoReportDialogProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: PlacePhotoReportReason, details: string | null) => void;
  text: UiText["photoReport"];
};

function PhotoReportDialog({
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  text,
}: PhotoReportDialogProps) {
  const [reason, setReason] = useState<PlacePhotoReportReason | null>(null);
  const [details, setDetails] = useState("");

  if (!isOpen) return null;

  const options: Array<{ value: PlacePhotoReportReason; label: string }> = [
    { value: "INAPPROPRIATE", label: text.inappropriate },
    { value: "VIOLENCE_OR_HATE", label: text.violenceOrHate },
    { value: "PRIVACY", label: text.privacy },
    { value: "SPAM", label: text.spam },
    { value: "OTHER", label: text.other },
  ];
  const canSubmit =
    Boolean(reason) &&
    (reason !== "OTHER" || Boolean(details.trim())) &&
    !isSubmitting;

  return createPortal(
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3600] flex items-end justify-center bg-slate-950/55 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="photo-report-title"
        className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-slate-900"
      >
        <header className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-xl text-rose-600 dark:bg-rose-400/15 dark:text-rose-200">
            <MdFlag />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="photo-report-title" className="font-black text-slate-900 dark:text-white">
              {text.title}
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {text.description}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.cancel}
            onClick={onClose}
            disabled={isSubmitting}
            className="flex size-9 items-center justify-center rounded-full text-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
          >
            <MdClose />
          </button>
        </header>

        <div className="mt-5 space-y-2">
          {options.map((option) => {
            const isSelected = reason === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setReason(option.value)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-bold transition ${
                  isSelected
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:bg-brand-400/15 dark:text-brand-100"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    isSelected ? "border-brand-600" : "border-slate-300"
                  }`}
                >
                  {isSelected ? <span className="size-2.5 rounded-full bg-brand-600" /> : null}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>

        {reason === "OTHER" ? (
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            placeholder={text.otherPlaceholder}
            rows={3}
            autoFocus
            className="mt-3 w-full resize-none rounded-2xl border border-brand-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-brand-300 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        ) : null}

        <footer className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {text.cancel}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => reason && onSubmit(reason, details.trim() || null)}
            className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {text.submit}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

export default PhotoReportDialog;
