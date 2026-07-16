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
    onSuccess: (result, { day }) => {
      showToast(`DAY ${day.dayIndex}를 삭제했어요.`);
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.deleteRouteDay)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
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
