import {
  useMemo,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  MdCheck,
  MdClose,
  MdCompareArrows,
  MdDeleteOutline,
  MdDragIndicator,
  MdEdit,
  MdImage,
  MdMap,
  MdShare,
} from "react-icons/md";
import PlaceCartRouteMapPopup from "@/features/route-checkout/components/cart-steps/PlaceCartRouteMapPopup";
import type { PlannedRouteDay } from "@/features/route-checkout/models/routePlanTypes";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiText } from "@/lib/uiText";
import {
  addDaysToDateKey,
  getDateKeyDiffInDays,
  getDayDateLabel,
  getRouteDateKey,
  getTodayDateKey,
  getSortedRouteDays,
  isVisitedStop,
} from "../routeDisplay";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";
import {
  createMapSheetPlaceFromRouteStop,
  createPlannedRouteDay,
} from "../adapters/dayRouteAdapters";
import {
  ActualStayMinutesPopup,
  EarlyRouteCompletionPopup,
  StayMinutesPopup,
  VerificationPhotoPreviewPopup,
  VisitCompletionPopup,
} from "./day-route/DayRouteDialogs";
import type {
  ActualStayMinutesTarget,
  VisitCompletionTarget,
} from "../models/dayRouteDialogTypes";
import {
  getLocalizedDayDateLabel,
  getLocalizedRouteTitle,
} from "../utils/dayRouteFormatting";
import DayRouteAccordionItem from "./day-route/DayRouteAccordionItem";
import { useDayRouteTravelSegments } from "../hooks/useDayRouteTravelSegments";
import { useRouteStopDrag } from "../hooks/useRouteStopDrag";
import { useDayRoutePopupState } from "../hooks/useDayRoutePopupState";
import { useRouteDayOrderMutation } from "../hooks/useRouteDayOrderMutation";
import { useRouteStopStayMutation } from "../hooks/useRouteStopStayMutation";
import { useRouteDayDeleteMutation } from "../hooks/useRouteDayDeleteMutation";
import { useRouteShareMutation } from "../hooks/useRouteShareMutation";
import { useRouteStartDateMutation } from "../hooks/useRouteStartDateMutation";
import { useRouteStopVisitMutation } from "../hooks/useRouteStopVisitMutation";
import {
  isSameStopOrder,
  restoreStopOrder,
} from "../utils/dayRouteStops";

type DayRoutePopupProps = {
  route: MyRoute;
  day: MyRouteDay;
  onClose: () => void;
  isReadOnly?: boolean;
  allowVisitCompletion?: boolean;
  visitCompletionMode?: "live" | "retrospective";
  headerLabel?: string;
  headerBadge?: string;
  enableStartPreview?: boolean;
  enableVerificationPhotoPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
  readOnlyFooterAction?: {
    label: string;
    ariaLabel?: string;
    icon?: ReactNode;
    isActive?: boolean;
    disabled?: boolean;
    onClick: () => void;
  };
  readOnlyPosterAction?: {
    label: string;
    ariaLabel?: string;
    disabled?: boolean;
    onClick: () => void;
  };
};

function DayRoutePopupContent({
  route,
  day,
  onClose,
  isReadOnly = false,
  allowVisitCompletion = false,
  visitCompletionMode = "live",
  headerLabel = "MY ROUTE",
  headerBadge,
  enableStartPreview = false,
  enableVerificationPhotoPreview = false,
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
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const {
    activeDayId,
    expandedDayIds,
    mapTargetDayId,
    isOrderEditing,
    stayMinutesEditTarget,
    visitCompletionTarget,
    verificationPhotoPreviewTarget,
    actualStayMinutesTarget,
    earlyRouteCompletionTarget,
    orderedStops,
    baseStopIds,
    setExpandedDayIds,
    setMapTargetDayId,
    setIsOrderEditing,
    setStayMinutesEditTarget,
    setVisitCompletionTarget,
    setVerificationPhotoPreviewTarget,
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
  const { isSharingRoute, shareRoute } = useRouteShareMutation(route.id);
  const { isUpdatingRouteStartDate, updateRouteStartDate } =
    useRouteStartDateMutation(route.id);
  const isRetrospectiveCompletion = visitCompletionMode === "retrospective";
  const {
    completeStopVisitManually: handleCompleteStopVisitManually,
    completeStopVisitWithGps: handleCompleteStopVisitWithGps,
    completeStopVisitWithPhoto: handleCompleteStopVisitWithPhoto,
    persistStopVisit,
    saveActualStayMinutes: handleSaveActualStayMinutes,
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
  });
  const isRouteCompleted =
    routeStopCount > 0 && routeCompletedStopCount === routeStopCount;
  const canToggleVisitStatus = !isReadOnly || allowVisitCompletion;
  const routeActualStartDateKey =
    getRouteDateKey(route.startedAt) ?? todayKey;
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
  const readOnlyActionIcon = readOnlyFooterAction?.icon ?? (
    <MdShare className="text-lg" />
  );

  const readOnlyActionDisabledClass = readOnlyFooterAction?.isActive
    ? "disabled:opacity-100"
    : "disabled:opacity-60";
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
    setOrderedStops((currentStops) => restoreStopOrder(currentStops, baseStopIds));
    setIsOrderEditing(false);
  };

  const handleSkipActualStayMinutes = (target: ActualStayMinutesTarget) => {
    void handleSaveActualStayMinutes(target, null);
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

  const handleCompleteEarlyRouteAsIs = () => {
    if (!earlyRouteCompletionTarget) {
      return;
    }

    openVisitCompletionTarget(earlyRouteCompletionTarget);
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
      openVisitCompletionTarget(target);
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
      const nextVisitCompletionTarget = {
        routeDay,
        stop,
      };

      if (shouldConfirmEarlyRouteCompletion(stop)) {
        setEarlyRouteCompletionTarget({
          ...nextVisitCompletionTarget,
          startedAt: routeActualStartDateKey,
        });
        return;
      }

      setVisitCompletionTarget(nextVisitCompletionTarget);
      return;
    }

    void persistStopVisit(routeDay, stop, false);
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
        "완료한 일정과 사진 인증 이미지가 공개돼요. 부적절한 사진이나 내용은 관리자에 의해 삭제 조치될 수 있어요.",
      actions: [
        {
          label: "취소",
          variant: "secondary",
        },
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
        {
          label: "취소",
          variant: "secondary",
        },
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
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <header className="app-safe-area-header flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-trip text-sm text-brand-700">{headerLabel}</p>
              {headerBadge ? (
                <span className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
                  {headerBadge}
                </span>
              ) : null}
              {isRouteShared && shouldShowSharedStatusText ? (
                <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 dark:border-brand-400/35 dark:bg-slate-950 dark:text-brand-100">
                  {text.dayRoute.routeShared}
                </span>
              ) : null}
            </div>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
              {getLocalizedRouteTitle(route, text)}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {text.dayRoute.daySchedule(route.tripDays)} ·{" "}
              {text.dayRoute.fullRouteProgress(
                routeCompletedStopCount,
                routeStopCount
              )}
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-brand-700">
              {text.dayRoute.selectedDay(
                activeDay.dayIndex,
                getLocalizedDayDateLabel(activeDay, text)
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.dayRoute.closeAria}
            onClick={onClose}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
          >
            <MdClose />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {sortedDays.map((routeDay) => {
              const isRouteDayActive = routeDay.id === activeDay.id;
              const routeDayStops = isRouteDayActive
                ? orderedStops
                : routeDay.stops;

              return (
                <DayRouteAccordionItem
                  key={routeDay.id}
                  routeDay={routeDay}
                  isExpanded={expandedDayIds.has(routeDay.id)}
                  orderedStops={routeDayStops}
                  startLocation={route.startLocation}
                  isOrderEditing={isRouteDayActive && isOrderEditing}
                  activeDropIndex={isRouteDayActive ? activeDropIndex : null}
                  draggedStopId={
                    isRouteDayActive ? draggedStop?.stop.id ?? null : null
                  }
                  visitSavingStopId={visitSavingStopId}
                  staySavingStopId={staySavingStopId}
                  isReadOnly={isReadOnly}
                  canToggleVisited={canToggleVisitStatus}
                  enableVerificationPhotoPreview={
                    enableVerificationPhotoPreview
                  }
                  travelSegmentByKey={travelSegmentByKey}
                  onSelect={handleSelectDay}
                  onRegisterDropZone={
                    isRouteDayActive ? registerDropZone : () => undefined
                  }
                  onStartDrag={(stop, fromIndex, event) => {
                    if (!isRouteDayActive) {
                      return;
                    }

                    startDragStop({
                      stop,
                      fromIndex,
                      event,
                    });
                  }}
                  onRequestStayMinutesEdit={(stop) => {
                    if (isReadOnly) {
                      return;
                    }

                    setStayMinutesEditTarget({
                      routeDay,
                      stop,
                    });
                  }}
                  onToggleVisited={(stop) =>
                    handleToggleStopVisited(routeDay, stop)
                  }
                  onOpenPlace={handleOpenPlaceDetail}
                  onOpenVerificationPhoto={setVerificationPhotoPreviewTarget}
                />
              );
            })}
          </div>
        </div>

        <footer className="app-safe-area-footer shrink-0 border-t border-brand-100 bg-white px-4 py-3">
          {isReadOnly ? (
            <div
              className={`grid gap-2 ${
                readOnlyPosterAction ? "grid-cols-3" : "grid-cols-2"
              }`}
            >
              <button
                type="button"
                aria-label={
                  readOnlyFooterAction?.ariaLabel ??
                  (isRouteShared
                    ? text.dayRoute.sharedRouteHeartAria(route.likeCount)
                    : readOnlyActionLabel)
                }
                onClick={readOnlyFooterAction?.onClick ?? handleRequestShareRoute}
                disabled={readOnlyActionDisabled}
                className={`flex items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-sm font-bold disabled:cursor-default ${readOnlyActionDisabledClass} ${
                  readOnlyFooterAction?.isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-brand-50 text-brand-700"
                }`}
              >
                {readOnlyActionIcon}
                {readOnlyActionLabel ? <span>{readOnlyActionLabel}</span> : null}
              </button>
              {readOnlyPosterAction ? (
                <button
                  type="button"
                  aria-label={readOnlyPosterAction.ariaLabel}
                  onClick={readOnlyPosterAction.onClick}
                  disabled={readOnlyPosterAction.disabled}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-2 py-3 text-xs font-bold text-amber-700 disabled:cursor-wait disabled:opacity-60"
                >
                  <MdImage className="text-lg" />
                  {readOnlyPosterAction.label}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => handleOpenMapForDay(activeDay)}
                disabled={routeStopCount === 0}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                <MdMap className="text-lg" />
                {text.dayRoute.routeMap}
              </button>
            </div>
          ) : isOrderEditing ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCancelOrderEditing}
                disabled={isSavingOrder}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-xs font-bold text-slate-600 disabled:opacity-40"
              >
                <MdClose />
                취소
              </button>
              <button
                type="button"
                onClick={() => handleOpenMapForDay(activeDay)}
                disabled={!isOrderDirty || orderedStops.length < 2}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 px-2 py-3 text-xs font-bold text-brand-700 disabled:opacity-40"
              >
                <MdCompareArrows />
                동선 비교
              </button>
              <button
                type="button"
                onClick={handleSaveOrder}
                disabled={!isOrderDirty || isSavingOrder}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                <MdCheck />
                {isSavingOrder ? "저장 중" : "저장"}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleRequestDeleteDay}
                disabled={isDeletingDay}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-100 bg-rose-50 px-2 py-3 text-xs font-bold text-rose-600 disabled:opacity-40"
              >
                <MdDeleteOutline />
                {isDeletingDay ? "삭제 중" : "DAY 삭제"}
              </button>
              <button
                type="button"
                onClick={() => setIsOrderEditing(true)}
                disabled={orderedStops.length < 2}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-brand-200 bg-brand-50 px-2 py-3 text-xs font-bold text-brand-700 disabled:opacity-40"
              >
                <MdEdit />
                순서 편집
              </button>
              <button
                type="button"
                onClick={() => handleOpenMapForDay(activeDay)}
                disabled={routeStopCount === 0}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                <MdMap className="text-lg" />
                {text.dayRoute.routeMap}
              </button>
            </div>
          )}
        </footer>
      </div>

      {mapTargetRouteDay ? (
        <PlaceCartRouteMapPopup
          day={mapTargetRouteDay}
          comparisonDay={mapTargetDayOption?.comparisonDay ?? null}
          completedItemIds={mapTargetDayOption?.completedItemIds}
          dayOptions={routeMapDayOptions}
          initialDayOptionId={
            mapTargetDayOption?.id ?? mapTargetDayId ?? undefined
          }
          enableStartPreview={enableStartPreview}
          onRequestCheckout={
            onRequestCheckout ? handleRequestCheckoutFromMap : undefined
          }
          onClose={() => setMapTargetDayId(null)}
        />
      ) : null}
      {draggedStop?.isActive ? (
        <div
          className="pointer-events-none fixed z-[3000] flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 shadow-2xl"
          style={{
            left: draggedStop.x,
            top: draggedStop.y,
          }}
        >
          <span className="flex size-8 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <MdDragIndicator />
          </span>
          <span className="max-w-[150px] truncate">
            {draggedStop.stop.place.title}
          </span>
        </div>
      ) : null}
      {stayMinutesEditTarget ? (
        <StayMinutesPopup
          target={stayMinutesEditTarget}
          onClose={() => setStayMinutesEditTarget(null)}
          onApply={(target, stayMinutes) => {
            void handleChangeStayMinutes(
              target.routeDay,
              target.stop,
              stayMinutes
            );
          }}
        />
      ) : null}
      {earlyRouteCompletionTarget ? (
        <EarlyRouteCompletionPopup
          target={earlyRouteCompletionTarget}
          plannedDays={route.tripDays}
          actualDays={earlyCompletionActualDays}
          expectedEndDateKey={earlyCompletionExpectedEndDateKey}
          isSaving={isUpdatingRouteStartDate}
          onChangeStartedAt={(startedAt) =>
            setEarlyRouteCompletionTarget((currentTarget) =>
              currentTarget
                ? {
                    ...currentTarget,
                    startedAt,
                  }
                : currentTarget
            )
          }
          onCompleteAsIs={handleCompleteEarlyRouteAsIs}
          onCompleteWithStartDate={() => {
            void handleCompleteEarlyRouteWithStartDate();
          }}
          onClose={() => {
            if (!isUpdatingRouteStartDate) {
              setEarlyRouteCompletionTarget(null);
            }
          }}
        />
      ) : null}
      {visitCompletionTarget ? (
        <VisitCompletionPopup
          target={visitCompletionTarget}
          isSaving={visitSavingStopId === visitCompletionTarget.stop.id}
          mode={visitCompletionMode}
          onClose={() => {
            if (!visitSavingStopId) {
              setVisitCompletionTarget(null);
            }
          }}
          onCompleteWithGps={(target) => {
            void handleCompleteStopVisitWithGps(target);
          }}
          onCompleteWithPhoto={(target, source) => {
            void handleCompleteStopVisitWithPhoto(target, source);
          }}
          onCompleteManually={(target) => {
            void handleCompleteStopVisitManually(target);
          }}
        />
      ) : null}
      {actualStayMinutesTarget ? (
        <ActualStayMinutesPopup
          target={actualStayMinutesTarget}
          isSaving={visitSavingStopId === actualStayMinutesTarget.stop.id}
          onSkip={handleSkipActualStayMinutes}
          onApply={(target, actualStayMinutes) => {
            void handleSaveActualStayMinutes(target, actualStayMinutes);
          }}
        />
      ) : null}
      {verificationPhotoPreviewTarget ? (
        <VerificationPhotoPreviewPopup
          target={verificationPhotoPreviewTarget}
          onClose={() => setVerificationPhotoPreviewTarget(null)}
        />
      ) : null}
    </div>,
    document.body
  );
}

function DayRoutePopup(props: DayRoutePopupProps) {
  return (
    <DayRoutePopupContent
      key={`${props.route.id}:${props.day.id}`}
      {...props}
    />
  );
}

export default DayRoutePopup;
