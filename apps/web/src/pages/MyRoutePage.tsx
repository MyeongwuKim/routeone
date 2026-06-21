import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { routeApi } from "@/api/routeApi";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import MyRouteEmptyState from "@/features/my-route/components/MyRouteEmptyState";
import {
  MY_ROUTES_QUERY_KEY,
  removeMyRouteCache,
} from "@/features/my-route/myRouteCache";
import {
  formatRouteDate,
  getSelectableRouteDay,
  getRouteStartDateKey,
  getRouteTimelineState,
  getRouteTitle,
  getNextRouteDayDateKey,
  getTodayDateKey,
  getTodayRouteDay,
  isDateKeyInRouteRange,
} from "@/features/my-route/routeDisplay";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MyRoutesQuery } from "@/generated/graphql";

type RouteSectionProps = {
  title: string;
  count: number;
  children: ReactNode;
};

function RouteSection({ title, count, children }: RouteSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black text-slate-500">{title}</h2>
        <span className="text-[11px] font-bold text-slate-400">
          {count}개
        </span>
      </div>
      {children}
    </section>
  );
}

function MyRoutePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDayRoute, setSelectedDayRoute] = useState<{
    routeId: string;
    dayId: string;
  } | null>(null);
  const startAppendTarget = useRouteEditFlowStore(
    (state) => state.startAppendTarget
  );
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const myRoutesQuery = useQuery({
    queryKey: MY_ROUTES_QUERY_KEY,
    queryFn: () => routeApi.myRoutes(),
  });
  const deleteRouteMutation = useMutation({
    mutationFn: (routeId: string) => routeApi.deleteRoute(routeId),
    onMutate: async (routeId) => {
      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      const previousRoutes =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);
      const previousSelectedDayRoute = selectedDayRoute;

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => removeMyRouteCache(currentData, routeId)
      );
      setSelectedDayRoute((currentRoute) =>
        currentRoute?.routeId === routeId ? null : currentRoute
      );

      return {
        previousRoutes,
        previousSelectedDayRoute,
      };
    },
    onSuccess: () => {
      showToast("일정을 삭제했어요.");
    },
    onError: (error, _routeId, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          context.previousRoutes
        );
      }
      setSelectedDayRoute(context?.previousSelectedDayRoute ?? null);
      showToast(
        error instanceof Error ? error.message : "일정을 삭제하지 못했어요.",
        2600
      );
    },
  });
  const routeGroups = useMemo(() => {
    const todayKey = getTodayDateKey();
    const currentRoutes: MyRoute[] = [];
    const upcomingRoutes: MyRoute[] = [];
    const undatedRoutes: MyRoute[] = [];

    for (const route of myRoutesQuery.data?.myRoutes ?? []) {
      const state = getRouteTimelineState(route, todayKey);

      if (state === "current") {
        currentRoutes.push(route);
      } else if (state === "upcoming") {
        upcomingRoutes.push(route);
      } else if (state === "undated") {
        undatedRoutes.push(route);
      }
    }

    currentRoutes.sort((left, right) => {
      const rightHasTodayRoute = getTodayRouteDay(right, todayKey) ? 1 : 0;
      const leftHasTodayRoute = getTodayRouteDay(left, todayKey) ? 1 : 0;

      return (
        rightHasTodayRoute - leftHasTodayRoute ||
        (getRouteStartDateKey(left) ?? "").localeCompare(
          getRouteStartDateKey(right) ?? ""
        )
      );
    });

    upcomingRoutes.sort((left, right) =>
      (getRouteStartDateKey(left) ?? "").localeCompare(
        getRouteStartDateKey(right) ?? ""
      )
    );

    return {
      currentRoutes,
      upcomingRoutes,
      undatedRoutes,
      totalCount:
        currentRoutes.length + upcomingRoutes.length + undatedRoutes.length,
    };
  }, [myRoutesQuery.data]);
  const selectedRouteDay = useMemo(() => {
    if (!selectedDayRoute) {
      return null;
    }

    const route = myRoutesQuery.data?.myRoutes.find(
      (candidateRoute) => candidateRoute.id === selectedDayRoute.routeId
    );

    if (!route) {
      return null;
    }

    const day =
      route.days.find((candidateDay) => candidateDay.id === selectedDayRoute.dayId) ??
      getSelectableRouteDay(route);

    return day
      ? {
          route,
          day,
        }
      : null;
  }, [myRoutesQuery.data, selectedDayRoute]);
  useEffect(() => {
    if (selectedDayRoute && myRoutesQuery.data && !selectedRouteDay) {
      setSelectedDayRoute(null);
    }
  }, [myRoutesQuery.data, selectedDayRoute, selectedRouteDay]);
  const hasRoutes = routeGroups.totalCount > 0;
  const handleSelectDay = (selectedRoute: MyRoute, day: MyRouteDay) =>
    setSelectedDayRoute({
      routeId: selectedRoute.id,
      dayId: day.id,
    });
  const handleRequestAppendDay = (route: MyRoute) => {
    const nextDateKey = getNextRouteDayDateKey(route);
    const conflictingRoute = nextDateKey
      ? (myRoutesQuery.data?.myRoutes ?? []).find(
          (candidateRoute) =>
            candidateRoute.id !== route.id &&
            candidateRoute.status !== "COMPLETED" &&
            isDateKeyInRouteRange(candidateRoute, nextDateKey)
        )
      : null;

    if (nextDateKey && conflictingRoute) {
      const selectableDay = getSelectableRouteDay(conflictingRoute);
      const conflictActions = selectableDay
        ? [
            {
              label: "해당 일정 보기",
              variant: "secondary" as const,
              onClick: () =>
                setSelectedDayRoute({
                  routeId: conflictingRoute.id,
                  dayId: selectableDay.id,
                }),
            },
            {
              label: "확인",
              variant: "primary" as const,
            },
          ]
        : undefined;

      openModal({
        title: "다음 날짜에 이미 일정이 있어요",
        description: `${getRouteTitle(route)}에 DAY ${
          route.tripDays + 1
        }을 추가하려면 ${formatRouteDate(nextDateKey)} 날짜가 필요해요.`,
        detail: `${getRouteTitle(
          conflictingRoute
        )} 일정이 같은 날짜를 사용 중이라 바로 이어 붙일 수 없어요. 아래 일정을 수정하거나 날짜를 먼저 비워주세요.`,
        actions: conflictActions,
      });
      return;
    }

    startAppendTarget({
      routeId: route.id,
      routeTitle: getRouteTitle(route),
      nextDayIndex: route.tripDays + 1,
      suggestedStartDate: nextDateKey,
    });
    showToast("지도에서 장소를 담아 추가할 DAY를 만들어요.");
    navigate("/home");
  };
  const handleRequestDeleteRoute = (route: MyRoute) => {
    if (deleteRouteMutation.isPending) {
      return;
    }

    openModal({
      title: "일정을 삭제할까요?",
      description: `${getRouteTitle(route)} 전체와 포함된 DAY, 장소가 모두 삭제돼요.`,
      detail: "삭제한 일정은 다시 되돌릴 수 없어요.",
      actions: [
        {
          label: "취소",
          variant: "secondary",
        },
        {
          label: "삭제",
          variant: "danger",
          onClick: () => deleteRouteMutation.mutate(route.id),
        },
      ],
    });
  };

  return (
    <section className="space-y-4 pb-4 text-slate-900">
      <div className="rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
        <h1 className="text-sm font-semibold text-brand-700">
          나의 여행 루트
        </h1>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          현재 루트와 다가오는 일정을 한곳에서 확인해요
        </p>
      </div>

      {myRoutesQuery.isLoading ? (
        <PotatoLoadingCard
          title="루트를 불러오는 중"
          description="내 여행 루트를 확인하고 있어요."
          animation="map-thinking"
          compact
          className="shadow-sm"
        />
      ) : null}

      {myRoutesQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          내 루트를 불러오지 못했어요.
        </div>
      ) : null}

      {!myRoutesQuery.isLoading && !myRoutesQuery.isError && !hasRoutes ? (
        <MyRouteEmptyState />
      ) : null}

      {hasRoutes ? (
        <div className="space-y-4">
          {routeGroups.currentRoutes.length > 0 ? (
            <div className="space-y-3">
              {routeGroups.currentRoutes.map((route, index) => (
                <MyRouteCard
                  key={route.id}
                  route={route}
                  variant={index === 0 ? "featured" : "compact"}
                  onSelectDay={handleSelectDay}
                  onRequestAppendDay={
                    index === 0 ? handleRequestAppendDay : undefined
                  }
                  onRequestDeleteRoute={handleRequestDeleteRoute}
                />
              ))}
            </div>
          ) : null}

          {routeGroups.upcomingRoutes.length > 0 ? (
            <RouteSection
              title="다가오는 일정"
              count={routeGroups.upcomingRoutes.length}
            >
              <div className="space-y-2">
                {routeGroups.upcomingRoutes.map((route) => (
                  <MyRouteCard
                    key={route.id}
                    route={route}
                    variant="upcoming"
                    onSelectDay={handleSelectDay}
                    onRequestDeleteRoute={handleRequestDeleteRoute}
                  />
                ))}
              </div>
            </RouteSection>
          ) : null}

          {routeGroups.undatedRoutes.length > 0 ? (
            <RouteSection
              title="날짜 미정 루트"
              count={routeGroups.undatedRoutes.length}
            >
              <div className="space-y-2">
                {routeGroups.undatedRoutes.map((route) => (
                  <MyRouteCard
                    key={route.id}
                    route={route}
                    variant="compact"
                    onSelectDay={handleSelectDay}
                    onRequestDeleteRoute={handleRequestDeleteRoute}
                  />
                ))}
              </div>
            </RouteSection>
          ) : null}

        </div>
      ) : null}

      {selectedRouteDay ? (
        <DayRoutePopup
          route={selectedRouteDay.route}
          day={selectedRouteDay.day}
          onClose={() => setSelectedDayRoute(null)}
        />
      ) : null}
    </section>
  );
}

export default MyRoutePage;
