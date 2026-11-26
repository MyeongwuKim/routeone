/** 내 경로를 공유 상태로 변경하고 관련 내 경로·공유 목록 캐시와 사용자 안내를 동기화한다. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery, ShareRouteStartLocationInput } from "@/generated/graphql";
import { SHARED_ROUTES_QUERY_KEY } from "@/features/shared-route/queries/sharedRouteQueryKeys";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  mergeMyRouteSummaryCache,
} from "../myRouteCache";

/**
 * 공유 성공 시 응답 경로를 내 경로 캐시에 합치고 공유 목록과 과거 경로 Query를 무효화한다.
 * 실패 시 오류를 표시하고 확인 창의 편집값을 유지할 수 있도록 성공 여부를 돌려준다.
 */
export function useRouteShareMutation(routeId: string) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: (startLocations: ShareRouteStartLocationInput[]) =>
      routeApi.shareRoute(routeId, startLocations),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          mergeMyRouteSummaryCache(currentData, result.shareRoute)
      );
      void queryClient.invalidateQueries({
        queryKey: SHARED_ROUTES_QUERY_KEY,
      });
      void queryClient.invalidateQueries({ queryKey: ["route-detail", routeId] });
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      showToast("공유 루트에 올렸어요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "루트를 공유하지 못했어요.",
        2600
      );
    },
  });

  return {
    isSharingRoute: mutation.isPending,
    shareRoute: (startLocations: ShareRouteStartLocationInput[]) =>
      mutation.mutateAsync(startLocations).then(() => true, () => false),
  };
}
