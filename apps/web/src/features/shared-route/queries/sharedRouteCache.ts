/** 공개·좋아요 공유 경로의 무한 Query 캐시에서 좋아요 상태, 경로, 작성자 항목을 원본 변경 없이 갱신한다. */
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

/** 공개 경로 목록과 좋아요한 경로 목록 중 한 페이지의 GraphQL 응답이다. */
export type SharedRouteConnectionPage =
  | SharedRouteConnectionQuery
  | LikedSharedRouteConnectionQuery;

export type SharedRouteInfiniteData = InfiniteData<
  SharedRouteConnectionPage,
  string | null
>;

export type SharedRouteLikeState = Pick<SharedRoute, "likedByMe" | "likeCount">;

/**
 * 현재 likedByMe와 likeCount를 기준으로 liked 적용 전후의 차이만 반영한다.
 * 감소 결과는 0보다 작아지지 않으며 입력 route는 변경하지 않는다.
 */
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

/** mode가 liked이면 좋아요 목록 연결을, 그 외에는 공개 목록 연결을 반환한다. */
export function getSharedRouteConnection(
  page: SharedRouteConnectionPage,
  mode: SharedRoutePageMode
) {
  return mode === "liked"
    ? (page as LikedSharedRouteConnectionQuery).likedRouteConnection
    : (page as SharedRouteConnectionQuery).sharedRouteConnection;
}

/** 무한 조회의 모든 페이지에서 mode에 해당하는 경로를 순서대로 펼치며, 캐시가 없으면 빈 배열을 반환한다. */
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

/** 모든 캐시 페이지에서 ownerId가 작성한 경로를 제외한 새 캐시 데이터를 반환한다. 캐시가 없으면 undefined를 유지한다. */
export function removeSharedRouteOwnerFromInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  ownerId: string
) {
  return updateSharedRouteInfiniteData(data, mode, (routes) =>
    routes.filter((route) => route.owner.id !== ownerId)
  );
}

/** 모든 캐시 페이지에서 routeId와 같은 경로를 제외한 새 캐시 데이터를 반환한다. 캐시가 없으면 undefined를 유지한다. */
export function removeSharedRouteFromInfiniteData(
  data: SharedRouteInfiniteData | undefined,
  mode: SharedRoutePageMode,
  routeId: string
) {
  return updateSharedRouteInfiniteData(data, mode, (routes) =>
    routes.filter((route) => route.id !== routeId)
  );
}

/**
 * 낙관적 변경 전 previousData에서 routeId의 경로와 페이지 위치를 찾아 현재 캐시에 복원한다.
 * 현재 캐시에 경로가 남아 있으면 좋아요 상태만 되돌리고, 빠졌으면 이전 페이지와 순서에 다시 삽입한다.
 * 이전 경로를 찾지 못하면 현재 캐시에서도 해당 ID를 제거한다.
 */
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

/**
 * 공개 경로만 mode에 해당하는 무한 목록 캐시에 추가하거나 기존 항목을 교체한다.
 * liked 목록에서는 좋아요 해제 경로를 기본적으로 제거하며 keepUnlikedRoute가 true이면 유지한다.
 * 새 경로는 첫 페이지 앞에 추가하고, 캐시가 없거나 페이지가 비어 있으면 원본 값을 유지한다.
 */
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

/**
 * 서버 응답 전에 route의 likedByMe와 likeCount를 예상 값으로 바꿔 무한 목록 캐시에 반영한다.
 * likeCount를 생략하면 기존 상태와 liked의 차이로 계산하며, liked 목록의 제거 여부는 keepUnlikedRoute로 결정한다.
 */
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
