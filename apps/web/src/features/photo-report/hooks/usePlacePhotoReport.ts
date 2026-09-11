/**
 * 용도:
 * 장소 사진 신고·취소 요청과 관련 목록 갱신을 관리한다.
 *
 * 동작 방식:
 * 요청이 끝나면 현재 장소 사진 캐시를 다시 불러와 신고자 전용 블러 상태를 반영한다.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PlacePhotoReportReason } from "@/generated/graphql";
import { routeApi } from "@/api/routeApi";
import type { UiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";

export function usePlacePhotoReport(text: UiText["photoReport"]) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const refreshPhotos = () =>
    queryClient.invalidateQueries({ queryKey: ["place-photos"] });

  const reportMutation = useMutation({
    mutationFn: ({
      photoId,
      reason,
      details,
    }: {
      photoId: string;
      reason: PlacePhotoReportReason;
      details: string | null;
    }) => routeApi.reportPlacePhoto(photoId, reason, details),
    onSuccess: async () => {
      await refreshPhotos();
      showToast(text.submitted);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : text.submitFailed);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (photoId: string) => routeApi.cancelPlacePhotoReport(photoId),
    onSuccess: async () => {
      await refreshPhotos();
      showToast(text.canceled);
    },
    onError: (error) => {
      showToast(error instanceof Error ? error.message : text.cancelFailed);
    },
  });

  return {
    cancelReport: cancelMutation.mutate,
    isCanceling: cancelMutation.isPending,
    isSubmitting: reportMutation.isPending,
    submitReport: reportMutation.mutate,
  };
}
