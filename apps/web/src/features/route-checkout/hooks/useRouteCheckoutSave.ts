import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  buildCreateRouteInput,
  getEffectiveRoutePlanTripDays,
  routeCheckoutApi,
  type SaveRoutePlanInput,
} from "@/api/routeCheckoutApi";
import { routeApi } from "@/api/routeApi";
import {
  MY_ROUTES_QUERY_KEY,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import type { MyRoutesQuery } from "@/generated/graphql";
import { isGraphQLRequestError } from "@/lib/graphqlClient";
import { useUiText } from "@/lib/uiText";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { findRouteDateConflict } from "../utils/routeDateConflict";
import { useRouteCheckout } from "./useRouteCheckout";

type UseRouteCheckoutSaveOptions = {
  input: SaveRoutePlanInput;
  canSave: boolean;
  onClose: () => void;
  onClearPlaces: () => void;
  onChooseDate: () => void;
};

type RouteCreateAttempt = {
  inputKey: string;
  requestId: string;
};

function createRouteRequestId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `route-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useRouteCheckoutSave({
  input,
  canSave,
  onClose,
  onClearPlaces,
  onChooseDate,
}: UseRouteCheckoutSaveOptions) {
  const text = useUiText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const openModal = useUiModalStore((state) => state.openModal);
  const appendTarget = useRouteEditFlowStore((state) => state.appendTarget);
  const clearAppendTarget = useRouteEditFlowStore(
    (state) => state.clearAppendTarget
  );
  const { isRouteSaveInFlight, startSavingRoute, finishSavingRoute } =
    useRouteCheckout();
  const createAttemptRef = useRef<RouteCreateAttempt | null>(null);

  const handleSaveRoute = async () => {
    if (!canSave || isRouteSaveInFlight()) {
      return;
    }

    if (!input.routePlan.some((day) => day.items.length > 0)) {
      showToast(text.cart.noPlacesToSaveToast);
      return;
    }

    if (!startSavingRoute()) {
      return;
    }

    let hasSentSaveRequest = false;

    try {
      const inputKey = JSON.stringify(buildCreateRouteInput(input));
      const isCreateRetry =
        !appendTarget && createAttemptRef.current?.inputKey === inputKey;

      // 응답만 유실된 재요청은 이미 저장된 본인 일정과 충돌할 수 있습니다.
      // 같은 요청 ID의 결과 확인은 서버의 중복 방지 처리에 맡깁니다.
      if (!isCreateRetry) {
        const routesData =
          queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY) ??
          (await queryClient.fetchQuery<MyRoutesQuery>({
            queryKey: MY_ROUTES_QUERY_KEY,
            queryFn: () =>
              routeApi.myRoutes(undefined, {
                timeoutMs: 30_000,
                maxRetryCount: 0,
              }),
            retry: false,
          }));
        const conflict = findRouteDateConflict({
          routes: routesData.myRoutes,
          travelStartDate: input.travelStartDate,
          tripDays: getEffectiveRoutePlanTripDays(input.routePlan),
          excludeRouteId: appendTarget?.routeId,
        });

        if (conflict) {
          openModal({
            title: text.cart.dateConflictTitle,
            description: text.cart.dateConflictDescription(
              conflict.requestedRangeLabel,
              conflict.existingRangeLabel
            ),
            detail: text.cart.dateConflictDetail,
            actions: [
              {
                label: text.cart.viewMyRoutes,
                variant: "secondary",
                onClick: () => {
                  onClose();
                  navigate("/my-route");
                },
              },
              {
                label: text.cart.chooseDateAgain,
                variant: "primary",
                onClick: onChooseDate,
              },
            ],
          });
          return;
        }
      }

      if (appendTarget) {
        hasSentSaveRequest = true;
        const result = await routeCheckoutApi.appendRouteDays(
          appendTarget.routeId,
          input
        );
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, result.appendRouteDays)
        );
        showToast(text.cart.appendDaySavedToast(appendTarget.routeTitle));
      } else {
        if (!isCreateRetry) {
          createAttemptRef.current = {
            inputKey,
            requestId: createRouteRequestId(),
          };
        }

        const attempt = createAttemptRef.current;

        if (!attempt) {
          return;
        }

        hasSentSaveRequest = true;
        const result = await routeCheckoutApi.saveRoutePlan(
          input,
          attempt.requestId
        );
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, result.createRoute)
        );
        showToast(text.cart.routeSavedToast(result.createRoute.totalStopCount));
      }

      clearAppendTarget();
      onClearPlaces();
      onClose();
    } catch (error) {
      const isSaveUnconfirmed =
        hasSentSaveRequest && isGraphQLRequestError(error) && error.retryable;
      const message = isSaveUnconfirmed
        ? appendTarget
          ? text.cart.appendRouteSaveUnconfirmedError
          : text.cart.routeSaveUnconfirmedError
        : error instanceof Error
          ? error.message
          : text.cart.saveRouteFallbackError;

      showToast(message, isSaveUnconfirmed ? 5000 : 2600);
    } finally {
      finishSavingRoute();
    }
  };

  return { handleSaveRoute };
}
