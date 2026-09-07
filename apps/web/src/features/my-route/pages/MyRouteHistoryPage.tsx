/**
 * 진입 경로: 내 정보 → 다녀온 루트
 * 용도: 지난 여행 기록을 조회하고 일정 상세와 DAY 포토카드로 연결한다.
 * 구조: 기록 목록과 일정 상세 팝업을 조합하고, 포토카드 상태는 전용 훅에서 관리한다.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  MdArrowBack,
  MdHistory,
} from "react-icons/md";
import { NOTIFICATION_INBOX_QUERY_KEY } from "@/api/notificationApi";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import RouteListSkeleton from "@/components/feedback/RouteListSkeleton";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import { useLocalizedMyRoutes } from "@/features/my-route/hooks/useLocalizedMyRoutes";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
} from "@/features/my-route/myRouteCache";
import { getRouteCompletionPosterStats } from "@/features/my-route/routeCompletionPoster";
import { useRoutePosterPreview } from "../hooks/useRoutePosterPreview";
import RoutePosterPreview from "../components/RoutePosterPreview";
import {
  getDateKeyDiffInDays,
  getRouteEndDateKey,
  getRouteTitle,
  getSelectableRouteDay,
  getTodayDateKey,
} from "@/features/my-route/routeDisplay";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";
import type {
  MyRouteHistoryConnectionQuery,
  MyRoutesQuery,
} from "@/generated/graphql";
import { useUiText } from "@/lib/uiText";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";

const PAST_ROUTE_COMPLETION_GRACE_DAYS = 7;
const MY_ROUTE_HISTORY_PAGE_SIZE = 12;

type MyRouteHistoryInfiniteData = InfiniteData<
  MyRouteHistoryConnectionQuery,
  string | null
>;

function getHistoryRoutesFromInfiniteData(
  data: MyRouteHistoryInfiniteData | undefined
) {
  return (
    data?.pages.flatMap(
      (page) => page.myRouteHistoryConnection.nodes
    ) ?? []
  );
}

function canCompletePastRoute(route: MyRoute, todayKey = getTodayDateKey()) {
  const endDateKey = getRouteEndDateKey(route);

  if (!endDateKey) {
    return false;
  }

  const daysSinceEnd = getDateKeyDiffInDays(todayKey, endDateKey);

  return (
    daysSinceEnd >= 0 && daysSinceEnd <= PAST_ROUTE_COMPLETION_GRACE_DAYS
  );
}

function MyRouteHistoryPage() {
  const text = useUiText();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const [selectedHistoryRoute, setSelectedHistoryRoute] = useState<{
    routeId: string;
    dayId: string;
    focusedStopId?: string | null;
    returnToNotificationInbox?: boolean;
  } | null>(null);
  const posterController = useRoutePosterPreview();
  const { generatingRouteId: posterGeneratingRouteId, createPoster: handleCreatePoster } = posterController;
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const historyRoutesQuery = useInfiniteQuery({
    queryKey: [...MY_ROUTE_HISTORY_QUERY_KEY, todayKey],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      routeApi.myRouteHistoryConnection({
        limit: MY_ROUTE_HISTORY_PAGE_SIZE,
        cursor: pageParam,
        today: todayKey,
      }),
    getNextPageParam: (lastPage) => {
      const { pageInfo } = lastPage.myRouteHistoryConnection;

      return pageInfo.hasNextPage ? pageInfo.endCursor : undefined;
    },
  });
  const {
    fetchNextPage: fetchNextHistoryPage,
    hasNextPage: hasNextHistoryPage,
    isFetchingNextPage: isFetchingNextHistoryPage,
    isFetchNextPageError: isNextHistoryPageError,
  } = historyRoutesQuery;
  const sourceHistoryRoutes = useMemo(
    () =>
      getHistoryRoutesFromInfiniteData(
        historyRoutesQuery.data as MyRouteHistoryInfiniteData | undefined
      ),
    [historyRoutesQuery.data]
  );
  const {
    routes: historyRoutes,
    isLoading: isHistoryLocalizationLoading,
    isUpdating: isHistoryLocalizationUpdating,
  } = useLocalizedMyRoutes(sourceHistoryRoutes);
  const deleteRouteMutation = useMutation({
    mutationFn: (routeId: string) => routeApi.deleteRoute(routeId),
    onSuccess: async (_data, routeId) => {
      setSelectedHistoryRoute((current) =>
        current?.routeId === routeId ? null : current
      );
      showToast(text.routeHistory.notVisitedSuccess);

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: MY_ROUTES_QUERY_KEY,
        }),
        queryClient.invalidateQueries({
          queryKey: ["place-photos"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["place-stay-summary"],
        }),
        queryClient.invalidateQueries({
          queryKey: NOTIFICATION_INBOX_QUERY_KEY,
        }),
      ]);

      try {
        const routesResult = await routeApi.myRoutes();
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          routesResult
        );
      } catch (error) {
        console.warn(
          "[route-history] notification cleanup failed",
          error instanceof Error ? error.message : error
        );
      }
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : text.routeHistory.notVisitedError,
        2600
      );
    },
  });
  const selectedRouteDay = useMemo(() => {
    if (!selectedHistoryRoute) {
      return null;
    }

    const route = historyRoutes.find(
      (candidateRoute) => candidateRoute.id === selectedHistoryRoute.routeId
    );

    if (!route) {
      return null;
    }

    const day =
      route.days.find(
        (candidateDay) => candidateDay.id === selectedHistoryRoute.dayId
      ) ?? getSelectableRouteDay(route);

    return day
      ? {
          route,
          day,
          focusedStopId: selectedHistoryRoute.focusedStopId ?? null,
        }
      : null;
  }, [historyRoutes, selectedHistoryRoute]);
  const canCompleteSelectedHistoryRoute = selectedRouteDay
    ? canCompletePastRoute(selectedRouteDay.route)
    : false;

  useEffect(() => {
    const routeId = searchParams.get("routeId")?.trim() ?? "";
    const dayId = searchParams.get("dayId")?.trim() ?? "";
    const stopId = searchParams.get("stopId")?.trim() ?? "";
    const source = searchParams.get("source")?.trim() ?? "";

    if (
      !routeId ||
      !dayId ||
      historyRoutesQuery.isLoading ||
      isHistoryLocalizationLoading
    ) {
      return;
    }

    const route = historyRoutes.find((candidate) => candidate.id === routeId);
    const day = route?.days.find((candidate) => candidate.id === dayId);

    if (!route || !day) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      setSelectedHistoryRoute({
        routeId,
        dayId,
        focusedStopId: day.stops.some(
          (candidateStop) => candidateStop.id === stopId
        )
          ? stopId
          : null,
        returnToNotificationInbox: source === "notification-inbox",
      });

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete("routeId");
      nextSearchParams.delete("dayId");
      nextSearchParams.delete("stopId");
      nextSearchParams.delete("source");
      setSearchParams(nextSearchParams, { replace: true });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    historyRoutes,
    historyRoutesQuery.isLoading,
    isHistoryLocalizationLoading,
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    const target = loadMoreTriggerRef.current;

    if (
      !target ||
      !hasNextHistoryPage ||
      isNextHistoryPageError ||
      isHistoryLocalizationUpdating
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting);

        if (
          isVisible &&
          hasNextHistoryPage &&
          !isFetchingNextHistoryPage &&
          !isNextHistoryPageError &&
          !isHistoryLocalizationUpdating
        ) {
          void fetchNextHistoryPage();
        }
      },
      {
        rootMargin: "180px 0px",
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [
    fetchNextHistoryPage,
    hasNextHistoryPage,
    isFetchingNextHistoryPage,
    isHistoryLocalizationUpdating,
    isNextHistoryPageError,
  ]);

  const handleSelectHistoryDay = (route: MyRoute, day: MyRouteDay) => {
    setSelectedHistoryRoute({
      routeId: route.id,
      dayId: day.id,
    });
  };
  const handleCloseSelectedHistoryRoute = () => {
    const shouldReturnToNotificationInbox =
      selectedHistoryRoute?.returnToNotificationInbox === true;

    setSelectedHistoryRoute(null);

    if (shouldReturnToNotificationInbox) {
      navigate(-1);
    }
  };
  const handleRequestNotVisited = (route: MyRoute) => {
    if (deleteRouteMutation.isPending) {
      return;
    }

    openModal({
      title: text.routeHistory.notVisitedTitle,
      description: text.routeHistory.notVisitedDescription(
        getRouteTitle(route, text)
      ),
      detail: text.routeHistory.notVisitedDetail,
      actions: [
        {
          label: text.common.cancel,
          variant: "secondary",
        },
        {
          label: text.routeHistory.deleteRoute,
          variant: "danger",
          onClick: () => deleteRouteMutation.mutate(route.id),
        },
      ],
    });
  };

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 pb-4 text-slate-900 dark:text-slate-100">
      <header className="flex items-center gap-3">
        <button
          type="button"
          aria-label={text.common.backToMyInfo}
          onClick={() => navigate("/me")}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
        >
          <MdArrowBack />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-black text-brand-700 dark:text-brand-200">
            {text.routeHistory.eyebrow}
          </p>
          <h1 className="truncate text-lg font-bold text-slate-900 dark:text-white">
            {text.routeHistory.title}
          </h1>
        </div>
      </header>

      <div className="rounded-2xl border border-brand-100 bg-white p-4 shadow-sm dark:border-brand-400/25 dark:bg-[#071f1d] dark:shadow-[0_16px_34px_rgba(0,0,0,0.28)]">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-xl text-brand-700 dark:bg-brand-400/15 dark:text-brand-100">
            <MdHistory />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {text.routeHistory.description}
            </p>
            <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-200/75">
              {text.routeHistory.loadedCount(sourceHistoryRoutes.length)}
            </p>
          </div>
        </div>
      </div>

      {historyRoutesQuery.isError && sourceHistoryRoutes.length === 0 ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
          <p>{text.routeHistory.loadError}</p>
          <button
            type="button"
            onClick={() => void historyRoutesQuery.refetch()}
            className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
            disabled={historyRoutesQuery.isFetching}
          >
            {text.common.retry}
          </button>
        </div>
      ) : null}

      {historyRoutesQuery.isLoading || isHistoryLocalizationLoading ? (
        <RouteListSkeleton variant="history" />
      ) : null}

      {!historyRoutesQuery.isLoading &&
      !isHistoryLocalizationLoading &&
      !historyRoutesQuery.isError &&
      sourceHistoryRoutes.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <PotatoLoadingCard
            title={text.routeHistory.emptyTitle}
            description={text.routeHistory.emptyDescription}
            footerText={text.routeHistory.emptyFooter}
            animation="empty"
            compact
            className="shadow-sm"
          />
        </div>
      ) : null}

      {historyRoutes.length > 0 ? (
        <div className="space-y-3 px-px pb-1 pt-1">
          {historyRoutes.map((route) => (
            <MyRouteCard
              key={route.id}
              route={route}
              variant="history"
              hideTimelineBadge
              onSelectDay={handleSelectHistoryDay}
              onRequestDeleteRoute={handleRequestNotVisited}
            />
          ))}

          {hasNextHistoryPage ? (
            <div ref={loadMoreTriggerRef} className="h-8" aria-hidden="true" />
          ) : null}

          {isFetchingNextHistoryPage || isHistoryLocalizationUpdating ? (
            <div className="py-2">
              <PotatoLoadingCard
                title={text.routeHistory.nextLoadingTitle}
                animation="running"
                compact
                className="shadow-sm"
              />
            </div>
          ) : null}

          {isNextHistoryPageError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-center text-sm font-semibold text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
              <p>{text.routeHistory.loadError}</p>
              <button
                type="button"
                onClick={() => void fetchNextHistoryPage()}
                className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
                disabled={isFetchingNextHistoryPage}
              >
                {text.common.retry}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRouteDay.route}
          day={selectedRouteDay.day}
          focusedStopId={selectedRouteDay.focusedStopId}
          onClose={handleCloseSelectedHistoryRoute}
          isReadOnly
          allowVisitCompletion={canCompleteSelectedHistoryRoute}
          visitCompletionMode="retrospective"
          enableVerificationPhotoPreview
          readOnlyPosterAction={
            getRouteCompletionPosterStats(selectedRouteDay.route).canCreate
              ? {
                  label:
                    posterGeneratingRouteId === selectedRouteDay.route.id
                      ? text.routeHistory.making
                      : text.routeHistory.dayCard,
                  ariaLabel: `${getRouteTitle(
                    selectedRouteDay.route,
                    text
                  )} ${text.routeHistory.posterTitle}`,
                  disabled: posterGeneratingRouteId === selectedRouteDay.route.id,
                  onClick: () => handleCreatePoster(selectedRouteDay.route, selectedRouteDay.day.dayIndex),
                }
              : undefined
          }
        />
      ) : null}

      <RoutePosterPreview controller={posterController} />
    </section>
  );
}

export default MyRouteHistoryPage;
