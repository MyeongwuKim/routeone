/**
 * DAY 상세 팝업의 일정 표시와 편집, 방문 완료·사진, 길찾기, 공유·삭제 동작을 조합한다.
 * 선택·팝업 표시는 reducer 훅에, 일정 draft는 편집 세션 훅에 맡긴다.
 * 서버 변경과 지도·권한·GPS 테스트 흐름은 책임별 훅과 Service에 위임한다.
 */
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { getCurrentPosition } from "@/lib/currentPosition";
import { useUiText } from "@/lib/uiText";
import {
  addDaysToDateKey,
  getDateKeyDiffInDays,
  getDayDateLabel,
  getRouteDateKey,
  getSortedRouteDays,
  getTodayDateKey,
  isVisitedStop,
  isSkippedStop,
  isResolvedStop,
} from "../routeDisplay";
import type { MyRouteDay, MyRouteStop } from "../types";
import {
  createMapSheetPlaceFromRouteStop,
  createPlannedRouteDay,
} from "../adapters/dayRouteAdapters";
import type {
  ActualStayMinutesTarget,
  DayStartTimeTarget,
  VisitCompletionTarget,
} from "../models/dayRouteDialogTypes";
import type { DayRoutePopupProps } from "../models/dayRoutePopupTypes";
import {
  getLocalizedDayDateLabel,
  getLocalizedRouteTitle,
} from "../utils/dayRouteFormatting";
import { getDayRouteStartLocation } from "../utils/dayRouteStartLocation";
import { useDayRouteTravelSegments } from "./useDayRouteTravelSegments";
import { useDayRouteGpsTest } from "./useDayRouteGpsTest";
import { useDayRoutePopupState } from "./useDayRoutePopupState";
import { useDayRouteLayoutEditor } from "./useDayRouteLayoutEditor";
import { useRouteStopStayMutation } from "./useRouteStopStayMutation";
import { useRouteShareMutation } from "./useRouteShareMutation";
import { useRouteStartDateMutation } from "./useRouteStartDateMutation";
import { useRouteStopVisitMutation } from "./useRouteStopVisitMutation";
import { useRouteSkippingMutation } from "./useRouteSkippingMutation";
import { useRouteDayStartMutation } from "./useRouteDayStartMutation";
import {
  isVisitVerificationBypassEnabled,
} from "../services/visitPhotoService";

/**
 * route와 선택 day를 화면 모델로 만들고 편집 가능 여부에 따라 공개 동작을 제한한다.
 * 순서 편집은 draft에서 수행한 뒤 명시적으로 저장하며, 방문 처리는 인증·위치·사진 검증과
 * 도착 알림 전환을 거쳐 서버 결과가 확인된 경우에만 관련 상태와 캐시를 갱신한다.
 */
export function useDayRoutePopupController({
  route,
  day,
  focusedStopId = null,
  onClose,
  isReadOnly = false,
  allowVisitCompletion = false,
  visitCompletionMode = "live",
  headerLabel = "MY ROUTE",
  headerBadge,
  headerIdentity,
  headerTitle,
  headerMeta,
  enableStartPreview = false,
  enableVerificationPhotoPreview = false,
  onRequestPlaceRouteFilter,
  onRequestCheckout,
  onRequestStartRoute,
  isRouteStartPending = false,
  readOnlyFooterAction,
  readOnlyPosterAction,
}: DayRoutePopupProps) {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const navigate = useNavigate();
  const openModal = useUiModalStore((state) => state.openModal);
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
  const {
    isGpsTestEnabled,
    indoorTestTarget,
    gpsTestTarget,
    gpsTestLocationStopId,
    gpsTestLocation,
    isGpsTestApplying,
    setGpsTestTarget,
    openIndoorTest,
    handleApplyGpsTestLocation,
    handleClearGpsTestLocation,
  } = useDayRouteGpsTest({ route, isReadOnly, visitCompletionMode });
  const [dayStartTimeTarget, setDayStartTimeTarget] =
    useState<DayStartTimeTarget | null>(null);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const {
    activeDayId,
    expandedDayIds,
    mapTargetDayId,
    stayMinutesEditTarget,
    visitCompletionTarget,
    visitTimesEditTarget,
    verificationPhotoPreviewTarget,
    photoPublicationTarget,
    actualStayMinutesTarget,
    earlyRouteCompletionTarget,
    orderedStops,
    setActiveDayId,
    setExpandedDayIds,
    setMapTargetDayId,
    setStayMinutesEditTarget,
    setVisitCompletionTarget,
    setVisitTimesEditTarget,
    setVerificationPhotoPreviewTarget,
    setPhotoPublicationTarget,
    setActualStayMinutesTarget,
    setEarlyRouteCompletionTarget,
    setOrderedStops,
    setBaseStopIds,
    resetDayEditorState,
  } = useDayRoutePopupState(day);
  const activeDay =
    sortedDays.find((routeDay) => routeDay.id === activeDayId) ?? day;
  /** 요청 완료 시점의 선택 DAY를 사용해 이전 DAY에서 시작한 응답이 현재 장소 목록을 덮지 않게 한다. */
  const activeDayIdRef = useRef(activeDay.id);
  const syncedServerDayRef = useRef({ id: activeDay.id, stops: activeDay.stops });
  useLayoutEffect(() => {
    activeDayIdRef.current = activeDay.id;
  }, [activeDay.id]);

  const {
    isOrderEditing,
    isOrderDirty,
    isSavingOrder,
    visibleDays,
    displayedStopsByDayId,
    activeDropTarget,
    draggedStop,
    registerDropZone,
    resetDropZones,
    startDragStop,
    stopCurrentDrag,
    startLocationPickerTarget,
    canEditStartLocation,
    isUpdatingRouteStartLocation,
    openStartLocationPicker,
    closeStartLocationPicker,
    handleApplyStartLocation,
    beginEditing,
    cancelEditing: handleCancelOrderEditing,
    saveEditing: handleSaveOrder,
    moveStopToDay,
    removeStop: handleRemoveStopFromLayout,
    changeDraftStayMinutes,
    deleteDay,
  } = useDayRouteLayoutEditor({
    route,
    days: sortedDays,
    activeDayId: activeDay.id,
    orderedStops,
    isReadOnly,
    onSaved: (nextRoute) => {
      const nextDays = getSortedRouteDays(nextRoute);
      const nextActiveDay =
        nextDays.find((routeDay) => routeDay.id === activeDayIdRef.current) ??
        nextDays[0];
      if (nextActiveDay) {
        setActiveDayId(nextActiveDay.id);
        setOrderedStops(nextActiveDay.stops);
        setBaseStopIds(nextActiveDay.stops.map((stop) => stop.id));
        setExpandedDayIds(new Set([nextActiveDay.id]));
      }
    },
  });

  // 결과 불명 요청을 서버 재조회로 복구한 경우에도 화면의 오래된 방문 상태를 교체한다.
  // 순서 편집 중의 장소 배치·체류시간 draft는 유지하고, 편집을 끝내면 최신 서버 DAY로 돌아간다.
  useLayoutEffect(() => {
    const previousDay = syncedServerDayRef.current;
    if (isOrderEditing ||
      (previousDay.id === activeDay.id && previousDay.stops === activeDay.stops)) return;
    syncedServerDayRef.current = { id: activeDay.id, stops: activeDay.stops };
    setOrderedStops(activeDay.stops);
    setBaseStopIds(activeDay.stops.map((stop) => stop.id));
  }, [activeDay.id, activeDay.stops, isOrderEditing, setOrderedStops, setBaseStopIds]);
  const resetDayEditor = (nextDay: MyRouteDay) => {
    activeDayIdRef.current = nextDay.id;
    resetDropZones();
    resetDayEditorState(nextDay);
    stopCurrentDrag();
  };
  const travelSegmentByKey = useDayRouteTravelSegments({
    language: appLanguage,
    days: visibleDays,
    activeDayId: activeDay.id,
    orderedStops,
    stopsByDayId: isOrderEditing ? displayedStopsByDayId : undefined,
    routeStartLocation: route.startLocation,
  });
  const routeStopCount = visibleDays.reduce((total, routeDay) => {
    return total + (displayedStopsByDayId[routeDay.id]?.length ?? 0);
  }, 0);
  const routeCompletedStopCount = visibleDays.reduce((total, routeDay) => {
    return (
      total +
      (displayedStopsByDayId[routeDay.id] ?? []).filter(isVisitedStop).length
    );
  }, 0);
  const routeSkippedStopCount = visibleDays.reduce((total, routeDay) =>
    total + (displayedStopsByDayId[routeDay.id] ?? []).filter(isSkippedStop).length, 0);
  const todayKey = getTodayDateKey();
  const {
    changeStayMinutes: persistStayMinutes,
    staySavingStopId,
  } = useRouteStopStayMutation({
    routeId: route.id,
    activeDayId: activeDay.id,
    orderedStops,
    isOrderEditing,
    setOrderedStops,
  });
  const { isSharingRoute, shareRoute } = useRouteShareMutation(route.id);
  const [shareConfirmationRouteId, setShareConfirmationRouteId] = useState<string | null>(null);
  const { isUpdatingRouteDayStart, updateRouteDayStart } =
    useRouteDayStartMutation();
  const { isUpdatingRouteStartDate, updateRouteStartDate } =
    useRouteStartDateMutation(route.id);
  const isRetrospectiveCompletion = visitCompletionMode === "retrospective";
  const isVerificationBypassEnabled = isVisitVerificationBypassEnabled();
  const {
    cancelStopCheckIn: handleCancelStopCheckIn,
    completeStopVisitWithGps: handleCompleteStopVisitWithGps,
    completeStopVisitWithPhoto: handleCompleteStopVisitWithPhoto,
    deleteVerificationPhoto: handleDeleteVerificationPhoto,
    replaceVerificationPhoto: handleReplaceVerificationPhoto,
    persistStopVisit,
    saveActualStayMinutes: handleSaveActualStayMinutes,
    setPhotoPublication: handleSetPhotoPublication,
    updateVisitTimes: handleUpdateVisitTimes,
    visitSavingStopId: visitMutationSavingStopId,
    visitProgress,
  } = useRouteStopVisitMutation({
    route,
    routeId: route.id,
    activeDayId: activeDay.id,
    orderedStops,
    isRetrospectiveCompletion,
    setOrderedStops,
    setBaseStopIds,
    setVisitCompletionTarget,
    setActualStayMinutesTarget,
    setPhotoPublicationTarget,
    setVerificationPhotoPreviewTarget,
    setVisitTimesEditTarget,
  });
  const { skipStop, finishDay, savingStopId: skippingStopId, isFinishingDay,
    pendingOperation: skippingOperation, isInFlight: isSkippingInFlight } = useRouteSkippingMutation({
    route,
    blocked: Boolean(visitMutationSavingStopId || staySavingStopId || isSavingOrder || isOrderEditing || isUpdatingRouteDayStart || isRouteStartPending || isUpdatingRouteStartDate),
    onSuccess: (nextRoute) => {
      const nextDay = nextRoute.days.find((item) => item.id === activeDayIdRef.current);
      if (nextDay) {
        setOrderedStops(nextDay.stops);
        setBaseStopIds(nextDay.stops.map((stop) => stop.id));
      }
    },
  });
  const visitSavingStopId = visitMutationSavingStopId ?? skippingStopId ??
    (isFinishingDay ? (activeDay.stops[0]?.id ?? "finishing-day") : null);
  /** 건너뛰기·취소·DAY 마무리의 저장·기기 알림 처리가 진행 중이면 팝업 닫기를 막는다. */
  const handleClose = () => {
    if (!isSkippingInFlight()) onClose();
  };
  const canToggleVisitStatus = !isReadOnly || allowVisitCompletion;
  const canToggleSkipStatus = route.isMine && canToggleVisitStatus;
  const canEditDayStartTime =
    route.isMine && (!isRetrospectiveCompletion || allowVisitCompletion);
  const isRouteCompleted =
    routeStopCount > 0 && routeCompletedStopCount + routeSkippedStopCount === routeStopCount;
  const todayRouteDay = visibleDays.find(
    (routeDay) => getRouteDateKey(routeDay.date) === todayKey
  );
  const firstUnstartedRouteDay = visibleDays.find(
    (routeDay) => !routeDay.startedAt
  );
  const routeActionDay = route.startedAt
    ? (todayRouteDay ??
      firstUnstartedRouteDay ??
      visibleDays.at(-1) ??
      activeDay)
    : (visibleDays[0] ?? activeDay);
  const routeActionDayStops = displayedStopsByDayId[routeActionDay.id] ?? [];
  const isRouteActionDayCompleted =
    routeActionDayStops.length > 0 &&
    routeActionDayStops.every(isResolvedStop);
  const routeActionDayDateKey = getRouteDateKey(routeActionDay.date);
  const isStartingRouteDay =
    isRouteStartPending || isUpdatingRouteDayStart;
  const canStartRouteActionDay =
    route.status !== "COMPLETED" &&
    !routeActionDay.startedAt &&
    !isStartingRouteDay &&
    (route.startedAt
      ? canEditDayStartTime &&
        Boolean(
          routeActionDayDateKey && routeActionDayDateKey <= todayKey
        )
      : Boolean(onRequestStartRoute));
  const visitEnabledDayIds = new Set(
    sortedDays
      .filter(
        (routeDay) =>
          isRetrospectiveCompletion ||
          isVerificationBypassEnabled ||
          (Boolean(route.startedAt) &&
            getRouteDateKey(routeDay.date) === todayKey)
      )
      .map((routeDay) => routeDay.id)
  );
  const routeActualStartDateKey = getRouteDateKey(route.startedAt) ?? todayKey;
  const earlyCompletionStartedAt =
    earlyRouteCompletionTarget?.startedAt || routeActualStartDateKey || todayKey;
  const earlyCompletionActualDays = Math.max(
    1,
    getDateKeyDiffInDays(todayKey, earlyCompletionStartedAt) + 1
  );
  const earlyCompletionExpectedEndDateKey = earlyCompletionStartedAt
    ? addDaysToDateKey(earlyCompletionStartedAt, route.tripDays - 1)
    : null;
  const isRouteShared = route.visibility === "PUBLIC" || Boolean(route.sharedAt);
  const shouldShowSharedStatusText = headerLabel === "MY ROUTE";
  const readOnlyActionDisabled =
    readOnlyFooterAction?.disabled ?? isSharingRoute;
  const readOnlyActionLabel =
    readOnlyFooterAction?.label ??
    (isSharingRoute
      ? text.dayRoute.sharing
      : isRouteShared
        ? text.dayRoute.shared
        : isRouteCompleted
          ? text.dayRoute.share
          : text.dayRoute.shareAfterComplete);
  const routeMapDayOptions = useMemo(
    () =>
      visibleDays.map((routeDay) => {
        const stops = displayedStopsByDayId[routeDay.id] ?? [];

        return {
          id: routeDay.id,
          label: `DAY ${routeDay.dayIndex}`,
          summary: `${getLocalizedDayDateLabel(routeDay, text)} · ${text.dayRoute.placeCount(
            stops.length
          )}`,
          day: createPlannedRouteDay(routeDay, stops, route.startLocation),
          completedItemIds: stops
            .filter((stop) => isVisitedStop(stop))
            .map((stop) => stop.id),
          comparisonDay: null,
        };
      }),
    [
      displayedStopsByDayId,
      route.startLocation,
      text,
      visibleDays,
    ]
  );
  const firstRouteMapDayWithStops =
    routeMapDayOptions.find((option) => option.day.items.length > 0) ?? null;
  const mapTargetDayOption = mapTargetDayId
    ? (routeMapDayOptions.find((option) => option.id === mapTargetDayId) ?? null)
    : null;
  const mapTargetRouteDay = mapTargetDayOption?.day ?? null;
  const startLocationPickerDay = startLocationPickerTarget
    ? (routeMapDayOptions.find(
        (option) => option.id === startLocationPickerTarget.dayId
      )?.day ?? null)
    : null;

  const handleStartOrderEditing = () => {
    if (
      isReadOnly ||
      isOrderEditing ||
      isSavingOrder ||
      visitSavingStopId ||
      isFinishingDay ||
      isUpdatingRouteStartLocation
    ) {
      return;
    }

    if (beginEditing()) {
      setExpandedDayIds(new Set(sortedDays.map((routeDay) => routeDay.id)));
    }
  };

  const handleMoveStopToDay = (
    stopId: string,
    fromDayId: string,
    targetDayId: string
  ) => {
    if (moveStopToDay(stopId, fromDayId, targetDayId)) {
      setExpandedDayIds((currentIds) => new Set(currentIds).add(targetDayId));
    }
  };

  const handleChangeStayMinutes = (
    routeDay: MyRouteDay,
    stop: MyRouteStop,
    nextStayMinutes: number
  ) => {
    if (!isOrderEditing) {
      persistStayMinutes(routeDay, stop, nextStayMinutes);
      return;
    }

    changeDraftStayMinutes(routeDay.id, stop.id, nextStayMinutes);
  };

  const shouldConfirmEarlyRouteCompletion = (stop: MyRouteStop) => {
    const isLastRouteStopToComplete =
      routeStopCount > 0 &&
      !isResolvedStop(stop) &&
      routeCompletedStopCount + routeSkippedStopCount + 1 === routeStopCount;

    return (
      route.tripDays > 1 &&
      isLastRouteStopToComplete &&
      earlyCompletionActualDays < route.tripDays
    );
  };

  const openVisitCompletionTarget = (target: VisitCompletionTarget) => {
    setEarlyRouteCompletionTarget(null);
    setVisitCompletionTarget(target);
  };

  const openActualStayMinutesTarget = (target: ActualStayMinutesTarget) => {
    setEarlyRouteCompletionTarget(null);
    setActualStayMinutesTarget(target);
  };

  const handleCompleteEarlyRouteAsIs = () => {
    if (earlyRouteCompletionTarget) {
      openActualStayMinutesTarget(earlyRouteCompletionTarget);
    }
  };

  const handleCompleteEarlyRouteWithStartDate = async () => {
    if (
      !earlyRouteCompletionTarget ||
      !earlyRouteCompletionTarget.startedAt ||
      isUpdatingRouteStartDate
    ) {
      return;
    }

    const target = earlyRouteCompletionTarget;
    const didUpdate = await updateRouteStartDate(target.startedAt);

    if (didUpdate) {
      openActualStayMinutesTarget(target);
    }
  };

  const handleToggleStopVisited = (
    routeDay: MyRouteDay,
    stop: MyRouteStop
  ) => {
    if (!canToggleVisitStatus || visitSavingStopId || isOrderEditing || isSkippedStop(stop)) {
      return;
    }

    if (!isVisitedStop(stop)) {
      const nextVisitCompletionTarget = { routeDay, stop };

      if (!stop.checkedInAt) {
        openVisitCompletionTarget(nextVisitCompletionTarget);
        return;
      }

      if (shouldConfirmEarlyRouteCompletion(stop)) {
        setEarlyRouteCompletionTarget({
          ...nextVisitCompletionTarget,
          startedAt: routeActualStartDateKey,
        });
        return;
      }

      openActualStayMinutesTarget(nextVisitCompletionTarget);
      return;
    }

    openModal({
      title: text.dayRoute.cancelVisitConfirmTitle(stop.place.title),
      description: text.dayRoute.cancelVisitConfirmDescription,
      detail:
        route.status === "COMPLETED"
          ? text.dayRoute.cancelCompletedRouteVisitConfirmDetail
          : text.dayRoute.cancelVisitConfirmDetail,
      actions: [
        {
          label: text.common.cancel,
          variant: "secondary",
        },
        {
          label: text.dayRoute.cancelVisitConfirmAction,
          variant: "danger",
          onClick: () => {
            void persistStopVisit(routeDay, stop, false);
          },
        },
      ],
    });
  };

  const handleCompleteStopVisitManually = (
    target: VisitCompletionTarget
  ) => {
    const actualStayTarget: ActualStayMinutesTarget = {
      ...target,
      verification: { status: "MANUAL" },
    };

    setVisitCompletionTarget(null);

    if (
      !isRetrospectiveCompletion &&
      shouldConfirmEarlyRouteCompletion(target.stop)
    ) {
      setEarlyRouteCompletionTarget({
        ...actualStayTarget,
        startedAt: routeActualStartDateKey,
      });
      return;
    }

    setActualStayMinutesTarget(actualStayTarget);
  };

  const handleKeepPhotoPrivate = () => {
    setPhotoPublicationTarget(null);
    showToast("인증 사진은 나만 볼 수 있게 저장했어요.");
  };

  /** 방문하지 않은 장소만 건너뛰거나 복원한다. 원래 순서와 방문 기록은 유지한다. */
  const handleToggleStopSkipped = (routeDay: MyRouteDay, stop: MyRouteStop) => {
    if (!canToggleSkipStatus || visitSavingStopId || isFinishingDay || isOrderEditing ||
      isUpdatingRouteStartLocation || !visitEnabledDayIds.has(routeDay.id) || isVisitedStop(stop)) return;
    const skipped = !isSkippedStop(stop);
    openModal({
      title: skipped ? text.dayRoute.skipConfirmTitle(stop.place.title) : text.dayRoute.undoSkipConfirmTitle(stop.place.title),
      description: skipped ? text.dayRoute.skipConfirmDescription : text.dayRoute.undoSkipConfirmDescription,
      actions: [
        { label: text.common.cancel, variant: "secondary" },
        { label: skipped ? text.dayRoute.skipStop : text.dayRoute.undoSkipStop, variant: "primary", onClick: () => { void skipStop(stop.id, skipped); } },
      ],
    });
  };
  const activeDayDateKey = getRouteDateKey(activeDay.date);
  const pendingActiveDayCount = (displayedStopsByDayId[activeDay.id] ?? []).filter((stop) => !isResolvedStop(stop)).length;
  const canFinishDay = Boolean(canToggleSkipStatus && route.startedAt && activeDayDateKey &&
    activeDayDateKey <= todayKey && (activeDay.startedAt || activeDayDateKey < todayKey) &&
    pendingActiveDayCount > 0 && !isOrderEditing && !visitSavingStopId && !isUpdatingRouteStartLocation);
  /** 선택한 DAY의 미방문 수를 확인받은 뒤 그 날짜만 마친다. 미래 DAY는 변경하지 않는다. */
  const handleRequestFinishDay = () => {
    if (!canFinishDay || isFinishingDay) return;
    openModal({
      title: text.dayRoute.finishDayConfirmTitle(activeDay.dayIndex),
      description: text.dayRoute.finishDayConfirmDescription(pendingActiveDayCount),
      actions: [
        { label: text.common.cancel, variant: "secondary" },
        { label: text.dayRoute.finishDay, variant: "primary", onClick: () => { void finishDay(activeDay.id); } },
      ],
    });
  };

  /** 완료한 내 루트는 공개 출발지 확인을 열고, 이미 공유했다면 공개 목록으로 이동한다. */
  const handleRequestShareRoute = () => {
    if (!route.isMine || isSharingRoute) {
      return;
    }

    if (isRouteShared) {
      navigate("/shared-route");
      return;
    }

    if (!isRouteCompleted) {
      showToast("모든 장소를 완료한 루트만 공유할 수 있어요.");
      return;
    }

    setShareConfirmationRouteId(route.id);
  };

  const handleRequestDeleteDay = (targetDay: MyRouteDay) => {
    if (isReadOnly || !isOrderEditing || isSavingOrder) {
      return;
    }

    if (visibleDays.length <= 1) {
      openModal({
        title: "마지막 DAY는 남겨둘게요",
        description: "DAY가 하나뿐인 일정은 전체 일정 삭제로 지워 주세요.",
      });
      return;
    }

    openModal({
      title: `DAY ${targetDay.dayIndex}를 삭제할까요?`,
      description: `${getDayDateLabel(targetDay)}에 남아 있는 장소 ${(displayedStopsByDayId[targetDay.id] ?? []).length}곳도 함께 삭제돼요.`,
      detail:
        "아직 서버에는 반영되지 않아요. 하단의 저장을 눌러야 삭제가 확정돼요.",
      actions: [
        { label: "취소", variant: "secondary" },
        {
          label: "삭제",
          variant: "danger",
          onClick: () => {
            const nextVisibleDay =
              visibleDays.find(
                (routeDay) =>
                  routeDay.id !== targetDay.id &&
                  routeDay.dayIndex > targetDay.dayIndex
              ) ??
              [...visibleDays]
                .reverse()
                .find((routeDay) => routeDay.id !== targetDay.id);

            deleteDay(targetDay.id);
            setExpandedDayIds((currentIds) => {
              const nextIds = new Set(currentIds);
              nextIds.delete(targetDay.id);
              if (nextVisibleDay) {
                nextIds.add(nextVisibleDay.id);
              }
              return nextIds;
            });
            if (nextVisibleDay && targetDay.id === activeDay.id) {
              setActiveDayId(nextVisibleDay.id);
            }
          },
        },
      ],
    });
  };

  const handleSelectDay = (nextDay: MyRouteDay) => {
    const isNextDayExpanded = expandedDayIds.has(nextDay.id);
    const isNextDayActive = nextDay.id === activeDay.id;

    if (isOrderEditing) {
      setExpandedDayIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (nextIds.has(nextDay.id)) {
          nextIds.delete(nextDay.id);
        } else {
          nextIds.add(nextDay.id);
        }

        return nextIds;
      });
      setActiveDayId(nextDay.id);
      return;
    }

    setExpandedDayIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (nextIds.has(nextDay.id)) {
        nextIds.delete(nextDay.id);
      } else {
        nextIds.add(nextDay.id);
      }

      return nextIds;
    });

    if (!isNextDayExpanded && !isNextDayActive) {
      resetDayEditor(nextDay);
    }
  };

  const handleOpenMapForDay = (routeDay: MyRouteDay) => {
    const stops = displayedStopsByDayId[routeDay.id] ?? [];

    if (routeStopCount === 0) {
      showToast("장소가 있는 루트만 지도로 볼 수 있어요.");
      return;
    }

    setMapTargetDayId(
      stops.length > 0
        ? routeDay.id
        : firstRouteMapDayWithStops?.id ?? routeDay.id
    );
  };

  const handleRequestCheckoutFromMap = (routePlan: PlannedRouteDay[]) => {
    onRequestCheckout?.(routePlan);
  };

  const handleOpenPlaceDetail = (stop: MyRouteStop) => {
    openSheet(createMapSheetPlaceFromRouteStop(stop), {
      mode: "full-popup",
      contextAction: onRequestPlaceRouteFilter
        ? {
            label: text.placeSheet.viewSharedRoutesWithPlace,
            onSelect: onRequestPlaceRouteFilter,
          }
        : undefined,
    });
  };

  const handleOpenStopDirections = async (
    routeDay: MyRouteDay,
    stop: MyRouteStop
  ) => {
    const startLocation = getDayRouteStartLocation(routeDay, route.startLocation);
    let realCurrentLocation: { lat: number; lng: number };

    try {
      realCurrentLocation = await getCurrentPosition({
        forceRefresh: true,
        useRealPosition: true,
      });
    } catch {
      showToast(text.placeSheet.currentLocationUnavailableTitle);
      return;
    }

    openSheet(createMapSheetPlaceFromRouteStop(stop), {
      mode: "directions-popup",
      directionOrigin: {
        coordinates: realCurrentLocation,
        label: text.placeSheet.currentLocation,
        isCurrentLocation: true,
      },
      fallbackDirectionOrigin:
        startLocation
          ? {
              coordinates: {
                lat: startLocation.lat,
                lng: startLocation.lng,
              },
              label: text.dayRoute.savedStartLocation,
              isCurrentLocation: false,
            }
          : undefined,
    });
  };

  const handleApplyDayStartTime = async (
    target: DayStartTimeTarget,
    value: number | string
  ) => {
    const didUpdate = await updateRouteDayStart(
      target.mode === "planned"
        ? {
            dayId: target.routeDay.id,
            plannedStartMinutes: value as number,
          }
        : {
            dayId: target.routeDay.id,
            startedAt: value as string,
          },
      target.mode === "planned"
        ? `DAY ${target.routeDay.dayIndex} 계획 시작 시각을 저장했어요.`
        : `DAY ${target.routeDay.dayIndex} 시작 시각을 저장했어요.`
    );

    if (didUpdate) {
      setDayStartTimeTarget(null);
    }
  };

  const handleRequestRouteActionDayStart = () => {
    if (!canStartRouteActionDay || isStartingRouteDay) {
      return;
    }

    if (!route.startedAt) {
      onRequestStartRoute?.(route);
      return;
    }

    setDayStartTimeTarget({
      routeDay: routeActionDay,
      mode: "start",
    });
  };


  return {
    header: {
      text,
      route,
      activeDay,
      headerLabel,
      headerBadge,
      headerIdentity,
      headerMeta,
      isRouteShared,
      shouldShowSharedStatusText,
      routeCompletedStopCount,
      routeSkippedStopCount,
      isFinishingDay,
      routeStopCount,
      routeTitle: headerTitle ?? getLocalizedRouteTitle(route, text),
      isReadOnly,
      isOrderEditing,
      isSavingOrder,
      handleStartOrderEditing,
      isCloseDisabled: skippingOperation != null,
      onClose: handleClose,
    },
    schedule: {
      sortedDays: visibleDays,
      activeDay,
      focusedStopId,
      expandedDayIds,
      stopsByDayId: displayedStopsByDayId,
      routeStartLocation: route.startLocation,
      dailyStartMinutes: route.dailyStartMinutes,
      isOrderEditing,
      activeDropTarget,
      draggedStopId: draggedStop?.stop.id ?? null,
      visitSavingStopId,
      staySavingStopId,
      isReadOnly,
      canEditVisitTimes:
        route.isMine &&
        (!isRetrospectiveCompletion || allowVisitCompletion),
      canEditDayStartTime,
      canEditStartLocation,
      isRetrospectiveCompletion,
      isVerificationBypassEnabled,
      canEditVerificationPhoto:
        route.isMine && isRetrospectiveCompletion && allowVisitCompletion,
      canToggleVisitStatus,
      canToggleSkipStatus,
      visitEnabledDayIds,
      enableVerificationPhotoPreview,
      isGpsTestEnabled,
      indoorTestTarget,
      gpsTestLocationStopId,
      travelSegmentByKey,
      registerDropZone,
      startDragStop,
      handleMoveStopToDay,
      handleRemoveStopFromLayout,
      handleSelectDay,
      handleRequestDeleteDay,
      setDayStartTimeTarget,
      openStartLocationPicker,
      setStayMinutesEditTarget,
      setVisitTimesEditTarget,
      handleToggleStopVisited,
      handleToggleStopSkipped,
      handleOpenPlaceDetail,
      handleOpenStopDirections,
      handleReplaceVerificationPhoto,
      openIndoorTest,
      setGpsTestTarget,
      setVerificationPhotoPreviewTarget,
    },
    footer: {
      text,
      canFinishDay,
      isFinishingDay,
      handleRequestFinishDay,
      activeDay,
      isReadOnly,
      readOnlyFooterAction,
      readOnlyPosterAction,
      readOnlyActionDisabled,
      readOnlyActionLabel,
      isRouteShared,
      routeLikeCount: route.likeCount,
      isOrderEditing,
      isSavingOrder,
      isOrderDirty,
      routeStopCount,
      routeStatus: route.status,
      routeActionDay,
      isRouteActionDayCompleted,
      isStartingRouteDay,
      canStartRouteActionDay,
      handleRequestShareRoute,
      handleCancelOrderEditing,
      handleSaveOrder,
      handleRequestRouteActionDayStart,
      handleOpenMapForDay,
    },
    overlays: {
      shareConfirmation: route.isMine && shareConfirmationRouteId === route.id
        ? { route, days: sortedDays, onClose: () => setShareConfirmationRouteId(null), onShare: shareRoute }
        : null,
      skippingOperation,
      mapTargetRouteDay,
      mapTargetDayOption,
      routeMapDayOptions,
      mapTargetDayId,
      enableStartPreview,
      onRequestCheckout,
      handleRequestCheckoutFromMap,
      closeMap: () => setMapTargetDayId(null),
      startLocationPickerTarget,
      startLocationPickerDay,
      isUpdatingRouteStartLocation,
      closeStartLocationPicker,
      handleApplyStartLocation,
      draggedStop,
      dayStartTimeTarget,
      defaultDayStartMinutes: route.dailyStartMinutes,
      isUpdatingRouteDayStart,
      setDayStartTimeTarget,
      handleApplyDayStartTime,
      stayMinutesEditTarget,
      closeStayMinutesEdit: () => setStayMinutesEditTarget(null),
      handleChangeStayMinutes,
      earlyRouteCompletionTarget,
      plannedDays: route.tripDays,
      earlyCompletionActualDays,
      earlyCompletionExpectedEndDateKey,
      isUpdatingRouteStartDate,
      setEarlyRouteCompletionTarget,
      handleCompleteEarlyRouteAsIs,
      handleCompleteEarlyRouteWithStartDate,
      visitCompletionTarget,
      visitTimesEditTarget,
      visitSavingStopId,
      visitProgress,
      visitCompletionMode,
      setVisitCompletionTarget,
      setVisitTimesEditTarget,
      handleUpdateVisitTimes,
      handleCompleteStopVisitWithGps,
      handleCompleteStopVisitWithPhoto,
      handleCompleteStopVisitManually,
      actualStayMinutesTarget,
      setActualStayMinutesTarget,
      handleCancelStopCheckIn,
      handleSaveActualStayMinutes,
      verificationPhotoPreviewTarget,
      canManageVerificationPhoto: route.isMine,
      canReplaceVerificationPhoto:
        route.isMine && isRetrospectiveCompletion && allowVisitCompletion,
      setVerificationPhotoPreviewTarget,
      photoPublicationTarget,
      handleSetPhotoPublication,
      handleDeleteVerificationPhoto,
      handleReplaceVerificationPhoto,
      handleKeepPhotoPrivate,
      gpsTestTarget,
      gpsTestLocation,
      isGpsTestApplying,
      setGpsTestTarget,
      handleApplyGpsTestLocation,
      handleClearGpsTestLocation,
    },
  };
}

export type DayRoutePopupController = ReturnType<
  typeof useDayRoutePopupController
>;
