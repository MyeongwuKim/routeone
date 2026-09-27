/** DAY 삭제를 낙관적으로 반영하고 활성 일차·펼침 상태와 내 경로 캐시를 서버 결과에 맞춰 복구한다. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  optimisticDeleteRouteDayCache,
  upsertMyRouteCache,
} from "../myRouteCache";
import type { MyRouteDay } from "../types";

type UseRouteDayDeleteMutationOptions = {

  routeId: string;

  activeDay: MyRouteDay;

  sortedDays: MyRouteDay[];

  isReadOnly: boolean;

  resetDayEditor: (day: MyRouteDay) => void;

  setExpandedDayIds: (value: SetStateAction<Set<string>>) => void;
};

type DeleteDayVariables = {
  day: MyRouteDay;
  nextActiveDay: MyRouteDay | undefined;
};

/**
 * 삭제 전 다음 활성 DAY를 선택하고 목록 캐시에서 대상 DAY를 먼저 제거한다. 실패하면 이전 캐시와 편집 상태를
 * 복원하며, 성공하면 서버 응답 경로로 교체하고 과거 경로 Query를 무효화한다. 읽기 전용 상태에서는 요청하지 않는다.
 */
export function useRouteDayDeleteMutation({
  routeId,
  activeDay,
  sortedDays,
  isReadOnly,
  resetDayEditor,
  setExpandedDayIds,
}: UseRouteDayDeleteMutationOptions) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: ({ day }: DeleteDayVariables) => routeApi.deleteRouteDay(day.id),
    onMutate: async ({ day, nextActiveDay }) => {
      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      const previousRoutes =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);

      if (nextActiveDay) {
        resetDayEditor(nextActiveDay);
      }
      setExpandedDayIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(day.id);
        if (nextActiveDay) {
          nextIds.add(nextActiveDay.id);
        }
        return nextIds;
      });
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          optimisticDeleteRouteDayCache({
            data: currentData,
            routeId,
            dayId: day.id,
          })
      );

      return { previousRoutes };
    },
    onSuccess: async (result, { day }) => {
      showToast(`DAY ${day.dayIndex}를 삭제했어요.`);
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.deleteRouteDay)
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["place-photos"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["place-stay-summary"],
        }),
      ]);
    },
    onError: (error, { day }, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          context.previousRoutes
        );
      }
      resetDayEditor(day);
      setExpandedDayIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(day.id);
        return nextIds;
      });
      showToast(
        error instanceof Error ? error.message : "DAY를 삭제하지 못했어요.",
        2600
      );
    },
  });

  const deleteCurrentDay = () => {
    if (isReadOnly || mutation.isPending) {
      return;
    }

    const activeDayIndex = sortedDays.findIndex(
      (routeDay) => routeDay.id === activeDay.id
    );
    const nextActiveDay =
      sortedDays[activeDayIndex + 1] ??
      sortedDays[activeDayIndex - 1] ??
      sortedDays.find((routeDay) => routeDay.id !== activeDay.id);

    mutation.mutate({ day: activeDay, nextActiveDay });
  };

  return {
    deleteCurrentDay,
    isDeletingDay: mutation.isPending,
  };
}
