/**
 * 사용 위치: 내 정보 → 신고 관리 → 공유 루트 신고
 *
 * 용도:
 * OWNER가 대기 중인 공유 루트 신고를 확인하고 문제없음·공유 숨김을 결정한다.
 *
 * 구조:
 * 루트 요약과 신고 사유 목록, 신고별 검토 버튼으로 구성되어 있다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MdOutlineCheckCircle, MdOutlineRoute, MdVisibilityOff } from "react-icons/md";
import { moderationApi } from "@/api/moderationApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "@/features/shared-route/queries/sharedRouteQueryKeys";
import type {
  PendingSharedRouteReportsQuery,
  SharedRouteModerationAction,
  SharedRouteReportReason,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

type ReportItem =
  PendingSharedRouteReportsQuery["pendingSharedRouteReports"][number];

function SharedRouteReportCard({
  item,
  isProcessing,
  onAction,
}: {
  item: ReportItem;
  isProcessing: boolean;
  onAction: (action: SharedRouteModerationAction) => void;
}) {
  const text = useUiText();
  const labels: Record<SharedRouteReportReason, string> = {
    INAPPROPRIATE: text.sharedRouteReport.inappropriate,
    MISLEADING: text.sharedRouteReport.misleading,
    SPAM: text.sharedRouteReport.spam,
    HARASSMENT_OR_HATE: text.sharedRouteReport.harassmentOrHate,
    PRIVACY_OR_RIGHTS: text.sharedRouteReport.privacyOrRights,
    OTHER: text.sharedRouteReport.other,
  };
  const routeTitle =
    item.placeTitles.length > 0
      ? item.placeTitles.join(" → ")
      : text.sharedRouteReport.routeFallback;

  return (
    <article className="w-full overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-sm dark:border-brand-400/20 dark:bg-[#0b211f]">
      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            <MdOutlineRoute />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h2 className="line-clamp-2 text-sm font-black leading-5 text-slate-900 dark:text-white">
                {routeTitle}
              </h2>
              <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 dark:bg-rose-400/15 dark:text-rose-200">
                {text.sharedRouteReport.reports(item.reportCount)}
              </span>
            </div>
            <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">
              {text.sharedRouteReport.owner}: {item.owner?.displayName || item.owner?.email || "-"}
            </p>
            <p className="mt-1 text-[11px] font-bold text-brand-700 dark:text-brand-200">
              {text.sharedRouteReport.tripDays(item.tripDays)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {item.reasons.map((reason) => (
            <span
              key={reason}
              className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              {labels[reason]}
            </span>
          ))}
        </div>

        {item.details.length > 0 ? (
          <div className="rounded-2xl bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300">
            <p className="font-bold text-slate-700 dark:text-slate-100">
              {text.sharedRouteReport.details}
            </p>
            {item.details.map((detail, index) => (
              <p key={`${detail}-${index}`} className="mt-1">
                {detail}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("DISMISSED")}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-brand-200 px-3 text-sm font-bold text-brand-700 disabled:opacity-50 dark:text-brand-200"
          >
            <MdOutlineCheckCircle className="text-lg" />
            {text.sharedRouteReport.dismiss}
          </button>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => onAction("HIDDEN")}
            className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white disabled:opacity-50"
          >
            <MdVisibilityOff className="text-lg" />
            {text.sharedRouteReport.hide}
          </button>
        </div>
      </div>
    </article>
  );
}

function SharedRouteReportQueue() {
  const text = useUiText();
  const queryClient = useQueryClient();
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const reportsQuery = useQuery({
    queryKey: ["pending-shared-route-reports"],
    queryFn: moderationApi.pendingSharedRouteReports,
  });
  const actionMutation = useMutation({
    mutationFn: ({
      routeId,
      action,
    }: {
      routeId: string;
      action: SharedRouteModerationAction;
    }) => moderationApi.moderateSharedRoute(routeId, action),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["pending-shared-route-reports"],
        }),
        queryClient.invalidateQueries({ queryKey: SHARED_ROUTES_QUERY_KEY }),
        queryClient.invalidateQueries({
          queryKey: LIKED_SHARED_ROUTES_QUERY_KEY,
        }),
        queryClient.invalidateQueries({ queryKey: ["route-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["place-photos"] }),
      ]);
      showToast(text.sharedRouteReport.actionComplete);
    },
    onError: (error) =>
      showToast(
        error instanceof Error
          ? error.message
          : text.sharedRouteReport.actionFailed
      ),
  });

  const handleAction = (
    routeId: string,
    action: SharedRouteModerationAction
  ) => {
    const description =
      action === "DISMISSED"
        ? text.sharedRouteReport.dismissConfirm
        : text.sharedRouteReport.hideConfirm;
    const actionLabel =
      action === "DISMISSED"
        ? text.sharedRouteReport.dismiss
        : text.sharedRouteReport.hide;

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
          onClick: () => actionMutation.mutate({ routeId, action }),
        },
      ],
    });
  };

  if (reportsQuery.isPending) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="skeleton-shimmer h-52 rounded-3xl bg-slate-200 dark:bg-slate-800"
          />
        ))}
      </div>
    );
  }

  if ((reportsQuery.data?.pendingSharedRouteReports.length ?? 0) === 0) {
    return (
      <PotatoLoadingCard
        title={text.sharedRouteReport.emptyTitle}
        description={text.sharedRouteReport.emptyDescription}
        animation="empty"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {reportsQuery.data?.pendingSharedRouteReports.map((item) => (
        <SharedRouteReportCard
          key={item.routeId}
          item={item}
          isProcessing={actionMutation.isPending}
          onAction={(action) => handleAction(item.routeId, action)}
        />
      ))}
    </div>
  );
}

export default SharedRouteReportQueue;
