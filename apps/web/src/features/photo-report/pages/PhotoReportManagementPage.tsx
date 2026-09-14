/**
 * 진입 경로: 내 정보 → 신고 관리
 *
 * 용도:
 * OWNER가 신고된 방문 사진을 전체 화면으로 확인하고 문제없음·전체 숨김·삭제를 결정하는 화면이다.
 *
 * 구조:
 * 대기 상태 안내, 신고 사진 목록, 사진별 검토 작업 영역으로 구성되어 있다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MdArrowBack, MdFlag, MdHideImage, MdOutlineCheckCircle, MdDeleteOutline, MdOpenInFull } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { moderationApi } from "@/api/moderationApi";
import { useAccountUser } from "@/components/account/useAccountUser";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import ModerationPhotoViewer from "../components/ModerationPhotoViewer";
import type {
  PendingPhotoReportsQuery,
  PlacePhotoModerationAction,
  PlacePhotoReportReason,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";

type ReportItem = PendingPhotoReportsQuery["pendingPhotoReports"][number];

function PhotoReportCard({
  item,
  isProcessing,
  onAction,
  onOpen,
}: {
  item: ReportItem;
  isProcessing: boolean;
  onAction: (action: PlacePhotoModerationAction) => void;
  onOpen: () => void;
}) {
  const text = useUiText();
  const labels: Record<PlacePhotoReportReason, string> = {
    INAPPROPRIATE: text.photoReport.inappropriate,
    VIOLENCE_OR_HATE: text.photoReport.violenceOrHate,
    PRIVACY: text.photoReport.privacy,
    SPAM: text.photoReport.spam,
    OTHER: text.photoReport.other,
  };

  return (
    <article className="w-full overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/20 dark:bg-[#0b211f]">
      <div className="flex gap-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${item.title} ${text.photoReport.viewFullImage}`}
          className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 sm:size-28"
        >
          <img
            src={item.thumbnailUrl || item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
          <span className="absolute bottom-1.5 right-1.5 flex size-7 items-center justify-center rounded-lg bg-slate-950/70 text-sm text-white">
            <MdOpenInFull />
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 truncate text-base font-bold text-slate-900 dark:text-white">
              {item.title}
            </h2>
            <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">
              {text.photoReport.reports(item.reportCount)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">
            {text.photoReport.uploader}: {item.uploader?.displayName || item.uploader?.email || "-"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                {labels[reason]}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 pb-4">
        {item.details.length > 0 ? (
          <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
            <p className="font-bold text-slate-700 dark:text-slate-100">{text.photoReport.details}</p>
            {item.details.map((detail, index) => <p key={`${detail}-${index}`} className="mt-1">{detail}</p>)}
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("DISMISSED")}
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-brand-200 px-2 text-center text-xs font-bold leading-tight text-brand-700 disabled:opacity-50 dark:text-brand-200"
          >
            <MdOutlineCheckCircle className="shrink-0 text-base" />
            {text.photoReport.dismiss}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("HIDDEN")}
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-amber-200 px-2 text-center text-xs font-bold leading-tight text-amber-700 disabled:opacity-50 dark:text-amber-200"
          >
            <MdHideImage className="shrink-0 text-base" />
            {text.photoReport.hide}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("DELETED")}
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl bg-rose-600 px-2 text-center text-xs font-bold leading-tight text-white disabled:opacity-50"
          >
            <MdDeleteOutline className="shrink-0 text-base" />
            {text.photoReport.delete}
          </button>
        </div>
      </div>
    </article>
  );
}

function PhotoReportManagementPage() {
  const text = useUiText();
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const { user, isLoading: isUserLoading } = useAccountUser();
  const isOwner = user?.role === "OWNER";
  const reportsQuery = useQuery({
    queryKey: ["pending-photo-reports"],
    queryFn: moderationApi.pendingPhotoReports,
    enabled: isOwner,
  });
  const selectedPhoto = reportsQuery.data?.pendingPhotoReports.find(
    (item) => item.photoId === selectedPhotoId
  );
  const actionMutation = useMutation({
    mutationFn: ({ photoId, action }: { photoId: string; action: PlacePhotoModerationAction }) =>
      moderationApi.moderatePlacePhoto(photoId, action),
    onSuccess: async () => {
      setSelectedPhotoId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["pending-photo-reports"] }),
        queryClient.invalidateQueries({ queryKey: ["place-photos"] }),
      ]);
      showToast(text.photoReport.actionComplete);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : text.photoReport.actionFailed),
  });

  const handleAction = (photoId: string, action: PlacePhotoModerationAction) => {
    const message =
      action === "DISMISSED"
        ? text.photoReport.dismissConfirm
        : action === "HIDDEN"
          ? text.photoReport.hideConfirm
          : text.photoReport.deleteConfirm;
    if (window.confirm(message)) actionMutation.mutate({ photoId, action });
  };

  return (
    <section className="space-y-4 pb-6 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200"
        >
          <MdArrowBack />
        </button>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-2xl text-rose-600 dark:bg-rose-400/15 dark:text-rose-200">
          <MdFlag />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900 dark:text-white">{text.photoReport.managementTitle}</h1>
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">{text.photoReport.managementDescription}</p>
        </div>
      </header>

      {!isUserLoading && !isOwner ? (
        <PotatoLoadingCard title={text.photoReport.ownerOnly} description="" animation="empty" />
      ) : reportsQuery.isPending || isUserLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-shimmer h-44 rounded-3xl bg-slate-200 dark:bg-slate-800" />)}
        </div>
      ) : (reportsQuery.data?.pendingPhotoReports.length ?? 0) === 0 ? (
        <PotatoLoadingCard
          title={text.photoReport.emptyTitle}
          description={text.photoReport.emptyDescription}
          animation="empty"
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {reportsQuery.data?.pendingPhotoReports.map((item) => (
            <PhotoReportCard
              key={item.photoId}
              item={item}
              isProcessing={actionMutation.isPending}
              onAction={(action) => handleAction(item.photoId, action)}
              onOpen={() => setSelectedPhotoId(item.photoId)}
            />
          ))}
        </div>
      )}
      {selectedPhoto ? (
        <ModerationPhotoViewer
          item={selectedPhoto}
          isProcessing={actionMutation.isPending}
          onAction={(action) => handleAction(selectedPhoto.photoId, action)}
          onClose={() => setSelectedPhotoId(null)}
          text={text}
        />
      ) : null}
    </section>
  );
}

export default PhotoReportManagementPage;
