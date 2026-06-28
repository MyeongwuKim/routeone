import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  MdAccessTime,
  MdAdd,
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
  MdMyLocation,
  MdRemove,
  MdOutlinePlace,
  MdShare,
} from "react-icons/md";
import { routeApi } from "@/api/routeApi";
import { PotatoLoadingCard } from "@/components/feedback/PotatoLoadingOverlay";
import PlaceCartRouteMapPopup from "@/features/route-checkout/components/cart-steps/PlaceCartRouteMapPopup";
import type { PlannedRouteDay } from "@/features/route-checkout/components/cart-steps/routePlanTypes";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
} from "@/lib/placeCategory";
import {
  MY_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
  mergeMyRouteSummaryCache,
  optimisticDeleteRouteDayCache,
  optimisticReorderRouteStopsCache,
  optimisticUpdateRouteStopStayMinutesCache,
  optimisticVisitRouteStopCache,
  upsertSharedRouteSummaryCache,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MyRoutesQuery, SharedRoutesQuery } from "@/generated/graphql";
import type { MapSheetPlace } from "@/types/place";
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
  headerLabel?: string;
  headerBadge?: string;
  enableStartPreview?: boolean;
  onRequestCheckout?: (routePlan: PlannedRouteDay[]) => void;
  readOnlyFooterAction?: {
    label: string;
    ariaLabel?: string;
    icon?: ReactNode;
    isActive?: boolean;
    disabled?: boolean;
    onClick: () => void;
  };
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

type StayMinutesEditTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

type RouteLatLng = {
  lat: number;
  lng: number;
};

type TravelSegmentState =
  | {
      status: "loading";
    }
  | {
      status: "success" | "fallback";
      minutes: number;
    }
  | {
      status: "error";
    };

type TravelSegmentRequest = {
  key: string;
  from: RouteLatLng;
  to: RouteLatLng;
};

function formatStayMinutes(value: number | null) {
  if (!value || value <= 0) {
    return "시간 미정";
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const timeText =
    hour > 0
      ? `${hour}시간${minute > 0 ? ` ${minute}분` : ""}`
      : `${minute}분`;

  return timeText;
}

function formatTravelMinutes(value: number) {
  if (value < 60) {
    return `${value}분`;
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return minute > 0 ? `${hour}시간 ${minute}분` : `${hour}시간`;
}

function hasValidCoordinate(
  point: RouteLatLng | null | undefined
): point is RouteLatLng {
  return Boolean(
    point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );
}

function calculateDistanceKm(from: RouteLatLng, to: RouteLatLng) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function estimateTravelMinutes(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
) {
  if (!hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  const distanceKm = calculateDistanceKm(from, to);

  return Math.max(8, Math.round((distanceKm / 35) * 60));
}

function getCoordinateKey(point: RouteLatLng) {
  return `${point.lat.toFixed(6)},${point.lng.toFixed(6)}`;
}

function getTravelSegmentKey(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
) {
  if (!hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  return `${getCoordinateKey(from)}>${getCoordinateKey(to)}`;
}

function createTravelSegmentRequest(
  from: RouteLatLng | null | undefined,
  to: RouteLatLng | null | undefined
): TravelSegmentRequest | null {
  const key = getTravelSegmentKey(from, to);

  if (!key || !hasValidCoordinate(from) || !hasValidCoordinate(to)) {
    return null;
  }

  return {
    key,
    from,
    to,
  };
}

function getTravelSegmentLabel(segment: TravelSegmentState | null) {
  if (!segment || segment.status === "loading") {
    return "이동 시간 계산 중";
  }

  if (segment.status === "error") {
    return "이동 시간 확인 불가";
  }

  const prefix = segment.status === "success" ? "차량 약" : "차량 추정";

  return `${prefix} ${formatTravelMinutes(segment.minutes)}`;
}

function getStoredTravelSegment(stop: MyRouteStop | null | undefined) {
  const minutes = stop?.travelMinutesFromPrevious;

  return typeof minutes === "number" && minutes > 0
    ? ({
        status: "success",
        minutes,
      } satisfies TravelSegmentState)
    : null;
}

function clampStayMinutes(value: number) {
  return Math.max(10, Math.min(480, Math.round(value / 10) * 10));
}

function getDayStartTitle(
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"]
) {
  if (startLocation) {
    return "저장한 출발 위치";
  }

  return dayStops[0]?.place.title ?? "출발 장소 없음";
}

function getDayStartDescription(
  routeDay: MyRouteDay,
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"]
) {
  if (startLocation) {
    return `DAY ${routeDay.dayIndex} 루트 지도에서 START로 표시돼요.`;
  }

  if (dayStops[0]) {
    return `별도 출발지 없이 첫 장소부터 DAY ${routeDay.dayIndex}를 시작해요.`;
  }

  return "장소를 추가하면 첫 장소가 출발 기준으로 표시돼요.";
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
  isStaySaving,
  isReadOnly,
  travelSegmentToNext,
  onStartDrag,
  onRequestStayMinutesEdit,
  onToggleVisited,
  onOpenPlace,
}: {
  stop: MyRouteStop;
  index: number;
  isLast: boolean;
  isOrderEditing: boolean;
  isDragging: boolean;
  isVisitSaving: boolean;
  isStaySaving: boolean;
  isReadOnly: boolean;
  travelSegmentToNext: TravelSegmentState | null;
  onStartDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
}) {
  const isVisited = isVisitedStop(stop);
  const stayMinutes = stop.stayMinutes ?? 60;
  const statusLabel = isVisited ? "완료됨" : "방문 전";
  const stayTimeClass =
    "inline-flex items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100 disabled:opacity-45 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25";

  return (
    <div className={`relative flex gap-3 ${isDragging ? "opacity-35" : ""}`}>
      {!isLast ? (
        <div
          className={`absolute left-[19px] top-10 h-[calc(100%-1.75rem)] w-0.5 rounded-full ${
            isVisited ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ) : null}
      <div
        className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-sm ${
          isVisited
            ? "bg-brand-600 text-white shadow-brand-200"
            : "bg-white text-slate-400 ring-2 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700"
        }`}
      >
        {isVisited ? <MdCheckCircle className="text-lg" /> : index + 1}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div
          role={isOrderEditing ? undefined : "button"}
          tabIndex={isOrderEditing ? undefined : 0}
          onClick={() => {
            if (!isOrderEditing) {
              onOpenPlace(stop);
            }
          }}
          onKeyDown={(event) => {
            if (
              isOrderEditing ||
              (event.key !== "Enter" && event.key !== " ")
            ) {
              return;
            }

            event.preventDefault();
            onOpenPlace(stop);
          }}
          className={`rounded-2xl border-2 px-4 py-3 transition ${
            isOrderEditing
              ? "border-brand-200 bg-white shadow-sm dark:border-brand-400/30 dark:bg-slate-950"
              : isVisited
                ? "cursor-pointer border-brand-500 bg-brand-50 shadow-sm active:scale-[0.99] dark:border-brand-400/40 dark:bg-brand-400/10"
                : "cursor-pointer border-slate-200 bg-white active:scale-[0.99] dark:border-slate-700 dark:bg-slate-950"
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`relative size-12 shrink-0 overflow-hidden rounded-xl ${
                isVisited
                  ? "ring-2 ring-brand-400"
                  : "bg-slate-50 dark:bg-slate-900"
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
              {isVisited ? (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white shadow-sm">
                  <MdCheck />
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-900 dark:text-white">
                {stop.place.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                    isVisited
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  {isVisited ? (
                    <MdCheckCircle className="text-sm" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-slate-400" />
                  )}
                  {statusLabel}
                </span>
                <span className="min-w-0 truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {stop.place.categoryLabel ?? stop.place.categoryName ?? "장소"}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {isReadOnly ? (
                  <span className={stayTimeClass}>
                    <MdAccessTime className="text-sm" />
                    <span className="whitespace-nowrap">
                      {formatStayMinutes(stayMinutes)}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestStayMinutesEdit(stop);
                    }}
                    disabled={isOrderEditing || isStaySaving}
                    className={stayTimeClass}
                  >
                    {isStaySaving ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <MdAccessTime className="text-sm" />
                    )}
                    <span className="whitespace-nowrap">
                      {formatStayMinutes(stayMinutes)}
                    </span>
                  </button>
                )}
              </div>
              {stop.place.address ? (
                <p
                  className={`mt-1 line-clamp-2 text-[11px] leading-4 ${
                    isVisited
                      ? "text-slate-500 dark:text-slate-300"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {stop.place.address}
                </p>
              ) : null}
            </div>
            {isOrderEditing ? (
              <button
                type="button"
                aria-label={`${stop.place.title} 순서 이동`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event);
                }}
                onClick={(event) => event.stopPropagation()}
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
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisited(stop);
                }}
                disabled={isVisitSaving}
                title={isVisited ? "완료 취소" : "완료 처리"}
                className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-base transition active:scale-95 disabled:opacity-40 ${
                  isVisited
                    ? "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                    : "border-brand-500 bg-brand-600 text-white"
                }`}
              >
                {isVisitSaving ? (
                  <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isVisited ? (
                  <MdClose />
                ) : (
                  <MdCheck />
                )}
              </button>
            )}
          </div>
        </div>
        {!isLast ? (
          <div className="ml-1 mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700 dark:bg-brand-400/10 dark:text-brand-100">
            <MdDirectionsCar className="text-sm" />
            다음 장소까지 {getTravelSegmentLabel(travelSegmentToNext)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StayMinutesPopup({
  target,
  onClose,
  onApply,
}: {
  target: StayMinutesEditTarget;
  onClose: () => void;
  onApply: (target: StayMinutesEditTarget, stayMinutes: number) => void;
}) {
  const [draftMinutes, setDraftMinutes] = useState(
    target.stop.stayMinutes ?? 60
  );
  const updateDraftMinutes = (nextMinutes: number) => {
    setDraftMinutes(clampStayMinutes(nextMinutes));
  };

  useEffect(() => {
    setDraftMinutes(target.stop.stayMinutes ?? 60);
  }, [target.stop.id, target.stop.stayMinutes]);

  return (
    <div className="fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label="머무는 시간 수정 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="route-checkout-modal-enter relative w-full max-w-[340px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">STAY TIME</p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {target.stop.place.title}
            </h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              장소에서 머무는 시간을 조정해요.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="머무는 시간 줄이기"
            onClick={() => updateDraftMinutes(draftMinutes - 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <MdRemove />
          </button>
          <label className="flex min-w-[132px] items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <input
              aria-label="머무는 시간(분)"
              type="number"
              min={10}
              max={480}
              step={10}
              value={draftMinutes}
              onChange={(event) => updateDraftMinutes(Number(event.target.value))}
              className="w-16 bg-transparent text-center text-2xl font-black text-slate-900 outline-none"
            />
            <span className="text-sm font-bold text-slate-500">분</span>
          </label>
          <button
            type="button"
            aria-label="머무는 시간 늘리기"
            onClick={() => updateDraftMinutes(draftMinutes + 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <MdAdd />
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-black text-brand-700">
          {formatStayMinutes(draftMinutes)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(target, draftMinutes);
              onClose();
            }}
            className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white"
          >
            적용
          </button>
        </div>
      </section>
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

function createMapSheetPlaceFromRouteStop(stop: MyRouteStop): MapSheetPlace {
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

  return {
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
  };
}

function createPlannedRouteDay(
  day: MyRouteDay,
  stops: MyRouteStop[],
  startLocation: MyRoute["startLocation"] = null
): PlannedRouteDay {
  return {
    day: day.dayIndex,
    date: normalizeRouteDayDate(day.date),
    startsFromCurrentLocation: Boolean(startLocation),
    startLocation: startLocation
      ? {
          lat: startLocation.lat,
          lng: startLocation.lng,
        }
      : null,
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
  startLocation,
  isOrderEditing,
  activeDropIndex,
  draggedStopId,
  visitSavingStopId,
  staySavingStopId,
  isReadOnly,
  travelSegmentByKey,
  onSelect,
  onRegisterDropZone,
  onStartDrag,
  onRequestStayMinutesEdit,
  onToggleVisited,
  onOpenPlace,
}: {
  routeDay: MyRouteDay;
  isExpanded: boolean;
  orderedStops: MyRouteStop[];
  startLocation: MyRoute["startLocation"];
  isOrderEditing: boolean;
  activeDropIndex: number | null;
  draggedStopId: string | null;
  visitSavingStopId: string | null;
  staySavingStopId: string | null;
  isReadOnly: boolean;
  travelSegmentByKey: Record<string, TravelSegmentState>;
  onSelect: (day: MyRouteDay) => void;
  onRegisterDropZone: (index: number, node: HTMLDivElement | null) => void;
  onStartDrag: (
    stop: MyRouteStop,
    fromIndex: number,
    event: React.PointerEvent<HTMLButtonElement>
  ) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
}) {
  const dayStops = orderedStops;
  const hasDayStops = dayStops.length > 0;
  const dayStartTitle = getDayStartTitle(dayStops, startLocation);
  const dayStartDescription = getDayStartDescription(
    routeDay,
    dayStops,
    startLocation
  );
  const firstStop = dayStops[0] ?? null;
  const getFallbackTravelSegment = (
    from: RouteLatLng | null | undefined,
    to: RouteLatLng | null | undefined
  ) => {
    const key = getTravelSegmentKey(from, to);

    return key ? (travelSegmentByKey[key] ?? { status: "loading" }) : null;
  };
  const firstTravelSegment =
    getStoredTravelSegment(firstStop) ??
    (firstStop ? getFallbackTravelSegment(startLocation, firstStop.place) : null);
  const completedStopCount = dayStops.filter(isVisitedStop).length;
  const startLabel = startLocation ? "출발" : "첫 장소";
  const startTitlePrefix = startLocation ? "START" : "첫 장소";
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
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => onSelect(routeDay)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
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
              <p className="mt-1 flex items-center gap-1 truncate text-[11px] font-bold text-brand-700">
                <MdMyLocation className="shrink-0 text-sm" />
                <span className="truncate">
                  {startLabel}: {dayStartTitle}
                </span>
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
      </div>

      {isExpanded ? (
        <div className="route-day-accordion-enter border-t border-brand-100 px-4 py-4">
          <div className="mb-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-lg text-brand-700">
                <MdMyLocation />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-brand-700">
                  {startTitlePrefix} · {dayStartTitle}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                  {dayStartDescription}
                </p>
                {firstTravelSegment ? (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-brand-700">
                    <MdDirectionsCar className="text-sm" />
                    첫 장소까지 {getTravelSegmentLabel(firstTravelSegment)}
                  </p>
                ) : startLocation || !hasDayStops ? null : (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
                    <MdDirectionsCar className="text-sm" />
                    출발 GPS 없음
                  </p>
                )}
              </div>
            </div>
          </div>

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
              {dayStops.map((stop, index) => (
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
                    isLast={index === dayStops.length - 1}
                    isOrderEditing={isOrderEditing}
                    isDragging={draggedStopId === stop.id}
                    isVisitSaving={visitSavingStopId === stop.id}
                    isStaySaving={staySavingStopId === stop.id}
                    isReadOnly={isReadOnly}
                    travelSegmentToNext={
                      getStoredTravelSegment(dayStops[index + 1]) ??
                      (dayStops[index + 1]
                        ? getFallbackTravelSegment(
                            stop.place,
                            dayStops[index + 1].place
                          )
                        : null)
                    }
                    onStartDrag={(event) => onStartDrag(stop, index, event)}
                    onRequestStayMinutesEdit={onRequestStayMinutesEdit}
                    onToggleVisited={onToggleVisited}
                    onOpenPlace={onOpenPlace}
                  />
                </div>
              ))}
              {isOrderEditing && activeDropIndex === dayStops.length ? (
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
  headerLabel = "MY ROUTE",
  headerBadge,
  enableStartPreview = false,
  onRequestCheckout,
  readOnlyFooterAction,
}: DayRoutePopupProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openModal = useUiModalStore((state) => state.openModal);
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
  const dropZoneRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const draggedStopRef = useRef<DraggedStop | null>(null);
  const sortedDays = useMemo(() => getSortedRouteDays(route), [route]);
  const [activeDayId, setActiveDayId] = useState(day.id);
  const [expandedDayIds, setExpandedDayIds] = useState<Set<string>>(
    () => new Set([day.id])
  );
  const activeDay =
    sortedDays.find((routeDay) => routeDay.id === activeDayId) ?? day;
  const [mapTargetDayId, setMapTargetDayId] = useState<string | null>(null);
  const [isOrderEditing, setIsOrderEditing] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isDeletingDay, setIsDeletingDay] = useState(false);
  const [visitSavingStopId, setVisitSavingStopId] = useState<string | null>(null);
  const [staySavingStopId, setStaySavingStopId] = useState<string | null>(null);
  const [stayMinutesEditTarget, setStayMinutesEditTarget] =
    useState<StayMinutesEditTarget | null>(null);
  const [isSharingRoute, setIsSharingRoute] = useState(false);
  const [orderedStops, setOrderedStops] = useState(activeDay.stops);
  const [baseStopIds, setBaseStopIds] = useState(
    activeDay.stops.map((stop) => stop.id)
  );
  const [draggedStop, setDraggedStop] = useState<DraggedStop | null>(null);
  const [activeDropIndex, setActiveDropIndex] = useState<number | null>(null);
  const [travelSegmentByKey, setTravelSegmentByKey] = useState<
    Record<string, TravelSegmentState>
  >({});
  const routeStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.length;
  }, 0);
  const routeCompletedStopCount = route.days.reduce((total, routeDay) => {
    const stops = routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
    return total + stops.filter(isVisitedStop).length;
  }, 0);
  const isOrderDirty = !isSameStopOrder(orderedStops, baseStopIds);
  const isRouteCompleted = routeStopCount > 0 && routeCompletedStopCount === routeStopCount;
  const isRouteShared = route.visibility === "PUBLIC" || Boolean(route.sharedAt);
  const shouldShowSharedStatusText = headerLabel === "MY ROUTE";
  const readOnlyActionDisabled =
    readOnlyFooterAction?.disabled ?? (isSharingRoute || !isRouteCompleted);
  const readOnlyActionLabel =
    readOnlyFooterAction?.label ??
    (isSharingRoute
      ? "공유 중"
      : isRouteShared
        ? "공유됨"
        : isRouteCompleted
          ? "공유하기"
          : "완료 후 공유");
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
          summary: `${getDayDateLabel(routeDay)} · ${stops.length}곳`,
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
    ]
  );
  const firstRouteMapDayWithStops =
    routeMapDayOptions.find((option) => option.day.items.length > 0) ?? null;
  const mapTargetDayOption = mapTargetDayId
    ? (routeMapDayOptions.find((option) => option.id === mapTargetDayId) ?? null)
    : null;
  const mapTargetRouteDay = mapTargetDayOption?.day ?? null;
  const travelSegmentRequests = useMemo(() => {
    const requests = new Map<string, TravelSegmentRequest>();
    const appendRequest = (request: TravelSegmentRequest | null) => {
      if (request) {
        requests.set(request.key, request);
      }
    };

    sortedDays.forEach((routeDay) => {
      const routeDayStops =
        routeDay.id === activeDay.id ? orderedStops : routeDay.stops;
      const firstStop = routeDayStops[0] ?? null;

      if (firstStop && !getStoredTravelSegment(firstStop)) {
        appendRequest(
          createTravelSegmentRequest(route.startLocation, firstStop.place)
        );
      }

      routeDayStops.forEach((stop, index) => {
        const nextStop = routeDayStops[index + 1] ?? null;

        if (nextStop && !getStoredTravelSegment(nextStop)) {
          appendRequest(createTravelSegmentRequest(stop.place, nextStop.place));
        }
      });
    });

    return [...requests.values()];
  }, [activeDay.id, orderedStops, route.startLocation, sortedDays]);
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

  const handleToggleStopVisited = async (
    routeDay: MyRouteDay,
    stop: MyRouteStop
  ) => {
    if (isReadOnly || visitSavingStopId || isOrderEditing) {
      return;
    }

    const isActiveRouteDay = routeDay.id === activeDay.id;
    const sourceStops = isActiveRouteDay ? orderedStops : routeDay.stops;
    const nextVisited = !isVisitedStop(stop);
    const wasDayCompleted =
      sourceStops.length > 0 &&
      sourceStops.filter(isVisitedStop).length === sourceStops.length;
    const previousStops = orderedStops;
    const visitedAt = new Date().toISOString();
    const optimisticStops: MyRouteStop[] = sourceStops.map((currentStop) =>
      currentStop.id === stop.id
        ? {
            ...currentStop,
            visitStatus: nextVisited ? "VISITED" : "PENDING",
            visitedAt: nextVisited ? visitedAt : null,
          }
        : currentStop
    );
    setVisitSavingStopId(stop.id);
    if (isActiveRouteDay) {
      setOrderedStops(optimisticStops);
    }
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
        (candidateDay) => candidateDay.id === routeDay.id
      );
      const nextStops = nextDay?.stops ?? sourceStops;
      const nextCompletedStopCount = nextStops.filter(isVisitedStop).length;
      const nextIsDayCompleted =
        nextStops.length > 0 && nextCompletedStopCount === nextStops.length;

      if (isActiveRouteDay) {
        setOrderedStops(nextStops);
        setBaseStopIds(nextStops.map((nextStop) => nextStop.id));
      }

      if (!wasDayCompleted && nextIsDayCompleted) {
        showToast(`DAY ${routeDay.dayIndex} 클리어`);
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
      if (isActiveRouteDay) {
        setOrderedStops(previousStops);
      }
      showToast(
        error instanceof Error ? error.message : "완료 상태를 바꾸지 못했어요.",
        2600
      );
    } finally {
      setVisitSavingStopId(null);
    }
  };

  const handleChangeStayMinutes = async (
    routeDay: MyRouteDay,
    stop: MyRouteStop,
    nextStayMinutes: number
  ) => {
    if (
      isOrderEditing ||
      staySavingStopId ||
      nextStayMinutes === (stop.stayMinutes ?? 60)
    ) {
      return;
    }

    const isActiveRouteDay = routeDay.id === activeDay.id;
    const sourceStops = isActiveRouteDay ? orderedStops : routeDay.stops;
    const previousStops = orderedStops;
    setStaySavingStopId(stop.id);
    if (isActiveRouteDay) {
      setOrderedStops((currentStops) =>
        currentStops.map((currentStop) =>
          currentStop.id === stop.id
            ? {
                ...currentStop,
                stayMinutes: nextStayMinutes,
              }
            : currentStop
        )
      );
    }
    await queryClient.cancelQueries({
      queryKey: MY_ROUTES_QUERY_KEY,
    });
    const previousRoutes =
      queryClient.getQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY);
    queryClient.setQueryData<MyRoutesQuery>(MY_ROUTES_QUERY_KEY, (currentData) =>
      optimisticUpdateRouteStopStayMinutesCache({
        data: currentData,
        routeId: route.id,
        stopId: stop.id,
        stayMinutes: nextStayMinutes,
      })
    );

    try {
      const result = await routeApi.updateRouteStopStayMinutes({
        stopId: stop.id,
        stayMinutes: nextStayMinutes,
      });
      const nextDay = result.updateRouteStopStayMinutes.days.find(
        (candidateDay) => candidateDay.id === routeDay.id
      );
      const nextStops = nextDay?.stops ?? sourceStops;

      if (isActiveRouteDay) {
        setOrderedStops(nextStops);
      }
      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          upsertMyRouteCache(currentData, result.updateRouteStopStayMinutes)
      );
    } catch (error) {
      if (previousRoutes) {
        queryClient.setQueryData<MyRoutesQuery>(
          MY_ROUTES_QUERY_KEY,
          previousRoutes
        );
      }
      if (isActiveRouteDay) {
        setOrderedStops(previousStops);
      }
      showToast(
        error instanceof Error
          ? error.message
          : "머무는 시간을 저장하지 못했어요.",
        2600
      );
    } finally {
      setStaySavingStopId(null);
    }
  };

  const handleShareRoute = async () => {
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

    setIsSharingRoute(true);
    try {
      const result = await routeApi.shareRoute(route.id);

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) =>
          mergeMyRouteSummaryCache(currentData, result.shareRoute)
      );
      queryClient.setQueriesData<SharedRoutesQuery>(
        {
          queryKey: SHARED_ROUTES_QUERY_KEY,
        },
        (currentData) =>
          upsertSharedRouteSummaryCache(currentData, result.shareRoute)
      );
      showToast("공유 루트에 올렸어요.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "루트를 공유하지 못했어요.",
        2600
      );
    } finally {
      setIsSharingRoute(false);
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
    setExpandedDayIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.delete(activeDay.id);
      if (nextActiveDay) {
        nextIds.add(nextActiveDay.id);
      }
      return nextIds;
    });
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
      setExpandedDayIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(previousActiveDayId);
        return nextIds;
      });
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
      dropZoneRefs.current = [];
      setOrderedStops(nextDay.stops);
      setBaseStopIds(nextDay.stops.map((stop) => stop.id));
      setActiveDayId(nextDay.id);
      stopCurrentDrag();
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

  useEffect(() => {
    setActiveDayId(day.id);
    setExpandedDayIds(new Set([day.id]));
  }, [day.id, route.id]);

  useEffect(() => {
    dropZoneRefs.current = [];
    setOrderedStops(activeDay.stops);
    setBaseStopIds(activeDay.stops.map((stop) => stop.id));
    setIsOrderEditing(false);
    setVisitSavingStopId(null);
    setStaySavingStopId(null);
    setStayMinutesEditTarget(null);
    setMapTargetDayId(null);
    stopCurrentDrag();
  }, [activeDay]);

  useEffect(() => {
    if (!isOrderEditing) {
      stopCurrentDrag();
    }
  }, [isOrderEditing]);

  useEffect(() => {
    if (travelSegmentRequests.length === 0) {
      return;
    }

    let isCancelled = false;

    setTravelSegmentByKey((currentSegments) => {
      const nextSegments = { ...currentSegments };

      travelSegmentRequests.forEach((request) => {
        if (!nextSegments[request.key]) {
          nextSegments[request.key] = {
            status: "loading",
          };
        }
      });

      return nextSegments;
    });

    travelSegmentRequests.forEach((request) => {
      void fetchDrivingRouteFromCurrentLocation({
        startLat: request.from.lat,
        startLng: request.from.lng,
        goalLat: request.to.lat,
        goalLng: request.to.lng,
      })
        .then((routeResult) => {
          if (isCancelled) {
            return;
          }

          setTravelSegmentByKey((currentSegments) => ({
            ...currentSegments,
            [request.key]: {
              status: "success",
              minutes: Math.max(1, Math.round(routeResult.durationMs / 60000)),
            },
          }));
        })
        .catch(() => {
          if (isCancelled) {
            return;
          }

          const fallbackMinutes = estimateTravelMinutes(
            request.from,
            request.to
          );

          setTravelSegmentByKey((currentSegments) => ({
            ...currentSegments,
            [request.key]:
              fallbackMinutes != null
                ? {
                    status: "fallback",
                    minutes: fallbackMinutes,
                  }
                : {
                    status: "error",
                  },
          }));
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [travelSegmentRequests]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2300] bg-white">
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-100 px-4 py-3">
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
                  공유됨
                </span>
              ) : null}
            </div>
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
                />
              );
            })}
          </div>
        </div>

        <footer className="shrink-0 border-t border-brand-100 bg-white px-4 py-3">
          {isReadOnly ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-label={
                  readOnlyFooterAction?.ariaLabel ??
                  (isRouteShared
                    ? `하트 ${route.likeCount}개 받은 공유 루트`
                    : readOnlyActionLabel)
                }
                onClick={readOnlyFooterAction?.onClick ?? handleShareRoute}
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
              <button
                type="button"
                onClick={() => handleOpenMapForDay(activeDay)}
                disabled={routeStopCount === 0}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                <MdMap className="text-lg" />
                루트 지도
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
                루트 지도
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
    </div>,
    document.body
  );
}

export default DayRoutePopup;
