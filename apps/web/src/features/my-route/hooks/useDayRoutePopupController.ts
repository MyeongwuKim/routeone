import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useUiText } from "@/lib/uiText";
import { resolvePlaceVerificationPolicy } from "@/lib/placeVerificationPolicy";
import { nativeBridge } from "@/native-bridge";
import {
  addDaysToDateKey,
  getDateKeyDiffInDays,
  getDayDateLabel,
  getRouteDateKey,
  getSortedRouteDays,
  getTodayDateKey,
  isVisitedStop,
} from "../routeDisplay";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
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
import {
  createRouteLayoutInput,
  createRouteLayoutSignature,
  createRouteStopsByDayId,
} from "../utils/dayRouteLayout";
import {
  getDayRouteStartLocation,
  updateDayRouteStartLocationDraft,
  type DayRouteStartLocations,
} from "../utils/dayRouteStartLocation";
import { useDayRouteTravelSegments } from "./useDayRouteTravelSegments";
import {
  useRouteStopDrag,
  type RouteStopsByDayId,
} from "./useRouteStopDrag";
import { useDayRoutePopupState } from "./useDayRoutePopupState";
import { useRouteLayoutMutation } from "./useRouteLayoutMutation";
import { useRouteStopStayMutation } from "./useRouteStopStayMutation";
import { useRouteShareMutation } from "./useRouteShareMutation";
import { useRouteStartDateMutation } from "./useRouteStartDateMutation";
import { useRouteStopVisitMutation } from "./useRouteStopVisitMutation";
import { useRouteDayStartMutation } from "./useRouteDayStartMutation";
import { useDayRouteStartLocationEditor } from "./useDayRouteStartLocationEditor";
import {
  isTestAccountModeEnabled,
  isVisitVerificationBypassEnabled,
} from "../services/visitPhotoService";

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
  const clearCurrentPosition = useCurrentPositionStore(
    (state) => state.clearPosition
  );
  const requestCurrentPosition = useCurrentPositionStore(
    (state) => state.requestCurrentPosition
  );
  const [gpsTestLocationStopId, setGpsTestLocationStopId] = useState<
    string | null
  >(null);
  const [gpsTestLocation, setGpsTestLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [gpsTestTarget, setGpsTestTarget] =
    useState<VisitCompletionTarget | null>(null);
  const [isGpsTestApplying, setIsGpsTestApplying] = useState(false);
  const [dayStartTimeTarget, setDayStartTimeTarget] =
    useState<DayStartTimeTarget | null>(null);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const [draftStopsByDayId, setDraftStopsByDayId] =
    useState<RouteStopsByDayId>(() => createRouteStopsByDayId(sortedDays));
  const [draftStartLocationsByDayId, setDraftStartLocationsByDayId] =
    useState<DayRouteStartLocations>({});
  const [deletedDayIds, setDeletedDayIds] = useState<Set<string>>(
    () => new Set()
  );
  const [baseLayoutSignature, setBaseLayoutSignature] = useState(() =>
    createRouteLayoutSignature(
      sortedDays,
      createRouteStopsByDayId(sortedDays),
      new Set()
    )
  );
  const {
    activeDayId,
    expandedDayIds,
    mapTargetDayId,
    isOrderEditing,
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
    setIsOrderEditing,
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
  const {
    activeDropTarget,
    draggedStop,
    registerDropZone,
    resetDropZones,
    startDragStop,
    stopCurrentDrag,
  } = useRouteStopDrag({
    isOrderEditing,
    stopsByDayId: draftStopsByDayId,
    setStopsByDayId: setDraftStopsByDayId,
  });
  const resetDayEditor = (nextDay: MyRouteDay) => {
    resetDropZones();
    resetDayEditorState(nextDay);
    stopCurrentDrag();
  };
  const visibleDays = useMemo(
    () =>
      isOrderEditing
        ? sortedDays
            .filter((routeDay) => !deletedDayIds.has(routeDay.id))
            .map((routeDay) =>
              draftStartLocationsByDayId[routeDay.id]
                ? {
                    ...routeDay,
                    startLocation: draftStartLocationsByDayId[routeDay.id],
                  }
                : routeDay
            )
        : sortedDays,
    [deletedDayIds, draftStartLocationsByDayId, isOrderEditing, sortedDays]
  );
  const displayedStopsByDayId = useMemo(
    () =>
      isOrderEditing
        ? draftStopsByDayId
        : createRouteStopsByDayId(sortedDays, activeDay.id, orderedStops),
    [activeDay.id, draftStopsByDayId, isOrderEditing, orderedStops, sortedDays]
  );
  const travelSegmentByKey = useDayRouteTravelSegments({
    language: appLanguage,
    days: visibleDays,
    activeDayId: activeDay.id,
    orderedStops,
    stopsByDayId: isOrderEditing ? draftStopsByDayId : undefined,
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
  const todayKey = getTodayDateKey();
  const isOrderDirty =
    createRouteLayoutSignature(
      sortedDays,
      draftStopsByDayId,
      deletedDayIds,
      draftStartLocationsByDayId
    ) !== baseLayoutSignature;
  const { isSavingLayout: isSavingOrder, saveLayout } =
    useRouteLayoutMutation({
      onSuccess: (nextRoute: MyRoute) => {
        const nextDays = getSortedRouteDays(nextRoute);
        const nextActiveDay =
          nextDays.find((routeDay) => routeDay.id === activeDay.id) ??
          nextDays[0];
        const nextStopsByDayId = createRouteStopsByDayId(nextDays);

        stopCurrentDrag();
        setDeletedDayIds(new Set());
        setDraftStopsByDayId(nextStopsByDayId);
        setDraftStartLocationsByDayId({});
        resetStartLocationPicker();
        setBaseLayoutSignature(
          createRouteLayoutSignature(nextDays, nextStopsByDayId, new Set())
        );
        setIsOrderEditing(false);

        if (nextActiveDay) {
          setActiveDayId(nextActiveDay.id);
          setOrderedStops(nextActiveDay.stops);
          setBaseStopIds(nextActiveDay.stops.map((stop) => stop.id));
          setExpandedDayIds(new Set([nextActiveDay.id]));
        }
      },
    });
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
    visitSavingStopId,
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
  const canToggleVisitStatus = !isReadOnly || allowVisitCompletion;
  const canEditDayStartTime =
    route.isMine && (!isRetrospectiveCompletion || allowVisitCompletion);
  const isRouteCompleted =
    routeStopCount > 0 && routeCompletedStopCount === routeStopCount;
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
    routeActionDayStops.every(isVisitedStop);
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
  const {
    startLocationPickerTarget,
    canEditStartLocation,
    isUpdatingRouteStartLocation,
    openStartLocationPicker,
    closeStartLocationPicker,
    resetStartLocationPicker,
    handleApplyStartLocation,
  } = useDayRouteStartLocationEditor({
    route,
    days: visibleDays,
    stopsByDayId: displayedStopsByDayId,
    isReadOnly,
    isOrderEditing,
    isSavingOrder,
    onDraftChange: (dayId, location) => {
      const savedDay = sortedDays.find((routeDay) => routeDay.id === dayId);

      if (savedDay) {
        setDraftStartLocationsByDayId((current) =>
          updateDayRouteStartLocationDraft(
            current,
            savedDay,
            route.startLocation,
            location
          )
        );
      }
    },
  });
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
      isUpdatingRouteStartLocation
    ) {
      return;
    }

    const nextStopsByDayId = createRouteStopsByDayId(
      sortedDays,
      activeDay.id,
      orderedStops
    );
    setDraftStopsByDayId(nextStopsByDayId);
    setDraftStartLocationsByDayId({});
    resetStartLocationPicker();
    setDeletedDayIds(new Set());
    setBaseLayoutSignature(
      createRouteLayoutSignature(sortedDays, nextStopsByDayId, new Set())
    );
    setExpandedDayIds(new Set(sortedDays.map((routeDay) => routeDay.id)));
    setIsOrderEditing(true);
  };

  const handleCancelOrderEditing = () => {
    if (isSavingOrder) {
      return;
    }

    stopCurrentDrag();
    const nextStopsByDayId = createRouteStopsByDayId(
      sortedDays,
      activeDay.id,
      orderedStops
    );
    setDraftStopsByDayId(nextStopsByDayId);
    setDraftStartLocationsByDayId({});
    resetStartLocationPicker();
    setDeletedDayIds(new Set());
    setBaseLayoutSignature(
      createRouteLayoutSignature(sortedDays, nextStopsByDayId, new Set())
    );
    setIsOrderEditing(false);
  };

  const handleSaveOrder = () => {
    if (
      !isOrderEditing ||
      !isOrderDirty ||
      isSavingOrder ||
      isUpdatingRouteStartLocation
    ) {
      return;
    }

    saveLayout(
      createRouteLayoutInput({
        routeId: route.id,
        days: sortedDays,
        stopsByDayId: draftStopsByDayId,
        deletedDayIds,
        startLocationsByDayId: draftStartLocationsByDayId,
      })
    );
  };

  const handleMoveStopToDay = (
    stopId: string,
    fromDayId: string,
    targetDayId: string
  ) => {
    if (!isOrderEditing || fromDayId === targetDayId) {
      return;
    }

    setDraftStopsByDayId((currentStopsByDayId) => {
      const sourceStops = currentStopsByDayId[fromDayId] ?? [];
      const movedStop = sourceStops.find((stop) => stop.id === stopId);

      if (!movedStop) {
        return currentStopsByDayId;
      }

      return {
        ...currentStopsByDayId,
        [fromDayId]: sourceStops.filter((stop) => stop.id !== stopId),
        [targetDayId]: [
          ...(currentStopsByDayId[targetDayId] ?? []),
          movedStop,
        ],
      };
    });
    setExpandedDayIds((currentIds) => new Set(currentIds).add(targetDayId));
  };

  const handleRemoveStopFromLayout = (dayId: string, stopId: string) => {
    if (!isOrderEditing) {
      return;
    }

    setDraftStopsByDayId((currentStopsByDayId) => ({
      ...currentStopsByDayId,
      [dayId]: (currentStopsByDayId[dayId] ?? []).filter(
        (stop) => stop.id !== stopId
      ),
    }));
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

    setDraftStopsByDayId((currentStopsByDayId) => ({
      ...currentStopsByDayId,
      [routeDay.id]: (currentStopsByDayId[routeDay.id] ?? []).map(
        (currentStop) =>
          currentStop.id === stop.id
            ? { ...currentStop, stayMinutes: nextStayMinutes }
            : currentStop
      ),
    }));
  };

  const shouldConfirmEarlyRouteCompletion = (stop: MyRouteStop) => {
    const isLastRouteStopToComplete =
      routeStopCount > 0 &&
      !isVisitedStop(stop) &&
      routeCompletedStopCount + 1 === routeStopCount;

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
    if (!canToggleVisitStatus || visitSavingStopId || isOrderEditing) {
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

    void persistStopVisit(routeDay, stop, false);
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

  const handleShareRoute = () => {
    if (isSharingRoute) {
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

    shareRoute();
  };

  const handleRequestShareRoute = () => {
    if (isSharingRoute) {
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

    openModal({
      title: "이대로 공유할까요?",
      description:
        "한 번 공유하면 현재 앱에서는 직접 삭제하거나 공유를 되돌릴 수 없어요.",
      detail:
        "완료한 일정이 공개돼요. 장소 사진 공개를 선택한 인증 이미지만 함께 표시되며, 비공개 사진은 공개되지 않아요.",
      actions: [
        { label: "취소", variant: "secondary" },
        {
          label: "동의하고 공유",
          variant: "primary",
          onClick: () => {
            void handleShareRoute();
          },
        },
      ],
    });
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
      description: `${getDayDateLabel(targetDay)}에 남아 있는 장소 ${(draftStopsByDayId[targetDay.id] ?? []).length}곳도 함께 삭제돼요.`,
      detail:
        "아직 서버에는 반영되지 않아요. 하단의 저장을 눌러야 삭제가 확정돼요.",
      actions: [
        { label: "취소", variant: "secondary" },
        {
          label: "삭제",
          variant: "danger",
          onClick: () => {
            resetStartLocationPicker();
            const nextVisibleDay =
              visibleDays.find(
                (routeDay) =>
                  routeDay.id !== targetDay.id &&
                  routeDay.dayIndex > targetDay.dayIndex
              ) ??
              [...visibleDays]
                .reverse()
                .find((routeDay) => routeDay.id !== targetDay.id);

            setDeletedDayIds((currentIds) =>
              new Set(currentIds).add(targetDay.id)
            );
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

  const handleOpenStopDirections = (
    routeDay: MyRouteDay,
    stop: MyRouteStop
  ) => {
    const startLocation = getDayRouteStartLocation(routeDay, route.startLocation);

    openSheet(createMapSheetPlaceFromRouteStop(stop), {
      mode: "directions-popup",
      directionOrigin: gpsTestLocation
        ? {
            coordinates: gpsTestLocation,
            label: text.placeSheet.currentLocation,
            isCurrentLocation: true,
          }
        : undefined,
      fallbackDirectionOrigin:
        !gpsTestLocation && startLocation
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

  const isGpsTestEnabled =
    !isReadOnly &&
    !isRetrospectiveCompletion &&
    route.isMine &&
    Boolean(route.startedAt) &&
    isTestAccountModeEnabled() &&
    nativeBridge.runtime.isAvailable();
  const indoorTestTarget = isGpsTestEnabled
    ? sortedDays
        .flatMap((routeDay) =>
          [...routeDay.stops]
            .sort((left, right) => left.order - right.order)
            .map((stop) => ({ routeDay, stop }))
        )
        .find(({ stop }) => !isVisitedStop(stop)) ?? null
    : null;

  const handleApplyGpsTestLocation = async (
    target: VisitCompletionTarget,
    position: { lat: number; lng: number },
    options: {
      showSuccessToast?: boolean;
      notificationWasScheduledEarlier?: boolean;
    } = {}
  ) => {
    if (!isGpsTestEnabled || isGpsTestApplying) {
      return null;
    }

    const request = nativeBridge.notifications.setRouteArrivalTestLocation({
      place: {
        id: `${route.id}:${target.stop.id}`,
        routeId: route.id,
        routeTitle: getLocalizedRouteTitle(route, text),
        dayId: target.routeDay.id,
        dayIndex: target.routeDay.dayIndex,
        dayDateKey:
          getRouteDateKey(target.routeDay.date) ?? getTodayDateKey(),
        stopId: target.stop.id,
        title: target.stop.place.title,
        lat: target.stop.place.lat,
        lng: target.stop.place.lng,
        radiusMeters: resolvePlaceVerificationPolicy(target.stop.place)
          .notificationRadiusMeters,
      },
      position,
      language: appLanguage,
    });

    if (!request) {
      showToast(text.dayRoute.gpsTestUnavailable);
      return null;
    }

    setIsGpsTestApplying(true);

    try {
      const result = await request;
      setGpsTestLocationStopId(target.stop.id);
      setGpsTestLocation(
        result.lat != null && result.lng != null
          ? { lat: result.lat, lng: result.lng }
          : null
      );
      if (options.showSuccessToast !== false) {
        showToast(
          result.notificationScheduled ||
            options.notificationWasScheduledEarlier
            ? text.dayRoute.gpsTestAppliedWithNotification
            : result.withinRadius
              ? text.dayRoute.gpsTestAppliedInsideWithoutNotification
              : text.dayRoute.gpsTestAppliedWithoutNotification
        );
      }
      return result;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : text.dayRoute.gpsTestMoveFailed
      );
      return null;
    } finally {
      setIsGpsTestApplying(false);
    }
  };

  const handleClearGpsTestLocation = async () => {
    if (!isGpsTestEnabled || isGpsTestApplying) {
      return null;
    }

    const request = nativeBridge.notifications.setRouteArrivalTestLocation({
      place: null,
      language: appLanguage,
    });

    if (!request) {
      showToast(text.dayRoute.gpsTestUnavailable);
      return null;
    }

    setIsGpsTestApplying(true);

    try {
      const result = await request;
      clearCurrentPosition();
      setGpsTestLocationStopId(null);
      setGpsTestLocation(null);
      const realPosition = await requestCurrentPosition({
        forceRefresh: true,
      }).catch(
        () => null
      );
      showToast(text.dayRoute.gpsTestCleared);
      return realPosition
        ? {
            ...result,
            lat: realPosition.lat,
            lng: realPosition.lng,
          }
        : result;
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : text.dayRoute.gpsTestMoveFailed
      );
      return null;
    } finally {
      setIsGpsTestApplying(false);
    }
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
      routeStopCount,
      routeTitle: headerTitle ?? getLocalizedRouteTitle(route, text),
      isReadOnly,
      isOrderEditing,
      isSavingOrder,
      handleStartOrderEditing,
      onClose,
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
      handleOpenPlaceDetail,
      handleOpenStopDirections,
      handleReplaceVerificationPhoto,
      openIndoorTest: () => {
        if (indoorTestTarget) {
          setGpsTestTarget(indoorTestTarget);
        }
      },
      setGpsTestTarget,
      setVerificationPhotoPreviewTarget,
    },
    footer: {
      text,
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
      // 테스트 좌표는 장소가 아니라 기기의 가상 현재 위치이므로
      // 다른 장소 테스트를 열어도 마지막으로 적용한 위치를 이어서 사용한다.
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
