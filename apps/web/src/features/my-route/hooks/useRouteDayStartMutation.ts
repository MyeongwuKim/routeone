import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery, UpdateRouteDayStartInput } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "../myRouteCache";

export function useRouteDayStartMutation() {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: (input: UpdateRouteDayStartInput) =>
      routeApi.updateRouteDayStart(input),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.updateRouteDayStart)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
    },
  });

  const updateRouteDayStart = async (
    input: UpdateRouteDayStartInput,
    successMessage: string
  ) => {
    if (mutation.isPending) {
      return false;
    }

    try {
      await mutation.mutateAsync(input);
      showToast(successMessage);
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "DAY 시작시간을 저장하지 못했어요.",
        2600
      );
      return false;
    }
  };

  return {
    isUpdatingRouteDayStart: mutation.isPending,
    updateRouteDayStart,
  };
}
