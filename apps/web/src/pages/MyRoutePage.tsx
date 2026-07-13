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
import { useUiText, type UiText } from "@/lib/uiText";
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
  const text = useUiText();

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-black text-slate-500">{title}</h2>
        <span className="text-[11px] font-bold text-slate-400">
          {text.myRoute.count(count)}
        </span>
      </div>
      {children}
    </section>
  );
}

function formatDateKeyLabel(dateKey: string | null, text: UiText) {
  if (!dateKey) {
    return text.myRoute.unknownDate;
  }

  const [year, month, day] = dateKey.split("-");

  return `${year}.${Number(month)}.${Number(day)}`;
}

function getCurrentMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatMinutesLabel(minutes: number, text: UiText) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? text.myRoute.am : text.myRoute.pm;
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
}

function getStartTimeReview(route: MyRoute, startedAt: string, text: UiText) {
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

  const scheduledLabel = formatMinutesLabel(scheduledMinutes, text);
  const currentLabel = formatMinutesLabel(currentMinutes, text);

  if (currentMinutes > scheduledMinutes) {
    return {
      title: text.myRoute.startTimeLateTitle,
      description: text.myRoute.startTimeReviewDescription(
        scheduledLabel,
        currentLabel
      ),
      detail: text.myRoute.startTimeReviewDetail,
    };
  }

  return {
    title: text.myRoute.startTimeEarlyTitle,
    description: text.myRoute.startTimeReviewDescription(
      scheduledLabel,
      currentLabel
    ),
    detail: text.myRoute.startTimeReviewDetail,
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
  const text = useUiText();

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
            {text.myRoute.startDateModalTitle}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {text.myRoute.startDateModalDescription(getRouteTitle(target.route))}
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-black text-slate-500">
            {text.myRoute.startDateLabel}
          </p>
          <DateInput value={target.startedAt} onChange={onChange} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            {text.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !target.startedAt}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {text.myRoute.startRoute}
          </button>
        </div>
      </section>
    </div>
  );
}

function MyRoutePage() {
  const text = useUiText();
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
      showToast(text.myRoute.deleteSuccess);
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
        error instanceof Error ? error.message : text.myRoute.deleteError,
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
      showToast(text.myRoute.startSuccess);
    },
    onError: (error) => {
      showToast(
        error instanceof Error ? error.message : text.myRoute.startError,
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
              label: text.myRoute.viewConflictingRoute,
              variant: "secondary" as const,
              onClick: () =>
                setSelectedDayRoute({
                  routeId: conflictingRoute.id,
                  dayId: selectableDay.id,
                }),
            },
            {
              label: text.myRoute.conflictConfirm,
              variant: "primary" as const,
            },
          ]
        : undefined;

      openModal({
        title: text.myRoute.conflictTitle,
        description: text.myRoute.conflictDescription(
          getRouteTitle(route),
          route.tripDays + 1,
          formatRouteDate(nextDateKey) ?? text.myRoute.unknownDate
        ),
        detail: text.myRoute.conflictDetail(getRouteTitle(conflictingRoute)),
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
    showToast(text.myRoute.appendToast);
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

    const startTimeReview = getStartTimeReview(route, startedAt, text);
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
          label: text.myRoute.startNow,
          variant: "primary",
          onClick: () => handleStartRoute(route, startedAt),
        },
        {
          label: text.common.cancel,
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
        ? text.myRoute.plannedPeriodPastTitle
        : text.myRoute.plannedStartDiffTitle,
      description: isPastPlannedPeriod
        ? text.myRoute.plannedPeriodDescription(
            formatDateKeyLabel(plannedStartKey, text),
            formatDateKeyLabel(plannedEndKey, text)
          )
        : text.myRoute.plannedStartDescription(
            formatDateKeyLabel(plannedStartKey, text),
            formatDateKeyLabel(todayKey, text)
          ),
      detail: text.myRoute.startTodayDetail,
      actions: [
        {
          label: text.myRoute.startToday,
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
          label: text.myRoute.startPlannedDate,
          variant: "secondary",
          onClick: () => handleStartRoute(route, plannedStartKey),
        },
        {
          label: text.myRoute.chooseDate,
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
      title: text.myRoute.deleteTitle,
      description: text.myRoute.deleteDescription(getRouteTitle(route)),
      detail: text.myRoute.deleteDetail,
      actions: [
        {
          label: text.common.cancel,
          variant: "secondary",
        },
        {
          label: text.myRoute.delete,
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
          {text.myRoute.loadError}
        </div>
      ) : null}

      {myRoutesQuery.isLoading ? (
        <div className="flex min-h-[calc(100dvh-18rem)] flex-col justify-center">
          <PotatoLoadingCard
            title={text.myRoute.loadingTitle}
            description={text.myRoute.loadingDescription}
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
              title={text.myRoute.needsReviewSection}
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
              title={text.myRoute.upcomingSection}
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
              title={text.myRoute.undatedSection}
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
