/**
 * 진입 경로: 내 정보 → 콘텐츠 관리
 *
 * 용도:
 * OWNER가 사진 공개 요청과 신고된 사진·공유 루트를 확인하고 공개 여부를 결정하는 화면이다.
 *
 * 구조:
 * 공개 검토·사진 신고·루트 신고 탭과 콘텐츠별 검토 영역으로 구성되어 있다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MdArrowBack, MdFlag, MdHideImage, MdOutlineCheckCircle, MdDeleteOutline, MdOpenInFull } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { moderationApi } from "@/api/moderationApi";
import { useAccountUser } from "@/components/account/useAccountUser";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import ModerationPhotoViewer from "../components/ModerationPhotoViewer";
import SharedRouteReportQueue from "../components/SharedRouteReportQueue";
import {
  MY_ROUTES_QUERY_KEY,
  MY_ROUTE_HISTORY_QUERY_KEY,
} from "@/features/my-route/myRouteCache";
import { SHARED_ROUTES_QUERY_KEY } from "@/features/shared-route/queries/sharedRouteQueryKeys";
import type {
  PendingPhotoReportsQuery,
  PlacePhotoModerationAction,
  PlacePhotoReportReason,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

type ReportItem = PendingPhotoReportsQuery["pendingPhotoReports"][number];
type PhotoModerationTab = "publication" | "photo-report" | "route-report";

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
  const isPublicationReview = item.reviewType === "PUBLICATION";
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
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                isPublicationReview
                  ? "bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-200"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-200"
              }`}
            >
              {isPublicationReview
                ? text.photoReport.publicationReviewBadge
                : text.photoReport.reports(item.reportCount)}
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
            {isPublicationReview
              ? text.photoReport.approve
              : text.photoReport.dismiss}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("HIDDEN")}
            className="inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border border-amber-200 px-2 text-center text-xs font-bold leading-tight text-amber-700 disabled:opacity-50 dark:text-amber-200"
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
  const [activeTab, setActiveTab] = useState<PhotoModerationTab>("publication");
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const { user, isLoading: isUserLoading } = useAccountUser();
  const isOwner = user?.role === "OWNER";
  const handleTabChange = (tab: PhotoModerationTab) => {
    setSelectedPhotoId(null);
    setActiveTab(tab);
  };
  const reportsQuery = useQuery({
    queryKey: ["pending-photo-reports"],
    queryFn: moderationApi.pendingPhotoReports,
    enabled: isOwner && activeTab !== "route-report",
  });
  const photoItems = (reportsQuery.data?.pendingPhotoReports ?? []).filter(
    (item) =>
      activeTab === "publication"
        ? item.reviewType === "PUBLICATION"
        : item.reviewType === "REPORT"
  );
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
        queryClient.invalidateQueries({ queryKey: SHARED_ROUTES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ["route-detail"] }),
        queryClient.invalidateQueries({ queryKey: MY_ROUTES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: MY_ROUTE_HISTORY_QUERY_KEY }),
      ]);
      showToast(text.photoReport.actionComplete);
    },
    onError: (error) => showToast(error instanceof Error ? error.message : text.photoReport.actionFailed),
  });

  const handleAction = (item: ReportItem, action: PlacePhotoModerationAction) => {
    const isPublicationReview = item.reviewType === "PUBLICATION";
    const description =
      action === "DISMISSED"
        ? isPublicationReview
          ? text.photoReport.approveConfirm
          : text.photoReport.dismissConfirm
        : action === "HIDDEN"
          ? isPublicationReview
            ? text.photoReport.rejectConfirm
            : text.photoReport.hideConfirm
          : text.photoReport.deleteConfirm;
    const actionLabel =
      action === "DISMISSED"
        ? isPublicationReview
          ? text.photoReport.approve
          : text.photoReport.dismiss
        : action === "HIDDEN"
          ? isPublicationReview
            ? text.photoReport.reject
            : text.photoReport.hide
          : text.photoReport.delete;

    openModal({
      title: actionLabel,
      description,
      actions: [
        {
          label: text.common.cancel,
          variant: "secondary",
        },
        {
          label: actionLabel,
          variant: action === "DISMISSED" ? "primary" : "danger",
          onClick: () => actionMutation.mutate({ photoId: item.photoId, action }),
        },
      ],
    });
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
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-brand-100 bg-brand-50 p-1 dark:border-brand-400/25 dark:bg-brand-400/10">
            <button
              type="button"
              aria-pressed={activeTab === "publication"}
              onClick={() => handleTabChange("publication")}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                activeTab === "publication"
                  ? "bg-white text-brand-700 shadow-sm dark:bg-[#0b211f] dark:text-brand-100"
                  : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {text.photoReport.publicationReviewTab}
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "photo-report"}
              onClick={() => handleTabChange("photo-report")}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                activeTab === "photo-report"
                  ? "bg-white text-brand-700 shadow-sm dark:bg-[#0b211f] dark:text-brand-100"
                  : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {text.photoReport.photoReportTab}
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "route-report"}
              onClick={() => handleTabChange("route-report")}
              className={`min-h-10 rounded-xl px-3 text-sm font-black transition ${
                activeTab === "route-report"
                  ? "bg-white text-brand-700 shadow-sm dark:bg-[#0b211f] dark:text-brand-100"
                  : "text-slate-500 dark:text-slate-300"
              }`}
            >
              {text.photoReport.routeReportTab}
            </button>
          </div>

          {activeTab !== "route-report" ? (
            reportsQuery.isPending || isUserLoading ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {[0, 1, 2, 3].map((item) => <div key={item} className="skeleton-shimmer h-44 rounded-3xl bg-slate-200 dark:bg-slate-800" />)}
              </div>
            ) : photoItems.length === 0 ? (
              <PotatoLoadingCard
                title={
                  activeTab === "publication"
                    ? text.photoReport.publicationEmptyTitle
                    : text.photoReport.emptyTitle
                }
                description={
                  activeTab === "publication"
                    ? text.photoReport.publicationEmptyDescription
                    : text.photoReport.emptyDescription
                }
                animation="empty"
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {photoItems.map((item) => (
                  <PhotoReportCard
                    key={item.photoId}
                    item={item}
                    isProcessing={actionMutation.isPending}
                    onAction={(action) => handleAction(item, action)}
                    onOpen={() => setSelectedPhotoId(item.photoId)}
                  />
                ))}
              </div>
            )
          ) : (
            <SharedRouteReportQueue />
          )}
        </>
      )}
      {activeTab !== "route-report" && selectedPhoto ? (
        <ModerationPhotoViewer
          item={selectedPhoto}
          isProcessing={actionMutation.isPending}
          onAction={(action) => handleAction(selectedPhoto, action)}
          onClose={() => setSelectedPhotoId(null)}
          text={text}
        />
      ) : null}
    </section>
  );
}

export default PhotoReportManagementPage;
