/** 공유 경로 좋아요를 낙관적으로 변경하고 목록·좋아요 목록·상세 캐시와 요청 중 상태를 함께 관리한다. */
import { useCallback, useMemo } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useStore } from "zustand";
import { routeApi } from "@/api/routeApi";
import { useLoginRequest } from "@/hooks/useLoginRequest";
import type { RouteByIdQuery } from "@/generated/graphql";
import { getAuthToken } from "@/lib/authToken";
import { useUiText } from "@/lib/uiText";
import type { ServiceAreaId } from "@/data/serviceAreas";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { SharedRoute } from "../sharedRouteCardModel";
import {
  getSharedRouteLikeState,
  restoreSharedRouteInInfiniteData,
  upsertSharedRouteInInfiniteData,
  type SharedRouteInfiniteData,
} from "../queries/sharedRouteCache";
import { getSharedRouteLikeStore } from "../stores/sharedRouteLikeStore";
import type { SharedRoutePageMode } from "../sharedRouteListModel";
import {
  getRouteDetailQueryKey,
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTE_LIKE_MUTATION_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "../queries/sharedRouteQueryKeys";

type UseSharedRouteLikeOptions = {

  mode: SharedRoutePageMode;

  serviceAreaId?: ServiceAreaId;
};

type ToggleLikeVariables = {
  route: SharedRoute;
  nextLiked: boolean;
  keepUnlikedRoute: boolean;
  queryKeys: { shared: QueryKey; liked: QueryKey };
  generation: number;
};

type ToggleLikeContext = {
  previousSharedRoutes: SharedRouteInfiniteData | undefined;
  previousLikedRoutes: SharedRouteInfiniteData | undefined;
  previousDetail: RouteByIdQuery | undefined;
};

/**
 * 비로그인 사용자는 로그인 흐름으로 보낸다. 요청 전 세 캐시를 예상 상태로 갱신하고 세대 번호로 연속 클릭의
 * 늦은 응답을 구분하며, 실패 시 해당 요청이 최신일 때만 이전 캐시와 좋아요 상태를 복원한다.
 */
export function useSharedRouteLike({
  mode,
  serviceAreaId,
}: UseSharedRouteLikeOptions) {
  const text = useUiText();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const requestLogin = useLoginRequest();
  const likeStore = useMemo(
    () => getSharedRouteLikeStore(queryClient),
    [queryClient]
  );
  const pendingLikes = useStore(likeStore, (state) => state.pendingLikes);
  const setPendingLike = useStore(likeStore, (state) => state.setPendingLike);
  const queryKeys = useMemo(
    () => ({
      shared: serviceAreaId
        ? [...SHARED_ROUTES_QUERY_KEY, "service-area", serviceAreaId]
        : SHARED_ROUTES_QUERY_KEY,
      liked: serviceAreaId
        ? [...LIKED_SHARED_ROUTES_QUERY_KEY, "service-area", serviceAreaId]
        : LIKED_SHARED_ROUTES_QUERY_KEY,
    }),
    [serviceAreaId]
  );

  const updateLikeCaches = (
    route: SharedRoute,
    { queryKeys, keepUnlikedRoute }: ToggleLikeVariables
  ) => {
    queryClient.setQueryData<SharedRouteInfiniteData>(queryKeys.shared, (data) =>
      upsertSharedRouteInInfiniteData(data, "feed", route)
    );
    queryClient.setQueryData<SharedRouteInfiniteData>(queryKeys.liked, (data) =>
      upsertSharedRouteInInfiniteData(data, "liked", route, { keepUnlikedRoute })
    );
    queryClient.setQueryData<RouteByIdQuery>(
      getRouteDetailQueryKey(route.id),
      (data) => data?.route
        ? { ...data, route: { ...data.route, ...getSharedRouteLikeState(route) } }
        : data
    );
  };

  const { mutate: mutateLike } = useMutation<
    Awaited<ReturnType<typeof routeApi.likeRoute>>["likeRoute"],
    Error,
    ToggleLikeVariables,
    ToggleLikeContext
  >({
    mutationKey: SHARED_ROUTE_LIKE_MUTATION_KEY,
    mutationFn: async ({ route, nextLiked, generation }) => {
      if (generation !== likeStore.getState().generation) {
        throw new Error("Shared route like request was cleared.");
      }

      return nextLiked
        ? (await routeApi.likeRoute(route.id)).likeRoute
        : (await routeApi.unlikeRoute(route.id)).unlikeRoute;
    },
    onMutate: async (variables) => {
      const { route, nextLiked, queryKeys } = variables;

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queryKeys.shared }),
        queryClient.cancelQueries({ queryKey: queryKeys.liked }),
        queryClient.cancelQueries({ queryKey: getRouteDetailQueryKey(route.id) }),
      ]);

      if (variables.generation !== likeStore.getState().generation) {
        throw new Error("Shared route like request was cleared.");
      }

      const previousSharedRoutes =
        queryClient.getQueryData<SharedRouteInfiniteData>(queryKeys.shared);
      const previousLikedRoutes =
        queryClient.getQueryData<SharedRouteInfiniteData>(queryKeys.liked);
      const previousDetail = queryClient.getQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id)
      );

      updateLikeCaches(
        { ...route, ...getSharedRouteLikeState(route, nextLiked) },
        variables
      );

      return { previousSharedRoutes, previousLikedRoutes, previousDetail };
    },
    onSuccess: (interaction, variables) => {
      if (variables.generation !== likeStore.getState().generation) {
        return;
      }

      updateLikeCaches(
        {
          ...variables.route,
          ...interaction.route,
          likedByMe: interaction.liked,
        },
        variables
      );
    },
    onError: (error, { route, queryKeys, generation }, context) => {
      if (generation !== likeStore.getState().generation) {
        return;
      }

      if (context) {
        queryClient.setQueryData<SharedRouteInfiniteData>(queryKeys.shared, (data) =>
          restoreSharedRouteInInfiniteData(
            data, context.previousSharedRoutes, "feed", route.id
          )
        );
        queryClient.setQueryData<SharedRouteInfiniteData>(queryKeys.liked, (data) =>
          restoreSharedRouteInInfiniteData(
            data, context.previousLikedRoutes, "liked", route.id
          )
        );
        queryClient.setQueryData<RouteByIdQuery>(
          getRouteDetailQueryKey(route.id),
          (data) => data?.route
            ? {
                ...data,
                route: {
                  ...data.route,
                  ...getSharedRouteLikeState(
                    context.previousDetail?.route ?? route
                  ),
                },
              }
            : data
        );
      }

      showToast(error.message || text.sharedRoute.likeError, 2400);
    },
    onSettled: (interaction, _error, variables) => {
      if (variables.generation !== likeStore.getState().generation) {
        return;
      }

      const pendingLike = likeStore.getState().pendingLikes.get(variables.route.id);

      // Keep the latest click visible while saving each route's requests in order.
      if (
        interaction &&
        pendingLike &&
        pendingLike.likedByMe !== interaction.liked
      ) {
        const confirmedRoute = {
          ...variables.route,
          ...interaction.route,
          likedByMe: interaction.liked,
        };

        setPendingLike(
          confirmedRoute.id,
          getSharedRouteLikeState(confirmedRoute, pendingLike.likedByMe)
        );
        mutateLike({
          ...variables,
          route: confirmedRoute,
          nextLiked: pendingLike.likedByMe,
        });
        return;
      }

      setPendingLike(variables.route.id);
    },
  });

  const toggleLike = useCallback(
    (route: SharedRoute) => {
      if (route.isMine) {
        return;
      }

      if (!getAuthToken()) {
        requestLogin("shared-route-like");
        return;
      }

      const pendingLike = likeStore.getState().pendingLikes.get(route.id);
      const currentLike = pendingLike ?? route;
      const nextLike = getSharedRouteLikeState(currentLike, !currentLike.likedByMe);

      // Show the click before query cancellation or network work starts.
      setPendingLike(route.id, nextLike);

      if (!pendingLike) {
        mutateLike({
          route,
          nextLiked: nextLike.likedByMe,
          keepUnlikedRoute: mode === "liked",
          queryKeys,
          generation: likeStore.getState().generation,
        });
      }
    },
    [likeStore, mode, mutateLike, queryKeys, requestLogin, setPendingLike]
  );

  const applyLikeState = useCallback(
    <Route extends SharedRoute>(route: Route): Route => {
      const pendingLike = pendingLikes.get(route.id);
      return pendingLike ? { ...route, ...pendingLike } : route;
    },
    [pendingLikes]
  );

  return {
    applyLikeState,
    pendingLikeRouteIds: new Set(pendingLikes.keys()),
    toggleLike,
  };
}
