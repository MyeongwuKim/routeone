/**
 * 용도:
 * 장소의 도착 인증, 방문 완료, 사진·머문 시간 수정 상태를 저장한다.
 *
 * 동작 방식:
 * 방문 저장의 알림 준비·실패 복구·잠금은 routeVisitArrivalTransition에 맡긴다.
 * 이 Hook은 낙관적 상태와 API 확정 결과를 목록·캐시·입력창에 반영한 뒤 최종 알림을 요청한다.
 * 저장 여부와 네이티브가 알려준 진행 단계를 입력창과 장소 카드에 전달한다.
 * 요청을 시작한 인증 세션이 바뀌면 후속 요청과 캐시·화면·알림 반영을 중단한다.
 * 일반 확정 실패는 이전 대상으로, 방문 충돌은 최신 서버 대상으로 알림을 맞춘다.
 * 결과가 불명확하면 재조회로 확정될 때까지 두 대상을 유지한다.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import { createAuthSessionRequest, type AuthSessionRequest } from "@/lib/authToken";
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
  createRouteVisitArrivalTransition,
  syncRouteVisitArrivalTarget,
  type RouteVisitArrivalTransition,
} from "../services/routeVisitArrivalTransition";
import { isRouteArrivalTransitionLocked } from "../services/routeArrivalTransitionLock";
import { isRouteStopVisitConflict } from "../services/routeArrivalMutationRecovery";
import type {
  ActualStayMinutesTarget,
  PhotoPublicationTarget,
  VerificationPhotoPreviewTarget,
  VisitCompletionTarget,
  VisitTimesEditTarget,
} from "../models/dayRouteDialogTypes";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
import { isVisitedStop, isResolvedStop } from "../routeDisplay";
import {
  useRouteVisitProgress,
  type RouteVisitProgressOperation,
} from "./useRouteVisitProgress";

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

type PersistVisitVariables = {
  session: AuthSessionRequest;
  arrivalTransition: RouteVisitArrivalTransition | null;
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
  session: AuthSessionRequest;
  target: VisitCompletionTarget;
  source: VisitPhotoSource;
};

type CheckInVariables = {
  session: AuthSessionRequest;
  target: VisitCompletionTarget;
  verification: RouteStopVisitVerificationInput;
};

type CompleteVisitVariables = {
  session: AuthSessionRequest;
  arrivalTransition: RouteVisitArrivalTransition;
  target: ActualStayMinutesTarget;
  actualStayMinutes: number | null;
};

type PhotoPublicationVariables = {
  session: AuthSessionRequest;
  target: PhotoPublicationTarget;
  published: boolean;
};

type VisitTargetVariables = { session: AuthSessionRequest; target: VisitCompletionTarget };
type ReplaceVisitPhotoVariables = { session: AuthSessionRequest; target: VerificationPhotoPreviewTarget };

type UpdateVisitTimesVariables = {
  session: AuthSessionRequest;
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
  const { progress: visitProgress, begin: beginVisitProgress } =
    useRouteVisitProgress();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const showToast = useUiToastStore((state) => state.showToast);
  const getRouteArrivalEnabled = () =>
    queryClient.getQueryData<NotificationSettingsQuery>(
      NOTIFICATION_SETTINGS_QUERY_KEY
    )?.notificationSettings.routeArrivalEnabled;
  const arrivalContext = {
    routeId,
    language: appLanguage,
    getRoutes: () => queryClient.getQueryData<MyRoutesQuery>(
      MY_ROUTES_QUERY_KEY
    )?.myRoutes,
    getRouteArrivalEnabled,
  };
  const createVisitArrivalTransition = (
    stopId: string,
    visitedAt: string,
    nextVisited: boolean,
    operation: RouteVisitProgressOperation,
    session: AuthSessionRequest
  ) => createRouteVisitArrivalTransition({
    ...arrivalContext,
    route,
    routeId,
    stopId,
    visitedAt,
    nextVisited,
    operation,
    beginProgress: beginVisitProgress,
    session,
  });
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
  /** 충돌로 거절된 요청은 다시 보내지 않고 목록·상세·기록에서 서버의 최신 상태를 읽는다. */
  const refreshOnVisitConflict = (error: unknown) => {
    if (!isRouteStopVisitConflict(error)) return;
    for (const key of [MY_ROUTES_QUERY_KEY, MY_ROUTE_HISTORY_QUERY_KEY, ["route-detail", routeId],
      ["shared-routes"], ["liked-shared-routes"], ["place-photos"], ["place-stay-summary"]]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
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
    mutationFn: ({ target, verification, session }: CheckInVariables) => {
      session.assertCurrent();
      return routeApi.checkInRouteStop(target.stop.id, verification);
    },
    onSuccess: (result, variables) => {
      if (!variables.session.isCurrent()) return;
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
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "도착 인증을 저장하지 못했어요.",
        2600
      );
    },
  });
  const completeVisitMutation = useMutation({
    mutationFn: ({
      arrivalTransition,
      target,
      actualStayMinutes,
      session,
    }: CompleteVisitVariables) => {
      session.assertCurrent();
      return arrivalTransition.execute(
        () => routeApi.completeRouteStopVisit(target.stop.id, actualStayMinutes),
        (recoveredRoute) => ({ completeRouteStopVisit: recoveredRoute }),
        arrivalContext
      );
    },
    onSuccess: async (data, variables) => {
      if (!variables.session.isCurrent()) return;
      variables.arrivalTransition.markSaved();
      const previousStops =
        variables.target.routeDay.id === activeDayId
          ? orderedStops
          : variables.target.routeDay.stops;
      const wasDayCompleted =
        previousStops.length > 0 &&
        previousStops.every(isResolvedStop);
      const nextStops = applyRouteResult(
        data.completeRouteStopVisit,
        variables.target
      );
      const nextIsDayCompleted =
        nextStops.length > 0 &&
        nextStops.every(isResolvedStop);
      const isRouteCompleted = Boolean(
        data.completeRouteStopVisit.completedAt
      );
      const successMessage =
        isRouteCompleted
          ? "전체 루트를 완료했어요!"
          : !wasDayCompleted && nextIsDayCompleted
          ? `DAY ${variables.target.routeDay.dayIndex} 클리어`
          : "방문을 완료했어요.";

      setActualStayMinutesTarget(null);
      showToast(successMessage, isRouteCompleted ? 3200 : undefined);

      const arrivalSyncError = await variables.arrivalTransition.syncSavedRoute(
        data.completeRouteStopVisit,
        arrivalContext
      );

      if (!variables.session.isCurrent()) return;
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
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
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
      variables.arrivalTransition.finish();
    },
  });
  const visitMutation = useMutation({
    mutationFn: async ({
      arrivalTransition,
      stop,
      nextVisited,
      verification,
      actualStayMinutes,
      session,
    }: PersistVisitVariables) => {
      session.assertCurrent();
      const save = () => routeApi.markRouteStopVisited(
        stop.id,
        nextVisited,
        nextVisited ? verification : null,
        nextVisited ? actualStayMinutes : null
      );
      return arrivalTransition
        ? arrivalTransition.execute(
            save,
            (recoveredRoute) => ({ markRouteStopVisited: recoveredRoute }),
            arrivalContext
          )
        : save();
    },
    onMutate: async (variables) => {
      variables.session.assertCurrent();
      if (variables.isActiveRouteDay) {
        setOrderedStops(variables.optimisticStops);
      }

      await queryClient.cancelQueries({
        queryKey: MY_ROUTES_QUERY_KEY,
      });
      variables.session.assertCurrent();
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
    onSuccess: async (data, variables) => {
      if (!variables.session.isCurrent()) return;
      variables.arrivalTransition?.markSaved();
      const nextDay = data.markRouteStopVisited.days.find(
        (candidateDay) => candidateDay.id === variables.routeDay.id
      );
      const nextStops = nextDay?.stops ?? variables.sourceStops;
      const nextIsDayCompleted =
        nextStops.length > 0 && nextStops.every(isResolvedStop);
      const isRouteCompleted =
        variables.nextVisited && Boolean(data.markRouteStopVisited.completedAt);

      if (variables.isActiveRouteDay) {
        setOrderedStops(nextStops);
        setBaseStopIds(nextStops.map((nextStop) => nextStop.id));
      }

      const successMessage =
        isRouteCompleted
          ? "전체 루트를 완료했어요!"
          : !variables.wasDayCompleted && nextIsDayCompleted
          ? `DAY ${variables.routeDay.dayIndex} 클리어`
            : variables.nextVisited
              ? variables.isGpsPhotoVerified
              ? "사진 인증 완료 처리했어요."
              : variables.isGpsVerified
                ? "GPS 인증 완료 처리했어요."
                : variables.hasPhotoRecord
                  ? "사진 기록으로 완료 처리했어요."
                  : "장소를 완료 처리했어요."
            : isVisitedStop(variables.stop)
              ? "방문 완료를 취소했어요."
              : variables.stop.checkedInAt
                ? "도착 인증을 취소했어요."
                : "완료를 취소했어요.";

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, data.markRouteStopVisited)
      );
      showToast(successMessage, isRouteCompleted ? 3200 : undefined);

      const arrivalSyncError = variables.arrivalTransition
        ? await variables.arrivalTransition.syncSavedRoute(
            data.markRouteStopVisited,
            arrivalContext
          )
        : await syncRouteVisitArrivalTarget(data.markRouteStopVisited, arrivalContext, variables.session);
      if (!variables.session.isCurrent()) return;
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
      if (!variables.session.isCurrent()) return;
      if (context?.previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          context.previousRoutes
        );
      }
      if (variables.isActiveRouteDay) {
        setOrderedStops(variables.previousStops);
      }
      refreshOnVisitConflict(error);
      showToast(
        variables.arrivalTransition?.isApiOutcomeUnresolved
          ? variables.nextVisited
            ? "방문 완료 여부를 확인 중이에요. 현재·다음 장소 알림은 그대로 유지돼요."
            : isVisitedStop(variables.stop)
              ? "방문 완료 취소 여부를 확인 중이에요. 도착 알림은 그대로 유지돼요."
              : "도착 인증 취소 여부를 확인 중이에요. 도착 알림은 그대로 유지돼요."
          : error instanceof Error
            ? error.message
            : "완료 상태를 바꾸지 못했어요.",
        variables.arrivalTransition?.isApiOutcomeUnresolved ? 4200 : 2600
      );
    },
    onSettled: (_data, _error, variables) => {
      variables.arrivalTransition?.finish();
    },
  });
  const photoMutation = useMutation({
    mutationFn: async ({ target, source, session }: PrepareVisitPhotoVariables) => {
      session.assertCurrent();
      const verificationStatus = getVisitPhotoVerificationStatus(
        source,
        isRetrospectiveCompletion
      );
      const position =
        verificationStatus === "GPS_PHOTO"
          ? await requestVisitVerificationPosition(target.stop.place)
          : null;

      session.assertCurrent();
      const photo = await requestVisitPhoto(source);
      session.assertCurrent();
      const uploadPayload = await routeApi.createRouteStopVisitPhotoUpload(
        target.stop.id
      );
      session.assertCurrent();
      const photoUrl = await uploadVerifiedVisitPhoto(
        uploadPayload.createRouteStopVisitPhotoUpload,
        photo,
        session.assertCurrent
      );

      session.assertCurrent();
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
    onSuccess: (target, variables) => {
      if (!variables.session.isCurrent()) return;
      if (target.verification.status === "MANUAL") {
        setActualStayMinutesTarget(target);
        setVisitCompletionTarget(null);
        return;
      }

      checkInMutation.mutate({
        target,
        verification: target.verification,
        session: variables.session,
      });
    },
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "사진 인증을 완료하지 못했어요.",
        2600
      );
    },
  });
  const gpsMutation = useMutation({
    mutationFn: async ({ target, session }: VisitTargetVariables) => {
      session.assertCurrent();
      const position = await requestVisitVerificationPosition(target.stop.place);
      session.assertCurrent();

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
    onSuccess: (target, variables) => {
      if (!variables.session.isCurrent()) return;
      checkInMutation.mutate({
        target,
        verification: target.verification,
        session: variables.session,
      });
    },
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "GPS 인증을 완료하지 못했어요.",
        2600
      );
    },
  });
  const photoPublicationMutation = useMutation({
    mutationFn: ({ target, published, session }: PhotoPublicationVariables) => {
      session.assertCurrent();
      return routeApi.setRouteStopPhotoPublication(target.stop.id, published);
    },
    onSuccess: (result, variables) => {
      if (!variables.session.isCurrent()) return;
      applyRouteResult(
        result.setRouteStopPhotoPublication,
        variables.target
      );
      setPhotoPublicationTarget(null);
      setVerificationPhotoPreviewTarget(null);
      invalidatePlaceVisitQueries(variables.target.stop);
      showToast(
        variables.published
          ? "사진 공개 검토를 요청했어요. 승인되면 다른 사용자에게 표시돼요."
          : "사진 공개를 취소했어요."
      );
    },
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "사진 공개 설정을 바꾸지 못했어요.",
        2600
      );
    },
  });
  const replacePhotoMutation = useMutation({
    mutationFn: async ({ target, session }: ReplaceVisitPhotoVariables) => {
      session.assertCurrent();
      const photo = await requestVisitPhoto("library");
      session.assertCurrent();
      const uploadPayload = await routeApi.createRouteStopVisitPhotoUpload(
        target.stop.id
      );
      session.assertCurrent();
      const photoUrl = await uploadVerifiedVisitPhoto(
        uploadPayload.createRouteStopVisitPhotoUpload,
        photo,
        session.assertCurrent
      );

      session.assertCurrent();
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
    onSuccess: (nextRoute, { target, session }) => {
      if (!session.isCurrent()) return;
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
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "사진 기록을 저장하지 못했어요.",
        2600
      );
    },
  });
  const deletePhotoMutation = useMutation({
    mutationFn: ({ target, session }: ReplaceVisitPhotoVariables) => {
      session.assertCurrent();
      return routeApi.deleteRouteStopVisitPhoto(target.stop.id);
    },
    onSuccess: (result, { target, session }) => {
      if (!session.isCurrent()) return;
      applyRouteResult(result.deleteRouteStopVisitPhoto, target);
      setPhotoPublicationTarget(null);
      setVerificationPhotoPreviewTarget(null);
      invalidatePlaceVisitQueries(target.stop);
      showToast("인증 사진을 삭제했어요. 방문 기록은 유지돼요.");
    },
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "인증 사진을 삭제하지 못했어요.",
        2600
      );
    },
  });
  const updateVisitTimesMutation = useMutation({
    mutationFn: ({ target, checkedInAt, checkedOutAt, session }: UpdateVisitTimesVariables) => {
      session.assertCurrent();
      return routeApi.updateRouteStopVisitTimes({
        stopId: target.stop.id,
        checkedInAt,
        checkedOutAt,
      });
    },
    onSuccess: (result, variables) => {
      if (!variables.session.isCurrent()) return;
      applyRouteResult(result.updateRouteStopVisitTimes, variables.target);
      setVisitTimesEditTarget(null);
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
      invalidatePlaceVisitQueries(variables.target.stop);
      showToast("방문시간을 수정했어요.");
    },
    onError: (error, variables) => {
      if (!variables.session.isCurrent()) return;
      refreshOnVisitConflict(error);
      showToast(
        error instanceof Error
          ? error.message
          : "방문시간을 수정하지 못했어요.",
        2600
      );
    },
  });
  const visitSavingStopId = replacePhotoMutation.isPending
    ? (replacePhotoMutation.variables?.target.stop.id ?? null)
    : photoMutation.isPending
    ? (photoMutation.variables?.target.stop.id ?? null)
    : gpsMutation.isPending
      ? (gpsMutation.variables?.target.stop.id ?? null)
      : checkInMutation.isPending
        ? (checkInMutation.variables?.target.stop.id ?? null)
        : completeVisitMutation.isPending
          ? (completeVisitMutation.variables?.target.stop.id ?? null)
          : visitMutation.isPending
            ? (visitMutation.variables?.stop.id ?? null)
            : photoPublicationMutation.isPending
              ? (photoPublicationMutation.variables?.target.stop.id ?? null)
              : deletePhotoMutation.isPending
                ? (deletePhotoMutation.variables?.target.stop.id ?? null)
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
    const session = createAuthSessionRequest();
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
          nextVisited,
          nextVisited
            ? "complete"
            : isVisitedStop(stop)
              ? "cancel-completion"
              : "cancel-arrival",
          session
        ),
        session,
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
          sourceStops.every(isResolvedStop),
        visitedAt,
        nextVerificationStatus,
        isGpsVerified,
        isGpsPhotoVerified,
        hasPhotoRecord,
        optimisticStops,
      });
      return session.isCurrent();
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

    photoMutation.mutate({ target, source, session: createAuthSessionRequest() });
  };

  const completeStopVisitWithGps = (target: VisitCompletionTarget) => {
    if (visitSavingStopId || isRetrospectiveCompletion) {
      return;
    }

    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return;
    }

    gpsMutation.mutate({ target, session: createAuthSessionRequest() });
  };

  const saveActualStayMinutes = async (
    target: ActualStayMinutesTarget,
    actualStayMinutes: number | null
  ) => {
    if (isRouteArrivalTransitionLocked()) {
      showToast("이전 방문 완료 여부를 확인하고 있어요.", 2600);
      return false;
    }

    const session = createAuthSessionRequest();
    if (target.stop.checkedInAt) {
      const visitedAt = new Date().toISOString();

      try {
        await completeVisitMutation.mutateAsync({
          arrivalTransition: createVisitArrivalTransition(
            target.stop.id,
            visitedAt,
            true,
            "complete",
            session
          ),
          session,
          target,
          actualStayMinutes,
        });
        return session.isCurrent();
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

    if (isSaved && session.isCurrent()) {
      setActualStayMinutesTarget(null);
    }

    return isSaved;
  };

  const cancelStopCheckIn = async (target: ActualStayMinutesTarget) => {
    const session = createAuthSessionRequest();
    const isSaved = await persistStopVisit(
      target.routeDay,
      target.stop,
      false
    );

    if (isSaved && session.isCurrent()) {
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

    photoPublicationMutation.mutate({ target, published, session: createAuthSessionRequest() });
  };

  const deleteVerificationPhoto = (
    target: VerificationPhotoPreviewTarget
  ) => {
    if (visitSavingStopId) {
      return;
    }

    deletePhotoMutation.mutate({ target, session: createAuthSessionRequest() });
  };

  const replaceVerificationPhoto = (
    target: VerificationPhotoPreviewTarget
  ) => {
    if (visitSavingStopId) {
      return;
    }

    replacePhotoMutation.mutate({ target, session: createAuthSessionRequest() });
  };

  const updateVisitTimes = async (
    target: VisitTimesEditTarget,
    checkedInAt: string,
    checkedOutAt: string | null
  ) => {
    const session = createAuthSessionRequest();
    if (visitSavingStopId) {
      return false;
    }

    try {
      await updateVisitTimesMutation.mutateAsync({
        session,
        target,
        checkedInAt,
        checkedOutAt,
      });
      return session.isCurrent();
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
    visitProgress,
  };
}
