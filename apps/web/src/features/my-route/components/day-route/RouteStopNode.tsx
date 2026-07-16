import type { PointerEvent as ReactPointerEvent } from "react";
import {
  MdAccessTime,
  MdCheck,
  MdCheckCircle,
  MdClose,
  MdDirectionsCar,
  MdDragIndicator,
  MdImage,
  MdMyLocation,
  MdOutlinePlace,
} from "react-icons/md";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";
import { isVisitedStop } from "../../routeDisplay";
import type { MyRouteStop } from "../../types";
import {
  formatStayMinutes,
  getTravelSegmentLabel,
} from "../../utils/dayRouteFormatting";
import type { TravelSegmentState } from "../../hooks/useDayRouteTravelSegments";

function getRouteStopVerificationBadge(stop: MyRouteStop, text: UiText) {
  if (stop.verificationStatus === "GPS_PHOTO") {
    return {
      kind: "gps-photo" as const,
      label: text.dayRoute.gpsVerification,
      previewLabel: text.dayRoute.gpsVerificationPhoto,
      className:
        "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-100 dark:ring-emerald-400/25",
    };
  }

  if (stop.verificationStatus === "GPS") {
    return {
      kind: "gps" as const,
      label: text.dayRoute.gpsVerification,
      previewLabel: text.dayRoute.gpsVerification,
      className:
        "bg-sky-50 text-sky-700 ring-sky-100 dark:bg-sky-400/10 dark:text-sky-100 dark:ring-sky-400/25",
    };
  }

  if (stop.verificationPhotoUrl) {
    return {
      kind: "photo-record" as const,
      label: text.dayRoute.photoRecord,
      previewLabel: text.dayRoute.photoRecord,
      className:
        "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/25",
    };
  }

  if (stop.verificationStatus === "MANUAL") {
    return {
      kind: "manual" as const,
      label: text.dayRoute.manualCompletion,
      previewLabel: text.dayRoute.manualCompletion,
      className:
        "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    };
  }

  return null;
}

type RouteStopNodeProps = {
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
  onStartDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
  onOpenVerificationPhoto: (stop: MyRouteStop) => void;
};

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
}: RouteStopNodeProps) {
  const text = useUiText();
  const isVisited = isVisitedStop(stop);
  const stayMinutes = stop.stayMinutes ?? 60;
  const statusLabel = isVisited
    ? text.dayRoute.visited
    : text.dayRoute.notVisited;
  const verificationBadge = isVisited
    ? getRouteStopVerificationBadge(stop, text)
    : null;
  const canOpenVerificationPhoto =
    enableVerificationPhotoPreview && Boolean(stop.verificationPhotoUrl);
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

export default RouteStopNode;
