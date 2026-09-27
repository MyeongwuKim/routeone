/** 공개 목록·좋아요 목록·좋아요 Mutation이 같은 React Query 캐시 범위를 사용하도록 기준 키를 제공한다. */
export const SHARED_ROUTES_QUERY_KEY = ["shared-routes"] as const;

export const LIKED_SHARED_ROUTES_QUERY_KEY = ["liked-shared-routes"] as const;

export const SHARED_ROUTE_LIKE_MUTATION_KEY = ["shared-route-like"] as const;

export const getRouteDetailQueryKey = (routeId: string | null) =>
  ["route-detail", routeId] as const;
