import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import MyRouteEmptyState from "@/features/my-route/components/MyRouteEmptyState";
import {
  MY_ROUTES_QUERY_KEY,
  removeMyRouteCache,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import {
  formatRouteDate,
  getRouteEndDateKey,
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
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MyRoutesQuery, StartRouteInput } from "@/generated/graphql";
import { DateInput } from "@/components/inputs";

type RouteSectionProps = {
  title: string;
  count: number;
  children: ReactNode;
};

type StartRouteDatePickerTarget = {
  route: MyRoute;
  startedAt: string;
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

function formatDateKeyLabel(dateKey: string | null) {
  if (!dateKey) {
    return "미정";
  }

  const [year, month, day] = dateKey.split("-");

  return `${year}.${Number(month)}.${Number(day)}`;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatMinutesLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? "오전" : "오후";
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

function getStartTimeReview(route: MyRoute, startedAt: string) {
  if (startedAt !== getTodayDateKey()) {
    return null;
  }

  const scheduledMinutes = route.dailyStartMinutes;
  if (typeof scheduledMinutes !== "number") {
    return null;
  }

  const currentMinutes = getCurrentMinutes();
  if (currentMinutes === scheduledMinutes) {
    return null;
  }

  const scheduledLabel = formatMinutesLabel(scheduledMinutes);
  const currentLabel = formatMinutesLabel(currentMinutes);

  if (currentMinutes > scheduledMinutes) {
    return {
      title: "출발 예정 시간이 지났어요",
      description: `예정 출발시간은 ${scheduledLabel}, 현재 시간은 ${currentLabel}예요. 지금 시작하는 게 맞는지 한 번 더 확인해주세요.`,
      detail: "지금 시작하면 DAY 날짜는 오늘 기준으로 유지돼요.",
    };
  }

  return {
    title: "예정 출발시간보다 빨라요",
    description: `예정 출발시간은 ${scheduledLabel}, 현재 시간은 ${currentLabel}예요. 지금 바로 시작하는 게 맞는지 한 번 더 확인해주세요.`,
    detail: "지금 시작하면 DAY 날짜는 오늘 기준으로 유지돼요.",
  };
}

function StartRouteDatePickerModal({
  target,
  isPending,
  onChange,
  onClose,
  onConfirm,
}: {
  target: StartRouteDatePickerTarget;
  isPending: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="global-modal-backdrop-enter fixed inset-0 z-[2800] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-route-date-title"
        className="global-modal-panel-enter w-full max-w-sm rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div>
          <p
            id="start-route-date-title"
            className="text-base font-bold text-slate-900"
          >
            실제 시작일 선택
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {getRouteTitle(target.route)}의 DAY 1 기준 날짜를 선택해요.
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-black text-slate-500">시작 날짜</p>
          <DateInput value={target.startedAt} onChange={onChange} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !target.startedAt}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            시작하기
          </button>
        </div>
      </section>
    </div>
  );
}

function MyRoutePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDayRoute, setSelectedDayRoute] = useState<{
    routeId: string;
    dayId: string;
  } | null>(null);
  const [startDatePickerTarget, setStartDatePickerTarget] =
    useState<StartRouteDatePickerTarget | null>(null);
  const startAppendTarget = useRouteEditFlowStore(
    (state) => state.startAppendTarget
  );
  const openModal = useUiModalStore((state) => state.openModal);
  const closeModal = useUiModalStore((state) => state.closeModal);
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
  const startRouteMutation = useMutation({
    mutationFn: (input: StartRouteInput) => routeApi.startRoute(input),
    onSuccess: (data) => {
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, data.startRoute)
      );
      setStartDatePickerTarget(null);
      showToast("여행을 시작했어요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : "여행을 시작하지 못했어요.",
        2600
      );
    },
  });
  const routeGroups = useMemo(() => {
    const todayKey = getTodayDateKey();
    const currentRoutes: MyRoute[] = [];
    const reviewRoutes: MyRoute[] = [];
    const upcomingRoutes: MyRoute[] = [];
    const undatedRoutes: MyRoute[] = [];

    for (const route of myRoutesQuery.data?.myRoutes ?? []) {
      const state = getRouteTimelineState(route, todayKey);

      if (state === "current") {
        currentRoutes.push(route);
      } else if (state === "needsReview") {
        reviewRoutes.push(route);
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

    reviewRoutes.sort((left, right) =>
      (getRouteEndDateKey(right) ?? "").localeCompare(
        getRouteEndDateKey(left) ?? ""
      )
    );

    upcomingRoutes.sort((left, right) =>
      (getRouteStartDateKey(left) ?? "").localeCompare(
        getRouteStartDateKey(right) ?? ""
      )
    );

    return {
      currentRoutes,
      reviewRoutes,
      upcomingRoutes,
      undatedRoutes,
      totalCount:
        currentRoutes.length +
        reviewRoutes.length +
        upcomingRoutes.length +
        undatedRoutes.length,
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
  const handleStartRoute = (route: MyRoute, startedAt: string) => {
    if (startRouteMutation.isPending || !startedAt) {
      return;
    }

    startRouteMutation.mutate({
      routeId: route.id,
      startedAt,
    });
  };
  const requestStartRouteWithTimeReview = (route: MyRoute, startedAt: string) => {
    if (startRouteMutation.isPending || !startedAt) {
      return false;
    }

    const startTimeReview = getStartTimeReview(route, startedAt);
    if (!startTimeReview) {
      handleStartRoute(route, startedAt);
      return false;
    }

    setStartDatePickerTarget(null);
    openModal({
      title: startTimeReview.title,
      description: startTimeReview.description,
      detail: startTimeReview.detail,
      actions: [
        {
          label: "지금 시작",
          variant: "primary",
          onClick: () => handleStartRoute(route, startedAt),
        },
        {
          label: "취소",
          variant: "secondary",
        },
      ],
    });
    return true;
  };
  const handleRequestStartRoute = (route: MyRoute) => {
    if (startRouteMutation.isPending) {
      return;
    }

    const todayKey = getTodayDateKey();
    const plannedStartKey = getRouteStartDateKey(route);
    const plannedEndKey = getRouteEndDateKey(route);

    if (!plannedStartKey || plannedStartKey === todayKey) {
      requestStartRouteWithTimeReview(route, todayKey);
      return;
    }

    const isPastPlannedPeriod = plannedEndKey ? todayKey > plannedEndKey : false;

    openModal({
      title: isPastPlannedPeriod
        ? "예정 기간이 지났어요"
        : "예정 시작일과 오늘 날짜가 달라요",
      description: isPastPlannedPeriod
        ? `예정 기간은 ${formatDateKeyLabel(
            plannedStartKey
          )} ~ ${formatDateKeyLabel(plannedEndKey)}였어요.`
        : `예정 시작일은 ${formatDateKeyLabel(
            plannedStartKey
          )}, 오늘은 ${formatDateKeyLabel(todayKey)}예요.`,
      detail: "오늘로 시작하면 DAY 날짜가 오늘 기준으로 다시 맞춰져요.",
      actions: [
        {
          label: "오늘로 시작",
          variant: "primary",
          autoClose: false,
          onClick: () => {
            const openedTimeReview = requestStartRouteWithTimeReview(
              route,
              todayKey
            );
            if (!openedTimeReview) {
              closeModal();
            }
          },
        },
        {
          label: "예정일로 시작",
          variant: "secondary",
          onClick: () => handleStartRoute(route, plannedStartKey),
        },
        {
          label: "날짜 선택",
          variant: "secondary",
          onClick: () =>
            setStartDatePickerTarget({
              route,
              startedAt: todayKey,
            }),
        },
      ],
    });
  };
  const handleConfirmCustomStartDate = () => {
    if (!startDatePickerTarget) {
      return;
    }

    requestStartRouteWithTimeReview(
      startDatePickerTarget.route,
      startDatePickerTarget.startedAt
    );
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
    <section className="space-y-4 text-slate-900">
      {myRoutesQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          내 루트를 불러오지 못했어요.
        </div>
      ) : null}

      {myRoutesQuery.isLoading ? (
        <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center">
          <PotatoLoadingCard
            title="감자가 내 루트 확인 중"
            description="여행 일정을 정리하고 있어요."
            animation="running"
            compact
            className="shadow-sm"
          />
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
                  onRequestStartRoute={handleRequestStartRoute}
                  onRequestAppendDay={
                    index === 0 ? handleRequestAppendDay : undefined
                  }
                  onRequestDeleteRoute={handleRequestDeleteRoute}
                />
              ))}
            </div>
          ) : null}

          {routeGroups.reviewRoutes.length > 0 ? (
            <RouteSection
              title="시작 확인 필요"
              count={routeGroups.reviewRoutes.length}
            >
              <div className="space-y-2">
                {routeGroups.reviewRoutes.map((route) => (
                  <MyRouteCard
                    key={route.id}
                    route={route}
                    variant="compact"
                    onSelectDay={handleSelectDay}
                    onRequestStartRoute={handleRequestStartRoute}
                    onRequestDeleteRoute={handleRequestDeleteRoute}
                  />
                ))}
              </div>
            </RouteSection>
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
                    onRequestStartRoute={handleRequestStartRoute}
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
                    onRequestStartRoute={handleRequestStartRoute}
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
          enableVerificationPhotoPreview
        />
      ) : null}

      {startDatePickerTarget ? (
        <StartRouteDatePickerModal
          target={startDatePickerTarget}
          isPending={startRouteMutation.isPending}
          onChange={(startedAt) =>
            setStartDatePickerTarget((currentTarget) =>
              currentTarget
                ? {
                    ...currentTarget,
                    startedAt,
                  }
                : currentTarget
            )
          }
          onClose={() => setStartDatePickerTarget(null)}
          onConfirm={handleConfirmCustomStartDate}
        />
      ) : null}
    </section>
  );
}

export default MyRoutePage;
