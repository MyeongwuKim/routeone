/** DAY와 장소 순서 편집 결과를 저장하고 내 경로 관련 캐시와 화면 상태를 갱신한다. */
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
  /** 저장된 최신 경로를 화면 로컬 편집 상태에 반영할 콜백 */
  onSuccess: (route: MyRoute) => void;
};

/**
 * 저장 성공 시 내 경로 캐시를 교체하고 과거 경로 Query를 무효화한 뒤 onSuccess를 호출한다.
 * saveLayout은 mutate 함수이므로 오류를 던지는 대신 훅 내부 토스트로 안내한다.
 */
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
