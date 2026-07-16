import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import type { MyRoutesQuery } from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  optimisticReorderRouteStopsCache,
  upsertMyRouteCache,
} from "../myRouteCache";
import type { MyRouteStop } from "../types";
import { restoreStopOrder } from "../utils/dayRouteStops";

type UseRouteDayOrderMutationOptions = {
  routeId: string;
  dayId: string;
  orderedStops: MyRouteStop[];
  baseStopIds: string[];
  isOrderDirty: boolean;
  setOrderedStops: (value: SetStateAction<MyRouteStop[]>) => void;
  setBaseStopIds: (value: string[]) => void;
  setIsOrderEditing: (value: boolean) => void;
  stopCurrentDrag: () => void;
};

type SaveOrderVariables = {
  stopIds: string[];
  previousStops: MyRouteStop[];
  baseStopIds: string[];
};

export function useRouteDayOrderMutation({
  routeId,
  dayId,
  orderedStops,
  baseStopIds,
  isOrderDirty,
  setOrderedStops,
  setBaseStopIds,
  setIsOrderEditing,
  stopCurrentDrag,
}: UseRouteDayOrderMutationOptions) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const mutation = useMutation({
    mutationFn: ({ stopIds }: SaveOrderVariables) =>
      routeApi.reorderRouteStops({
        routeId,
        dayId,
        stopIds,
      }),
    onMutate: async ({ stopIds }) => {
      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      const previousRoutes =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          optimisticReorderRouteStopsCache({
            data: currentData,
            routeId,
            dayId,
            stopIds,
          })
      );

      return { previousRoutes };
    },
    onSuccess: (result, variables) => {
      const nextDay = result.reorderRouteStops.days.find(
        (routeDay) => routeDay.id === dayId
      );
      const nextStops = nextDay?.stops ?? variables.previousStops;

      setOrderedStops(nextStops);
      setBaseStopIds(nextStops.map((stop) => stop.id));
      stopCurrentDrag();
      setIsOrderEditing(false);
      showToast("장소 순서를 저장했어요.");
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.reorderRouteStops)
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
      setOrderedStops(
        restoreStopOrder(variables.previousStops, variables.baseStopIds)
      );
      showToast(
        error instanceof Error
          ? error.message
          : "장소 순서를 저장하지 못했어요.",
        2600
      );
    },
  });

  const saveOrder = () => {
    if (!isOrderDirty || mutation.isPending) {
      return;
    }

    mutation.mutate({
      stopIds: orderedStops.map((stop) => stop.id),
      previousStops: orderedStops,
      baseStopIds,
    });
  };

  return {
    isSavingOrder: mutation.isPending,
    saveOrder,
  };
}
