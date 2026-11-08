/** 공개 목록·좋아요 목록·좋아요 Mutation이 같은 React Query 캐시 범위를 사용하도록 기준 키를 제공한다. */
import type { ServiceAreaId } from "@/data/serviceAreas";
import type { SharedRoutePageMode } from "../sharedRouteListModel";

export const SHARED_ROUTES_QUERY_KEY = ["shared-routes"] as const;

export const LIKED_SHARED_ROUTES_QUERY_KEY = ["liked-shared-routes"] as const;

/** 조회 지역별 무한 목록을 분리한다. null은 지역 조건이 없는 목록을 뜻한다. */
export const getSharedRouteListQueryKey = (
  mode: SharedRoutePageMode,
  serviceAreaId: ServiceAreaId | null
) =>
  [
    ...(mode === "liked" ? LIKED_SHARED_ROUTES_QUERY_KEY : SHARED_ROUTES_QUERY_KEY),
    "service-area",
    serviceAreaId,
  ] as const;

export const SHARED_ROUTE_LIKE_MUTATION_KEY = ["shared-route-like"] as const;

export const getRouteDetailQueryKey = (routeId: string | null) =>
  ["route-detail", routeId] as const;
