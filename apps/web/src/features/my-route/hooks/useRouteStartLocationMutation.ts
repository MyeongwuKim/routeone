import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type {
  MyRoutesQuery,
  UpdateRouteStartLocationInput,
} from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "../myRouteCache";

export function useRouteStartLocationMutation() {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: (input: UpdateRouteStartLocationInput) =>
      routeApi.updateRouteStartLocation(input),
    onSuccess: (result) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.updateRouteStartLocation)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
    },
  });

  const updateRouteStartLocation = async (
    input: UpdateRouteStartLocationInput
  ) => {
    if (mutation.isPending) {
      return false;
    }

    try {
      await mutation.mutateAsync(input);
      showToast("스타트 지점을 변경했어요.");
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "스타트 지점을 저장하지 못했어요.",
        2600
      );
      return false;
    }
  };

  return {
    isUpdatingRouteStartLocation: mutation.isPending,
    updateRouteStartLocation,
  };
}
