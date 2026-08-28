import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type {
  MyRoutesQuery,
  UpdateRouteStartLocationInput,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "../myRouteCache";

export function useRouteStartLocationMutation() {
  const text = useUiText();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const isApplyingRef = useRef(false);
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
    input: UpdateRouteStartLocationInput,
    dayIndex: number
  ) => {
    if (isApplyingRef.current) {
      return false;
    }

    isApplyingRef.current = true;

    try {
      await mutation.mutateAsync(input);
      showToast(text.dayRoute.startLocationSaved(dayIndex));
      return true;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : text.dayRoute.startLocationSaveFailed,
        2600
      );
      return false;
    } finally {
      isApplyingRef.current = false;
    }
  };

  return {
    isUpdatingRouteStartLocation: mutation.isPending,
    updateRouteStartLocation,
  };
}
