import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  MdAccessTime,
  MdCheck,
  MdCheckCircle,
  MdClose,
  MdCompareArrows,
  MdDeleteOutline,
  MdDirectionsCar,
  MdDragIndicator,
  MdEdit,
  MdExpandMore,
  MdMap,
  MdOutlinePlace,
} from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import PlaceCartRouteMapPopup from "@/features/route-checkout/components/cart-steps/PlaceCartRouteMapPopup";
import type { PlannedRouteDay } from "@/features/route-checkout/components/cart-steps/routePlanTypes";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
} from "@/lib/placeCategory";
import {
  MY_ROUTES_QUERY_KEY,
  optimisticDeleteRouteDayCache,
  optimisticReorderRouteStopsCache,
  optimisticVisitRouteStopCache,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MyRoutesQuery } from "@/generated/graphql";
import {
  getDayDateLabel,
  getDaySummary,
  getRouteTitle,
  getSortedRouteDays,
  isVisitedStop,
} from "../routeDisplay";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

type DayRoutePopupProps = {
  route: MyRoute;
  day: MyRouteDay;
  onClose: () => void;
  isReadOnly?: boolean;
};

type DraggedStop = {
  stop: MyRouteStop;
  fromIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  isActive: boolean;
};

function formatStayMinutes(value: number | null) {
  if (!value || value <= 0) {
    return "머무는 시간 미정";
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const timeText =
    hour > 0
      ? `${hour}시간${minute > 0 ? ` ${minute}분` : ""}`
      : `${minute}분`;

  return `머무는 시간 ${timeText}`;
}

function formatVisitedTime(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameStopOrder(left: MyRouteStop[], rightIds: string[]) {
  return (
    left.length === rightIds.length &&
    left.every((stop, index) => stop.id === rightIds[index])
  );
}

function moveStop(stops: MyRouteStop[], fromIndex: number, toIndex: number) {
  const nextStops = [...stops];
  const [movedStop] = nextStops.splice(fromIndex, 1);

  if (!movedStop) {
    return stops;
  }

  const adjustedIndex = toIndex > fromIndex ? toIndex - 1 : toIndex;
  const safeIndex = Math.max(0, Math.min(adjustedIndex, nextStops.length));
  nextStops.splice(safeIndex, 0, movedStop);

  return nextStops;
}

function restoreStopOrder(stops: MyRouteStop[], stopIds: string[]) {
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  const orderedStops = stopIds
    .map((stopId) => stopById.get(stopId))
    .filter((stop): stop is MyRouteStop => Boolean(stop));

  if (orderedStops.length !== stops.length) {
    return stops;
  }

  return orderedStops;
}

function RouteStopNode({
  stop,
  index,
  isLast,
  isOrderEditing,
  isDragging,
  isVisitSaving,
  isReadOnly,
  onStartDrag,
  onToggleVisited,
}: {
  stop: MyRouteStop;
  index: number;
  isLast: boolean;
  isOrderEditing: boolean;
  isDragging: boolean;
  isVisitSaving: boolean;
  isReadOnly: boolean;
  onStartDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
}) {
  const isVisited = isVisitedStop(stop);
  const visitedTime = formatVisitedTime(stop.visitedAt);

  return (
    <div className={`relative flex gap-3 ${isDragging ? "opacity-35" : ""}`}>
      {!isLast ? (
        <div
          className={`absolute left-[17px] top-9 h-[calc(100%-1.5rem)] w-0.5 rounded-full ${
            isVisited ? "bg-brand-500" : "bg-teal-300"
          }`}
        />
      ) : null}
      <div
        className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-sm ${
          isVisited ? "bg-brand-600 text-white" : "bg-white text-brand-700"
        }`}
      >
        {isVisited ? <MdCheckCircle className="text-lg" /> : index + 1}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div
          className={`rounded-2xl px-4 py-3 transition ${
            isOrderEditing
              ? "border border-brand-100 bg-white shadow-sm"
              : isVisited
                ? "border border-brand-100 bg-brand-50"
                : "bg-slate-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`size-12 shrink-0 overflow-hidden rounded-xl ${
                isVisited ? "ring-2 ring-brand-300" : "bg-brand-50"
              }`}
            >
              {stop.place.imageUrl ? (
                <img
                  src={stop.place.imageUrl}
                  alt=""
                  className={`h-full w-full object-cover ${
                    isVisited ? "brightness-95" : ""
                  }`}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-brand-600">
                  <MdOutlinePlace />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                {stop.place.title}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-semibold text-slate-500">
                  {stop.place.categoryLabel ?? stop.place.categoryName ?? "장소"}
                </span>
                {isVisited ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-brand-700 ring-1 ring-brand-100">
                    완료
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100">
                  <MdAccessTime className="text-sm" />
                  {formatStayMinutes(stop.stayMinutes)}
                </p>
                {visitedTime ? (
                  <p className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    <MdCheckCircle className="text-sm" />
                    {visitedTime}
                  </p>
                ) : null}
              </div>
              {stop.place.address ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">
                  {stop.place.address}
                </p>
              ) : null}
            </div>
            {isOrderEditing ? (
              <button
                type="button"
                aria-label={`${stop.place.title} 순서 이동`}
                onPointerDown={onStartDrag}
                className="flex size-9 shrink-0 touch-none items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 active:cursor-grabbing"
              >
                <MdDragIndicator />
              </button>
            ) : isReadOnly ? null : (
              <button
                type="button"
                aria-label={
                  isVisited
                    ? `${stop.place.title} 완료 취소`
                    : `${stop.place.title} 완료 처리`
                }
                onClick={() => onToggleVisited(stop)}
                disabled={isVisitSaving}
                className={`flex min-h-9 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-black disabled:opacity-40 ${
                  isVisited
                    ? "border-brand-200 bg-white text-brand-700"
                    : "border-brand-500 bg-brand-600 text-white"
                }`}
              >
                {isVisitSaving ? (
                  <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isVisited ? (
                  <MdClose className="text-sm" />
                ) : (
                  <MdCheck className="text-sm" />
                )}
                {isVisited ? "취소" : "완료"}
              </button>
            )}
          </div>
        </div>
        {!isLast ? (
          <div className="ml-1 mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <MdDirectionsCar className="text-sm" />
            다음 장소로 이동
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeRouteDayDate(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function getRegionCodes(regionLabelKey: string | null, regionCode: string | null) {
  const [areaCode, signguCode] = regionLabelKey?.split(":") ?? [];

  return {
    areaCode: areaCode ?? "",
    signguCode: signguCode ?? regionCode ?? "",
  };
}

function createPlannedRouteDay(
  day: MyRouteDay,
  stops: MyRouteStop[]
): PlannedRouteDay {
  return {
    day: day.dayIndex,
    date: normalizeRouteDayDate(day.date),
    startsFromCurrentLocation: false,
    startLocation: null,
    items: stops.map((stop) => {
      const contentTypeId = stop.place.contentTypeId ?? "";
      const contentTypeLabel = getPlaceCategoryLabel({
        title: stop.place.title,
        contentTypeId,
        contentTypeLabel: stop.place.categoryLabel ?? undefined,
        categoryName: stop.place.categoryName ?? undefined,
      });
      const regionCodes = getRegionCodes(
        stop.place.regionLabelKey,
        stop.place.regionCode
      );
      const stayMinutes = stop.stayMinutes ?? 60;

      return {
        id: stop.id,
        stayMinutes,
        recommendedStayMinutes: stayMinutes,
        startMinutes: 0,
        endMinutes: 0,
        travelMinutesFromPrevious: 0,
        isOverSchedule: false,
        place: {
          id: stop.place.externalId ?? stop.place.contentId ?? stop.id,
          contentId: stop.place.contentId ?? stop.place.externalId ?? stop.id,
          contentTypeId,
          ...regionCodes,
          touristTrendName: stop.place.title,
          topRank: null,
          title: stop.place.title,
          address: stop.place.address ?? "",
          lat: stop.place.lat,
          lng: stop.place.lng,
          contentTypeLabel,
          categoryName: stop.place.categoryName ?? contentTypeLabel,
          icon: getPlaceCategoryIcon(contentTypeLabel),
          images: stop.place.imageUrl ? [stop.place.imageUrl] : [],
        },
      };
    }),
  };
}

function DayRouteAccordionItem({
  routeDay,
  isExpanded,
  orderedStops,
  isOrderEditing,
  activeDropIndex,
  draggedStopId,
  visitSavingStopId,
  isReadOnly,
  onSelect,
  onRegisterDropZone,
  onStartDrag,
  onToggleVisited,
}: {
  routeDay: MyRouteDay;
  isExpanded: boolean;
  orderedStops: MyRouteStop[];
  isOrderEditing: boolean;
  activeDropIndex: number | null;
  draggedStopId: string | null;
  visitSavingStopId: string | null;
  isReadOnly: boolean;
  onSelect: (day: MyRouteDay) => void;
  onRegisterDropZone: (index: number, node: HTMLDivElement | null) => void;
  onStartDrag: (
    stop: MyRouteStop,
    fromIndex: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
}) {
  const dayStops = isExpanded ? orderedStops : routeDay.stops;
  const hasDayStops = dayStops.length > 0;
  const completedStopCount = dayStops.filter(isVisitedStop).length;
  const progressPercent = hasDayStops
    ? Math.round((completedStopCount / dayStops.length) * 100)
    : 0;
  const isDayCleared = hasDayStops && completedStopCount === dayStops.length;

  return (
    <section
      className={`overflow-hidden rounded-2xl border transition ${
        isExpanded
          ? "border-brand-200 bg-white shadow-sm"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => onSelect(routeDay)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
              isDayCleared
                ? "bg-brand-600 text-white"
                : isExpanded
                  ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200"
                  : "bg-white text-slate-500 ring-1 ring-slate-200"
            }`}
          >
            {isDayCleared ? (
              <MdCheckCircle className="text-xl" />
            ) : (
              routeDay.dayIndex
            )}
          </div>
          <div className="min-w-0">
            <p className="font-trip text-sm text-slate-900">
              DAY {routeDay.dayIndex}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {getDayDateLabel(routeDay)} · {getDaySummary(routeDay)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
              isDayCleared
                ? "bg-brand-600 text-white"
                : "bg-white text-brand-700 ring-1 ring-brand-100"
            }`}
          >
            {completedStopCount}/{dayStops.length}
          </span>
          <MdExpandMore
            className={`text-xl text-brand-700 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-brand-100 px-4 py-4">
          {hasDayStops ? (
            <>
              <div
                className={`mb-4 rounded-2xl border px-4 py-3 ${
                  isDayCleared
                    ? "border-brand-200 bg-brand-600 text-white"
                    : "border-brand-100 bg-brand-50 text-brand-800"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-trip text-sm">
                      {isDayCleared ? "DAY CLEAR" : `DAY ${routeDay.dayIndex}`}
                    </p>
                    <p
                      className={`mt-0.5 text-xs font-bold ${
                        isDayCleared ? "text-white/85" : "text-brand-700"
                      }`}
                    >
                      {isDayCleared
                        ? "모든 장소 완료"
                        : `${dayStops.length - completedStopCount}곳 남음`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-brand-700">
                    {completedStopCount}/{dayStops.length}
                  </span>
                </div>
                <div
                  className={`mt-3 h-2 overflow-hidden rounded-full ${
                    isDayCleared ? "bg-white/25" : "bg-white"
                  }`}
                >
                  <div
                    className={`h-full rounded-full ${
                      isDayCleared ? "bg-white" : "bg-brand-600"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {isOrderEditing ? (
                <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700">
                  오른쪽 핸들을 잡고 원하는 위치로 옮겨 주세요.
                </div>
              ) : null}
              {orderedStops.map((stop, index) => (
                <div
                  key={stop.id}
                  ref={(node) => onRegisterDropZone(index, node)}
                  className="relative"
                >
                  {isOrderEditing && activeDropIndex === index ? (
                    <div className="mb-2 rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                      여기에 놓기
                    </div>
                  ) : null}
                  <RouteStopNode
                    stop={stop}
                    index={index}
                    isLast={index === orderedStops.length - 1}
                    isOrderEditing={isOrderEditing}
                    isDragging={draggedStopId === stop.id}
                    isVisitSaving={visitSavingStopId === stop.id}
                    isReadOnly={isReadOnly}
                    onStartDrag={(event) => onStartDrag(stop, index, event)}
                    onToggleVisited={onToggleVisited}
                  />
                </div>
              ))}
              {isOrderEditing && activeDropIndex === orderedStops.length ? (
                <div className="rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                  맨 뒤에 놓기
                </div>
              ) : null}
            </>
          ) : (
            <PotatoLoadingCard
              title="이 날은 아직 비어 있어요"
              description="장소를 추가하면 이동 순서를 볼 수 있어요."
              animation="empty"
              compact
              className="shadow-sm"
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

function DayRoutePopup({
  route,
  day,
  onClose,
  isReadOnly = false,
}: DayRoutePopupProps) {
  const queryClient = useQueryClient();
  const openModal = useUiModalStore((state) => state.openModal);
  const showToast = useUiToastStore((state) => state.showToast);
  const dropZoneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const draggedStopRef = useRef<DraggedStop | null>(null);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const [activeDayId, setActiveDayId] = useState(day.id);
  const activeDay =
    sortedDays.find((routeDay) => routeDay.id === activeDayId) ?? day;
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isDeletingDay, setIsDeletingDay] = useState(false);
  const [visitSavingStopId, setVisitSavingStopId] = useState<string | null>(null);
  const [orderedStops, setOrderedStops] = useState(activeDay.stops);
  const [baseStopIds, setBaseStopIds] = useState(
    activeDay.stops.map((stop) => stop.id)
  );
  const [draggedStop, setDraggedStop] = useState<DraggedStop | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const hasStops = orderedStops.length > 0;
  const completedStopCount = orderedStops.filter(isVisitedStop).length;
  const isDayCompleted = hasStops && completedStopCount === orderedStops.length;
  const routeStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.length;
  }, 0);
  const routeCompletedStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.filter(isVisitedStop).length;
  }, 0);
  const isOrderDirty = !isSameStopOrder(orderedStops, baseStopIds);
  const plannedRouteDay = useMemo(
    () => createPlannedRouteDay(activeDay, orderedStops),
    [activeDay, orderedStops]
  );
  const comparisonRouteDay = useMemo(() => {
    if (!isOrderDirty) {
      return null;
    }

    return createPlannedRouteDay(
      activeDay,
      restoreStopOrder(orderedStops, baseStopIds)
    );
  }, [activeDay, baseStopIds, isOrderDirty, orderedStops]);

  const stopCurrentDrag = () => {
    dragCleanupRef.current?.();
    dragCleanupRef.current = null;
    draggedStopRef.current = null;
    setDraggedStop(null);
    setActiveDropIndex(null);
  };

  const registerDropZone = (index: number, node: HTMLDivElement | null) => {
    dropZoneRefs.current[index] = node;
  };

  const getDropIndexAtPoint = (clientY: number) => {
    for (let index = 0; index < orderedStops.length; index += 1) {
      const node = dropZoneRefs.current[index];

      if (!node) {
        continue;
      }

      const rect = node.getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return orderedStops.length;
  };

  const startDragStop = ({
    stop,
    fromIndex,
    event,
  }: {
    stop: MyRouteStop;
    fromIndex: number;
    event: React.PointerEvent<HTMLButtonElement>;
  }) => {
    if (!isOrderEditing || event.button !== 0) {
      return;
    }

    let pointerCaptureTarget: HTMLElement | null = event.currentTarget;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      pointerCaptureTarget = null;
    }

    dragCleanupRef.current?.();
    const initialDraggedStop = {
      stop,
      fromIndex,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      isActive: false,
    };
    draggedStopRef.current = initialDraggedStop;
    setDraggedStop(initialDraggedStop);
    setActiveDropIndex(null);

    const isCurrentPointer = (pointerEvent: PointerEvent) =>
      pointerEvent.pointerId === event.pointerId;

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      if (!isCurrentPointer(pointerEvent)) {
        return;
      }

      const currentDraggedStop = draggedStopRef.current;

      if (!currentDraggedStop) {
        return;
      }

      const moveDistance = Math.hypot(
        pointerEvent.clientX - currentDraggedStop.startX,
        pointerEvent.clientY - currentDraggedStop.startY
      );

      if (!currentDraggedStop.isActive && moveDistance < 6) {
        return;
      }

      pointerEvent.preventDefault();
      const nextDraggedStop = {
        ...currentDraggedStop,
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
        isActive: true,
      };
      draggedStopRef.current = nextDraggedStop;
      setDraggedStop(nextDraggedStop);
      setActiveDropIndex(getDropIndexAtPoint(pointerEvent.clientY));
    };

    const handlePointerEnd = (pointerEvent: PointerEvent) => {
      if (!isCurrentPointer(pointerEvent)) {
        return;
      }

      const currentDraggedStop = draggedStopRef.current;

      if (!currentDraggedStop) {
        stopCurrentDrag();
        return;
      }

      if (currentDraggedStop.isActive) {
        pointerEvent.preventDefault();
        const dropIndex = getDropIndexAtPoint(pointerEvent.clientY);
        setOrderedStops((currentStops) =>
          moveStop(currentStops, currentDraggedStop.fromIndex, dropIndex)
        );
      }

      stopCurrentDrag();
    };

    const handleLostPointerCapture = (pointerEvent: PointerEvent) => {
      if (isCurrentPointer(pointerEvent)) {
        stopCurrentDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", handlePointerEnd, { once: true });
    window.addEventListener("pointercancel", handlePointerEnd, { once: true });
    pointerCaptureTarget?.addEventListener(
      "lostpointercapture",
      handleLostPointerCapture
    );

    dragCleanupRef.current = () => {
      if (pointerCaptureTarget?.hasPointerCapture?.(event.pointerId)) {
        try {
          pointerCaptureTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer capture can already be released.
        }
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      pointerCaptureTarget?.removeEventListener(
        "lostpointercapture",
        handleLostPointerCapture
      );
    };
  };

  const handleCancelOrderEditing = () => {
    stopCurrentDrag();
    setOrderedStops((currentStops) => restoreStopOrder(currentStops, baseStopIds));
    setIsOrderEditing(false);
  };

  const handleSaveOrder = async () => {
    if (!isOrderDirty || isSavingOrder) {
      return;
    }

    const stopIds = orderedStops.map((stop) => stop.id);
    const previousStops = orderedStops;
    setIsSavingOrder(true);
    await queryClient.cancelQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
    const previousRoutes =
      queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);
    queryClient.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, (currentData) =>
      optimisticReorderRouteStopsCache({
        data: currentData,
        routeId: route.id,
        dayId: activeDay.id,
        stopIds,
      })
    );

    try {
      const result = await routeApi.reorderRouteStops({
        routeId: route.id,
        dayId: activeDay.id,
        stopIds,
      });
      const nextDay = result.reorderRouteStops.days.find(
        (routeDay) => routeDay.id === activeDay.id
      );
      const nextStops = nextDay?.stops ?? orderedStops;
      const nextStopIds = nextStops.map((stop) => stop.id);

      setOrderedStops(nextStops);
      setBaseStopIds(nextStopIds);
      setIsOrderEditing(false);
      showToast("장소 순서를 저장했어요.");
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.reorderRouteStops)
      );
    } catch (error) {
      if (previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          previousRoutes
        );
      }
      setOrderedStops(restoreStopOrder(previousStops, baseStopIds));
      showToast(
        error instanceof Error
          ? error.message
          : "장소 순서를 저장하지 못했어요.",
        2600
      );
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleToggleStopVisited = async (stop: MyRouteStop) => {
    if (isReadOnly || visitSavingStopId || isOrderEditing) {
      return;
    }

    const nextVisited = !isVisitedStop(stop);
    const wasDayCompleted = isDayCompleted;
    const previousStops = orderedStops;
    const visitedAt = new Date().toISOString();
    const optimisticStops: MyRouteStop[] = orderedStops.map((currentStop) =>
      currentStop.id === stop.id
        ? {
            ...currentStop,
            visitStatus: nextVisited ? "VISITED" : "PENDING",
            visitedAt: nextVisited ? visitedAt : null,
          }
        : currentStop
    );
    setVisitSavingStopId(stop.id);
    setOrderedStops(optimisticStops);
    await queryClient.cancelQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
    const previousRoutes =
      queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);
    queryClient.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, (currentData) =>
      optimisticVisitRouteStopCache({
        data: currentData,
        routeId: route.id,
        stopId: stop.id,
        visited: nextVisited,
        visitedAt,
      })
    );

    try {
      const result = await routeApi.markRouteStopVisited(stop.id, nextVisited);
      const nextDay = result.markRouteStopVisited.days.find(
        (routeDay) => routeDay.id === activeDay.id
      );
      const nextStops = nextDay?.stops ?? orderedStops;
      const nextCompletedStopCount = nextStops.filter(isVisitedStop).length;
      const nextIsDayCompleted =
        nextStops.length > 0 && nextCompletedStopCount === nextStops.length;

      setOrderedStops(nextStops);
      setBaseStopIds(nextStops.map((nextStop) => nextStop.id));

      if (!wasDayCompleted && nextIsDayCompleted) {
        showToast(`DAY ${activeDay.dayIndex} 클리어`);
      } else {
        showToast(nextVisited ? "장소를 완료 처리했어요." : "완료를 취소했어요.");
      }

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.markRouteStopVisited)
      );
    } catch (error) {
      if (previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          previousRoutes
        );
      }
      setOrderedStops(previousStops);
      showToast(
        error instanceof Error ? error.message : "완료 상태를 바꾸지 못했어요.",
        2600
      );
    } finally {
      setVisitSavingStopId(null);
    }
  };

  const deleteCurrentDay = async () => {
    if (isReadOnly || isDeletingDay) {
      return;
    }

    setIsDeletingDay(true);
    await queryClient.cancelQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
    const previousRoutes =
      queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);
    const previousActiveDayId = activeDay.id;
    const activeDayIndex = sortedDays.findIndex(
      (routeDay) => routeDay.id === activeDay.id
    );
    const nextActiveDay =
      sortedDays[activeDayIndex + 1] ??
      sortedDays[activeDayIndex - 1] ??
      sortedDays.find((routeDay) => routeDay.id !== activeDay.id);

    if (nextActiveDay) {
      setActiveDayId(nextActiveDay.id);
    }
    queryClient.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, (currentData) =>
      optimisticDeleteRouteDayCache({
        data: currentData,
        routeId: route.id,
        dayId: activeDay.id,
      })
    );

    try {
      const result = await routeApi.deleteRouteDay(activeDay.id);
      showToast(`DAY ${activeDay.dayIndex}를 삭제했어요.`);
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.deleteRouteDay)
      );
    } catch (error) {
      if (previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          previousRoutes
        );
      }
      setActiveDayId(previousActiveDayId);
      showToast(
        error instanceof Error ? error.message : "DAY를 삭제하지 못했어요.",
        2600
      );
    } finally {
      setIsDeletingDay(false);
    }
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
    if (nextDay.id === activeDay.id) {
      return;
    }

    if (isOrderEditing) {
      showToast("순서 편집을 마치고 다른 DAY를 열어 주세요.");
      return;
    }

    setActiveDayId(nextDay.id);
  };

  useEffect(() => {
    setActiveDayId(day.id);
  }, [day.id, route.id]);

  useEffect(() => {
    dropZoneRefs.current = [];
    setOrderedStops(activeDay.stops);
    setBaseStopIds(activeDay.stops.map((stop) => stop.id));
    setIsOrderEditing(false);
    setVisitSavingStopId(null);
    setIsMapOpen(false);
    stopCurrentDrag();
  }, [activeDay]);

  useEffect(() => {
    if (!isOrderEditing) {
      stopCurrentDrag();
    }
  }, [isOrderEditing]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">MY ROUTE</p>
            <h2 className="mt-0.5 truncate text-lg font-bold text-slate-900">
              {getRouteTitle(route)}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {route.tripDays}일 일정 · 전체 루트 {routeCompletedStopCount}/
              {routeStopCount} 완료
            </p>
            <p className="mt-0.5 text-[11px] font-bold text-brand-700">
              DAY {activeDay.dayIndex} 선택됨 · {getDayDateLabel(activeDay)}
            </p>
          </div>
          <button
            type="button"
            aria-label="일차 경로 닫기"
            onClick={onClose}
            className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
          >
            <MdClose />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {sortedDays.map((routeDay) => (
              <DayRouteAccordionItem
                key={routeDay.id}
                routeDay={routeDay}
                isExpanded={routeDay.id === activeDay.id}
                orderedStops={orderedStops}
                isOrderEditing={isOrderEditing}
                activeDropIndex={activeDropIndex}
                draggedStopId={draggedStop?.stop.id ?? null}
                visitSavingStopId={visitSavingStopId}
                isReadOnly={isReadOnly}
                onSelect={handleSelectDay}
                onRegisterDropZone={registerDropZone}
                onStartDrag={(stop, fromIndex, event) =>
                  startDragStop({
                    stop,
                    fromIndex,
                    event,
                  })
                }
                onToggleVisited={handleToggleStopVisited}
              />
            ))}
          </div>
        </div>

        <footer className="shrink-0 border-t border-brand-100 bg-white px-4 py-3">
          {isReadOnly ? (
            <button
              type="button"
              onClick={() => setIsMapOpen(true)}
              disabled={!hasStops}
              className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <MdMap className="text-lg" />
              루트 지도
            </button>
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
                onClick={() => setIsMapOpen(true)}
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
                onClick={() => setIsMapOpen(true)}
                disabled={!hasStops}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-2 py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                <MdMap className="text-lg" />
                루트 지도
              </button>
            </div>
          )}
        </footer>
      </div>

      {isMapOpen ? (
        <PlaceCartRouteMapPopup
          day={plannedRouteDay}
          comparisonDay={comparisonRouteDay}
          onClose={() => setIsMapOpen(false)}
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
    </div>
  );
}

export default DayRoutePopup;
