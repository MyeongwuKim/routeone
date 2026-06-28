import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaRegHeart } from "react-icons/fa";
import { MdArrowBack, MdOutlineHub } from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import RouteCheckoutModal from "@/features/route-checkout/components/RouteCheckoutModal";
import type {
  PlannedRouteDay,
  RouteStartLocation,
} from "@/features/route-checkout/components/cart-steps/routePlanTypes";
import SharedRouteCard from "@/features/shared-route/components/SharedRouteCard";
import SharedRouteDetailSkeleton from "@/features/shared-route/components/SharedRouteDetailSkeleton";
import {
  LIKED_SHARED_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
  optimisticUpdateLikedSharedRouteLikeCache,
  optimisticUpdateSharedRouteLikeCache,
  upsertLikedSharedRouteSummaryCache,
  upsertSharedRouteSummaryCache,
} from "@/features/my-route/myRouteCache";
import { getSortedRouteDays } from "@/features/my-route/routeDisplay";
import type {
  LikedSharedRoutesQuery,
  RouteByIdQuery,
  RouteSummaryFieldsFragment,
  SharedRoutesQuery,
} from "@/generated/graphql";
import type { SavedPlaceItem } from "@/stores/placeCartStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const getRouteDetailQueryKey = (routeId: string) =>
  ["route-detail", routeId] as const;

type SharedRoutePageMode = "feed" | "liked";

type SharedRoutePageProps = {
  mode?: SharedRoutePageMode;
};

type SharedRouteListData = SharedRoutesQuery | LikedSharedRoutesQuery;

const PAGE_COPY: Record<
  SharedRoutePageMode,
  {
    title: string;
    description: string;
    loadingTitle: string;
    loadingDescription: string;
    error: string;
    empty: string;
  }
> = {
  feed: {
    title: "공유 루트",
    description: "완료한 여행 루트를 모아보는 피드",
    loadingTitle: "공유 루트를 불러오는 중",
    loadingDescription: "다녀온 사람들의 루트를 확인하고 있어요.",
    error: "공유 루트를 불러오지 못했어요.",
    empty: "아직 공유된 루트가 없어요.",
  },
  liked: {
    title: "좋아요한 공유 루트",
    description: "내가 좋아요한 공유 루트 모아보기",
    loadingTitle: "좋아요한 루트를 불러오는 중",
    loadingDescription: "하트를 눌렀던 공유 루트를 모으고 있어요.",
    error: "좋아요한 공유 루트를 불러오지 못했어요.",
    empty: "아직 좋아요한 공유 루트가 없어요.",
  },
};

function getSharedRouteList(
  data: SharedRouteListData | undefined,
  mode: SharedRoutePageMode
) {
  if (!data) {
    return [];
  }

  return mode === "liked"
    ? (data as LikedSharedRoutesQuery).likedRoutes
    : (data as SharedRoutesQuery).sharedRoutes;
}

function createSavedPlacesFromRoutePlan(routePlan: PlannedRouteDay[]) {
  const seenPlaceIds = new Set<string>();
  const savedPlaces: SavedPlaceItem[] = [];

  routePlan.forEach((day) => {
    day.items.forEach((item) => {
      if (seenPlaceIds.has(item.place.id)) {
        return;
      }

      seenPlaceIds.add(item.place.id);
      savedPlaces.push({
        id: item.place.id,
        place: item.place,
        thumbnailUrl: item.place.images[0] ?? "",
        savedAt: Date.now() - savedPlaces.length,
      });
    });
  });

  return savedPlaces;
}

function getRoutePlanStartLocation(
  routePlan: PlannedRouteDay[]
): RouteStartLocation | null {
  return routePlan.find((day) => day.startLocation)?.startLocation ?? null;
}

function getRoutePlanTripDays(routePlan: PlannedRouteDay[]) {
  return Math.max(1, routePlan.length);
}

function SharedRoutePage({ mode = "feed" }: SharedRoutePageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const [likedRouteIds, setLikedRouteIds] = useState<Set<string>>(new Set());
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [checkoutRoutePlan, setCheckoutRoutePlan] = useState<
    PlannedRouteDay[] | null
  >(null);
  const pendingLikeRouteIdsRef = useRef<Set<string>>(new Set());
  const [pendingLikeRouteIds, setPendingLikeRouteIds] = useState<Set<string>>(
    new Set()
  );
  const pageCopy = PAGE_COPY[mode];
  const routeListQueryKey =
    mode === "liked" ? LIKED_SHARED_ROUTES_QUERY_KEY : SHARED_ROUTES_QUERY_KEY;
  const routeListQuery = useQuery<SharedRouteListData>({
    queryKey: routeListQueryKey,
    queryFn: async () =>
      mode === "liked"
        ? routeApi.likedSharedRoutes()
        : routeApi.sharedRoutes(),
  });
  const routes = useMemo(
    () => getSharedRouteList(routeListQuery.data, mode),
    [routeListQuery.data, mode]
  );
  const selectedRouteQuery = useQuery({
    queryKey: ["route-detail", selectedRouteId],
    enabled: Boolean(selectedRouteId),
    queryFn: async () => {
      if (!selectedRouteId) {
        throw new Error("선택한 공유 루트가 없습니다.");
      }

      const result = await routeApi.routeById(selectedRouteId);

      if (!result.route) {
        throw new Error("공유 루트를 찾지 못했어요.");
      }

      return result;
    },
  });
  const selectedRoute = selectedRouteQuery.data?.route ?? null;
  const selectedRouteDay = selectedRoute
    ? (getSortedRouteDays(selectedRoute)[0] ?? null)
    : null;
  const checkoutSavedPlaces = useMemo(
    () => (checkoutRoutePlan ? createSavedPlacesFromRoutePlan(checkoutRoutePlan) : []),
    [checkoutRoutePlan]
  );
  const checkoutCandidatePlaces = useMemo(
    () => checkoutSavedPlaces.map((item) => item.place),
    [checkoutSavedPlaces]
  );
  const checkoutStartLocation = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanStartLocation(checkoutRoutePlan) : null),
    [checkoutRoutePlan]
  );
  const checkoutTripDays = useMemo(
    () => (checkoutRoutePlan ? getRoutePlanTripDays(checkoutRoutePlan) : 1),
    [checkoutRoutePlan]
  );

  useEffect(() => {
    if (!routeListQuery.data) {
      return;
    }

    setLikedRouteIds((currentIds) => {
      const nextIds = new Set(currentIds);

      routes.forEach((route) => {
        if (route.likedByMe) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }
      });

      return nextIds;
    });
  }, [routeListQuery.data, routes]);

  const setLikePending = (routeId: string, pending: boolean) => {
    const nextIds = new Set(pendingLikeRouteIdsRef.current);

    if (pending) {
      nextIds.add(routeId);
    } else {
      nextIds.delete(routeId);
    }

    pendingLikeRouteIdsRef.current = nextIds;
    setPendingLikeRouteIds(nextIds);
  };

  const handleToggleLike = async (route: RouteSummaryFieldsFragment) => {
    if (route.isMine || pendingLikeRouteIdsRef.current.has(route.id)) {
      return;
    }

    const wasLiked = likedRouteIds.has(route.id) || route.likedByMe;
    const nextLiked = !wasLiked;
    const previousLikeCount = route.likeCount;
    const previousLikedRoutes =
      queryClient.getQueryData<LikedSharedRoutesQuery>(
        LIKED_SHARED_ROUTES_QUERY_KEY
      );

    setLikePending(route.id, true);
    await Promise.all([
      queryClient.cancelQueries({
        queryKey: SHARED_ROUTES_QUERY_KEY,
      }),
      queryClient.cancelQueries({
        queryKey: LIKED_SHARED_ROUTES_QUERY_KEY,
      }),
    ]);

    setLikedRouteIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextLiked) {
        nextIds.add(route.id);
      } else {
        nextIds.delete(route.id);
      }

      return nextIds;
    });
    queryClient.setQueriesData<SharedRoutesQuery>(
      {
        queryKey: SHARED_ROUTES_QUERY_KEY,
      },
      (currentData) =>
        optimisticUpdateSharedRouteLikeCache({
          data: currentData,
          routeId: route.id,
          liked: nextLiked,
        })
    );
    queryClient.setQueryData<LikedSharedRoutesQuery>(
      LIKED_SHARED_ROUTES_QUERY_KEY,
      (currentData) =>
        optimisticUpdateLikedSharedRouteLikeCache({
          data: currentData,
          route,
          liked: nextLiked,
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

    try {
      const interaction = nextLiked
        ? (await routeApi.likeRoute(route.id)).likeRoute
        : (await routeApi.unlikeRoute(route.id)).unlikeRoute;

      setLikedRouteIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (interaction.liked) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }

        return nextIds;
      });
      queryClient.setQueriesData<SharedRoutesQuery>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          upsertSharedRouteSummaryCache(currentData, interaction.route)
      );
      queryClient.setQueryData<LikedSharedRoutesQuery>(
        LIKED_SHARED_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertLikedSharedRouteSummaryCache(
            currentData,
            interaction.route,
            interaction.liked
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
    } catch (error) {
      setLikedRouteIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (wasLiked) {
          nextIds.add(route.id);
        } else {
          nextIds.delete(route.id);
        }

        return nextIds;
      });
      queryClient.setQueriesData<SharedRoutesQuery>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          optimisticUpdateSharedRouteLikeCache({
            data: currentData,
            routeId: route.id,
            liked: wasLiked,
            likeCount: previousLikeCount,
          })
      );
      if (previousLikedRoutes) {
        queryClient.setQueryData<LikedSharedRoutesQuery>(
          LIKED_SHARED_ROUTES_QUERY_KEY,
          previousLikedRoutes
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
        error instanceof Error ? error.message : "좋아요를 반영하지 못했어요.",
        2400
      );
    } finally {
      setLikePending(route.id, false);
    }
  };
  const handleRequestCheckoutFromSharedRoute = (
    routePlan: PlannedRouteDay[]
  ) => {
    setCheckoutRoutePlan(routePlan);
  };
  const handleCloseCheckout = () => {
    setCheckoutRoutePlan(null);
  };

  return (
    <section className="space-y-3 pb-4">
      {mode === "liked" ? (
        <header className="flex items-center gap-3">
          <button
            type="button"
            aria-label="내 정보로 돌아가기"
            onClick={() => navigate("/me")}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdArrowBack />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-black text-brand-700">내 정보</p>
            <h1 className="truncate text-lg font-bold text-slate-900">
              좋아요한 공유 루트
            </h1>
          </div>
        </header>
      ) : null}

      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            {mode === "liked" ? <FaHeart /> : <MdOutlineHub />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {pageCopy.title}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
              {pageCopy.description}
            </p>
          </div>
        </div>
      </div>

      {routeListQuery.isLoading ? (
        <PotatoLoadingCard
          title={pageCopy.loadingTitle}
          description={pageCopy.loadingDescription}
          animation="map-thinking"
          compact
          className="shadow-sm"
        />
      ) : null}

      {routeListQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
          {pageCopy.error}
        </div>
      ) : null}

      {!routeListQuery.isLoading &&
      !routeListQuery.isError &&
      routes.length === 0 ? (
        <div className="rounded-2xl border border-brand-100 bg-white p-4 text-sm font-semibold text-slate-500 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/40 dark:text-slate-300">
          {pageCopy.empty}
        </div>
      ) : null}

      {routes.map((route) => (
        <SharedRouteCard
          key={route.id}
          route={route}
          isLiked={likedRouteIds.has(route.id) || route.likedByMe}
          isLikePending={pendingLikeRouteIds.has(route.id)}
          onToggleLike={handleToggleLike}
          onOpen={(route) => setSelectedRouteId(route.id)}
        />
      ))}
      {selectedRouteId && selectedRouteQuery.isLoading ? (
        <SharedRouteDetailSkeleton onClose={() => setSelectedRouteId(null)} />
      ) : null}
      {selectedRouteId && selectedRouteQuery.isError ? (
        <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-white px-4 dark:bg-[#071718]">
          <div className="w-full max-w-sm rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center shadow-sm dark:border-rose-400/30 dark:bg-rose-950/30">
            <p className="text-sm font-bold text-rose-700 dark:text-rose-200">
              공유 루트 상세를 불러오지 못했어요.
            </p>
            <button
              type="button"
              onClick={() => setSelectedRouteId(null)}
              className="mt-3 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white"
            >
              닫기
            </button>
          </div>
        </div>
      ) : null}
      {selectedRoute && selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRoute}
          day={selectedRouteDay}
          isReadOnly
          headerLabel="SHARED ROUTE"
          headerBadge={selectedRoute.isMine ? "내 공유 루트" : undefined}
          enableStartPreview
          onRequestCheckout={handleRequestCheckoutFromSharedRoute}
          readOnlyFooterAction={
            selectedRoute.isMine
              ? {
                  label: String(selectedRoute.likeCount),
                  ariaLabel: `내가 공유한 루트, 하트 ${selectedRoute.likeCount}개`,
                  icon: <FaHeart className="text-lg" />,
                  isActive: true,
                  disabled: true,
                  onClick: () => undefined,
                }
              : {
                  label: String(selectedRoute.likeCount),
                  ariaLabel:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe
                      ? `좋아요 취소, 하트 ${selectedRoute.likeCount}개`
                      : `좋아요, 하트 ${selectedRoute.likeCount}개`,
                  icon:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe ? (
                      <FaHeart className="text-lg" />
                    ) : (
                      <FaRegHeart className="text-lg" />
                    ),
                  isActive:
                    likedRouteIds.has(selectedRoute.id) ||
                    selectedRoute.likedByMe,
                  disabled: pendingLikeRouteIds.has(selectedRoute.id),
                  onClick: () => void handleToggleLike(selectedRoute),
                }
          }
          onClose={() => setSelectedRouteId(null)}
        />
      ) : null}
      <RouteCheckoutModal
        isOpen={Boolean(checkoutRoutePlan)}
        savedPlaces={checkoutSavedPlaces}
        insertCandidatePlaces={checkoutCandidatePlaces}
        currentLocation={checkoutStartLocation}
        initialStep="schedule"
        initialTripDays={checkoutTripDays}
        initialRoutePlan={checkoutRoutePlan}
        onClose={handleCloseCheckout}
        onSelectPlace={() => undefined}
        onRemovePlace={() => undefined}
        onClearPlaces={handleCloseCheckout}
        onRequestSearchPlace={() => {
          handleCloseCheckout();
          navigate("/");
        }}
      />
    </section>
  );
}

export default SharedRoutePage;
