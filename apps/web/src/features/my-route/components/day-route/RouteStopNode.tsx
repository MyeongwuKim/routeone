import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  MdAccessTime,
  MdArrowBack,
  MdArrowForward,
  MdCheck,
  MdCheckCircle,
  MdClose,
  MdDirectionsCar,
  MdDragIndicator,
  MdDeleteOutline,
  MdEdit,
  MdFlag,
  MdGpsFixed,
  MdImage,
  MdLockOutline,
  MdMyLocation,
  MdMap,
  MdOutlinePlace,
  MdPublic,
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
  isActiveDestination: boolean;
  canToggleVisited: boolean;
  enableVerificationPhotoPreview: boolean;
  isGpsTestEnabled: boolean;
  isGpsTestLocationActive: boolean;
  isNotificationFocused: boolean;
  travelSegmentToNext: TravelSegmentState | null;
  scheduleLabel: string | null;
  canEditVisitTimes: boolean;
  canEditVerificationPhoto: boolean;
  previousDayIndex: number | null;
  nextDayIndex: number | null;
  onStartDrag: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onMoveToPreviousDay?: () => void;
  onMoveToNextDay?: () => void;
  onRemoveFromRoute: () => void;
  onRequestStayMinutesEdit: (stop: MyRouteStop) => void;
  onRequestVisitTimesEdit: (stop: MyRouteStop) => void;
  onToggleVisited: (stop: MyRouteStop) => void;
  onOpenPlace: (stop: MyRouteStop) => void;
  onOpenDirections: (stop: MyRouteStop) => void;
  onEditVerificationPhoto: (stop: MyRouteStop) => void;
  onOpenGpsTest: (stop: MyRouteStop) => void;
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
  isActiveDestination,
  canToggleVisited,
  enableVerificationPhotoPreview,
  isGpsTestEnabled,
  isGpsTestLocationActive,
  isNotificationFocused,
  travelSegmentToNext,
  scheduleLabel,
  canEditVisitTimes,
  canEditVerificationPhoto,
  previousDayIndex,
  nextDayIndex,
  onStartDrag,
  onMoveToPreviousDay,
  onMoveToNextDay,
  onRemoveFromRoute,
  onRequestStayMinutesEdit,
  onRequestVisitTimesEdit,
  onToggleVisited,
  onOpenPlace,
  onOpenDirections,
  onEditVerificationPhoto,
  onOpenGpsTest,
  onOpenVerificationPhoto,
}: RouteStopNodeProps) {
  const text = useUiText();
  const cardRef = useRef<HTMLDivElement>(null);
  const isVisited = isVisitedStop(stop);
  const isCheckedIn = !isVisited && Boolean(stop.checkedInAt);
  const stayMinutes = stop.stayMinutes ?? 60;
  const hasActualStayMinutes =
    isVisited && Boolean(stop.actualStayMinutes && stop.actualStayMinutes > 0);
  const displayedStayMinutes = hasActualStayMinutes
    ? (stop.actualStayMinutes ?? stayMinutes)
    : stayMinutes;
  const stayDurationLabel = hasActualStayMinutes
    ? text.dayRoute.actualStay(
        formatStayMinutes(displayedStayMinutes, text)
      )
    : text.dayRoute.plannedStay(
        formatStayMinutes(displayedStayMinutes, text)
      );
  const statusLabel = isVisited
    ? text.dayRoute.visited
    : isCheckedIn
      ? text.dayRoute.visiting
      : text.dayRoute.notVisited;
  const verificationBadge = isVisited || isCheckedIn
    ? getRouteStopVerificationBadge(stop, text)
    : null;
  const canOpenVerificationPhoto =
    enableVerificationPhotoPreview && Boolean(stop.verificationPhotoUrl);
  const canAddVerificationPhoto =
    canEditVerificationPhoto && isVisited && !stop.verificationPhotoUrl;
  const stayTimeClass =
    "inline-flex items-center justify-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700 ring-1 ring-brand-100 disabled:opacity-45 dark:bg-slate-950 dark:text-brand-100 dark:ring-brand-400/25";

  useEffect(() => {
    if (!isNotificationFocused) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      cardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      cardRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isNotificationFocused]);

  return (
    <div className={`relative flex gap-3 ${isDragging ? "opacity-35" : ""}`}>
      {!isLast ? (
        <div
          className={`absolute left-[19px] top-10 h-[calc(100%-1.75rem)] w-0.5 rounded-full ${
            isVisited || isCheckedIn
              ? "bg-brand-500"
              : "bg-slate-200 dark:bg-slate-700"
          }`}
        />
      ) : null}
      <div
        className={`relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-white text-xs font-black shadow-sm ${
          isVisited
            ? "bg-brand-600 text-white shadow-brand-200"
            : isCheckedIn
              ? "bg-brand-100 text-brand-700 ring-2 ring-brand-400 dark:bg-brand-400/15 dark:text-brand-100"
              : isActiveDestination
                ? "bg-brand-600 text-white ring-4 ring-brand-200 shadow-lg shadow-brand-200/70 dark:ring-brand-400/30 dark:shadow-none"
            : "bg-white text-slate-400 ring-2 ring-slate-200 dark:bg-slate-950 dark:text-slate-300 dark:ring-slate-700"
        }`}
      >
        {isVisited ? (
          <MdCheckCircle className="text-lg" />
        ) : isCheckedIn ? (
          <MdMyLocation className="text-lg" />
        ) : (
          index + 1
        )}
      </div>
      <div className="min-w-0 flex-1 pb-5">
        <div
          ref={cardRef}
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
          className={`scroll-m-24 rounded-2xl border-2 px-4 py-3 transition ${
            isOrderEditing
              ? "border-brand-200 bg-white shadow-sm dark:border-brand-400/30 dark:bg-slate-950"
              : isVisited
                ? "cursor-pointer border-brand-500 bg-brand-50 shadow-sm active:scale-[0.99] dark:border-brand-400/40 dark:bg-brand-400/10"
                : isCheckedIn
                  ? "cursor-pointer border-brand-400 bg-brand-50/60 shadow-sm active:scale-[0.99] dark:border-brand-400/40 dark:bg-brand-400/10"
                  : isActiveDestination
                    ? "cursor-pointer border-brand-400 bg-brand-50 shadow-[0_12px_30px_rgba(20,184,166,0.16)] ring-2 ring-brand-200 active:scale-[0.99] dark:border-brand-300 dark:bg-brand-400/10 dark:ring-brand-400/25"
                : "cursor-pointer border-slate-200 bg-white active:scale-[0.99] dark:border-slate-700 dark:bg-slate-950"
          } ${
            isNotificationFocused
              ? "outline-4 outline-offset-2 outline-sky-300 dark:outline-sky-400"
              : ""
          }`}
          aria-current={isActiveDestination ? "step" : undefined}
        >
          <div className="relative flex items-start gap-3">
            <div
              className={`relative size-12 shrink-0 overflow-hidden rounded-xl ${
                isVisited || isCheckedIn || isActiveDestination
                  ? "ring-2 ring-brand-400"
                  : "bg-slate-50 dark:bg-slate-900"
              }`}
            >
              {stop.place.imageUrl ? (
                <img
                  src={stop.place.imageUrl}
                  alt=""
                  className={`h-full w-full object-cover ${
                    isVisited || isCheckedIn ? "brightness-95" : ""
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
              ) : isCheckedIn ? (
                <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-white text-xs text-brand-700 shadow-sm">
                  <MdMyLocation />
                </span>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {isActiveDestination ? (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
                  <MdFlag className="text-xs" />
                  {text.dayRoute.currentDestination}
                </span>
              ) : null}
              <p
                className={`truncate text-sm font-black text-slate-900 dark:text-white ${
                  isOrderEditing ? "pr-20" : "pr-10"
                }`}
              >
                {stop.place.title}
              </p>
              <div className="mt-1 flex items-center">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black ${
                    isVisited
                      ? "bg-brand-600 text-white"
                      : isCheckedIn
                        ? "bg-brand-100 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/30"
                      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  }`}
                >
                  {isVisited ? (
                    <MdCheckCircle className="text-sm" />
                  ) : isCheckedIn ? (
                    <MdMyLocation className="text-sm" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-slate-400" />
                  )}
                  {statusLabel}
                </span>
              </div>
              <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-1.5">
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
                      <span className="relative size-5 shrink-0 rounded-full bg-white ring-1 ring-white/80">
                        <img
                          src={stop.verificationPhotoUrl ?? ""}
                          alt=""
                          className="h-full w-full rounded-full object-cover"
                          loading="lazy"
                        />
                        {stop.verificationPhotoPublicationConsent === true ||
                        stop.verificationPhotoPublishedAt ? (
                          <span
                            aria-label={text.dayRoute.photoPublished}
                            className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-emerald-700 text-[8px] text-white ring-1 ring-white dark:ring-[#0b211f]"
                          >
                            <MdPublic />
                          </span>
                        ) : stop.verificationPhotoPublicationConsent === false ? (
                          <span
                            aria-label={text.dayRoute.photoPrivate}
                            className="absolute -bottom-0.5 -right-0.5 flex size-3 items-center justify-center rounded-full bg-slate-600 text-[8px] text-white ring-1 ring-white dark:ring-[#0b211f]"
                          >
                            <MdLockOutline />
                          </span>
                        ) : null}
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
                {canAddVerificationPhoto ? (
                  <button
                    type="button"
                    disabled={isVisitSaving}
                    onClick={(event) => {
                      event.stopPropagation();
                      onEditVerificationPhoto(stop);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-200 transition active:scale-95 disabled:opacity-50 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-400/30"
                  >
                    {isVisitSaving ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <MdImage className="text-sm" />
                    )}
                    {text.dayRoute.addVisitPhoto}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 truncate text-xs font-semibold text-slate-500 dark:text-slate-300">
                {localizePlaceCategoryLabel(
                  stop.place.categoryLabel ?? stop.place.categoryName,
                  text
                )}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {scheduleLabel ? (
                  canEditVisitTimes && (stop.checkedInAt || isVisited) ? (
                    <>
                      <button
                        type="button"
                        aria-label={text.dayRoute.editVisitTimesAria(
                          stop.place.title
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          onRequestVisitTimesEdit(stop);
                        }}
                        disabled={isVisitSaving}
                        className={stayTimeClass}
                      >
                        {isVisitSaving ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <MdEdit className="text-sm" />
                        )}
                        <span className="whitespace-nowrap">
                          {scheduleLabel}
                        </span>
                      </button>
                      {stop.visitTimeEditedAt ? (
                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-brand-100 px-2 py-1 text-[9px] font-black text-brand-700 dark:bg-brand-400/20 dark:text-brand-100">
                          {text.dayRoute.visitTimeEdited}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span className={stayTimeClass}>
                        <MdAccessTime className="text-sm" />
                        <span className="whitespace-nowrap">
                          {scheduleLabel}
                        </span>
                      </span>
                      {stop.visitTimeEditedAt ? (
                        <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-brand-100 px-2 py-1 text-[9px] font-black text-brand-700 dark:bg-brand-400/20 dark:text-brand-100">
                          {text.dayRoute.visitTimeEdited}
                        </span>
                      ) : null}
                    </>
                  )
                ) : null}
                {isReadOnly || isVisited ? (
                  <span className={stayTimeClass}>
                    <MdAccessTime className="text-sm" />
                    <span className="whitespace-nowrap">
                      {stayDurationLabel}
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestStayMinutesEdit(stop);
                    }}
                    disabled={isStaySaving}
                    className={stayTimeClass}
                  >
                    {isStaySaving ? (
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <MdAccessTime className="text-sm" />
                    )}
                    <span className="whitespace-nowrap">
                      {stayDurationLabel}
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
              {isOrderEditing ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMoveToPreviousDay?.();
                    }}
                    disabled={!onMoveToPreviousDay}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-brand-200 bg-brand-50 px-2 py-2 text-[11px] font-black text-brand-700 disabled:opacity-35"
                  >
                    <MdArrowBack />
                    {previousDayIndex ? `DAY ${previousDayIndex}` : "이전 DAY"}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onMoveToNextDay?.();
                    }}
                    disabled={!onMoveToNextDay}
                    className="inline-flex items-center justify-center gap-1 rounded-xl border border-brand-200 bg-brand-50 px-2 py-2 text-[11px] font-black text-brand-700 disabled:opacity-35"
                  >
                    {nextDayIndex ? `DAY ${nextDayIndex}` : "다음 DAY"}
                    <MdArrowForward />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  aria-label={text.dayRoute.openPlaceDirectionsAria(
                    stop.place.title
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDirections(stop);
                  }}
                  className={`mt-2 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-black transition active:scale-[0.99] ${
                    isActiveDestination
                      ? "bg-brand-600 text-white shadow-sm"
                      : "border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-400/10 dark:text-brand-100"
                  }`}
                >
                  <MdMap className="text-base" />
                  {text.dayRoute.placeDirections}
                </button>
              )}
            </div>
            {isOrderEditing ? (
              <div className="absolute right-0 top-0 flex items-center gap-1">
                <button
                  type="button"
                  aria-label={`${stop.place.title} 삭제`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFromRoute();
                  }}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600"
                >
                  <MdDeleteOutline />
                </button>
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
              </div>
            ) : (
              <div className="absolute right-0 top-0 flex shrink-0 flex-col items-end gap-2">
                {isGpsTestEnabled ? (
                  <button
                    type="button"
                    aria-label={text.dayRoute.gpsTestOpenAria(
                      stop.place.title
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenGpsTest(stop);
                    }}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-black ring-1 transition active:scale-95 ${
                      isGpsTestLocationActive
                        ? "bg-violet-600 text-white ring-violet-600"
                        : "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-400/10 dark:text-violet-100 dark:ring-violet-400/30"
                    }`}
                  >
                    <MdGpsFixed className="text-sm" />
                    {isGpsTestLocationActive
                      ? text.dayRoute.gpsTestActiveButton
                      : text.dayRoute.gpsTestButton}
                  </button>
                ) : null}
                {canToggleVisited ? (
                  <button
                    type="button"
                    aria-label={
                      isVisited
                        ? text.dayRoute.cancelVisitAria(stop.place.title)
                        : isCheckedIn
                          ? text.dayRoute.finishVisitAria(stop.place.title)
                          : text.dayRoute.checkInAria(stop.place.title)
                    }
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleVisited(stop);
                    }}
                    disabled={isVisitSaving}
                    title={
                      isVisited
                        ? text.dayRoute.cancelVisitTitle
                        : isCheckedIn
                          ? text.dayRoute.finishVisitTitle
                          : text.dayRoute.checkInTitle
                    }
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border text-base transition active:scale-95 disabled:opacity-40 ${
                      isVisited
                        ? "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        : isCheckedIn
                          ? "border-brand-500 bg-brand-600 text-white"
                          : "border-brand-300 bg-brand-50 text-brand-700"
                    }`}
                  >
                    {isVisitSaving ? (
                      <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : isVisited ? (
                      <MdClose />
                    ) : isCheckedIn ? (
                      <MdCheck />
                    ) : (
                      <MdMyLocation />
                    )}
                  </button>
                ) : null}
              </div>
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
