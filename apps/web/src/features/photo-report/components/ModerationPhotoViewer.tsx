/**
 * 사용 위치: 내 정보 → 콘텐츠 관리 → 검토 사진 선택
 *
 * 용도:
 * 운영자가 공개 요청 또는 신고된 사진 원본을 전체 화면에서 확인하고 처리한다.
 *
 * 구조:
 * 원본 사진, 검토 정보, 승인·숨김·사진 삭제 버튼으로 구성된다.
 */
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { MdClose, MdDeleteOutline, MdHideImage, MdOutlineCheckCircle } from "react-icons/md";
import type {
  PendingPhotoReportsQuery,
  PlacePhotoModerationAction,
  PlacePhotoReportReason,
} from "@/generated/graphql";
import type { UiText } from "@/lib/uiText";

type ReportItem = PendingPhotoReportsQuery["pendingPhotoReports"][number];

type ModerationPhotoViewerProps = {
  isProcessing: boolean;
  item: ReportItem;
  onAction: (action: PlacePhotoModerationAction) => void;
  onClose: () => void;
  text: UiText;
};

function ModerationPhotoViewer({
  isProcessing,
  item,
  onAction,
  onClose,
  text,
}: ModerationPhotoViewerProps) {
  const isPublicationReview = item.reviewType === "PUBLICATION";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const labels: Record<PlacePhotoReportReason, string> = {
    INAPPROPRIATE: text.photoReport.inappropriate,
    VIOLENCE_OR_HATE: text.photoReport.violenceOrHate,
    PRIVACY: text.photoReport.privacy,
    SPAM: text.photoReport.spam,
    OTHER: text.photoReport.other,
  };

  return createPortal(
    <section
      role="dialog"
      aria-modal="true"
      aria-label={text.photoReport.viewFullImage}
      className="fixed inset-0 z-[3600] flex items-center justify-center bg-slate-950/75 px-4 py-6 text-slate-900"
    >
      <div className="flex max-h-[calc(100dvh-3rem)] w-full max-w-[640px] flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-2xl dark:bg-slate-950 dark:text-white">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{item.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
              {isPublicationReview
                ? text.photoReport.publicationReviewBadge
                : text.photoReport.reports(item.reportCount)}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            aria-label={text.common.close}
            onClick={onClose}
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-white/10"
          >
            <MdClose />
          </button>
        </header>

        <div className="flex aspect-[4/3] max-h-[55dvh] w-full shrink-0 items-center justify-center bg-slate-100 dark:bg-slate-900">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-contain"
          />
        </div>

        <footer className="min-h-0 shrink overflow-y-auto border-t border-slate-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 dark:border-white/10 dark:bg-slate-950">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {item.reasons.map((reason) => (
                <span
                  key={reason}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200"
                >
                  {labels[reason]}
                </span>
              ))}
            </div>
            {item.details.length > 0 ? (
              <div className="max-h-20 overflow-y-auto text-xs leading-5 text-slate-600 dark:text-slate-300">
                {item.details.map((detail, index) => (
                  <p key={`${detail}-${index}`}>{detail}</p>
                ))}
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onAction("DISMISSED")}
                className="flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-brand-200 px-1 text-center text-xs font-bold leading-tight text-brand-700 disabled:opacity-50 dark:border-white/30 dark:text-white"
              >
                <MdOutlineCheckCircle className="shrink-0 text-base" />
                {isPublicationReview
                  ? text.photoReport.approve
                  : text.photoReport.dismiss}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onAction("HIDDEN")}
                className="flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-amber-200 px-1 text-center text-xs font-bold leading-tight text-amber-700 disabled:opacity-50 dark:border-amber-300/70 dark:text-amber-200"
              >
                <MdHideImage className="shrink-0 text-base" />
                {isPublicationReview
                  ? text.photoReport.reject
                  : text.photoReport.hide}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => onAction("DELETED")}
                className="flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl bg-rose-600 px-1 text-center text-xs font-bold leading-tight text-white disabled:opacity-50"
              >
                <MdDeleteOutline className="shrink-0 text-base" />
                {text.photoReport.delete}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </section>,
    document.body
  );
}

export default ModerationPhotoViewer;
