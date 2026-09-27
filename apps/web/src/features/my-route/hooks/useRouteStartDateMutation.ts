/** 여행의 실제 시작일을 저장하고 응답 경로와 내 경로 캐시를 동기화한다. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import { MY_ROUTES_QUERY_KEY, upsertMyRouteCache } from "../myRouteCache";

/**
 * startedAt을 지정한 경로의 시작 요청으로 전달한다. 성공하면 응답 경로를 캐시에 반영하고,
 * 실패는 토스트로 안내한 뒤 updateRouteStartDate에서 false로 변환해 호출부가 예외 없이 분기하게 한다.
 */
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

  /** 저장 성공 여부를 boolean으로 반환하며 Mutation 오류를 호출부로 다시 던지지 않는다. */
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
