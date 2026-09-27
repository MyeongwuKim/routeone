/** DAY별 시작 시각을 저장하고 내 경로 현재·과거 캐시를 동기화한다. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery, UpdateRouteDayStartInput } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "../myRouteCache";

/** 저장 중 중복 호출을 거절하며, 성공·실패를 토스트로 안내하고 boolean으로 반환한다. */
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

  /** 진행 중이면 요청하지 않고 false를 반환하며, 성공한 경우에만 전달받은 successMessage를 표시한다. */
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
