import type { InfiniteData } from "@tanstack/react-query";
import type {
  LikedSharedRouteConnectionQuery,
  RouteSummaryFieldsFragment,
  SharedRouteConnectionQuery,
} from "@/generated/graphql";
import type { SharedRoute } from "../sharedRouteCardModel";
import type { SharedRoutePageMode } from "../sharedRouteListModel";

export type SharedRouteConnectionPage =
  | SharedRouteConnectionQuery
  | LikedSharedRouteConnectionQuery;

export type SharedRouteInfiniteData = InfiniteData<
  SharedRouteConnectionPage,
  string | null
>;

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

export function upsertSharedRouteInInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  nextRoute: RouteSummaryFieldsFragment,
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
  route: RouteSummaryFieldsFragment;
  liked: boolean;
  likeCount?: number;
  keepUnlikedRoute?: boolean;
}) {
  const nextLikeCount =
    likeCount ??
    Math.max(0, route.likeCount + (liked ? (route.likedByMe ? 0 : 1) : -1));

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
