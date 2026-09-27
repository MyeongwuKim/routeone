/** 경로 또는 DAY 출발 위치를 저장하고 내 경로 현재·과거 캐시를 동기화한다. */
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

/**
 * ref 잠금으로 같은 렌더 사이의 중복 저장까지 막는다. 응답 경로를 캐시에 반영하고 dayIndex를 포함한
 * 성공 문구를 표시하며, 실패는 토스트로 안내한 뒤 false를 반환한다.
 */
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

  /** 저장이 진행 중이면 요청을 추가하지 않고 false를 반환한다. */
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
