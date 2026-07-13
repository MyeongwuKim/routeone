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
  MdImage,
  MdMap,
  MdMyLocation,
  MdPhotoCamera,
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
  MY_ROUTE_HISTORY_QUERY_KEY,
  MY_ROUTES_QUERY_KEY,
  SHARED_ROUTES_QUERY_KEY,
  mergeMyRouteSummaryCache,
  optimisticDeleteRouteDayCache,
  optimisticReorderRouteStopsCache,
  optimisticUpdateRouteStopStayMinutesCache,
  optimisticVisitRouteStopCache,
  upsertMyRouteCache,
} from "@/features/my-route/myRouteCache";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useUiModalStore } from "@/stores/uiModalStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";
import type {
  MyRoutesQuery,
  RouteStopVisitVerificationInput,
} from "@/generated/graphql";
import type { MapSheetPlace } from "@/types/place";
import {
  addDaysToDateKey,
  getDateKeyDiffInDays,
  getDayDateLabel,
  getRouteDateKey,
  formatRouteDate,
  getTodayDateKey,
  getSortedRouteDays,
  isVisitedStop,
} from "../routeDisplay";
import { cacheRouteStopVerificationPhotoDataUrl } from "../routeCompletionPoster";
import type { MyRoute, MyRouteDay, MyRouteStop } from "../types";

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

type VisitCompletionTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

type ActualStayMinutesTarget = VisitCompletionTarget & {
  verification: RouteStopVisitVerificationInput;
};

type VerificationPhotoPreviewTarget = {
  routeDay: MyRouteDay;
  stop: MyRouteStop;
};

type EarlyRouteCompletionTarget = VisitCompletionTarget & {
  startedAt: string;
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

type RouteOneNativePosition = {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
};

type RouteOneNativePhoto = {
  uri: string | null;
  dataUrl?: string | null;
  width: number | null;
  height: number | null;
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

type VisitPhotoSource = "camera" | "library";

type RouteOneNativePhotoUploadTarget = {
  uploadUrl: string;
  imageId: string;
  imageUrl: string;
  fileName: string;
  environment: string;
};

type RouteOneNativePhotoUploadResult = {
  uploadedImageId?: string | null;
  uploadedImageUrl?: string | null;
};

type RouteOneNativeBridge = {
  getCurrentPosition?: () => Promise<RouteOneNativePosition>;
  takeVisitPhoto?: (options?: {
    source?: VisitPhotoSource;
    uploadTarget?: RouteOneNativePhotoUploadTarget;
  }) => Promise<RouteOneNativePhoto>;
  uploadVisitPhoto?: (options: {
    photoUri: string;
    uploadTarget: RouteOneNativePhotoUploadTarget;
  }) => Promise<RouteOneNativePhotoUploadResult>;
};

type CloudflareImageUploadResponse = {
  success?: boolean;
  result?: {
    id?: string;
    variants?: string[];
  };
  errors?: Array<{
    message?: string;
  }>;
};

type RouteStopSchedule = {
  startMinutes: number;
  endMinutes: number;
};

const DEFAULT_ROUTE_DAY_START_MINUTES = 9 * 60;

function formatClock(totalMinutes: number, text: UiText) {
  const normalizedMinutes = Math.max(0, Math.round(totalMinutes));
  const dayOffset = Math.floor(normalizedMinutes / (24 * 60));
  const minutesInDay = normalizedMinutes % (24 * 60);
  const hour = Math.floor(minutesInDay / 60);
  const minute = minutesInDay % 60;
  const clockText = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  if (dayOffset === 0) {
    return clockText;
  }

  return dayOffset === 1
    ? text.dayRoute.nextDayClock(clockText)
    : text.dayRoute.dayOffsetClock(dayOffset, clockText);
}

function formatStayMinutes(value: number | null, text: UiText) {
  if (!value || value <= 0) {
    return text.dayRoute.noTime;
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  if (hour > 0 && minute > 0) {
    return text.dayRoute.hoursMinutes(hour, minute);
  }

  return hour > 0 ? text.dayRoute.hours(hour) : text.dayRoute.minutes(minute);
}

function formatTravelMinutes(value: number, text: UiText) {
  if (value < 60) {
    return text.dayRoute.minutes(value);
  }

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  return minute > 0
    ? text.dayRoute.hoursMinutes(hour, minute)
    : text.dayRoute.hours(hour);
}

function getRouteStopVerificationBadge(stop: MyRouteStop) {
  if (stop.verificationStatus === "GPS_PHOTO") {
    return {
      kind: "gps-photo" as const,
      label: "GPS 인증",
      previewLabel: "GPS 인증 사진",
      className:
        "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/25",
    };
  }

  if (stop.verificationStatus === "GPS") {
    return {
      kind: "gps" as const,
      label: "GPS 인증",
      previewLabel: "GPS 인증",
      className:
        "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-400/25",
    };
  }

  if (stop.verificationPhotoUrl) {
    return {
      kind: "photo-record" as const,
      label: "사진 기록",
      previewLabel: "사진 기록",
      className:
        "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25",
    };
  }

  if (stop.verificationStatus === "MANUAL") {
    return {
      kind: "manual" as const,
      label: "수동",
      previewLabel: "수동",
      className:
        "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    };
  }

  return null;
}

function getRouteOneNativeBridge() {
  return (window as Window & { RouteOneNative?: RouteOneNativeBridge })
    .RouteOneNative;
}

async function requestCurrentPosition() {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.getCurrentPosition) {
    throw new Error("앱에서만 위치 인증을 사용할 수 있어요.");
  }

  return nativeBridge.getCurrentPosition();
}

async function requestVisitPhoto(
  source: VisitPhotoSource,
  uploadTarget?: RouteOneNativePhotoUploadTarget
) {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.takeVisitPhoto) {
    throw new Error("앱에서만 사진 인증을 사용할 수 있어요.");
  }

  return nativeBridge.takeVisitPhoto(
    uploadTarget
      ? {
          source,
          uploadTarget,
        }
      : {
          source,
        }
  );
}

async function requestVisitPhotoUpload(
  photoUri: string,
  uploadTarget: RouteOneNativePhotoUploadTarget
) {
  const nativeBridge = getRouteOneNativeBridge();

  if (!nativeBridge?.uploadVisitPhoto) {
    return null;
  }

  return nativeBridge.uploadVisitPhoto({
    photoUri,
    uploadTarget,
  });
}

function assertCloudflareUploadUrl(uploadUrl: string) {
  const url = new URL(uploadUrl);

  if (url.protocol !== "https:" || url.hostname !== "upload.imagedelivery.net") {
    throw new Error("사진 업로드 URL이 올바르지 않아요.");
  }
}

function getCloudflareUploadError(payload: CloudflareImageUploadResponse) {
  return (
    payload.errors
      ?.map((error) => error.message)
      .filter(Boolean)
      .join(", ") || "사진 업로드에 실패했어요."
  );
}

function createBlobFromDataUrl(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(",");

  if (!dataUrl.startsWith("data:") || separatorIndex < 0) {
    throw new Error("사진 데이터 형식이 올바르지 않아요.");
  }

  const metadata = dataUrl.slice(5, separatorIndex).split(";");
  const mimeType = metadata[0] || "image/jpeg";
  const isBase64 = metadata
    .slice(1)
    .some((part) => part.trim().toLowerCase() === "base64");

  if (!isBase64) {
    throw new Error("사진 데이터 형식이 올바르지 않아요.");
  }

  const byteString = window.atob(dataUrl.slice(separatorIndex + 1));
  const chunks: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteString.length; offset += 1024) {
    const slice = byteString.slice(offset, offset + 1024);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);

    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }

    chunks.push(buffer);
  }

  return new Blob(chunks, {
    type: mimeType,
  });
}

async function parseCloudflareUploadResponse(response: Response) {
  try {
    return (await response.json()) as CloudflareImageUploadResponse;
  } catch {
    return {
      success: false,
      errors: [{ message: "사진 업로드 응답을 읽지 못했어요." }],
    };
  }
}

async function uploadVerifiedVisitPhoto(
  uploadTarget: RouteOneNativePhotoUploadTarget,
  photo: RouteOneNativePhoto
) {
  if (photo.uploadedImageUrl) {
    return photo.uploadedImageUrl;
  }

  if (!uploadTarget.uploadUrl) {
    if (photo.dataUrl) {
      return photo.dataUrl;
    }

    return uploadTarget.imageUrl;
  }

  if (photo.uri) {
    const nativeUploadResult = await requestVisitPhotoUpload(
      photo.uri,
      uploadTarget
    );

    if (nativeUploadResult) {
      return nativeUploadResult.uploadedImageUrl ?? uploadTarget.imageUrl;
    }
  }

  if (!photo.dataUrl) {
    throw new Error("사진 업로드에 사용할 데이터를 찾지 못했어요.");
  }

  assertCloudflareUploadUrl(uploadTarget.uploadUrl);

  const formData = new FormData();

  formData.append(
    "file",
    createBlobFromDataUrl(photo.dataUrl),
    uploadTarget.fileName
  );

  const response = await fetch(uploadTarget.uploadUrl, {
    method: "POST",
    body: formData,
  });
  const payload = await parseCloudflareUploadResponse(response);

  if (!response.ok || !payload.success) {
    throw new Error(getCloudflareUploadError(payload));
  }

  return payload.result?.variants?.[0] ?? uploadTarget.imageUrl;
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

function getTravelSegmentLabel(segment: TravelSegmentState | null, text: UiText) {
  if (!segment || segment.status === "loading") {
    return text.dayRoute.travelLoading;
  }

  if (segment.status === "error") {
    return text.dayRoute.travelError;
  }

  const duration = formatTravelMinutes(segment.minutes, text);

  return segment.status === "success"
    ? text.dayRoute.travelByCar(duration)
    : text.dayRoute.travelEstimatedByCar(duration);
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

function getStopStayMinutes(stop: MyRouteStop) {
  return stop.stayMinutes ?? 60;
}

function getStopTravelMinutes(
  stop: MyRouteStop,
  index: number,
  startLocation: MyRoute["startLocation"]
) {
  if (index === 0 && !startLocation) {
    return 0;
  }

  return Math.max(0, stop.travelMinutesFromPrevious ?? 0);
}

function buildRouteStopSchedules(
  stops: MyRouteStop[],
  startLocation: MyRoute["startLocation"]
) {
  let currentMinutes = DEFAULT_ROUTE_DAY_START_MINUTES;

  return stops.map((stop, index): RouteStopSchedule => {
    currentMinutes += getStopTravelMinutes(stop, index, startLocation);

    const startMinutes = currentMinutes;
    const endMinutes = startMinutes + getStopStayMinutes(stop);
    currentMinutes = endMinutes;

    return {
      startMinutes,
      endMinutes,
    };
  });
}

function formatRouteStopSchedule(schedule: RouteStopSchedule, text: UiText) {
  return `${formatClock(schedule.startMinutes, text)}-${formatClock(
    schedule.endMinutes,
    text
  )}`;
}

function formatScheduleDuration(totalMinutes: number, text: UiText) {
  return formatTravelMinutes(Math.max(0, totalMinutes), text);
}

function clampStayMinutes(value: number) {
  return Math.max(10, Math.min(480, Math.round(value / 10) * 10));
}

function getDayStartTitle(
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"],
  text: UiText
) {
  if (startLocation) {
    return text.dayRoute.savedStartLocation;
  }

  return dayStops[0]?.place.title ?? text.dayRoute.noStartPlace;
}

function getDayStartDescription(
  routeDay: MyRouteDay,
  dayStops: MyRouteStop[],
  startLocation: MyRoute["startLocation"],
  text: UiText
) {
  if (startLocation) {
    return text.dayRoute.startFromMapDescription(routeDay.dayIndex);
  }

  if (dayStops[0]) {
    return text.dayRoute.startFromFirstPlaceDescription(routeDay.dayIndex);
  }

  return text.dayRoute.emptyStartDescription;
}

function getLocalizedRouteTitle(route: MyRoute, text: UiText) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return text.dayRoute.undatedRouteTitle;
  }

  return text.dayRoute.routeTitle(startDate, endDate);
}

function getLocalizedDayDateLabel(day: MyRouteDay, text: UiText) {
  return formatRouteDate(day.date) ?? text.dayRoute.dateUnknown;
}

function getLocalizedDaySummary(day: MyRouteDay, text: UiText) {
  const firstPlace = day.stops[0]?.place.title;
  const stopCount = day.stops.length;

  if (!firstPlace || stopCount === 0) {
    return text.dayRoute.daySummaryEmpty;
  }

  return stopCount > 1
    ? text.dayRoute.daySummaryMore(firstPlace, stopCount - 1)
    : firstPlace;
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
  canToggleVisited,
  enableVerificationPhotoPreview,
  travelSegmentToNext,
  scheduleLabel,
  onStartDrag,
  onRequestStayMinutesEdit,
  onToggleVisited,
  onOpenPlace,
  onOpenVerificationPhoto,
}: {
  stop: MyRouteStop;
  index: number;
  isLast: boolean;
  isOrderEditing: boolean;
  isDragging: boolean;
  isVisitSaving: boolean;
  isStaySaving: boolean;
  isReadOnly: boolean;
  canToggleVisited: boolean;
  enableVerificationPhotoPreview: boolean;
  travelSegmentToNext: TravelSegmentState | null;
  scheduleLabel: string | null;
  onStartDrag: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
  onOpenVerificationPhoto: (stop: MyRouteStop) => void;
}) {
  const text = useUiText();
  const isVisited = isVisitedStop(stop);
  const stayMinutes = stop.stayMinutes ?? 60;
  const statusLabel = isVisited
    ? text.dayRoute.visited
    : text.dayRoute.notVisited;
  const verificationBadge = isVisited
    ? getRouteStopVerificationBadge(stop)
    : null;
  const canOpenVerificationPhoto =
    enableVerificationPhotoPreview &&
    Boolean(stop.verificationPhotoUrl);
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
                {verificationBadge ? (
                  canOpenVerificationPhoto ? (
                    <button
                      type="button"
                      aria-label={text.dayRoute.viewVerificationPhotoAria(
                        stop.place.title,
                        verificationBadge.previewLabel
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenVerificationPhoto(stop);
                      }}
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full py-1 pl-1 pr-2.5 text-[11px] font-black ring-1 transition active:scale-95 ${verificationBadge.className}`}
                    >
                      <span className="size-5 overflow-hidden rounded-full bg-white ring-1 ring-white/80">
                        <img
                          src={stop.verificationPhotoUrl ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </span>
                      {verificationBadge.kind === "gps-photo" ? (
                        <MdMyLocation className="text-sm" />
                      ) : null}
                      {verificationBadge.label}
                    </button>
                  ) : (
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${verificationBadge.className}`}
                    >
                      {verificationBadge.kind === "manual" ? (
                        <MdCheckCircle className="text-sm" />
                      ) : verificationBadge.kind === "photo-record" ? (
                        <MdImage className="text-sm" />
                      ) : (
                        <MdMyLocation className="text-sm" />
                      )}
                      {verificationBadge.label}
                    </span>
                  )
                ) : null}
                <span className="min-w-0 truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                  {localizePlaceCategoryLabel(
                    stop.place.categoryLabel ?? stop.place.categoryName,
                    text
                  )}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {scheduleLabel ? (
                  <span className={stayTimeClass}>
                    <MdAccessTime className="text-sm" />
                    <span className="whitespace-nowrap">{scheduleLabel}</span>
                  </span>
                ) : null}
                {isReadOnly ? (
                  <span className={stayTimeClass}>
                    <MdAccessTime className="text-sm" />
                    <span className="whitespace-nowrap">
                      {formatStayMinutes(stayMinutes, text)}
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
                      {formatStayMinutes(stayMinutes, text)}
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
                aria-label={text.dayRoute.moveOrderAria(stop.place.title)}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onStartDrag(event);
                }}
                onClick={(event) => event.stopPropagation()}
                className="flex size-9 shrink-0 touch-none items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 active:cursor-grabbing"
              >
                <MdDragIndicator />
              </button>
            ) : !canToggleVisited ? null : (
              <button
                type="button"
                aria-label={
                  isVisited
                    ? text.dayRoute.cancelVisitAria(stop.place.title)
                    : text.dayRoute.markVisitAria(stop.place.title)
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleVisited(stop);
                }}
                disabled={isVisitSaving}
                title={
                  isVisited
                    ? text.dayRoute.cancelVisitTitle
                    : text.dayRoute.markVisitTitle
                }
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
            {text.dayRoute.nextPlaceTravel(
              getTravelSegmentLabel(travelSegmentToNext, text)
            )}
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
  const text = useUiText();
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
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label="머무는 시간 수정 닫기"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[340px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
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
          {formatStayMinutes(draftMinutes, text)}
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

function ActualStayMinutesPopup({
  target,
  isSaving,
  onSkip,
  onApply,
}: {
  target: ActualStayMinutesTarget;
  isSaving: boolean;
  onSkip: (target: ActualStayMinutesTarget) => void;
  onApply: (target: ActualStayMinutesTarget, actualStayMinutes: number) => void;
}) {
  const text = useUiText();
  const [draftMinutes, setDraftMinutes] = useState(
    target.stop.stayMinutes ?? 60
  );
  const updateDraftMinutes = (nextMinutes: number) => {
    setDraftMinutes(clampStayMinutes(nextMinutes));
  };

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label="머문 시간 입력 배경"
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[340px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">ACTUAL STAY</p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              얼마나 머물렀나요?
            </h3>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">
              {target.stop.place.title}
            </p>
          </div>
          <button
            type="button"
            aria-label="머문 시간 입력 건너뛰기"
            disabled={isSaving}
            onClick={() => onSkip(target)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="머문 시간 줄이기"
            disabled={isSaving}
            onClick={() => updateDraftMinutes(draftMinutes - 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 disabled:opacity-40"
          >
            <MdRemove />
          </button>
          <label className="flex min-w-[132px] items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <input
              aria-label="실제 머문 시간(분)"
              type="number"
              min={10}
              max={480}
              step={10}
              value={draftMinutes}
              disabled={isSaving}
              onChange={(event) => updateDraftMinutes(Number(event.target.value))}
              className="w-16 bg-transparent text-center text-2xl font-black text-slate-900 outline-none disabled:opacity-60"
            />
            <span className="text-sm font-bold text-slate-500">분</span>
          </label>
          <button
            type="button"
            aria-label="머문 시간 늘리기"
            disabled={isSaving}
            onClick={() => updateDraftMinutes(draftMinutes + 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 disabled:opacity-40"
          >
            <MdAdd />
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-black text-brand-700">
          {formatStayMinutes(draftMinutes, text)}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onSkip(target)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            건너뛰기
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onApply(target, draftMinutes)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            저장
          </button>
        </div>
      </section>
    </div>
  );
}

function VisitCompletionPopup({
  target,
  isSaving,
  mode,
  onClose,
  onCompleteWithPhoto,
  onCompleteManually,
}: {
  target: VisitCompletionTarget;
  isSaving: boolean;
  mode: "live" | "retrospective";
  onClose: () => void;
  onCompleteWithPhoto: (
    target: VisitCompletionTarget,
    source: VisitPhotoSource
  ) => void;
  onCompleteManually: (target: VisitCompletionTarget) => void;
}) {
  const photoActionDisabled = isSaving;
  const isRetrospective = mode === "retrospective";

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label="완료 방식 선택 닫기"
        className="absolute inset-0 cursor-default"
        onClick={isSaving ? undefined : onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[350px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">VISIT CHECK</p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {target.stop.place.title}
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {isRetrospective
                ? "지난 일정은 GPS 없이 사진 기록 또는 수동으로 저장해요."
                : "사진과 현재 위치를 확인해 사진 인증으로 저장해요."}
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            disabled={isSaving}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {isRetrospective ? (
            <button
              type="button"
              disabled={photoActionDisabled}
              onClick={() => onCompleteWithPhoto(target, "library")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-black text-white disabled:opacity-60"
            >
              {photoActionDisabled ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <MdImage className="text-lg" />
              )}
              사진 기록
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={photoActionDisabled}
                onClick={() => onCompleteWithPhoto(target, "camera")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {photoActionDisabled ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <MdPhotoCamera className="text-lg" />
                )}
                카메라
              </button>
              <button
                type="button"
                disabled={photoActionDisabled}
                onClick={() => onCompleteWithPhoto(target, "library")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-3 text-sm font-black text-brand-700 disabled:opacity-60"
              >
                <MdImage className="text-lg" />
                앨범
              </button>
            </div>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onCompleteManually(target)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            {isRetrospective ? "수동" : "인증 없이 완료"}
          </button>
        </div>
      </section>
    </div>
  );
}

function VerificationPhotoPreviewPopup({
  target,
  onClose,
}: {
  target: VerificationPhotoPreviewTarget;
  onClose: () => void;
}) {
  const photoUrl = target.stop.verificationPhotoUrl;
  const isGpsPhoto = target.stop.verificationStatus === "GPS_PHOTO";
  const previewTitle = isGpsPhoto ? "PHOTO VERIFIED" : "PHOTO RECORD";
  const previewLabel = isGpsPhoto ? "GPS 인증" : "사진 기록";
  const previewBadgeClass = isGpsPhoto
    ? "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/25"
    : "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25";
  const verifiedAtLabel = target.stop.verifiedAt
    ? formatDateKeyLabel(target.stop.verifiedAt.slice(0, 10))
    : null;

  if (!photoUrl) {
    return null;
  }

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3300] flex items-center justify-center bg-slate-950/75 px-4 py-6">
      <button
        type="button"
        aria-label={`${previewLabel} 이미지 닫기`}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative flex max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative min-h-0 bg-slate-950">
          <img
            src={photoUrl}
            alt={`${target.stop.place.title} ${previewLabel} 이미지`}
            className="max-h-[68vh] w-full object-contain"
          />
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-slate-950/65 text-lg text-white shadow-lg backdrop-blur"
          >
            <MdClose />
          </button>
        </div>
        <div className="p-4">
          <p className="font-trip text-sm text-brand-700">{previewTitle}</p>
          <h3 className="mt-1 truncate text-lg font-black text-slate-900 dark:text-white">
            {target.stop.place.title}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 dark:bg-brand-400/10 dark:text-brand-100 dark:ring-brand-400/25">
              DAY {target.routeDay.dayIndex}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${previewBadgeClass}`}
            >
              {isGpsPhoto ? (
                <MdMyLocation className="text-sm" />
              ) : (
                <MdImage className="text-sm" />
              )}
              {previewLabel}
            </span>
            {isGpsPhoto ? null : (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                GPS 없음
              </span>
            )}
            {verifiedAtLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {verifiedAtLabel}
              </span>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function formatDateKeyLabel(dateKey: string | null) {
  if (!dateKey) {
    return "미정";
  }

  const [year, month, day] = dateKey.split("-");

  return `${year}.${Number(month)}.${Number(day)}`;
}

function formatRouteDurationDays(days: number) {
  return days <= 1 ? "당일 여행" : `${days - 1}박 ${days}일`;
}

function EarlyRouteCompletionPopup({
  target,
  plannedDays,
  actualDays,
  expectedEndDateKey,
  isSaving,
  onChangeStartedAt,
  onCompleteAsIs,
  onCompleteWithStartDate,
  onClose,
}: {
  target: EarlyRouteCompletionTarget;
  plannedDays: number;
  actualDays: number;
  expectedEndDateKey: string | null;
  isSaving: boolean;
  onChangeStartedAt: (value: string) => void;
  onCompleteAsIs: () => void;
  onCompleteWithStartDate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label="예정 기간 확인 닫기"
        className="absolute inset-0 cursor-default"
        onClick={isSaving ? undefined : onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[350px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">CHECK OUT</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">
              예정보다 일찍 종료돼요
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              지금 완료하면 실제 여행 기간이 계획보다 짧게 저장돼요.
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            disabled={isSaving}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-semibold leading-5 text-amber-800">
          계획: {formatRouteDurationDays(plannedDays)}
          <br />
          실제: {formatRouteDurationDays(actualDays)}
          {expectedEndDateKey ? (
            <>
              <br />
              예상 종료일: {formatDateKeyLabel(expectedEndDateKey)}
            </>
          ) : null}
        </div>

        <label className="mt-4 block text-xs font-black text-slate-500">
          실제 시작일
          <input
            type="date"
            value={target.startedAt}
            disabled={isSaving}
            onChange={(event) => onChangeStartedAt(event.target.value)}
            className="mt-2 h-12 w-full rounded-2xl border border-brand-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-brand-500 disabled:opacity-60"
          />
        </label>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            disabled={isSaving || !target.startedAt}
            onClick={onCompleteWithStartDate}
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
          >
            {isSaving ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            시작일 수정 후 완료
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCompleteAsIs}
            className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-bold text-brand-700 disabled:opacity-60"
          >
            이대로 완료
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            취소
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
  canToggleVisited,
  enableVerificationPhotoPreview,
  travelSegmentByKey,
  onSelect,
  onRegisterDropZone,
  onStartDrag,
  onRequestStayMinutesEdit,
  onToggleVisited,
  onOpenPlace,
  onOpenVerificationPhoto,
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
  canToggleVisited: boolean;
  enableVerificationPhotoPreview: boolean;
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
  onOpenVerificationPhoto: (target: VerificationPhotoPreviewTarget) => void;
}) {
  const text = useUiText();
  const dayStops = orderedStops;
  const hasDayStops = dayStops.length > 0;
  const stopSchedules = useMemo(
    () => buildRouteStopSchedules(dayStops, startLocation),
    [dayStops, startLocation]
  );
  const firstStopSchedule = stopSchedules[0] ?? null;
  const lastStopSchedule = stopSchedules.at(-1) ?? null;
  const totalScheduleMinutes = lastStopSchedule
    ? lastStopSchedule.endMinutes - DEFAULT_ROUTE_DAY_START_MINUTES
    : 0;
  const dayStartTitle = getDayStartTitle(dayStops, startLocation, text);
  const dayStartDescription = getDayStartDescription(
    routeDay,
    dayStops,
    startLocation,
    text
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
  const startLabel = startLocation ? text.dayRoute.start : text.dayRoute.firstPlace;
  const startTitlePrefix = startLocation ? "START" : text.dayRoute.firstPlace;
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
                {getLocalizedDayDateLabel(routeDay, text)} ·{" "}
                {getLocalizedDaySummary(routeDay, text)}
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
                    {text.dayRoute.firstPlaceTravel(
                      getTravelSegmentLabel(firstTravelSegment, text)
                    )}
                  </p>
                ) : startLocation || !hasDayStops ? null : (
                  <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500">
                    <MdDirectionsCar className="text-sm" />
                    {text.dayRoute.noStartGps}
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
                        ? text.dayRoute.allPlacesCompleted
                        : text.dayRoute.remainingPlaces(
                            dayStops.length - completedStopCount
                          )}
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
                  {text.dayRoute.dragGuide}
                </div>
              ) : null}
              {firstStopSchedule && lastStopSchedule ? (
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {text.dayRoute.expectedStart}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatClock(DEFAULT_ROUTE_DAY_START_MINUTES, text)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {text.dayRoute.expectedEnd}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatClock(lastStopSchedule.endMinutes, text)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-2 shadow-sm">
                    <p className="text-[10px] font-black text-slate-400">
                      {text.dayRoute.totalDuration}
                    </p>
                    <p className="mt-0.5 text-sm font-black text-slate-900">
                      {formatScheduleDuration(totalScheduleMinutes, text)}
                    </p>
                  </div>
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
                      {text.dayRoute.dropHere}
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
                    canToggleVisited={canToggleVisited}
                    enableVerificationPhotoPreview={
                      enableVerificationPhotoPreview
                    }
                    travelSegmentToNext={
                      getStoredTravelSegment(dayStops[index + 1]) ??
                      (dayStops[index + 1]
                        ? getFallbackTravelSegment(
                            stop.place,
                            dayStops[index + 1].place
                          )
                        : null)
                    }
                    scheduleLabel={
                      stopSchedules[index]
                        ? formatRouteStopSchedule(stopSchedules[index], text)
                        : null
                    }
                    onStartDrag={(event) => onStartDrag(stop, index, event)}
                    onRequestStayMinutesEdit={onRequestStayMinutesEdit}
                    onToggleVisited={onToggleVisited}
                    onOpenPlace={onOpenPlace}
                    onOpenVerificationPhoto={(selectedStop) =>
                      onOpenVerificationPhoto({
                        routeDay,
                        stop: selectedStop,
                      })
                    }
                  />
                </div>
              ))}
              {isOrderEditing && activeDropIndex === dayStops.length ? (
                <div className="rounded-2xl border border-dashed border-brand-500 bg-brand-50 px-3 py-2 text-center text-xs font-black text-brand-700">
                  {text.dayRoute.dropToEnd}
                </div>
              ) : null}
            </>
          ) : (
            <PotatoLoadingCard
              title={text.dayRoute.emptyDayTitle}
              description={text.dayRoute.emptyDayDescription}
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
  const queryClient = useQueryClient();
  const openModal = useUiModalStore((state) => state.openModal);
  const openSheet = useMapSheetStore((state) => state.openSheet);
  const showToast = useUiToastStore((state) => state.showToast);
  const invalidateRouteHistory = () => {
    void queryClient.invalidateQueries({
      queryKey: MY_ROUTE_HISTORY_QUERY_KEY,
    });
  };
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
  const [visitCompletionTarget, setVisitCompletionTarget] =
    useState<VisitCompletionTarget | null>(null);
  const [verificationPhotoPreviewTarget, setVerificationPhotoPreviewTarget] =
    useState<VerificationPhotoPreviewTarget | null>(null);
  const [actualStayMinutesTarget, setActualStayMinutesTarget] =
    useState<ActualStayMinutesTarget | null>(null);
  const [earlyRouteCompletionTarget, setEarlyRouteCompletionTarget] =
    useState<EarlyRouteCompletionTarget | null>(null);
  const [isUpdatingRouteStartDate, setIsUpdatingRouteStartDate] =
    useState(false);
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
  const todayKey = getTodayDateKey();
  const isOrderDirty = !isSameStopOrder(orderedStops, baseStopIds);
  const isRouteCompleted = routeStopCount > 0 && routeCompletedStopCount === routeStopCount;
  const canToggleVisitStatus = !isReadOnly || allowVisitCompletion;
  const isRetrospectiveCompletion = visitCompletionMode === "retrospective";
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
      invalidateRouteHistory();
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

  const persistStopVisit = async (
    routeDay: MyRouteDay,
    stop: MyRouteStop,
    nextVisited: boolean,
    verification?: RouteStopVisitVerificationInput | null,
    actualStayMinutes?: number | null
  ) => {
    const isActiveRouteDay = routeDay.id === activeDay.id;
    const sourceStops = isActiveRouteDay ? orderedStops : routeDay.stops;
    const wasDayCompleted =
      sourceStops.length > 0 &&
      sourceStops.filter(isVisitedStop).length === sourceStops.length;
    const previousStops = orderedStops;
    const visitedAt = new Date().toISOString();
    const nextVerificationStatus = nextVisited
      ? (verification?.status ?? "MANUAL")
      : "NONE";
    const isPhotoVerified = nextVerificationStatus === "GPS_PHOTO";
    const hasPhotoRecord = nextVisited && Boolean(verification?.photoUrl);
    const optimisticStops: MyRouteStop[] = sourceStops.map((currentStop) =>
      currentStop.id === stop.id
        ? {
            ...currentStop,
            visitStatus: nextVisited ? "VISITED" : "PENDING",
            visitedAt: nextVisited ? visitedAt : null,
            verificationStatus: nextVerificationStatus,
            verifiedAt: isPhotoVerified ? visitedAt : null,
            verificationPhotoImageId: isPhotoVerified || hasPhotoRecord
              ? (verification?.photoImageId ?? null)
              : null,
            verificationPhotoUrl: isPhotoVerified || hasPhotoRecord
              ? (verification?.photoUrl ?? null)
              : null,
            verificationLat: isPhotoVerified ? (verification?.lat ?? null) : null,
            verificationLng: isPhotoVerified ? (verification?.lng ?? null) : null,
            verificationAccuracyMeters: isPhotoVerified
              ? (verification?.accuracyMeters ?? null)
              : null,
            checkedInAt: isPhotoVerified
              ? (currentStop.checkedInAt ?? visitedAt)
              : null,
            checkedOutAt: null,
            actualStayMinutes: nextVisited ? (actualStayMinutes ?? null) : null,
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
        verificationStatus: nextVerificationStatus,
        verificationLat: verification?.lat ?? null,
        verificationLng: verification?.lng ?? null,
        verificationAccuracyMeters: verification?.accuracyMeters ?? null,
        verificationPhotoImageId: verification?.photoImageId ?? null,
        verificationPhotoUrl: verification?.photoUrl ?? null,
        actualStayMinutes,
      })
    );

    try {
      const result = await routeApi.markRouteStopVisited(
        stop.id,
        nextVisited,
        nextVisited ? verification : null,
        nextVisited ? actualStayMinutes : null
      );
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
        showToast(
          nextVisited
            ? isPhotoVerified
              ? "사진 인증 완료 처리했어요."
              : hasPhotoRecord
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
      invalidateRouteHistory();

      return true;
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

      return false;
    } finally {
      setVisitSavingStopId(null);
    }
  };

  const handleCompleteStopVisitManually = async (
    target: VisitCompletionTarget
  ) => {
    if (visitSavingStopId) {
      return;
    }

    const isSaved = await persistStopVisit(target.routeDay, target.stop, true, {
      status: "MANUAL",
    });

    if (isSaved) {
      setVisitCompletionTarget(null);
    }
  };

  const handleCompleteStopVisitWithPhoto = async (
    target: VisitCompletionTarget,
    source: VisitPhotoSource
  ) => {
    if (visitSavingStopId) {
      return;
    }

    setVisitSavingStopId(target.stop.id);

    try {
      const position = isRetrospectiveCompletion
        ? null
        : await requestCurrentPosition();
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

      setActualStayMinutesTarget({
        ...target,
        verification,
      });
      setVisitCompletionTarget(null);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "사진 인증을 완료하지 못했어요.",
        2600
      );
    } finally {
      setVisitSavingStopId(null);
    }
  };

  const handleSaveActualStayMinutes = async (
    target: ActualStayMinutesTarget,
    actualStayMinutes: number | null
  ) => {
    if (visitSavingStopId) {
      return;
    }

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

    setIsUpdatingRouteStartDate(true);

    try {
      const result = await routeApi.startRoute({
        routeId: route.id,
        startedAt: earlyRouteCompletionTarget.startedAt,
      });

      queryClient.setQueryData<MyRoutesQuery>(
        MY_ROUTES_QUERY_KEY,
        (currentData) => upsertMyRouteCache(currentData, result.startRoute)
      );
      showToast("실제 시작일을 수정했어요.");
      openVisitCompletionTarget(earlyRouteCompletionTarget);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "시작일을 수정하지 못했어요.",
        2600
      );
    } finally {
      setIsUpdatingRouteStartDate(false);
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
      invalidateRouteHistory();
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
      void queryClient.invalidateQueries({
        queryKey: SHARED_ROUTES_QUERY_KEY,
      });
      invalidateRouteHistory();
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
      invalidateRouteHistory();
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
    setActualStayMinutesTarget(null);
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
        language: appLanguage,
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
  }, [appLanguage, travelSegmentRequests]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

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

export default DayRoutePopup;
