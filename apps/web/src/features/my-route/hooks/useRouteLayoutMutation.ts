import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type {
  MyRoutesQuery,
  UpdateRouteLayoutInput,
} from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "../myRouteCache";
import type { MyRoute } from "../types";

type UseRouteLayoutMutationOptions = {
  onSuccess: (route: MyRoute) => void;
};

export function useRouteLayoutMutation({
  onSuccess,
}: UseRouteLayoutMutationOptions) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: (input: UpdateRouteLayoutInput) =>
      routeApi.updateRouteLayout(input),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.updateRouteLayout)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      onSuccess(result.updateRouteLayout);
      showToast("루트 수정을 저장했어요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "루트 수정을 저장하지 못했어요.",
        2600
      );
    },
  });

  return {
    isSavingLayout: mutation.isPending,
    saveLayout: mutation.mutate,
  };
}
