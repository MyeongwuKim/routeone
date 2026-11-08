/** 일정 만들기 결과를 새 경로로 저장하거나 기존 경로에 DAY로 추가하는 인증·중복·복구 흐름을 관리한다. */
import { useCallback, useRef } from "react";
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
import { getSelectableRouteDay } from "@/features/my-route/routeDisplay";
import type { MyRoutesQuery } from "@/generated/graphql";
import { isGraphQLRequestError } from "@/lib/graphqlClient";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import { useLoginRequest } from "@/hooks/useLoginRequest";
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

/**
 * 비로그인 사용자는 일정 결과를 유지한 채 로그인으로 안내한다. 다시 저장을 누르면 날짜 충돌과 입력 가능 상태를 확인한다.
 * 새 경로 생성은 같은 입력에 같은 requestId를 재사용해
 * 결과 불명 재시도를 중복 생성으로부터 보호한다. 성공 시 캐시를 갱신하고 담은 장소를 비우며,
 * 새로 만든 루트는 저장 완료 안내에서 해당 DAY 상세를 열 수 있게 한다.
 */
export function useRouteCheckoutSave({
  input,
  canSave,
  onClose,
  onClearPlaces,
  onChooseDate,
}: UseRouteCheckoutSaveOptions) {
  const text = useUiText();
  const navigate = useNavigate();
  const requestLogin = useLoginRequest();
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

  const saveAuthenticatedRoute = useCallback(async () => {
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
        const savedRoute = result.createRoute;
        // 저장 전에 시작된 목록 조회가 새 루트를 덮어쓰지 않도록 정리한다.
        await queryClient.cancelQueries({
          queryKey: MY_ROUTES_QUERY_KEY,
          exact: true,
        });
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          (currentData) => upsertMyRouteCache(currentData, savedRoute)
        );
        const savedDay = getSelectableRouteDay(savedRoute);
        const savedRoutePath = savedDay
          ? `/my-route?${new URLSearchParams({
              routeId: savedRoute.id,
              dayId: savedDay.id,
            })}`
          : "/my-route";

        openModal({
          title: text.cart.routeSavedTitle(savedRoute.totalStopCount),
          actions: [
            { label: text.common.close, variant: "secondary" },
            {
              label: text.cart.viewSavedRoute,
              variant: "primary",
              onClick: () => navigate(savedRoutePath),
            },
          ],
        });
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
  }, [
    appendTarget,
    canSave,
    clearAppendTarget,
    finishSavingRoute,
    input,
    isRouteSaveInFlight,
    navigate,
    onChooseDate,
    onClearPlaces,
    onClose,
    openModal,
    queryClient,
    showToast,
    startSavingRoute,
    text,
  ]);

  const handleSaveRoute = () => {
    if (!canSave || isRouteSaveInFlight()) {
      return;
    }

    if (!input.routePlan.some((day) => day.items.length > 0)) {
      showToast(text.cart.noPlacesToSaveToast);
      return;
    }

    if (!getAuthToken()) {
      openModal({
        title: text.auth.saveRequiredTitle,
        description: text.auth.saveRequiredDescription,
        actions: [
          {
            label: text.common.cancel,
            variant: "secondary",
          },
          {
            label: text.auth.login,
            variant: "primary",
            onClick: () => requestLogin("route-save", { preserveCurrentScreen: true }),
          },
        ],
      });
      return;
    }

    void saveAuthenticatedRoute();
  };

  return { handleSaveRoute };
}
