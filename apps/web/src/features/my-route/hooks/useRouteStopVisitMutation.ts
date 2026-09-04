/**
 * 용도:
 * 장소의 도착 인증, 방문 완료, 사진·머문 시간 수정 상태를 저장한다.
 *
 * 동작 방식:
 * 방문 완료 전에 현재·다음 도착 알림을 함께 사전 등록하고,
 * API 성공을 화면에 먼저 반영한 뒤 다음 대상의 현재 위치를 다시 확인한다.
 * 확정 실패만 기존 타깃으로 되돌리고, 결과가 불명확하면 재조회로 확정될 때까지 두 대상을 유지한다.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import { NOTIFICATION_SETTINGS_QUERY_KEY } from "@/api/notificationApi";
import type {
  MyRoutesQuery,
  NotificationSettingsQuery,
  RouteStopVerificationStatus,
  RouteStopVisitVerificationInput,
} from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  optimisticVisitRouteStopCache,
  upsertMyRouteCache,
} from "../myRouteCache";
import { cacheRouteStopVerificationPhotoDataUrl } from "../routeCompletionPoster";
import {
  requestVisitVerificationPosition,
  requestVisitPhoto,
  uploadVerifiedVisitPhoto,
  type VisitPhotoSource,
} from "../services/visitPhotoService";
import { getVisitPhotoVerificationStatus } from "../services/visitPhotoVerification";
import {
  prepareRouteArrivalNotificationsForVisitTransition,
  RouteArrivalVisitTransitionPreparationError,
  syncRouteArrivalNotificationsAfterVisitChange,
  syncTodayRouteArrivalNotifications,
  type RouteArrivalVisitTransitionPreparation,
} from "../services/routeArrivalNotificationService";
import { createRouteArrivalVisitPreview } from "../services/routeArrivalNotificationTarget";
import {
  acquireRouteArrivalTransitionLock,
  isRouteArrivalTransitionLocked,
  markRouteArrivalTransitionRequestDispatched,
  markRouteArrivalTransitionUnresolved,
  resolveRouteArrivalTransition,
} from "../services/routeArrivalTransitionLock";
import {
  getConfirmedRouteVisitState,
  isDefinitiveRouteMutationFailure,
} from "../services/routeArrivalMutationRecovery";
import type {
  ActualStayMinutesTarget,
  PhotoPublicationTarget,
  VerificationPhotoPreviewTarget,
  VisitCompletionTarget,
  VisitTimesEditTarget,
} from "../models/dayRouteDialogTypes";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
import { isVisitedStop } from "../routeDisplay";
import { nativeBridge } from "@/native-bridge";

type UseRouteStopVisitMutationOptions = {
  route: MyRoute;
  routeId: string;
  activeDayId: string;
  orderedStops: MyRouteStop[];
  isRetrospectiveCompletion: boolean;
  setOrderedStops: (value: SetStateAction<MyRouteStop[]>) => void;
  setBaseStopIds: (value: string[]) => void;
  setVisitCompletionTarget: (value: VisitCompletionTarget | null) => void;
  setActualStayMinutesTarget: (
    value: ActualStayMinutesTarget | null
  ) => void;
  setPhotoPublicationTarget: (
    value: PhotoPublicationTarget | null
  ) => void;
  setVerificationPhotoPreviewTarget: (
    value: VerificationPhotoPreviewTarget | null
  ) => void;
  setVisitTimesEditTarget: (value: VisitTimesEditTarget | null) => void;
};

type VisitArrivalTransition = {
  currentRoutes: MyRoute[];
  nextRoutes: MyRoute[];
  isApiOutcomeUnresolved: boolean;
  journalGeneration: number | null;
  releaseLock: () => void;
};

type PersistVisitVariables = {
  arrivalTransition: VisitArrivalTransition | null;
  routeDay: MyRouteDay;
  stop: MyRouteStop;
  nextVisited: boolean;
  verification: RouteStopVisitVerificationInput | null;
  actualStayMinutes: number | null;
  isActiveRouteDay: boolean;
  sourceStops: MyRouteStop[];
  previousStops: MyRouteStop[];
  wasDayCompleted: boolean;
  visitedAt: string;
  nextVerificationStatus: RouteStopVerificationStatus;
  isGpsVerified: boolean;
  isGpsPhotoVerified: boolean;
  hasPhotoRecord: boolean;
  optimisticStops: MyRouteStop[];
};

type PrepareVisitPhotoVariables = {
  target: VisitCompletionTarget;
  source: VisitPhotoSource;
};

type CheckInVariables = {
  target: VisitCompletionTarget;
  verification: RouteStopVisitVerificationInput;
};

type CompleteVisitVariables = {
  arrivalTransition: VisitArrivalTransition;
  target: ActualStayMinutesTarget;
  actualStayMinutes: number | null;
};

type PhotoPublicationVariables = {
  target: PhotoPublicationTarget;
  published: boolean;
};

type ReplaceVisitPhotoVariables = VerificationPhotoPreviewTarget;

type UpdateVisitTimesVariables = {
  target: VisitTimesEditTarget;
  checkedInAt: string;
  checkedOutAt: string | null;
};

export function useRouteStopVisitMutation({
  route,
  routeId,
  activeDayId,
  orderedStops,
  isRetrospectiveCompletion,
  setOrderedStops,
  setBaseStopIds,
  setVisitCompletionTarget,
  setActualStayMinutesTarget,
  setPhotoPublicationTarget,
  setVerificationPhotoPreviewTarget,
  setVisitTimesEditTarget,
}: UseRouteStopVisitMutationOptions) {
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const showToast = useUiToastStore((state) => state.showToast);
  const getRouteArrivalEnabled = () =>
    queryClient.getQueryData<NotificationSettingsQuery>(
      NOTIFICATION_SETTINGS_QUERY_KEY
    )?.notificationSettings.routeArrivalEnabled;
  const createVisitArrivalTransition = (
    stopId: string,
    visitedAt: string,
    nextVisited: boolean
  ): VisitArrivalTransition => {
    const cachedRoutes = queryClient.getQueryData<MyRoutesQuery>(
      MY_ROUTES_QUERY_KEY
    )?.myRoutes;
    const currentRoutes = cachedRoutes?.length ? cachedRoutes : [route];
    const currentRoute =
      currentRoutes.find((candidateRoute) => candidateRoute.id === routeId) ??
      route;
    const nextRoute = createRouteArrivalVisitPreview(
      currentRoute,
      stopId,
      visitedAt,
      nextVisited
    );

    return {
      currentRoutes,
      nextRoutes: currentRoutes.map((candidateRoute) =>
        candidateRoute.id === routeId ? nextRoute : candidateRoute
      ),
      isApiOutcomeUnresolved: false,
      journalGeneration: null,
      releaseLock: acquireRouteArrivalTransitionLock(routeId),
    };
  };
  const rollbackVisitArrivalTransition = async (
    transition: VisitArrivalTransition,
    requestPermissions: boolean
  ) => {
    try {
      const result = await syncTodayRouteArrivalNotifications(
        transition.currentRoutes,
        appLanguage,
        routeId,
        {
          routeArrivalEnabled: getRouteArrivalEnabled(),
          checkCurrentPosition: false,
          requestPermissions,
          requireConfirmedRegistration: requestPermissions,
        }
      );

      return result !== null;
    } catch (error) {
      console.warn(
        "[route-arrival-notifications] visit transition rollback failed",
        error instanceof Error ? error.message : error
      );
      return false;
    }
  };
  const prepareVisitArrivalTransition = async (
    transition: VisitArrivalTransition,
    stopId: string,
    nextVisited: boolean
  ) => {
    const routeArrivalEnabled = getRouteArrivalEnabled();

    if (
      nativeBridge.runtime.isAvailable() &&
      routeArrivalEnabled !== false &&
      transition.journalGeneration === null
    ) {
      const unresolvedTransition = markRouteArrivalTransitionUnresolved(
        routeId,
        {
          expectation: {
            kind: "stop-visit",
            stopId,
            visited: nextVisited,
          },
        }
      );

      transition.journalGeneration =
        unresolvedTransition?.generation ?? null;

      if (transition.journalGeneration === null) {
        throw new Error(
          appLanguage === "en"
            ? "The app could not safely save the arrival alert transition."
            : "도착 알림 전환 상태를 안전하게 저장하지 못했어요."
        );
      }
    }
    try {
      const preparation =
        await prepareRouteArrivalNotificationsForVisitTransition(
        transition.currentRoutes,
        transition.nextRoutes,
        appLanguage,
        routeId,
        { routeArrivalEnabled }
      );

      if (!preparation.rollbackRequired) {
        resolveVisitArrivalTransitionJournal(transition);
      }

      return preparation;
    } catch (error) {
      if (!(error instanceof RouteArrivalVisitTransitionPreparationError)) {
        resolveVisitArrivalTransitionJournal(transition);
        throw error;
      }

      const didRollback = await rollbackVisitArrivalTransition(
        transition,
        error.requestPermissions
      );

      if (didRollback) {
        resolveVisitArrivalTransitionJournal(transition);
      }

      throw error;
    }
  };
  const rollbackPreparedVisitArrivalTransition = async (
    transition: VisitArrivalTransition,
    preparation: RouteArrivalVisitTransitionPreparation | null
  ) => {
    if (!preparation?.rollbackRequired) {
      return true;
    }

    return rollbackVisitArrivalTransition(
      transition,
      preparation.requestPermissions
    );
  };
  const resolveVisitArrivalTransitionJournal = (
    transition: VisitArrivalTransition
  ) => {
    if (transition.journalGeneration === null) {
      return;
    }

    resolveRouteArrivalTransition(
      routeId,
      transition.journalGeneration
    );
    transition.journalGeneration = null;
  };
  const markVisitArrivalTransitionRequestDispatched = (
    transition: VisitArrivalTransition
  ) => {
    if (transition.journalGeneration === null) {
      return;
    }

    const dispatchedTransition =
      markRouteArrivalTransitionRequestDispatched(
        routeId,
        transition.journalGeneration
      );

    if (!dispatchedTransition) {
      throw new Error(
        appLanguage === "en"
          ? "The app could not safely update the arrival alert transition."
          : "도착 알림 전환 상태를 안전하게 갱신하지 못했어요."
      );
    }
  };
  const recoverVisitMutationFailure = async (
    transition: VisitArrivalTransition,
    preparation: RouteArrivalVisitTransitionPreparation | null,
    stopId: string,
    nextVisited: boolean,
    error: unknown
  ) => {
    if (isDefinitiveRouteMutationFailure(error)) {
      const didRollback = await rollbackPreparedVisitArrivalTransition(
        transition,
        preparation
      );

      if (didRollback) {
        resolveVisitArrivalTransitionJournal(transition);
      }

      return null;
    }

    try {
      const result = await routeApi.routeById(routeId);
      const recoveredRoute = getConfirmedRouteVisitState(
        result.route,
        stopId,
        nextVisited
      );

      if (recoveredRoute) {
        return recoveredRoute;
      }
    } catch (recoveryError) {
      console.warn(
        "[route-arrival-notifications] visit result recovery failed",
        recoveryError instanceof Error
          ? recoveryError.message
          : recoveryError
      );
    }

    if (preparation?.rollbackRequired) {
      transition.isApiOutcomeUnresolved = true;
    }

    return null;
  };
  const syncUpdatedRouteArrivalTarget = async (
    nextRoute: MyRoute,
    preparation?: RouteArrivalVisitTransitionPreparation | null
  ) => {
    const nextRoutes =
      queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY)?.myRoutes ??
      [nextRoute];

    try {
      const result = await syncRouteArrivalNotificationsAfterVisitChange(
        nextRoutes,
        appLanguage,
        nextRoute.id,
        {
          routeArrivalEnabled: getRouteArrivalEnabled(),
          requestPermissions: preparation?.requestPermissions,
          requireConfirmedRegistration:
            preparation?.requestPermissions === true,
        }
      );

      if (preparation?.rollbackRequired && result === null) {
        throw new Error("Native route arrival target sync did not respond");
      }

      return null;
    } catch (error) {
      console.warn(
        "[route-arrival-notifications] updated route target sync failed",
        error instanceof Error ? error.message : error
      );
      return error;
    }
  };
  const invalidatePlaceVisitQueries = (stop: MyRouteStop) => {
    const contentId =
      stop.place.contentId?.trim() ||
      stop.place.externalId?.trim() ||
      stop.id;
    const contentTypeId = stop.place.contentTypeId?.trim() ?? "";
    const placeDetailKey = `${contentId}-${contentTypeId}`;

    void queryClient.invalidateQueries({
      queryKey: ["place-photos", placeDetailKey],
    });
    void queryClient.invalidateQueries({
      queryKey: ["place-stay-summary", placeDetailKey],
    });
  };
  const applyRouteResult = (
    nextRoute: MyRoute,
    target: VisitCompletionTarget
  ) => {
    const nextDay = nextRoute.days.find(
      (candidateDay) => candidateDay.id === target.routeDay.id
    );
    const nextStops = nextDay?.stops ?? target.routeDay.stops;

    if (target.routeDay.id === activeDayId) {
      setOrderedStops(nextStops);
      setBaseStopIds(nextStops.map((nextStop) => nextStop.id));
    }

    queryClient.setQueryData<MyRoutesQuery>(
      MY_ROUTES_QUERY_KEY,
      (currentData) => upsertMyRouteCache(currentData, nextRoute)
    );

    return nextStops;
  };
  const checkInMutation = useMutation({
    mutationFn: ({ target, verification }: CheckInVariables) =>
      routeApi.checkInRouteStop(target.stop.id, verification),
    onSuccess: (result, variables) => {
      const nextStops = applyRouteResult(
        result.checkInRouteStop,
        variables.target
      );
      const nextStop = nextStops.find(
        (candidateStop) => candidateStop.id === variables.target.stop.id
      );
      setVisitCompletionTarget(null);
      if (variables.verification.photoUrl && nextStop) {
        setPhotoPublicationTarget({
          routeDay: variables.target.routeDay,
          stop: nextStop,
        });
      } else {
        showToast("도착 인증이 완료됐어요. 머무는 시간을 기록할게요.");
      }
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "도착 인증을 저장하지 못했어요.",
        2600
      );
    },
  });
  const completeVisitMutation = useMutation({
    mutationFn: async ({
      arrivalTransition,
      target,
      actualStayMinutes,
    }: CompleteVisitVariables) => {
      const preparation = await prepareVisitArrivalTransition(
        arrivalTransition,
        target.stop.id,
        true
      );

      markVisitArrivalTransitionRequestDispatched(arrivalTransition);

      try {
        const data = await routeApi.completeRouteStopVisit(
          target.stop.id,
          actualStayMinutes
        );

        return { data, preparation };
      } catch (error) {
        const recoveredRoute = await recoverVisitMutationFailure(
          arrivalTransition,
          preparation,
          target.stop.id,
          true,
          error
        );

        if (recoveredRoute) {
          return {
            data: { completeRouteStopVisit: recoveredRoute },
            preparation,
          };
        }

        throw error;
      }
    },
    onSuccess: async ({ data, preparation }, variables) => {
      const previousStops =
        variables.target.routeDay.id === activeDayId
          ? orderedStops
          : variables.target.routeDay.stops;
      const wasDayCompleted =
        previousStops.length > 0 &&
        previousStops.filter(isVisitedStop).length === previousStops.length;
      const nextStops = applyRouteResult(
        data.completeRouteStopVisit,
        variables.target
      );
      const nextIsDayCompleted =
        nextStops.length > 0 &&
        nextStops.filter(isVisitedStop).length === nextStops.length;
      const successMessage =
        !wasDayCompleted && nextIsDayCompleted
          ? `DAY ${variables.target.routeDay.dayIndex} 클리어`
          : "방문을 완료했어요.";

      setActualStayMinutesTarget(null);
      showToast(successMessage);

      const arrivalSyncError = await syncUpdatedRouteArrivalTarget(
        data.completeRouteStopVisit,
        preparation
      );

      if (!arrivalSyncError) {
        resolveVisitArrivalTransitionJournal(
          variables.arrivalTransition
        );
      }

      if (arrivalSyncError) {
        showToast(
          "방문은 완료했지만 도착 알림 상태를 정리하지 못했어요. 앱을 다시 열면 자동으로 맞춰져요.",
          4200
        );
      }
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      invalidatePlaceVisitQueries(variables.target.stop);
    },
    onError: (error, variables) => {
      showToast(
        variables.arrivalTransition.isApiOutcomeUnresolved
          ? "방문 완료 여부를 확인 중이에요. 현재·다음 장소 알림은 그대로 유지돼요."
          : error instanceof Error
            ? error.message
            : "방문을 완료하지 못했어요.",
        variables.arrivalTransition.isApiOutcomeUnresolved ? 4200 : 2600
      );
    },
    onSettled: (_data, _error, variables) => {
      variables.arrivalTransition.releaseLock();
    },
  });
  const visitMutation = useMutation({
    mutationFn: async ({
      arrivalTransition,
      stop,
      nextVisited,
      verification,
      actualStayMinutes,
    }: PersistVisitVariables) => {
      const preparation =
        arrivalTransition
          ? await prepareVisitArrivalTransition(
              arrivalTransition,
              stop.id,
              nextVisited
            )
          : null;

      if (arrivalTransition) {
        markVisitArrivalTransitionRequestDispatched(arrivalTransition);
      }

      try {
        const data = await routeApi.markRouteStopVisited(
          stop.id,
          nextVisited,
          nextVisited ? verification : null,
          nextVisited ? actualStayMinutes : null
        );

        return { data, preparation };
      } catch (error) {
        if (arrivalTransition) {
          const recoveredRoute = await recoverVisitMutationFailure(
            arrivalTransition,
            preparation,
            stop.id,
            nextVisited,
            error
          );

          if (recoveredRoute) {
            return {
              data: { markRouteStopVisited: recoveredRoute },
              preparation,
            };
          }
        }

        throw error;
      }
    },
    onMutate: async (variables) => {
      if (variables.isActiveRouteDay) {
        setOrderedStops(variables.optimisticStops);
      }

      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      const previousRoutes =
        queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          optimisticVisitRouteStopCache({
            data: currentData,
            routeId,
            stopId: variables.stop.id,
            visited: variables.nextVisited,
            visitedAt: variables.visitedAt,
            verificationStatus: variables.nextVerificationStatus,
            verificationLat: variables.verification?.lat ?? null,
            verificationLng: variables.verification?.lng ?? null,
            verificationAccuracyMeters:
              variables.verification?.accuracyMeters ?? null,
            verificationPhotoImageId:
              variables.verification?.photoImageId ?? null,
            verificationPhotoUrl: variables.verification?.photoUrl ?? null,
            actualStayMinutes: variables.actualStayMinutes,
          })
      );

      return { previousRoutes };
    },
    onSuccess: async ({ data, preparation }, variables) => {
      const nextDay = data.markRouteStopVisited.days.find(
        (candidateDay) => candidateDay.id === variables.routeDay.id
      );
      const nextStops = nextDay?.stops ?? variables.sourceStops;
      const nextCompletedStopCount = nextStops.filter(isVisitedStop).length;
      const nextIsDayCompleted =
        nextStops.length > 0 && nextCompletedStopCount === nextStops.length;

      if (variables.isActiveRouteDay) {
        setOrderedStops(nextStops);
        setBaseStopIds(nextStops.map((nextStop) => nextStop.id));
      }

      const successMessage =
        !variables.wasDayCompleted && nextIsDayCompleted
          ? `DAY ${variables.routeDay.dayIndex} 클리어`
          : variables.nextVisited
            ? variables.isGpsPhotoVerified
              ? "사진 인증 완료 처리했어요."
              : variables.isGpsVerified
                ? "GPS 인증 완료 처리했어요."
                : variables.hasPhotoRecord
                  ? "사진 기록으로 완료 처리했어요."
                  : "장소를 완료 처리했어요."
            : variables.stop.checkedInAt
              ? "도착 인증을 취소했어요."
              : "완료를 취소했어요.";

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, data.markRouteStopVisited)
      );
      showToast(successMessage);

      const arrivalSyncError = await syncUpdatedRouteArrivalTarget(
        data.markRouteStopVisited,
        preparation
      );

      if (!arrivalSyncError && variables.arrivalTransition) {
        resolveVisitArrivalTransitionJournal(
          variables.arrivalTransition
        );
      }
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      invalidatePlaceVisitQueries(variables.stop);

      if (arrivalSyncError) {
        showToast(
          "장소 상태는 저장했지만 도착 알림 상태를 갱신하지 못했어요. 앱을 다시 열면 자동으로 맞춰져요.",
          4200
        );
      }

      if (variables.nextVisited && variables.hasPhotoRecord) {
        const nextStop = nextStops.find(
          (candidateStop) => candidateStop.id === variables.stop.id
        );

        if (nextStop) {
          setPhotoPublicationTarget({
            routeDay: variables.routeDay,
            stop: nextStop,
          });
        }
      }
    },
    onError: (error, variables, context) => {
      if (context?.previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          context.previousRoutes
        );
      }
      if (variables.isActiveRouteDay) {
        setOrderedStops(variables.previousStops);
      }
      showToast(
        variables.arrivalTransition?.isApiOutcomeUnresolved
          ? "완료 여부를 확인 중이에요. 현재·다음 장소 알림은 그대로 유지돼요."
          : error instanceof Error
            ? error.message
            : "완료 상태를 바꾸지 못했어요.",
        variables.arrivalTransition?.isApiOutcomeUnresolved ? 4200 : 2600
      );
    },
    onSettled: (_data, _error, variables) => {
      variables.arrivalTransition?.releaseLock();
    },
  });
  const photoMutation = useMutation({
    mutationFn: async ({ target, source }: PrepareVisitPhotoVariables) => {
      const verificationStatus = getVisitPhotoVerificationStatus(
        source,
        isRetrospectiveCompletion
      );
      const position =
        verificationStatus === "GPS_PHOTO"
          ? await requestVisitVerificationPosition(target.stop.place)
          : null;

      const photo = await requestVisitPhoto(source);
      const uploadPayload = await routeApi.createRouteStopVisitPhotoUpload(
        target.stop.id
      );
      const photoUrl = await uploadVerifiedVisitPhoto(
        uploadPayload.createRouteStopVisitPhotoUpload,
        photo
      );

      cacheRouteStopVerificationPhotoDataUrl({
        stopId: target.stop.id,
        photoUrl,
        dataUrl: photo.dataUrl,
      });

      let verification: RouteStopVisitVerificationInput;

      if (verificationStatus === "MANUAL") {
        verification = {
          status: "MANUAL",
          lat: null,
          lng: null,
          accuracyMeters: null,
          photoImageId: uploadPayload.createRouteStopVisitPhotoUpload.imageId,
          photoUrl,
        };
      } else {
        if (!position) {
          throw new Error("현재 위치를 확인하지 못했어요.");
        }

        verification = {
          status: "GPS_PHOTO",
          lat: position.lat,
          lng: position.lng,
          accuracyMeters: position.accuracyMeters,
          photoImageId: uploadPayload.createRouteStopVisitPhotoUpload.imageId,
          photoUrl,
        };
      }

      return { ...target, verification } satisfies ActualStayMinutesTarget;
    },
    onSuccess: (target) => {
      if (target.verification.status === "MANUAL") {
        setActualStayMinutesTarget(target);
        setVisitCompletionTarget(null);
        return;
      }

      checkInMutation.mutate({
        target,
        verification: target.verification,
      });
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "사진 인증을 완료하지 못했어요.",
        2600
      );
    },
  });
  const gpsMutation = useMutation({
    mutationFn: async (target: VisitCompletionTarget) => {
      const position = await requestVisitVerificationPosition(target.stop.place);

      return {
        ...target,
        verification: {
          status: "GPS",
          lat: position.lat,
          lng: position.lng,
          accuracyMeters: position.accuracyMeters,
          photoImageId: null,
          photoUrl: null,
        },
      } satisfies ActualStayMinutesTarget;
    },
    onSuccess: (target) => {
      checkInMutation.mutate({
        target,
        verification: target.verification,
      });
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "GPS 인증을 완료하지 못했어요.",
        2600
      );
    },
  });
  const photoPublicationMutation = useMutation({
    mutationFn: ({ target, published }: PhotoPublicationVariables) =>
      routeApi.setRouteStopPhotoPublication(target.stop.id, published),
    onSuccess: (result, variables) => {
      applyRouteResult(
        result.setRouteStopPhotoPublication,
        variables.target
      );
      setPhotoPublicationTarget(null);
      setVerificationPhotoPreviewTarget(null);
      invalidatePlaceVisitQueries(variables.target.stop);
      showToast(
        variables.published
          ? "장소 사진에 공개했어요."
          : "사진 공개를 취소했어요."
      );
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "사진 공개 설정을 바꾸지 못했어요.",
        2600
      );
    },
  });
  const replacePhotoMutation = useMutation({
    mutationFn: async (target: ReplaceVisitPhotoVariables) => {
      const photo = await requestVisitPhoto("library");
      const uploadPayload = await routeApi.createRouteStopVisitPhotoUpload(
        target.stop.id
      );
      const photoUrl = await uploadVerifiedVisitPhoto(
        uploadPayload.createRouteStopVisitPhotoUpload,
        photo
      );

      cacheRouteStopVerificationPhotoDataUrl({
        stopId: target.stop.id,
        photoUrl,
        dataUrl: photo.dataUrl,
      });

      const result = await routeApi.setRouteStopVisitPhoto(
        target.stop.id,
        uploadPayload.createRouteStopVisitPhotoUpload.imageId,
        photoUrl
      );

      return result.setRouteStopVisitPhoto;
    },
    onSuccess: (nextRoute, target) => {
      const nextStops = applyRouteResult(nextRoute, target);
      const nextStop = nextStops.find(
        (candidateStop) => candidateStop.id === target.stop.id
      );

      setVerificationPhotoPreviewTarget(null);
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      invalidatePlaceVisitQueries(target.stop);

      if (nextStop) {
        setPhotoPublicationTarget({
          routeDay: target.routeDay,
          stop: nextStop,
        });
      } else {
        showToast("사진 기록을 저장했어요.");
      }
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "사진 기록을 저장하지 못했어요.",
        2600
      );
    },
  });
  const deletePhotoMutation = useMutation({
    mutationFn: (target: VerificationPhotoPreviewTarget) =>
      routeApi.deleteRouteStopVisitPhoto(target.stop.id),
    onSuccess: (result, target) => {
      applyRouteResult(result.deleteRouteStopVisitPhoto, target);
      setPhotoPublicationTarget(null);
      setVerificationPhotoPreviewTarget(null);
      invalidatePlaceVisitQueries(target.stop);
      showToast("인증 사진을 삭제했어요. 방문 기록은 유지돼요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "인증 사진을 삭제하지 못했어요.",
        2600
      );
    },
  });
  const updateVisitTimesMutation = useMutation({
    mutationFn: ({ target, checkedInAt, checkedOutAt }: UpdateVisitTimesVariables) =>
      routeApi.updateRouteStopVisitTimes({
        stopId: target.stop.id,
        checkedInAt,
        checkedOutAt,
      }),
    onSuccess: (result, variables) => {
      applyRouteResult(result.updateRouteStopVisitTimes, variables.target);
      setVisitTimesEditTarget(null);
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      invalidatePlaceVisitQueries(variables.target.stop);
      showToast("방문시간을 수정했어요.");
    },
    onError: (error) => {
      showToast(
        error instanceof Error
          ? error.message
          : "방문시간을 수정하지 못했어요.",
        2600
      );
    },
  });
  const visitSavingStopId = replacePhotoMutation.isPending
    ? (replacePhotoMutation.variables?.stop.id ?? null)
    : photoMutation.isPending
    ? (photoMutation.variables?.target.stop.id ?? null)
    : gpsMutation.isPending
      ? (gpsMutation.variables?.stop.id ?? null)
      : checkInMutation.isPending
        ? (checkInMutation.variables?.target.stop.id ?? null)
        : completeVisitMutation.isPending
          ? (completeVisitMutation.variables?.target.stop.id ?? null)
          : visitMutation.isPending
            ? (visitMutation.variables?.stop.id ?? null)
            : photoPublicationMutation.isPending
              ? (photoPublicationMutation.variables?.target.stop.id ?? null)
              : deletePhotoMutation.isPending
                ? (deletePhotoMutation.variables?.stop.id ?? null)
                : updateVisitTimesMutation.isPending
                  ? (updateVisitTimesMutation.variables?.target.stop.id ?? null)
                  : null;

  const persistStopVisit = async (
    routeDay: MyRouteDay,
    stop: MyRouteStop,
    nextVisited: boolean,
    verification: RouteStopVisitVerificationInput | null = null,
    actualStayMinutes: number | null = null
  ) => {
    if (visitSavingStopId) {
      return false;
    }

    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return false;
    }

    const isActiveRouteDay = routeDay.id === activeDayId;
    const sourceStops = isActiveRouteDay ? orderedStops : routeDay.stops;
    const visitedAt = new Date().toISOString();
    const nextVerificationStatus: RouteStopVerificationStatus = nextVisited
      ? (verification?.status ?? "MANUAL")
      : "NONE";
    const isGpsPhotoVerified = nextVerificationStatus === "GPS_PHOTO";
    const isGpsVerified =
      nextVerificationStatus === "GPS" || isGpsPhotoVerified;
    const hasPhotoRecord = nextVisited && Boolean(verification?.photoUrl);
    const optimisticStops: MyRouteStop[] = sourceStops.map((currentStop) =>
      currentStop.id === stop.id
        ? {
            ...currentStop,
            visitStatus: nextVisited ? "VISITED" : "PENDING",
            visitedAt: nextVisited ? visitedAt : null,
            verificationStatus: nextVerificationStatus,
            verifiedAt: isGpsVerified ? visitedAt : null,
            verificationPhotoImageId: isGpsPhotoVerified || hasPhotoRecord
              ? (verification?.photoImageId ?? null)
              : null,
            verificationPhotoUrl: isGpsPhotoVerified || hasPhotoRecord
              ? (verification?.photoUrl ?? null)
              : null,
            verificationLat: isGpsVerified ? (verification?.lat ?? null) : null,
            verificationLng: isGpsVerified ? (verification?.lng ?? null) : null,
            verificationAccuracyMeters: isGpsVerified
              ? (verification?.accuracyMeters ?? null)
              : null,
            checkedInAt: isGpsVerified
              ? (currentStop.checkedInAt ?? visitedAt)
              : null,
            checkedOutAt: null,
            actualStayMinutes: nextVisited ? actualStayMinutes : null,
          }
        : currentStop
    );

    try {
      await visitMutation.mutateAsync({
        arrivalTransition: createVisitArrivalTransition(
          stop.id,
          visitedAt,
          nextVisited
        ),
        routeDay,
        stop,
        nextVisited,
        verification,
        actualStayMinutes,
        isActiveRouteDay,
        sourceStops,
        previousStops: orderedStops,
        wasDayCompleted:
          sourceStops.length > 0 &&
          sourceStops.filter(isVisitedStop).length === sourceStops.length,
        visitedAt,
        nextVerificationStatus,
        isGpsVerified,
        isGpsPhotoVerified,
        hasPhotoRecord,
        optimisticStops,
      });
      return true;
    } catch {
      return false;
    }
  };

  const completeStopVisitWithPhoto = (
    target: VisitCompletionTarget,
    source: VisitPhotoSource
  ) => {
    if (visitSavingStopId) {
      return;
    }

    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return;
    }

    photoMutation.mutate({ target, source });
  };

  const completeStopVisitWithGps = (target: VisitCompletionTarget) => {
    if (visitSavingStopId || isRetrospectiveCompletion) {
      return;
    }

    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return;
    }

    gpsMutation.mutate(target);
  };

  const saveActualStayMinutes = async (
    target: ActualStayMinutesTarget,
    actualStayMinutes: number | null
  ) => {
    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return false;
    }

    if (target.stop.checkedInAt) {
      const visitedAt = new Date().toISOString();

      try {
        await completeVisitMutation.mutateAsync({
          arrivalTransition: createVisitArrivalTransition(
            target.stop.id,
            visitedAt,
            true
          ),
          target,
          actualStayMinutes,
        });
        return true;
      } catch {
        return false;
      }
    }

    const isSaved = await persistStopVisit(
      target.routeDay,
      target.stop,
      true,
      target.verification ?? { status: "MANUAL" },
      actualStayMinutes
    );

    if (isSaved) {
      setActualStayMinutesTarget(null);
    }

    return isSaved;
  };

  const cancelStopCheckIn = async (target: ActualStayMinutesTarget) => {
    const isSaved = await persistStopVisit(
      target.routeDay,
      target.stop,
      false
    );

    if (isSaved) {
      setActualStayMinutesTarget(null);
    }

    return isSaved;
  };

  const setPhotoPublication = (
    target: PhotoPublicationTarget,
    published: boolean
  ) => {
    if (visitSavingStopId) {
      return;
    }

    photoPublicationMutation.mutate({ target, published });
  };

  const deleteVerificationPhoto = (
    target: VerificationPhotoPreviewTarget
  ) => {
    if (visitSavingStopId) {
      return;
    }

    deletePhotoMutation.mutate(target);
  };

  const replaceVerificationPhoto = (
    target: VerificationPhotoPreviewTarget
  ) => {
    if (visitSavingStopId) {
      return;
    }

    replacePhotoMutation.mutate(target);
  };

  const updateVisitTimes = async (
    target: VisitTimesEditTarget,
    checkedInAt: string,
    checkedOutAt: string | null
  ) => {
    if (visitSavingStopId) {
      return false;
    }

    try {
      await updateVisitTimesMutation.mutateAsync({
        target,
        checkedInAt,
        checkedOutAt,
      });
      return true;
    } catch {
      return false;
    }
  };

  return {
    cancelStopCheckIn,
    completeStopVisitWithGps,
    completeStopVisitWithPhoto,
    persistStopVisit,
    saveActualStayMinutes,
    setPhotoPublication,
    deleteVerificationPhoto,
    replaceVerificationPhoto,
    updateVisitTimes,
    visitSavingStopId,
  };
}
