import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { SHARED_ROUTES_QUERY_KEY } from "@/features/shared-route/queries/sharedRouteQueryKeys";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  mergeMyRouteSummaryCache,
} from "../myRouteCache";

export function useRouteShareMutation(routeId: string) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: () => routeApi.shareRoute(routeId),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          mergeMyRouteSummaryCache(currentData, result.shareRoute)
      );
      void queryClient.invalidateQueries({
        queryKey: SHARED_ROUTES_QUERY_KEY,
      });
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
    shareRoute: mutation.mutate,
  };
}
