import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import type {
  RouteByIdQuery,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import type { ServiceAreaId } from "@/data/serviceAreas";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { SharedRoute } from "../sharedRouteCardModel";
import {
  optimisticUpdateSharedRouteInfiniteLike,
  upsertSharedRouteInInfiniteData,
  type SharedRouteInfiniteData,
} from "../queries/sharedRouteCache";
import type { SharedRoutePageMode } from "../sharedRouteListModel";
import {
  getRouteDetailQueryKey,
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
} from "../queries/sharedRouteQueryKeys";

type UseSharedRouteLikeOptions = {
  routes: SharedRoute[];
  mode: SharedRoutePageMode;
  serviceAreaId?: ServiceAreaId;
};

type ToggleLikeVariables = {
  route: SharedRoute;
  wasLiked: boolean;
  nextLiked: boolean;
  previousLikeCount: number;
  keepUnlikedRoute: boolean;
};

type ToggleLikeContext = {
  previousLikedRoutes: SharedRouteInfiniteData | undefined;
};

export function useSharedRouteLike({
  routes,
  mode,
  serviceAreaId,
}: UseSharedRouteLikeOptions) {
  const text = useUiText();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const pendingLikeRouteIdsRef = useRef<Set<string>>(new Set());
  const [pendingLikeRouteIds, setPendingLikeRouteIds] = useState<Set<string>>(
    new Set()
  );
  const sharedRoutesQueryKey = serviceAreaId
    ? [...SHARED_ROUTES_QUERY_KEY, "service-area", serviceAreaId]
    : SHARED_ROUTES_QUERY_KEY;
  const likedSharedRoutesQueryKey = serviceAreaId
    ? [...LIKED_SHARED_ROUTES_QUERY_KEY, "service-area", serviceAreaId]
    : LIKED_SHARED_ROUTES_QUERY_KEY;
  const likedRouteIds = useMemo(
    () =>
      new Set(
        routes.filter((route) => route.likedByMe).map((route) => route.id)
      ),
    [routes]
  );

  const setLikePending = useCallback((routeId: string, pending: boolean) => {
    const nextIds = new Set(pendingLikeRouteIdsRef.current);

    if (pending) {
      nextIds.add(routeId);
    } else {
      nextIds.delete(routeId);
    }

    pendingLikeRouteIdsRef.current = nextIds;
    setPendingLikeRouteIds(nextIds);
  }, []);
  const { mutate: mutateLike } = useMutation<
    Awaited<ReturnType<typeof routeApi.likeRoute>>["likeRoute"],
    Error,
    ToggleLikeVariables,
    ToggleLikeContext
  >({
    mutationFn: async ({ route, nextLiked }) =>
      nextLiked
        ? (await routeApi.likeRoute(route.id)).likeRoute
        : (await routeApi.unlikeRoute(route.id)).unlikeRoute,
    onMutate: async ({ route, nextLiked, keepUnlikedRoute }) => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: sharedRoutesQueryKey,
        }),
        queryClient.cancelQueries({
          queryKey: likedSharedRoutesQueryKey,
        }),
      ]);
      const previousLikedRoutes =
        queryClient.getQueryData<SharedRouteInfiniteData>(
          likedSharedRoutesQueryKey
        );

      queryClient.setQueryData<SharedRouteInfiniteData>(
        sharedRoutesQueryKey,
        (currentData) =>
          optimisticUpdateSharedRouteInfiniteLike({
            data: currentData,
            mode: "feed",
            route,
            liked: nextLiked,
          })
      );
      queryClient.setQueryData<SharedRouteInfiniteData>(
        likedSharedRoutesQueryKey,
        (currentData) =>
          optimisticUpdateSharedRouteInfiniteLike({
            data: currentData,
            mode: "liked",
            route,
            liked: nextLiked,
            keepUnlikedRoute,
          })
      );
      queryClient.setQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id),
        (currentData) =>
          currentData?.route
            ? {
                ...currentData,
                route: {
                  ...currentData.route,
                  likedByMe: nextLiked,
                  likeCount: Math.max(
                    0,
                    currentData.route.likeCount + (nextLiked ? 1 : -1)
                  ),
                },
              }
            : currentData
      );

      return { previousLikedRoutes };
    },
    onSuccess: (interaction, { route, keepUnlikedRoute }) => {
      queryClient.setQueryData<SharedRouteInfiniteData>(
        sharedRoutesQueryKey,
        (currentData) =>
          upsertSharedRouteInInfiniteData(
            currentData,
            "feed",
            interaction.route,
            {
              liked: interaction.liked,
            }
          )
      );
      queryClient.setQueryData<SharedRouteInfiniteData>(
        likedSharedRoutesQueryKey,
        (currentData) =>
          upsertSharedRouteInInfiniteData(
            currentData,
            "liked",
            interaction.route,
            {
              liked: interaction.liked,
              keepUnlikedRoute,
            }
          )
      );
      queryClient.setQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id),
        (currentData) =>
          currentData?.route
            ? {
                ...currentData,
                route: {
                  ...currentData.route,
                  ...interaction.route,
                  likedByMe: interaction.liked,
                },
              }
            : currentData
      );
    },
    onError: (
      error,
      { route, wasLiked, previousLikeCount },
      context
    ) => {
      queryClient.setQueryData<SharedRouteInfiniteData>(
        sharedRoutesQueryKey,
        (currentData) =>
          optimisticUpdateSharedRouteInfiniteLike({
            data: currentData,
            mode: "feed",
            route,
            liked: wasLiked,
            likeCount: previousLikeCount,
          })
      );
      if (context?.previousLikedRoutes) {
        queryClient.setQueryData<SharedRouteInfiniteData>(
          likedSharedRoutesQueryKey,
          context.previousLikedRoutes
        );
      }
      queryClient.setQueryData<RouteByIdQuery>(
        getRouteDetailQueryKey(route.id),
        (currentData) =>
          currentData?.route
            ? {
                ...currentData,
                route: {
                  ...currentData.route,
                  likedByMe: wasLiked,
                  likeCount: previousLikeCount,
                },
              }
            : currentData
      );
      showToast(
        error.message || text.sharedRoute.likeError,
        2400
      );
    },
    onSettled: (_data, _error, { route }) => {
      setLikePending(route.id, false);
    },
  });

  const toggleLike = useCallback(
    (route: SharedRoute) => {
      if (route.isMine || pendingLikeRouteIdsRef.current.has(route.id)) {
        return;
      }

      const wasLiked = likedRouteIds.has(route.id) || route.likedByMe;

      setLikePending(route.id, true);
      mutateLike({
        route,
        wasLiked,
        nextLiked: !wasLiked,
        previousLikeCount: route.likeCount,
        keepUnlikedRoute: mode === "liked",
      });
    },
    [likedRouteIds, mode, mutateLike, setLikePending]
  );

  return {
    likedRouteIds,
    pendingLikeRouteIds,
    toggleLike,
  };
}
