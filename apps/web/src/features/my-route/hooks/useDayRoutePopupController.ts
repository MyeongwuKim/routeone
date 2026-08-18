import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiText } from "@/lib/uiText";
import { getCurrentPosition } from "@/lib/currentPosition";
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
import { useDayRouteTravelSegments } from "./useDayRouteTravelSegments";
import { useRouteStopDrag } from "./useRouteStopDrag";
import { useDayRoutePopupState } from "./useDayRoutePopupState";
import { useRouteDayOrderMutation } from "./useRouteDayOrderMutation";
import { useRouteStopStayMutation } from "./useRouteStopStayMutation";
import { useRouteDayDeleteMutation } from "./useRouteDayDeleteMutation";
import { useRouteShareMutation } from "./useRouteShareMutation";
import { useRouteStartDateMutation } from "./useRouteStartDateMutation";
import { useRouteStopVisitMutation } from "./useRouteStopVisitMutation";
import { useRouteDayStartMutation } from "./useRouteDayStartMutation";
import { useRouteStartLocationMutation } from "./useRouteStartLocationMutation";
import { isSameStopOrder, restoreStopOrder } from "../utils/dayRouteStops";

export function useDayRoutePopupController({
  route,
  day,
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
  readOnlyFooterAction,
  readOnlyPosterAction,
}: DayRoutePopupProps) {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const navigate = useNavigate();
  const openModal = useUiModalStore((state) => state.openModal);
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
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
  const [isStartLocationPickerOpen, setIsStartLocationPickerOpen] =
    useState(false);
  const [directionsOpeningStopId, setDirectionsOpeningStopId] = useState<
    string | null
  >(null);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
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
    baseStopIds,
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
    activeDropIndex,
    draggedStop,
    registerDropZone,
    resetDropZones,
    startDragStop,
    stopCurrentDrag,
  } = useRouteStopDrag({
    isOrderEditing,
    orderedStops,
    setOrderedStops,
  });
  const resetDayEditor = (nextDay: MyRouteDay) => {
    resetDropZones();
    resetDayEditorState(nextDay);
    stopCurrentDrag();
  };
  const travelSegmentByKey = useDayRouteTravelSegments({
    language: appLanguage,
    days: sortedDays,
    activeDayId: activeDay.id,
    orderedStops,
    startLocation: route.startLocation,
  });
  const routeStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.length;
  }, 0);
  const routeCompletedStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.filter(isVisitedStop).length;
  }, 0);
  const todayKey = getTodayDateKey();
  const isOrderDirty = !isSameStopOrder(orderedStops, baseStopIds);
  const { isSavingOrder, saveOrder: handleSaveOrder } =
    useRouteDayOrderMutation({
      routeId: route.id,
      dayId: activeDay.id,
      orderedStops,
      baseStopIds,
      isOrderDirty,
      setOrderedStops,
      setBaseStopIds,
      setIsOrderEditing,
      stopCurrentDrag,
    });
  const {
    changeStayMinutes: handleChangeStayMinutes,
    staySavingStopId,
  } = useRouteStopStayMutation({
    routeId: route.id,
    activeDayId: activeDay.id,
    orderedStops,
    isOrderEditing,
    setOrderedStops,
  });
  const { deleteCurrentDay, isDeletingDay } = useRouteDayDeleteMutation({
    routeId: route.id,
    activeDay,
    sortedDays,
    isReadOnly,
    resetDayEditor,
    setExpandedDayIds,
  });
  const {
    isUpdatingRouteStartLocation,
    updateRouteStartLocation,
  } = useRouteStartLocationMutation();
  const { isSharingRoute, shareRoute } = useRouteShareMutation(route.id);
  const { isUpdatingRouteDayStart, updateRouteDayStart } =
    useRouteDayStartMutation();
  const { isUpdatingRouteStartDate, updateRouteStartDate } =
    useRouteStartDateMutation(route.id);
  const isRetrospectiveCompletion = visitCompletionMode === "retrospective";
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
  const isRouteCompleted =
    routeStopCount > 0 && routeCompletedStopCount === routeStopCount;
  const canToggleVisitStatus = !isReadOnly || allowVisitCompletion;
  const canEditDayStartTime =
    route.isMine && (!isRetrospectiveCompletion || allowVisitCompletion);
  const visitEnabledDayIds = new Set(
    sortedDays
      .filter(
        (routeDay) =>
          isRetrospectiveCompletion ||
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
  const comparisonRouteDay = useMemo(() => {
    if (!isOrderDirty) {
      return null;
    }

    return createPlannedRouteDay(
      activeDay,
      restoreStopOrder(orderedStops, baseStopIds),
      route.startLocation
    );
  }, [activeDay, baseStopIds, isOrderDirty, orderedStops, route.startLocation]);
  const routeMapDayOptions = useMemo(
    () =>
      sortedDays.map((routeDay) => {
        const stops =
          routeDay.id === activeDay.id ? orderedStops : routeDay.stops;

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
          comparisonDay:
            routeDay.id === activeDay.id ? comparisonRouteDay : null,
        };
      }),
    [
      activeDay.id,
      comparisonRouteDay,
      orderedStops,
      route.startLocation,
      sortedDays,
      text,
    ]
  );
  const firstRouteMapDayWithStops =
    routeMapDayOptions.find((option) => option.day.items.length > 0) ?? null;
  const mapTargetDayOption = mapTargetDayId
    ? (routeMapDayOptions.find((option) => option.id === mapTargetDayId) ?? null)
    : null;
  const mapTargetRouteDay = mapTargetDayOption?.day ?? null;

  const handleCancelOrderEditing = () => {
    stopCurrentDrag();
    setOrderedStops((currentStops) =>
      restoreStopOrder(currentStops, baseStopIds)
    );
    setIsOrderEditing(false);
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

  const handleRequestDeleteDay = () => {
    if (isReadOnly || isDeletingDay) {
      return;
    }

    if (route.tripDays <= 1) {
      openModal({
        title: "마지막 DAY는 남겨둘게요",
        description: "DAY가 하나뿐인 일정은 전체 일정 삭제로 지워 주세요.",
      });
      return;
    }

    openModal({
      title: `DAY ${activeDay.dayIndex}를 삭제할까요?`,
      description: `${getDayDateLabel(activeDay)}에 담긴 장소 ${orderedStops.length}곳이 일정에서 사라져요.`,
      detail: "삭제하면 뒤에 있는 DAY 번호와 날짜가 앞으로 당겨져요.",
      actions: [
        { label: "취소", variant: "secondary" },
        {
          label: "삭제",
          variant: "danger",
          onClick: () => {
            void deleteCurrentDay();
          },
        },
      ],
    });
  };

  const handleSelectDay = (nextDay: MyRouteDay) => {
    const isNextDayExpanded = expandedDayIds.has(nextDay.id);
    const isNextDayActive = nextDay.id === activeDay.id;

    if (isOrderEditing) {
      showToast(
        isNextDayActive
          ? "순서 편집을 마치고 DAY를 접어 주세요."
          : "순서 편집을 마치고 다른 DAY를 열어 주세요."
      );
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
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;

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

  const handleOpenStopDirections = async (stop: MyRouteStop) => {
    if (directionsOpeningStopId) {
      return;
    }

    setDirectionsOpeningStopId(stop.id);

    try {
      const currentPosition = gpsTestLocation ?? (await getCurrentPosition());

      openSheet(createMapSheetPlaceFromRouteStop(stop), {
        mode: "directions-popup",
        directionOrigin: {
          coordinates: {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
          },
          label: text.placeSheet.currentLocation,
          isCurrentLocation: true,
        },
      });
    } catch {
      openSheet(createMapSheetPlaceFromRouteStop(stop), {
        mode: "directions-popup",
        directionOrigin: route.startLocation
          ? {
              coordinates: {
                lat: route.startLocation.lat,
                lng: route.startLocation.lng,
              },
              label: text.dayRoute.savedStartLocation,
              isCurrentLocation: false,
            }
          : undefined,
      });
      showToast(text.home.currentLocationUnavailable);
    } finally {
      setDirectionsOpeningStopId(null);
    }
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
        ? `DAY ${target.routeDay.dayIndex} 계획 출발시간을 저장했어요.`
        : `DAY ${target.routeDay.dayIndex} 출발 시각을 저장했어요.`
    );

    if (didUpdate) {
      setDayStartTimeTarget(null);
    }
  };

  const handleApplyStartLocation = (startLocation: {
    lat: number;
    lng: number;
  }) =>
    updateRouteStartLocation({
      routeId: route.id,
      startLocation,
    });

  const runtimeAppVariant =
    window.RouteOneRuntimeConfig?.nativeAppVariant?.trim().toLowerCase() ||
    window.RouteOneRuntimeConfig?.webBundleChannel?.trim().toLowerCase();
  const isGpsTestEnabled =
    !isReadOnly &&
    !isRetrospectiveCompletion &&
    route.isMine &&
    runtimeAppVariant === "dev" &&
    nativeBridge.runtime.isAvailable();

  const handleApplyGpsTestLocation = async (
    target: VisitCompletionTarget,
    position: { lat: number; lng: number }
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
        stopId: target.stop.id,
        title: target.stop.place.title,
        lat: target.stop.place.lat,
        lng: target.stop.place.lng,
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
      setGpsTestLocationStopId(null);
      setGpsTestLocation(null);
      showToast(text.dayRoute.gpsTestCleared);
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
      onClose,
    },
    schedule: {
      sortedDays,
      activeDay,
      expandedDayIds,
      orderedStops,
      startLocation: route.startLocation,
      dailyStartMinutes: route.dailyStartMinutes,
      isOrderEditing,
      activeDropIndex,
      draggedStopId: draggedStop?.stop.id ?? null,
      visitSavingStopId,
      staySavingStopId,
      isReadOnly,
      canEditVisitTimes:
        route.isMine &&
        (!isRetrospectiveCompletion || allowVisitCompletion),
      canEditDayStartTime,
      canEditStartLocation:
        route.isMine && !isReadOnly && Boolean(route.startLocation),
      isRetrospectiveCompletion,
      canEditVerificationPhoto:
        route.isMine && isRetrospectiveCompletion && allowVisitCompletion,
      canToggleVisitStatus,
      visitEnabledDayIds,
      enableVerificationPhotoPreview,
      isGpsTestEnabled,
      gpsTestLocationStopId,
      directionsOpeningStopId,
      travelSegmentByKey,
      registerDropZone,
      startDragStop,
      handleSelectDay,
      setDayStartTimeTarget,
      openStartLocationPicker: () => setIsStartLocationPickerOpen(true),
      setStayMinutesEditTarget,
      setVisitTimesEditTarget,
      handleToggleStopVisited,
      handleOpenPlaceDetail,
      handleOpenStopDirections,
      handleReplaceVerificationPhoto,
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
      orderedStopCount: orderedStops.length,
      isDeletingDay,
      routeStopCount,
      handleRequestShareRoute,
      handleCancelOrderEditing,
      handleSaveOrder,
      handleRequestDeleteDay,
      handleOpenMapForDay,
      setIsOrderEditing,
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
      isStartLocationPickerOpen,
      startLocation: route.startLocation,
      isUpdatingRouteStartLocation,
      closeStartLocationPicker: () => {
        if (!isUpdatingRouteStartLocation) {
          setIsStartLocationPickerOpen(false);
        }
      },
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
      gpsTestLocation:
        gpsTestTarget?.stop.id === gpsTestLocationStopId
          ? gpsTestLocation
          : null,
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
