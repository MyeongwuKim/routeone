/**
 * 진입 경로: 하단 내 루트 탭 → 일정 카드 또는 여행 시작
 *
 * 용도:
 * 저장한 여행 일정을 조회하고 날짜별 장소를 확인하며 여행을 시작한다.
 * 시작 요청이 중단된 경우에는 영속 기록을 이어받아 안전하게 재시도한다.
 *
 * 구조:
 * 일정 상태별 목록, 일정 상세 팝업, 시작 시각 선택과 시작 진행 상태로 구성되어 있다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  notificationApi,
  NOTIFICATION_INBOX_QUERY_KEY,
  NOTIFICATION_SETTINGS_QUERY_KEY,
} from "@/api/notificationApi";
import { routeApi } from "@/api/routeApi";
import RouteListSkeleton from "@/components/feedback/RouteListSkeleton";
import DayRoutePopup from "@/features/my-route/components/DayRoutePopup";
import MyRouteCard from "@/features/my-route/components/MyRouteCard";
import MyRouteEmptyState from "@/features/my-route/components/MyRouteEmptyState";
import RouteStartProgressOverlay from "@/features/my-route/components/RouteStartProgressOverlay";
import { useLocalizedMyRoutes } from "@/features/my-route/hooks/useLocalizedMyRoutes";
import {
  useRouteStartLocationPermissionGuard,
  type RouteStartOptions,
  type RouteStartRequest,
} from "@/features/my-route/hooks/useRouteStartLocationPermissionGuard";
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
import {
  prepareRouteArrivalNotificationsForStart,
  syncTodayRouteArrivalNotifications,
} from "@/features/my-route/services/routeArrivalNotificationService";
import {
  getConfirmedStartedRoute,
  isDefinitiveRouteMutationFailure,
} from "@/features/my-route/services/routeArrivalMutationRecovery";
import {
  acquireRouteArrivalTransitionLock,
  isRouteArrivalTransitionLocked,
  markRouteArrivalTransitionRequestDispatched,
  markRouteArrivalTransitionUnresolved,
  resolveRouteArrivalTransition,
} from "@/features/my-route/services/routeArrivalTransitionLock";
import {
  beginRouteStartAttempt,
  getRouteStartAttempts,
  isRouteStartAttemptLocked,
  markRouteStartAttemptRequestDispatched,
  resolveRouteStartAttempt,
  ROUTE_START_RECOVERY_GENERATION_PARAM,
  ROUTE_START_RECOVERY_ROUTE_ID_PARAM,
} from "@/features/my-route/services/routeStartAttemptJournal";
import { shouldRequestRouteArrivalRegistrationForStart } from "@/features/my-route/services/routeStartLocationPermissionService";
import type { MyRoute, MyRouteDay } from "@/features/my-route/types";
import { useUiText, type UiText } from "@/lib/uiText";
import { useRouteEditFlowStore } from "@/stores/routeEditFlowStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MyRoutesQuery, StartRouteInput } from "@/generated/graphql";
import { DateInput, TimeWheelInput } from "@/components/inputs";
import { nativeBridge } from "@/native-bridge";

type RouteSectionProps = {
  title: string;
  count: number;
  children: ReactNode;
};

type StartRouteDatePickerTarget = {
  route: MyRoute;
  startedAt: string;
};

type StartRouteTimePickerTarget = StartRouteDatePickerTarget & {
  timeValue: string;
};

type StartRouteArrivalTransition = {
  sourceRoutes: MyRoute[];
  didPrepareArrivalTarget: boolean;
  isApiOutcomeUnresolved: boolean;
  journalGeneration: number | null;
  releaseLock: () => void;
};

type ActiveRouteStartAttempt = NonNullable<
  ReturnType<typeof beginRouteStartAttempt>
>;

const ROUTE_DEEP_LINK_SEARCH_PARAM_KEYS = [
  "routeId",
  "dayId",
  "stopId",
  "source",
] as const;

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

function toTimeValue(minutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getRoutePlannedStartMinutes(route: MyRoute) {
  const firstDay = route.days.find((day) => day.dayIndex === 1);

  return firstDay?.plannedStartMinutes ?? route.dailyStartMinutes ?? 9 * 60;
}

function combineDateKeyAndTime(dateKey: string, timeValue: string) {
  const [yearText, monthText, dayText] = dateKey.split("-");
  const [hourText, minuteText] = timeValue.split(":");
  const date = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    0,
    0
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatMinutesLabel(minutes: number, text: UiText) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const period = hour < 12 ? text.myRoute.am : text.myRoute.pm;
  const displayHour = hour % 12 || 12;

  return `${period} ${displayHour}:${String(minute).padStart(2, "0")}`;
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
            {text.myRoute.startDateModalDescription(
              getRouteTitle(target.route, text)
            )}
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
            {text.myRoute.chooseStartTime}
          </button>
        </div>
      </section>
    </div>
  );
}

function StartRouteTimePickerModal({
  target,
  isPending,
  onChange,
  onClose,
  onConfirm,
}: {
  target: StartRouteTimePickerTarget;
  isPending: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const text = useUiText();
  const plannedMinutes = getRoutePlannedStartMinutes(target.route);

  return (
    <div
      className="global-modal-backdrop-enter fixed inset-0 z-[2800] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:pb-4"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="global-modal-panel-enter w-full max-w-sm rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-base font-bold text-slate-900">
          {text.dayRoute.actualStartEditTitle(1)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {text.dayRoute.dayStartPlannedDescription(
            formatMinutesLabel(plannedMinutes, text)
          )}
        </p>

        <div className="mt-4">
          <TimeWheelInput
            value={target.timeValue}
            title={text.dayRoute.actualStartEditTitle(1)}
            description={text.dayRoute.dayStartPlannedDescription(
              formatMinutesLabel(plannedMinutes, text)
            )}
            disabled={isPending}
            onChange={onChange}
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            {text.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !target.timeValue}
            className="rounded-2xl border border-brand-500 bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {text.dayRoute.startAtSelectedTime}
          </button>
        </div>
      </section>
    </div>
  );
}

function MyRoutePage() {
  const text = useUiText();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [selectedDayRoute, setSelectedDayRoute] = useState<{
    routeId: string;
    dayId: string;
  } | null>(null);
  const [startDatePickerTarget, setStartDatePickerTarget] =
    useState<StartRouteDatePickerTarget | null>(null);
  const [startTimePickerTarget, setStartTimePickerTarget] =
    useState<StartRouteTimePickerTarget | null>(null);
  const activeStartAttemptRef = useRef<ActiveRouteStartAttempt | null>(
    null
  );
  const handledRecoveryRouteIdRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      activeStartAttemptRef.current?.release();
      activeStartAttemptRef.current = null;
    },
    []
  );
  const startAppendTarget = useRouteEditFlowStore(
    (state) => state.startAppendTarget
  );
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const myRoutesQuery = useQuery({
    queryKey: MY_ROUTES_QUERY_KEY,
    queryFn: () => routeApi.myRoutes(),
  });
  const sourceMyRoutes = useMemo(
    () => myRoutesQuery.data?.myRoutes ?? [],
    [myRoutesQuery.data]
  );
  const {
    routes: localizedMyRoutes,
    isLoading: isMyRouteLocalizationLoading,
  } = useLocalizedMyRoutes(sourceMyRoutes);
  const deepLinkRouteId = searchParams.get("routeId")?.trim() ?? "";
  const deepLinkDayId = searchParams.get("dayId")?.trim() ?? "";
  const recoveryRouteId =
    searchParams.get(ROUTE_START_RECOVERY_ROUTE_ID_PARAM)?.trim() ?? "";
  const recoveryGeneration = Number(
    searchParams.get(ROUTE_START_RECOVERY_GENERATION_PARAM)
  );
  const clearRouteDeepLinkSearchParams = useCallback(() => {
    if (
      !ROUTE_DEEP_LINK_SEARCH_PARAM_KEYS.some((key) => searchParams.has(key))
    ) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams);

    for (const key of ROUTE_DEEP_LINK_SEARCH_PARAM_KEYS) {
      nextSearchParams.delete(key);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams, setSearchParams]);
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
    onSuccess: async () => {
      showToast(text.myRoute.deleteSuccess);
      await Promise.all([
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
    mutationFn: async ({
      input,
      route,
      startWithoutLocationPermission,
      arrivalTransition,
      startAttempt,
    }: {
      input: StartRouteInput;
      route: MyRoute;
      startWithoutLocationPermission: boolean;
      arrivalTransition: StartRouteArrivalTransition;
      startAttempt: ActiveRouteStartAttempt;
    }) => {
      const notificationSettings = await queryClient
        .fetchQuery({
          queryKey: NOTIFICATION_SETTINGS_QUERY_KEY,
          queryFn: () => notificationApi.settings(),
          staleTime: 60_000,
          retry: false,
        })
        .then(
          (data) => ({ data, error: null }),
          (error: unknown) => ({ data: null, error })
        );

      if (
        nativeBridge.runtime.isAvailable() &&
        !notificationSettings.data
      ) {
        throw new Error(text.myRoute.arrivalNotificationRegistrationError);
      }

      let shouldRequireArrivalRegistration = false;

      if (notificationSettings.data) {
        const routeArrivalEnabled =
          notificationSettings.data.notificationSettings.routeArrivalEnabled;

        if (
          routeArrivalEnabled &&
          nativeBridge.runtime.isAvailable() &&
          !startWithoutLocationPermission
        ) {
          shouldRequireArrivalRegistration =
            await shouldRequestRouteArrivalRegistrationForStart(
              startWithoutLocationPermission
            );
        }

        if (
          routeArrivalEnabled &&
          nativeBridge.runtime.isAvailable() &&
          arrivalTransition.journalGeneration === null
        ) {
          const unresolvedTransition =
            markRouteArrivalTransitionUnresolved(route.id, {
              expectation: { kind: "route-start" },
            });

          arrivalTransition.journalGeneration =
            unresolvedTransition?.generation ?? null;

          if (arrivalTransition.journalGeneration === null) {
            throw new Error(
              appLanguage === "en"
                ? "The app could not safely save the arrival alert transition."
                : "도착 알림 전환 상태를 안전하게 저장하지 못했어요."
            );
          }
        }

        try {
          const preparationResult =
            await prepareRouteArrivalNotificationsForStart(
              arrivalTransition.sourceRoutes,
              route,
              input.startedAt,
              input.dayStartedAt ?? new Date().toISOString(),
              appLanguage,
              routeArrivalEnabled,
              {
                requestPermissions: shouldRequireArrivalRegistration,
                requireConfirmedRegistration:
                  shouldRequireArrivalRegistration,
              }
            );
          arrivalTransition.didPrepareArrivalTarget = Boolean(
            preparationResult && routeArrivalEnabled
          );

          if (
            !arrivalTransition.didPrepareArrivalTarget &&
            arrivalTransition.journalGeneration !== null
          ) {
            resolveRouteArrivalTransition(
              route.id,
              arrivalTransition.journalGeneration
            );
            arrivalTransition.journalGeneration = null;
          }
        } catch (error) {
          try {
            const rollbackResult =
              await syncTodayRouteArrivalNotifications(
                arrivalTransition.sourceRoutes,
                appLanguage,
                undefined,
                {
                  routeArrivalEnabled,
                  checkCurrentPosition: false,
                  requestPermissions: shouldRequireArrivalRegistration,
                  requireConfirmedRegistration:
                    shouldRequireArrivalRegistration,
                }
              );

            if (
              rollbackResult !== null &&
              arrivalTransition.journalGeneration !== null
            ) {
              resolveRouteArrivalTransition(
                route.id,
                arrivalTransition.journalGeneration
              );
              arrivalTransition.journalGeneration = null;
            }
          } catch (rollbackError) {
            console.warn(
              "[route-arrival-notifications] route start preparation rollback failed",
              rollbackError instanceof Error
                ? rollbackError.message
                : rollbackError
            );
          }

          if (routeArrivalEnabled) {
            throw error;
          }

          console.warn(
            "[route-arrival-notifications] disabled target cleanup failed",
            error instanceof Error ? error.message : error
          );
        }
      }

      const dispatchedAttempt = markRouteStartAttemptRequestDispatched(
        startAttempt.attempt.routeId,
        startAttempt.attempt.generation
      );

      if (!dispatchedAttempt) {
        throw new Error(text.myRoute.startAttemptStorageError);
      }

      if (arrivalTransition.journalGeneration !== null) {
        const dispatchedTransition =
          markRouteArrivalTransitionRequestDispatched(
            route.id,
            arrivalTransition.journalGeneration
          );

        if (!dispatchedTransition) {
          throw new Error(
            appLanguage === "en"
              ? "The app could not safely update the arrival alert transition."
              : "도착 알림 전환 상태를 안전하게 갱신하지 못했어요."
          );
        }
      }

      try {
        const data = await routeApi.startRoute(input);

        return {
          data,
          notificationSettings,
          shouldRequireArrivalRegistration,
        };
      } catch (error) {
        if (!isDefinitiveRouteMutationFailure(error)) {
          try {
            const routeResult = await routeApi.routeById(route.id);
            const recoveredRoute = getConfirmedStartedRoute(
              routeResult.route
            );

            if (recoveredRoute) {
              return {
                data: { startRoute: recoveredRoute },
                notificationSettings,
                shouldRequireArrivalRegistration,
              };
            }
          } catch (recoveryError) {
            console.warn(
              "[route-arrival-notifications] route start result recovery failed",
              recoveryError instanceof Error
                ? recoveryError.message
                : recoveryError
            );
          }

          arrivalTransition.isApiOutcomeUnresolved = true;

          throw error;
        }

        if (
          notificationSettings.data &&
          arrivalTransition.didPrepareArrivalTarget
        ) {
          try {
            const rollbackResult =
              await syncTodayRouteArrivalNotifications(
                arrivalTransition.sourceRoutes,
                appLanguage,
                undefined,
                {
                  routeArrivalEnabled:
                    notificationSettings.data.notificationSettings
                      .routeArrivalEnabled,
                  checkCurrentPosition: false,
                  requestPermissions: shouldRequireArrivalRegistration,
                  requireConfirmedRegistration:
                    shouldRequireArrivalRegistration,
                }
              );

            if (
              rollbackResult !== null &&
              arrivalTransition.journalGeneration !== null
            ) {
              resolveRouteArrivalTransition(
                route.id,
                arrivalTransition.journalGeneration
              );
              arrivalTransition.journalGeneration = null;
            }
          } catch (rollbackError) {
            console.warn(
              "[route-arrival-notifications] route start rollback failed",
              rollbackError instanceof Error
                ? rollbackError.message
                : rollbackError
            );
          }
        }

        throw error;
      }
    },
    onSuccess: async ({
      data,
      notificationSettings,
      shouldRequireArrivalRegistration,
    }, variables) => {
      resolveRouteStartAttempt(
        String(variables.input.routeId),
        variables.startAttempt.attempt.generation
      );
      const nextRoutesData = queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, data.startRoute)
      );
      setStartDatePickerTarget(null);
      setStartTimePickerTarget(null);

      if (!shouldRequireArrivalRegistration) {
        if (notificationSettings.data) {
          try {
            const syncResult = await syncTodayRouteArrivalNotifications(
              nextRoutesData?.myRoutes ?? [data.startRoute],
              appLanguage,
              data.startRoute.id,
              {
                routeArrivalEnabled:
                  notificationSettings.data.notificationSettings
                    .routeArrivalEnabled,
                checkCurrentPosition: false,
                requestPermissions: false,
              }
            );

            if (
              syncResult !== null &&
              variables.arrivalTransition.journalGeneration !== null
            ) {
              resolveRouteArrivalTransition(
                data.startRoute.id,
                variables.arrivalTransition.journalGeneration
              );
              variables.arrivalTransition.journalGeneration = null;
            }
          } catch (error) {
            console.warn(
              "[route-arrival-notifications] deferred target storage failed",
              error instanceof Error ? error.message : error
            );
          }
        }

        showToast(text.myRoute.startSuccess);
        return;
      }

      try {
        if (notificationSettings.error || !notificationSettings.data) {
          throw notificationSettings.error ?? new Error(
            text.myRoute.arrivalNotificationRegistrationError
          );
        }

        await syncTodayRouteArrivalNotifications(
          nextRoutesData?.myRoutes ?? [data.startRoute],
          appLanguage,
          data.startRoute.id,
          {
            routeArrivalEnabled:
              notificationSettings.data.notificationSettings
                .routeArrivalEnabled,
            requestPermissions: true,
            requireConfirmedRegistration: true,
          }
        );

        if (variables.arrivalTransition.journalGeneration !== null) {
          resolveRouteArrivalTransition(
            data.startRoute.id,
            variables.arrivalTransition.journalGeneration
          );
          variables.arrivalTransition.journalGeneration = null;
        }
        showToast(text.myRoute.startSuccess);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : text.myRoute.arrivalNotificationRegistrationError;

        console.error(
          "Failed to register route arrival notification after starting route.",
          error
        );
        showToast(
          text.myRoute.startSuccessWithoutArrivalNotification(errorMessage),
          4200
        );
      }
    },
    onError: (error, variables) => {
      if (!variables.arrivalTransition.isApiOutcomeUnresolved) {
        resolveRouteStartAttempt(
          String(variables.input.routeId),
          variables.startAttempt.attempt.generation
        );
      }
      showToast(
        variables.arrivalTransition.isApiOutcomeUnresolved
          ? "여행 시작 여부를 확인 중이에요. 장소 도착 알림 대상은 그대로 유지돼요."
          : error instanceof Error
            ? error.message
            : text.myRoute.startError,
        variables.arrivalTransition.isApiOutcomeUnresolved ? 4200 : 2600
      );
    },
    onSettled: (_data, _error, variables) => {
      variables.arrivalTransition.releaseLock();
      variables.startAttempt.release();
    },
  });
  const routeGroups = useMemo(() => {
    const todayKey = getTodayDateKey();
    const currentRoutes: MyRoute[] = [];
    const reviewRoutes: MyRoute[] = [];
    const upcomingRoutes: MyRoute[] = [];
    const undatedRoutes: MyRoute[] = [];

    for (const route of localizedMyRoutes) {
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
  }, [localizedMyRoutes]);
  const deepLinkedRouteDay = useMemo(() => {
    if (
      !deepLinkRouteId ||
      !deepLinkDayId ||
      myRoutesQuery.isLoading ||
      isMyRouteLocalizationLoading ||
      myRoutesQuery.isError
    ) {
      return null;
    }

    const route = localizedMyRoutes.find(
      (candidateRoute) => candidateRoute.id === deepLinkRouteId
    );
    const day = route?.days.find(
      (candidateDay) => candidateDay.id === deepLinkDayId
    );

    return route && day
      ? {
          route,
          day,
        }
      : null;
  }, [
    deepLinkDayId,
    deepLinkRouteId,
    isMyRouteLocalizationLoading,
    localizedMyRoutes,
    myRoutesQuery.isError,
    myRoutesQuery.isLoading,
  ]);
  const shouldOpenDeepLinkInHistory = Boolean(
    deepLinkedRouteDay &&
      getRouteTimelineState(deepLinkedRouteDay.route, getTodayDateKey()) ===
        "past"
  );
  useEffect(() => {
    if (!deepLinkedRouteDay || !shouldOpenDeepLinkInHistory) {
      return;
    }

    const historySearchParams = new URLSearchParams({
      routeId: deepLinkedRouteDay.route.id,
      dayId: deepLinkedRouteDay.day.id,
    });
    const source = searchParams.get("source")?.trim();

    if (source) {
      historySearchParams.set("source", source);
    }

    navigate(`/me/routes?${historySearchParams.toString()}`, {
      replace: true,
    });
  }, [
    deepLinkedRouteDay,
    navigate,
    searchParams,
    shouldOpenDeepLinkInHistory,
  ]);
  const selectedRouteDay = useMemo(() => {
    if (deepLinkedRouteDay && !shouldOpenDeepLinkInHistory) {
      return deepLinkedRouteDay;
    }

    if (!selectedDayRoute) {
      return null;
    }

    const route = localizedMyRoutes.find(
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
  }, [
    deepLinkedRouteDay,
    localizedMyRoutes,
    selectedDayRoute,
    shouldOpenDeepLinkInHistory,
  ]);
  const hasRoutes = routeGroups.totalCount > 0;
  const selectDayRoute = useCallback(
    (routeId: string, dayId: string) => {
      clearRouteDeepLinkSearchParams();
      setSelectedDayRoute({ routeId, dayId });
    },
    [clearRouteDeepLinkSearchParams]
  );
  const handleSelectDay = (selectedRoute: MyRoute, day: MyRouteDay) =>
    selectDayRoute(selectedRoute.id, day.id);
  const handleCloseSelectedDayRoute = () => {
    setSelectedDayRoute(null);
    clearRouteDeepLinkSearchParams();
  };
  const handleRequestAppendDay = (route: MyRoute) => {
    const nextDateKey = getNextRouteDayDateKey(route);
    const conflictingRoute = nextDateKey
      ? sourceMyRoutes.find(
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
                selectDayRoute(conflictingRoute.id, selectableDay.id),
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
          getRouteTitle(route, text),
          route.tripDays + 1,
          formatRouteDate(nextDateKey) ?? text.myRoute.unknownDate
        ),
        detail: text.myRoute.conflictDetail(
          getRouteTitle(conflictingRoute, text)
        ),
        actions: conflictActions,
      });
      return;
    }

    startAppendTarget({
      routeId: route.id,
      routeTitle: getRouteTitle(route, text),
      nextDayIndex: route.tripDays + 1,
      suggestedStartDate: nextDateKey,
    });
    showToast(text.myRoute.appendToast);
    navigate("/home");
  };
  const handlePermissionApprovedRouteStart = useCallback(
    (request: RouteStartRequest, options: RouteStartOptions) => {
      const startAttempt = activeStartAttemptRef.current;

      if (
        !startAttempt ||
        startAttempt.attempt.routeId !== request.route.id
      ) {
        showToast(text.myRoute.startAttemptStorageError, 2600);
        return;
      }

      if (isRouteArrivalTransitionLocked()) {
        activeStartAttemptRef.current = null;
        resolveRouteStartAttempt(
          startAttempt.attempt.routeId,
          startAttempt.attempt.generation
        );
        startAttempt.release();
        showToast("이전 일정 상태를 확인하고 있어요.", 2600);
        return;
      }

      activeStartAttemptRef.current = null;
      const cachedRoutes = queryClient.getQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY
      )?.myRoutes;

      startRouteMutation.mutate({
        route: request.route,
        input: {
          routeId: request.route.id,
          startedAt: request.startedAt,
          dayStartedAt: request.dayStartedAt,
        },
        startWithoutLocationPermission:
          options.startWithoutLocationPermission,
        startAttempt,
        arrivalTransition: {
          sourceRoutes: cachedRoutes?.length
            ? cachedRoutes
            : sourceMyRoutes,
          didPrepareArrivalTarget: false,
          isApiOutcomeUnresolved: false,
          journalGeneration: null,
          releaseLock: acquireRouteArrivalTransitionLock(
            request.route.id
          ),
        },
      });
    },
    [
      queryClient,
      showToast,
      sourceMyRoutes,
      startRouteMutation,
      text.myRoute.startAttemptStorageError,
    ]
  );
  const handlePermissionRouteStartCancel = useCallback(
    (request: RouteStartRequest) => {
      const startAttempt = activeStartAttemptRef.current;

      if (
        !startAttempt ||
        startAttempt.attempt.routeId !== request.route.id
      ) {
        return;
      }

      activeStartAttemptRef.current = null;
      resolveRouteStartAttempt(
        startAttempt.attempt.routeId,
        startAttempt.attempt.generation
      );
      startAttempt.release();
    },
    []
  );
  const {
    isPermissionLookupPending,
    requestRouteStart,
  } = useRouteStartLocationPermissionGuard({
    isStartPending: startRouteMutation.isPending,
    onStart: handlePermissionApprovedRouteStart,
    onCancel: handlePermissionRouteStartCancel,
  });
  const isRouteStartPending =
    startRouteMutation.isPending || isPermissionLookupPending;
  const handleStartRoute = useCallback(
    (
      route: MyRoute,
      startedAt: string,
      dayStartedAt: string,
      replaceAttemptGeneration?: number
    ) => {
      if (isRouteStartPending || !startedAt || !dayStartedAt) {
        return false;
      }

      if (
        isRouteArrivalTransitionLocked() ||
        (isRouteStartAttemptLocked() &&
          replaceAttemptGeneration === undefined)
      ) {
        showToast("이전 일정 상태를 확인하고 있어요.", 2600);
        return false;
      }

      const startAttempt = beginRouteStartAttempt(
        {
          routeId: route.id,
          startedAt,
          dayStartedAt,
        },
        {
          replaceGeneration: replaceAttemptGeneration,
        }
      );

      if (!startAttempt) {
        showToast(text.myRoute.startAttemptStorageError, 2600);
        return false;
      }

      activeStartAttemptRef.current = startAttempt;

      void requestRouteStart({
        route,
        startedAt,
        dayStartedAt,
      });
      return true;
    }, [
      isRouteStartPending,
      requestRouteStart,
      showToast,
      text.myRoute.startAttemptStorageError,
    ]
  );
  const openStartTimePicker = useCallback(
    (route: MyRoute, startedAt: string) => {
      if (!startedAt || startedAt > getTodayDateKey()) {
        showToast(text.myRoute.futureStartError, 2600);
        return;
      }

      setStartDatePickerTarget(null);
      setStartTimePickerTarget({
        route,
        startedAt,
        timeValue: toTimeValue(getRoutePlannedStartMinutes(route)),
      });
    },
    [showToast, text.myRoute.futureStartError]
  );
  const handleRequestStartRoute = useCallback(
    (route: MyRoute) => {
      if (isRouteStartPending) {
        return;
      }

      const todayKey = getTodayDateKey();
      const plannedStartKey = getRouteStartDateKey(route);
      const plannedEndKey = getRouteEndDateKey(route);

      const plannedStartMinutes = getRoutePlannedStartMinutes(route);
      const plannedTimeLabel = formatMinutesLabel(plannedStartMinutes, text);
      const currentTimeLabel = formatMinutesLabel(getCurrentMinutes(), text);

      if (!plannedStartKey || plannedStartKey === todayKey) {
        openModal({
          title: text.dayRoute.dayStartTitle(1),
          description: text.myRoute.startTimeReviewDescription(
            plannedTimeLabel,
            currentTimeLabel
          ),
          detail: text.myRoute.startTimeReviewDetail,
          actions: [
            {
              label: text.myRoute.startNow,
              variant: "primary",
              onClick: () =>
                handleStartRoute(
                  route,
                  todayKey,
                  new Date().toISOString()
                ),
            },
            {
              label: text.myRoute.chooseStartTime,
              variant: "secondary",
              onClick: () => openStartTimePicker(route, todayKey),
            },
            {
              label: text.common.cancel,
              variant: "secondary",
            },
          ],
        });
        return;
      }

      const isPastPlannedPeriod = plannedEndKey
        ? todayKey > plannedEndKey
        : false;

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
            onClick: () =>
              handleStartRoute(
                route,
                todayKey,
                new Date().toISOString()
              ),
          },
          {
            label: text.myRoute.chooseStartTime,
            variant: "secondary",
            onClick: () => openStartTimePicker(route, todayKey),
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
    }, [
      handleStartRoute,
      isRouteStartPending,
      openModal,
      openStartTimePicker,
      text,
    ]
  );
  useEffect(() => {
    if (!recoveryRouteId) {
      handledRecoveryRouteIdRef.current = null;
      return;
    }

    const recoveryRequestKey = `${recoveryRouteId}:${recoveryGeneration}`;

    if (
      !Number.isSafeInteger(recoveryGeneration) ||
      recoveryGeneration <= 0 ||
      handledRecoveryRouteIdRef.current === recoveryRequestKey ||
      myRoutesQuery.isLoading ||
      myRoutesQuery.isError
    ) {
      return;
    }

    const recoveryAttempt = getRouteStartAttempts().find(
      (attempt) =>
        attempt.routeId === recoveryRouteId &&
        attempt.generation === recoveryGeneration
    );
    const route = sourceMyRoutes.find(
      (candidateRoute) => candidateRoute.id === recoveryRouteId
    );
    const clearRecoverySearchParams = () => {
      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.delete(ROUTE_START_RECOVERY_ROUTE_ID_PARAM);
      nextSearchParams.delete(ROUTE_START_RECOVERY_GENERATION_PARAM);
      setSearchParams(nextSearchParams, { replace: true });
    };

    if (!recoveryAttempt) {
      handledRecoveryRouteIdRef.current = recoveryRequestKey;
      clearRecoverySearchParams();
      return;
    }

    if (!route) {
      handledRecoveryRouteIdRef.current = recoveryRequestKey;
      resolveRouteStartAttempt(
        recoveryAttempt.routeId,
        recoveryAttempt.generation
      );
      clearRecoverySearchParams();
      showToast(text.myRoute.startError, 2600);
      return;
    }

    if (getConfirmedStartedRoute(route)) {
      handledRecoveryRouteIdRef.current = recoveryRequestKey;
      resolveRouteStartAttempt(
        recoveryAttempt.routeId,
        recoveryAttempt.generation
      );
      clearRecoverySearchParams();
      showToast(text.myRoute.startRecoverySuccess, 2600);
      return;
    }

    if (
      handleStartRoute(
        route,
        recoveryAttempt.startedAt,
        recoveryAttempt.dayStartedAt ?? new Date().toISOString(),
        recoveryAttempt.generation
      )
    ) {
      handledRecoveryRouteIdRef.current = recoveryRequestKey;
      clearRecoverySearchParams();
    }
  }, [
    handleStartRoute,
    myRoutesQuery.isError,
    myRoutesQuery.isLoading,
    recoveryGeneration,
    recoveryRouteId,
    searchParams,
    setSearchParams,
    showToast,
    sourceMyRoutes,
    text.myRoute,
  ]);
  const handleConfirmCustomStartDate = () => {
    if (!startDatePickerTarget) {
      return;
    }

    openStartTimePicker(
      startDatePickerTarget.route,
      startDatePickerTarget.startedAt
    );
  };
  const handleConfirmCustomStartTime = () => {
    if (!startTimePickerTarget) {
      return;
    }

    const dayStartedAt = combineDateKeyAndTime(
      startTimePickerTarget.startedAt,
      startTimePickerTarget.timeValue
    );

    if (!dayStartedAt) {
      showToast(text.myRoute.startError, 2600);
      return;
    }

    if (Date.parse(dayStartedAt) > Date.now() + 60_000) {
      showToast(text.dayRoute.dayStartFutureError, 2600);
      return;
    }

    handleStartRoute(
      startTimePickerTarget.route,
      startTimePickerTarget.startedAt,
      dayStartedAt
    );
  };
  const handleRequestDeleteRoute = (route: MyRoute) => {
    if (deleteRouteMutation.isPending) {
      return;
    }

    openModal({
      title: text.myRoute.deleteTitle,
      description: text.myRoute.deleteDescription(getRouteTitle(route, text)),
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
    <section className="flex min-h-full flex-col gap-4 text-slate-900">
      {myRoutesQuery.isError ? (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm font-semibold text-rose-700">
          <p>{text.myRoute.loadError}</p>
          <button
            type="button"
            onClick={() => void myRoutesQuery.refetch()}
            className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-60"
            disabled={myRoutesQuery.isFetching}
          >
            {text.common.retry}
          </button>
        </div>
      ) : null}

      {myRoutesQuery.isLoading || isMyRouteLocalizationLoading ? (
        <RouteListSkeleton variant="my-route" />
      ) : null}

      {!myRoutesQuery.isLoading &&
      !isMyRouteLocalizationLoading &&
      !myRoutesQuery.isError &&
      !hasRoutes ? (
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
          onClose={handleCloseSelectedDayRoute}
          onRequestStartRoute={handleRequestStartRoute}
          isRouteStartPending={isRouteStartPending}
          enableVerificationPhotoPreview
        />
      ) : null}

      {startDatePickerTarget ? (
        <StartRouteDatePickerModal
          target={startDatePickerTarget}
          isPending={isRouteStartPending}
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

      {startTimePickerTarget ? (
        <StartRouteTimePickerModal
          target={startTimePickerTarget}
          isPending={isRouteStartPending}
          onChange={(timeValue) =>
            setStartTimePickerTarget((currentTarget) =>
              currentTarget
                ? {
                    ...currentTarget,
                    timeValue,
                  }
                : currentTarget
            )
          }
          onClose={() => setStartTimePickerTarget(null)}
          onConfirm={handleConfirmCustomStartTime}
        />
      ) : null}

      {isRouteStartPending ? <RouteStartProgressOverlay /> : null}
    </section>
  );
}

export default MyRoutePage;
