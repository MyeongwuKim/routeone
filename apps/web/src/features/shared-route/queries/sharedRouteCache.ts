import type { InfiniteData } from "@tanstack/react-query";
import type {
  LikedSharedRouteConnectionQuery,
  RouteSummaryFieldsFragment,
  SharedRouteConnectionQuery,
} from "@/generated/graphql";
import type { SharedRoute } from "../sharedRouteCardModel";
import type { SharedRoutePageMode } from "../sharedRouteListModel";

type SharedRouteCacheRoute = RouteSummaryFieldsFragment &
  Pick<SharedRoute, "owner">;

export type SharedRouteConnectionPage =
  | SharedRouteConnectionQuery
  | LikedSharedRouteConnectionQuery;

export type SharedRouteInfiniteData = InfiniteData<
  SharedRouteConnectionPage,
  string | null
>;

export type SharedRouteLikeState = Pick<SharedRoute, "likedByMe" | "likeCount">;

export function getSharedRouteLikeState(
  route: SharedRouteLikeState,
  liked = route.likedByMe
): SharedRouteLikeState {
  return {
    likedByMe: liked,
    likeCount: Math.max(
      0,
      route.likeCount + Number(liked) - Number(route.likedByMe)
    ),
  };
}

export function getSharedRouteConnection(
  page: SharedRouteConnectionPage,
  mode: SharedRoutePageMode
) {
  return mode === "liked"
    ? (page as LikedSharedRouteConnectionQuery).likedRouteConnection
    : (page as SharedRouteConnectionQuery).sharedRouteConnection;
}

export function getSharedRouteInfiniteList(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode
) {
  return (
    data?.pages.flatMap((page) => getSharedRouteConnection(page, mode).nodes) ??
    []
  );
}

function mapSharedRouteConnectionPage(
  page: SharedRouteConnectionPage,
  mode: SharedRoutePageMode,
  mapper: (routes: SharedRoute[]) => SharedRoute[]
): SharedRouteConnectionPage {
  if (mode === "liked") {
    const likedPage = page as LikedSharedRouteConnectionQuery;

    return {
      ...likedPage,
      likedRouteConnection: {
        ...likedPage.likedRouteConnection,
        nodes: mapper(likedPage.likedRouteConnection.nodes),
      },
    };
  }

  const sharedPage = page as SharedRouteConnectionQuery;

  return {
    ...sharedPage,
    sharedRouteConnection: {
      ...sharedPage.sharedRouteConnection,
      nodes: mapper(sharedPage.sharedRouteConnection.nodes),
    },
  };
}

function updateSharedRouteInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  mapper: (routes: SharedRoute[]) => SharedRoute[]
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) =>
      mapSharedRouteConnectionPage(page, mode, mapper)
    ),
  };
}

export function restoreSharedRouteInInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  previousData: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  routeId: string
) {
  if (!data) {
    return data;
  }

  const previousPageIndex = previousData?.pages.findIndex((page) =>
    getSharedRouteConnection(page, mode).nodes.some(
      (route) => route.id === routeId
    )
  ) ?? -1;
  const previousPage = previousData?.pages[previousPageIndex];
  const previousRoutes = previousPage
    ? getSharedRouteConnection(previousPage, mode).nodes
    : [];
  const previousRouteIndex = previousRoutes.findIndex(
    (route) => route.id === routeId
  );
  const previousRoute = previousRoutes[previousRouteIndex];

  if (!previousRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.filter((route) => route.id !== routeId)
    );
  }

  const hasRoute = data.pages.some((page) =>
    getSharedRouteConnection(page, mode).nodes.some(
      (route) => route.id === routeId
    )
  );

  if (hasRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.map((route) =>
        route.id === routeId
          ? { ...route, ...getSharedRouteLikeState(previousRoute) }
          : route
      )
    );
  }

  return {
    ...data,
    pages: data.pages.map((page, index) =>
      index === Math.min(previousPageIndex, data.pages.length - 1)
        ? mapSharedRouteConnectionPage(page, mode, (routes) => [
            ...routes.slice(0, previousRouteIndex),
            previousRoute,
            ...routes.slice(previousRouteIndex),
          ])
        : page
    ),
  };
}

export function upsertSharedRouteInInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  nextRoute: SharedRouteCacheRoute,
  options: {
    liked?: boolean;
    keepUnlikedRoute?: boolean;
    likeCount?: number;
  } = {}
) {
  if (!data || nextRoute.visibility !== "PUBLIC") {
    return data;
  }

  const nextLiked = options.liked ?? nextRoute.likedByMe;
  const routeForCache = {
    ...nextRoute,
    likedByMe: nextLiked,
    likeCount: options.likeCount ?? nextRoute.likeCount,
  };
  const hasRoute = data.pages.some((page) =>
    getSharedRouteConnection(page, mode).nodes.some(
      (route) => route.id === nextRoute.id
    )
  );

  if (mode === "liked" && !nextLiked && !options.keepUnlikedRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.filter((route) => route.id !== nextRoute.id)
    );
  }

  if (hasRoute) {
    return updateSharedRouteInfiniteData(data, mode, (routes) =>
      routes.map((route) =>
        route.id === nextRoute.id ? { ...route, ...routeForCache } : route
      )
    );
  }

  if (data.pages.length === 0) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page, index) =>
      index === 0
        ? mapSharedRouteConnectionPage(page, mode, (routes) => [
            { ...routeForCache, stops: [] },
            ...routes,
          ])
        : page
    ),
  };
}

export function optimisticUpdateSharedRouteInfiniteLike({
  data,
  mode,
  route,
  liked,
  likeCount,
  keepUnlikedRoute = false,
}: {
  data: SharedRouteInfiniteData | undefined;
  mode: SharedRoutePageMode;
  route: SharedRoute;
  liked: boolean;
  likeCount?: number;
  keepUnlikedRoute?: boolean;
}) {
  const nextLikeCount = likeCount ?? getSharedRouteLikeState(route, liked).likeCount;

  return upsertSharedRouteInInfiniteData(
    data,
    mode,
    {
      ...route,
      likedByMe: liked,
      likeCount: nextLikeCount,
    },
    {
      liked,
      keepUnlikedRoute,
      likeCount: nextLikeCount,
    }
  );
}
