import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  optimisticUpdateRouteStopStayMinutesCache,
  upsertMyRouteCache,
} from "../myRouteCache";
import type { MyRouteDay, MyRouteStop } from "../types";

type UseRouteStopStayMutationOptions = {
  routeId: string;
  activeDayId: string;
  orderedStops: MyRouteStop[];
  isOrderEditing: boolean;
  setOrderedStops: (value: SetStateAction<MyRouteStop[]>) => void;
};

type UpdateStayVariables = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
  nextStayMinutes: number;
  isActiveRouteDay: boolean;
  sourceStops: MyRouteStop[];
  previousStops: MyRouteStop[];
};

export function useRouteStopStayMutation({
  routeId,
  activeDayId,
  orderedStops,
  isOrderEditing,
  setOrderedStops,
}: UseRouteStopStayMutationOptions) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: ({ stop, nextStayMinutes }: UpdateStayVariables) =>
      routeApi.updateRouteStopStayMinutes({
        stopId: stop.id,
        stayMinutes: nextStayMinutes,
      }),
    onMutate: async ({ stop, nextStayMinutes, isActiveRouteDay }) => {
      if (isActiveRouteDay) {
        setOrderedStops((currentStops) =>
          currentStops.map((currentStop) =>
            currentStop.id === stop.id
              ? { ...currentStop, stayMinutes: nextStayMinutes }
              : currentStop
          )
        );
      }

      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      const previousRoutes =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          optimisticUpdateRouteStopStayMinutesCache({
            data: currentData,
            routeId,
            stopId: stop.id,
            stayMinutes: nextStayMinutes,
          })
      );

      return { previousRoutes };
    },
    onSuccess: (result, variables) => {
      const nextDay = result.updateRouteStopStayMinutes.days.find(
        (candidateDay) => candidateDay.id === variables.routeDay.id
      );
      const nextStops = nextDay?.stops ?? variables.sourceStops;

      if (variables.isActiveRouteDay) {
        setOrderedStops(nextStops);
      }
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.updateRouteStopStayMinutes)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
    },
    onError: (error, variables, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          context.previousRoutes
        );
      }
      if (variables.isActiveRouteDay) {
        setOrderedStops(variables.previousStops);
      }
      showToast(
        error instanceof Error
          ? error.message
          : "머무는 시간을 저장하지 못했어요.",
        2600
      );
    },
  });

  const changeStayMinutes = (
    routeDay: MyRouteDay,
    stop: MyRouteStop,
    nextStayMinutes: number
  ) => {
    if (
      isOrderEditing ||
      mutation.isPending ||
      nextStayMinutes === (stop.stayMinutes ?? 60)
    ) {
      return;
    }

    const isActiveRouteDay = routeDay.id === activeDayId;

    mutation.mutate({
      routeDay,
      stop,
      nextStayMinutes,
      isActiveRouteDay,
      sourceStops: isActiveRouteDay ? orderedStops : routeDay.stops,
      previousStops: orderedStops,
    });
  };

  return {
    changeStayMinutes,
    staySavingStopId: mutation.isPending ? mutation.variables?.stop.id ?? null : null,
  };
}
