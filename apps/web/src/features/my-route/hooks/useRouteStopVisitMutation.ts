import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "react";
import { routeApi } from "@/api/routeApi";
import type {
  MyRoutesQuery,
  RouteStopVerificationStatus,
  RouteStopVisitVerificationInput,
} from "@/generated/graphql";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  optimisticVisitRouteStopCache,
  upsertMyRouteCache,
} from "../myRouteCache";
import { cacheRouteStopVerificationPhotoDataUrl } from "../routeCompletionPoster";
import {
  assertVisitPositionNearPlace,
  requestCurrentPosition,
  requestVisitPhoto,
  uploadVerifiedVisitPhoto,
  type VisitPhotoSource,
} from "../services/visitPhotoService";
import type {
  ActualStayMinutesTarget,
  VisitCompletionTarget,
} from "../models/dayRouteDialogTypes";
import type { MyRouteDay, MyRouteStop } from "../types";
import { isVisitedStop } from "../routeDisplay";

type UseRouteStopVisitMutationOptions = {
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
};

type PersistVisitVariables = {
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

export function useRouteStopVisitMutation({
  routeId,
  activeDayId,
  orderedStops,
  isRetrospectiveCompletion,
  setOrderedStops,
  setBaseStopIds,
  setVisitCompletionTarget,
  setActualStayMinutesTarget,
}: UseRouteStopVisitMutationOptions) {
  const queryClient = useQueryClient();
  const showToast = useUiToastStore((state) => state.showToast);
  const visitMutation = useMutation({
    mutationFn: ({
      stop,
      nextVisited,
      verification,
      actualStayMinutes,
    }: PersistVisitVariables) =>
      routeApi.markRouteStopVisited(
        stop.id,
        nextVisited,
        nextVisited ? verification : null,
        nextVisited ? actualStayMinutes : null
      ),
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
    onSuccess: (result, variables) => {
      const nextDay = result.markRouteStopVisited.days.find(
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

      if (!variables.wasDayCompleted && nextIsDayCompleted) {
        showToast(`DAY ${variables.routeDay.dayIndex} 클리어`);
      } else {
        showToast(
          variables.nextVisited
            ? variables.isGpsPhotoVerified
              ? "사진 인증 완료 처리했어요."
              : variables.isGpsVerified
                ? "GPS 인증 완료 처리했어요."
              : variables.hasPhotoRecord
                ? "사진 기록으로 완료 처리했어요."
                : "장소를 완료 처리했어요."
            : "완료를 취소했어요."
        );
      }

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.markRouteStopVisited)
      );
      void queryClient.invalidateQueries({
        queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
      });
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
        error instanceof Error ? error.message : "완료 상태를 바꾸지 못했어요.",
        2600
      );
    },
  });
  const photoMutation = useMutation({
    mutationFn: async ({ target, source }: PrepareVisitPhotoVariables) => {
      const position = isRetrospectiveCompletion
        ? null
        : await requestCurrentPosition();

      if (position) {
        assertVisitPositionNearPlace(position, target.stop.place);
      }

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

      if (isRetrospectiveCompletion) {
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
      setActualStayMinutesTarget(target);
      setVisitCompletionTarget(null);
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
      const position = await requestCurrentPosition();

      assertVisitPositionNearPlace(position, target.stop.place);

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
      setActualStayMinutesTarget(target);
      setVisitCompletionTarget(null);
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
  const visitSavingStopId = photoMutation.isPending
    ? (photoMutation.variables?.target.stop.id ?? null)
    : gpsMutation.isPending
      ? (gpsMutation.variables?.stop.id ?? null)
    : visitMutation.isPending
      ? (visitMutation.variables?.stop.id ?? null)
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

  const completeStopVisitManually = async (target: VisitCompletionTarget) => {
    const isSaved = await persistStopVisit(
      target.routeDay,
      target.stop,
      true,
      { status: "MANUAL" }
    );

    if (isSaved) {
      setVisitCompletionTarget(null);
    }
  };

  const completeStopVisitWithPhoto = (
    target: VisitCompletionTarget,
    source: VisitPhotoSource
  ) => {
    if (visitSavingStopId) {
      return;
    }

    photoMutation.mutate({ target, source });
  };

  const completeStopVisitWithGps = (target: VisitCompletionTarget) => {
    if (visitSavingStopId || isRetrospectiveCompletion) {
      return;
    }

    gpsMutation.mutate(target);
  };

  const saveActualStayMinutes = async (
    target: ActualStayMinutesTarget,
    actualStayMinutes: number | null
  ) => {
    const isSaved = await persistStopVisit(
      target.routeDay,
      target.stop,
      true,
      target.verification,
      actualStayMinutes
    );

    if (isSaved) {
      setActualStayMinutesTarget(null);
    }
  };

  return {
    completeStopVisitManually,
    completeStopVisitWithGps,
    completeStopVisitWithPhoto,
    persistStopVisit,
    saveActualStayMinutes,
    visitSavingStopId,
  };
}
