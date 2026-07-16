import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import { MY_ROUTES_QUERY_KEY, upsertMyRouteCache } from "../myRouteCache";

export function useRouteStartDateMutation(routeId: string) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: (startedAt: string) =>
      routeApi.startRoute({
        routeId,
        startedAt,
      }),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.startRoute)
      );
      showToast("실제 시작일을 수정했어요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "시작일을 수정하지 못했어요.",
        2600
      );
    },
  });

  const updateRouteStartDate = async (startedAt: string) => {
    try {
      await mutation.mutateAsync(startedAt);
      return true;
    } catch {
      return false;
    }
  };

  return {
    isUpdatingRouteStartDate: mutation.isPending,
    updateRouteStartDate,
  };
}
