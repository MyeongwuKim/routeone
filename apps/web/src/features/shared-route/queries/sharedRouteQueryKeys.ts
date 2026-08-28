export const SHARED_ROUTES_QUERY_KEY = ["shared-routes"] as const;
export const LIKED_SHARED_ROUTES_QUERY_KEY = ["liked-shared-routes"] as const;
export const SHARED_ROUTE_LIKE_MUTATION_KEY = ["shared-route-like"] as const;

export const getRouteDetailQueryKey = (routeId: string | null) =>
  ["route-detail", routeId] as const;
