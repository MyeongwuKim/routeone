/**
 * 용도:
 * 장소 사진 신고·취소 요청과 관련 목록 갱신을 관리한다.
 *
 * 동작 방식:
 * 요청 전에 사진 캐시의 신고 상태를 바꾸고, 실패하면 이전 상태로 되돌린다.
 */
import { useIsMutating, useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { PlacePhotoReportReason, PlacePhotosQuery } from "@/generated/graphql";
import { routeApi } from "@/api/routeApi";
import {
  MY_ROUTES_QUERY_KEY,
  MY_ROUTE_HISTORY_QUERY_KEY,
} from "@/features/my-route/myRouteCache";
import type { UiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";

type PlacePhotos = PlacePhotosQuery["placePhotos"];
type PreviousPhotoState = { queryKey: QueryKey; reportedByMe: boolean };
const PLACE_PHOTOS_QUERY_KEY = ["place-photos"] as const;
const PHOTO_REPORT_MUTATION_KEY = ["place-photo-report"] as const;

export function usePlacePhotoReport(text: UiText["photoReport"]) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const isUpdating = useIsMutating({ mutationKey: PHOTO_REPORT_MUTATION_KEY }) > 0;
  const refreshPhotos = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: PLACE_PHOTOS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MY_ROUTES_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: MY_ROUTE_HISTORY_QUERY_KEY }),
    ]);
  };
  const updatePhotoStatus = (photoId: string, reportedByMe: boolean) => {
    queryClient.setQueriesData<PlacePhotos>(
      { queryKey: PLACE_PHOTOS_QUERY_KEY },
      (photos) =>
        photos?.map((photo) =>
          photo.id === photoId ? { ...photo, reportedByMe } : photo
        )
    );
  };
  const optimisticUpdate = async (photoId: string, reportedByMe: boolean) => {
    await queryClient.cancelQueries({ queryKey: PLACE_PHOTOS_QUERY_KEY });
    const previousPhotoStates: PreviousPhotoState[] = [];

    for (const [queryKey, photos] of queryClient.getQueriesData<PlacePhotos>({
      queryKey: PLACE_PHOTOS_QUERY_KEY,
    })) {
      const photo = photos?.find((item) => item.id === photoId);
      if (photo) {
        previousPhotoStates.push({ queryKey, reportedByMe: photo.reportedByMe });
      }
    }

    updatePhotoStatus(photoId, reportedByMe);
    return previousPhotoStates;
  };
  const rollback = (photoId: string, previousPhotoStates: PreviousPhotoState[] = []) => {
    for (const { queryKey, reportedByMe } of previousPhotoStates) {
      queryClient.setQueryData<PlacePhotos>(queryKey, (photos) =>
        photos?.map((photo) =>
          photo.id === photoId ? { ...photo, reportedByMe } : photo
        )
      );
    }
  };

  const reportMutation = useMutation({
    mutationKey: PHOTO_REPORT_MUTATION_KEY,
    mutationFn: ({
      photoId,
      reason,
      details,
    }: {
      photoId: string;
      reason: PlacePhotoReportReason;
      details: string | null;
    }) => routeApi.reportPlacePhoto(photoId, reason, details),
    onMutate: ({ photoId }) => optimisticUpdate(photoId, true),
    onSuccess: () => {
      showToast(text.submitted);
    },
    onError: (error, { photoId }, previousPhotoStates) => {
      rollback(photoId, previousPhotoStates);
      showToast(error instanceof Error ? error.message : text.submitFailed);
    },
    onSettled: refreshPhotos,
  });

  const cancelMutation = useMutation({
    mutationKey: PHOTO_REPORT_MUTATION_KEY,
    mutationFn: (photoId: string) => routeApi.cancelPlacePhotoReport(photoId),
    onMutate: (photoId) => optimisticUpdate(photoId, false),
    onSuccess: () => {
      showToast(text.canceled);
    },
    onError: (error, photoId, previousPhotoStates) => {
      rollback(photoId, previousPhotoStates);
      showToast(error instanceof Error ? error.message : text.cancelFailed);
    },
    onSettled: refreshPhotos,
  });

  return {
    cancelReport: cancelMutation.mutate,
    isSubmitting: reportMutation.isPending,
    isUpdating,
    submitReport: reportMutation.mutate,
  };
}
