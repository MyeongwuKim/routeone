import { useState } from "react";
import {
  MdAdd,
  MdAccessTime,
  MdClose,
  MdDeleteOutline,
  MdImage,
  MdLockOutline,
  MdMyLocation,
  MdPhotoCamera,
  MdPlayArrow,
  MdPublic,
  MdRemove,
} from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import { TimeWheelPicker } from "@/components/inputs";
import {
  clampStayMinutes,
  formatClock,
  formatStayMinutes,
} from "../../utils/dayRouteFormatting";
import type { VisitPhotoSource } from "../../services/visitPhotoService";
import type {
  ActualStayMinutesTarget,
  DayStartTimeTarget,
  EarlyRouteCompletionTarget,
  PhotoPublicationTarget,
  StayMinutesEditTarget,
  VerificationPhotoPreviewTarget,
  VisitCompletionTarget,
  VisitTimesEditTarget,
} from "../../models/dayRouteDialogTypes";

function toTimeValue(minutes: number) {
  const normalized = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toMinutesValue(timeValue: string) {
  const [hourText, minuteText] = timeValue.split(":");

  return Number(hourText) * 60 + Number(minuteText);
}

function toLocalTimeInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (number: number) => String(number).padStart(2, "0");

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function combineDateWithTimeInput(
  dateValue: string | null | undefined,
  timeValue: string
) {
  if (!dateValue || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return Number.NaN;
  }

  const date = new Date(dateValue);
  const [hourText, minuteText] = timeValue.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    Number.isNaN(date.getTime()) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return Number.NaN;
  }

  date.setHours(hour, minute, 0, 0);

  return date.getTime();
}

function getVisitTimeEditInitialArrival(target: VisitTimesEditTarget) {
  if (target.stop.checkedInAt) {
    return target.stop.checkedInAt;
  }

  const checkedOutValue = target.stop.checkedOutAt ?? target.stop.visitedAt;

  if (!checkedOutValue) {
    return null;
  }

  const checkedOutTimestamp = Date.parse(checkedOutValue);

  if (!Number.isFinite(checkedOutTimestamp)) {
    return null;
  }

  const stayMinutes =
    target.stop.actualStayMinutes ?? target.stop.stayMinutes ?? 60;

  return new Date(checkedOutTimestamp - stayMinutes * 60_000).toISOString();
}

export function DayStartTimePopup({
  target,
  defaultStartMinutes,
  isSaving,
  onClose,
  onApply,
}: {
  target: DayStartTimeTarget;
  defaultStartMinutes: number | null;
  isSaving: boolean;
  onClose: () => void;
  onApply: (target: DayStartTimeTarget, value: number | string) => void;
}) {
  const text = useUiText();
  const plannedStartMinutes =
    target.routeDay.plannedStartMinutes ?? defaultStartMinutes ?? 9 * 60;
  const [openedAt] = useState(() => Date.now());
  const [timeValue, setTimeValue] = useState(() => {
    if (target.mode === "start") {
      return toLocalTimeInputValue(new Date(openedAt).toISOString());
    }

    if (target.mode === "actual" && target.routeDay.startedAt) {
      return toLocalTimeInputValue(target.routeDay.startedAt);
    }

    return toTimeValue(plannedStartMinutes);
  });
  const selectedTimestamp = combineDateWithTimeInput(
    target.routeDay.date,
    timeValue
  );
  const firstRecordedVisitTimestamp = target.routeDay.stops
    .flatMap((stop) => {
      const completedAt = stop.checkedOutAt ?? stop.visitedAt;
      const completedTimestamp = completedAt
        ? Date.parse(completedAt)
        : Number.NaN;
      const inferredArrivalAt =
        stop.checkedInAt ??
        (Number.isFinite(completedTimestamp) && stop.actualStayMinutes
          ? new Date(
              completedTimestamp - stop.actualStayMinutes * 60_000
            ).toISOString()
          : null);

      return [inferredArrivalAt, completedAt];
    })
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  const isActualMode = target.mode !== "planned";
  const isFuture = isActualMode && selectedTimestamp > openedAt + 60_000;
  const isAfterFirstVisit = Boolean(
    isActualMode &&
    Number.isFinite(firstRecordedVisitTimestamp) &&
    selectedTimestamp > firstRecordedVisitTimestamp
  );
  const isValid =
    target.mode === "planned"
      ? Number.isFinite(toMinutesValue(timeValue))
      : Number.isFinite(selectedTimestamp) && !isFuture && !isAfterFirstVisit;
  const title =
    target.mode === "start"
      ? text.dayRoute.dayStartTitle(target.routeDay.dayIndex)
      : target.mode === "planned"
        ? text.dayRoute.plannedStartEditTitle(target.routeDay.dayIndex)
        : text.dayRoute.actualStartEditTitle(target.routeDay.dayIndex);

  const applySelectedTime = () => {
    if (!isValid) {
      return;
    }

    onApply(
      target,
      target.mode === "planned"
        ? toMinutesValue(timeValue)
        : new Date(selectedTimestamp).toISOString()
    );
  };

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3200] flex items-center justify-center bg-slate-950/45 px-4">
      <button
        type="button"
        aria-label={text.common.close}
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[360px] rounded-[1.5rem] border border-brand-100 bg-white p-4 shadow-2xl dark:border-brand-400/20 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">DAY START</p>
            <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
              {text.dayRoute.dayStartPlannedDescription(
                formatClock(plannedStartMinutes, text)
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.common.close}
            disabled={isSaving}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-4">
          <TimeWheelPicker
            value={timeValue}
            disabled={isSaving}
            onChange={setTimeValue}
          />
        </div>

        {isFuture || isAfterFirstVisit ? (
          <p className="mt-3 rounded-2xl bg-rose-50 px-3 py-2.5 text-xs font-bold leading-5 text-rose-600 dark:bg-rose-400/10 dark:text-rose-200">
            {isFuture
              ? text.dayRoute.dayStartFutureError
              : text.dayRoute.dayStartAfterVisitError}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          {target.mode === "start" ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onApply(target, new Date().toISOString())}
              className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
            >
              {isSaving ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <MdPlayArrow className="text-lg" />
              )}
              {text.dayRoute.dayStartNow(
                formatClock(
                  new Date(openedAt).getHours() * 60 +
                    new Date(openedAt).getMinutes(),
                  text
                )
              )}
            </button>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {text.common.cancel}
            </button>
            <button
              type="button"
              disabled={isSaving || !isValid}
              onClick={applySelectedTime}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold disabled:opacity-50 ${
                target.mode === "start"
                  ? "border border-brand-200 bg-brand-50 text-brand-700"
                  : "bg-brand-600 text-white"
              }`}
            >
              {isSaving && target.mode !== "start" ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : null}
              {target.mode === "start"
                ? text.dayRoute.startAtSelectedTime
                : target.mode === "planned"
                  ? text.dayRoute.savePlannedStart
                  : text.dayRoute.saveActualStart}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function sanitizeMinutesInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 3);
}

type VisitTimeStop = VisitTimesEditTarget["stop"];

function getRecordedStopArrivalTimestamp(stop: VisitTimeStop) {
  if (stop.checkedInAt) {
    return Date.parse(stop.checkedInAt);
  }

  const completedAt = stop.checkedOutAt ?? stop.visitedAt;

  if (!completedAt || !stop.actualStayMinutes) {
    return null;
  }

  const completedTimestamp = Date.parse(completedAt);

  return Number.isFinite(completedTimestamp)
    ? completedTimestamp - stop.actualStayMinutes * 60_000
    : null;
}

function getRecordedStopCompletionTimestamp(stop: VisitTimeStop) {
  const completedAt =
    stop.checkedOutAt ??
    (stop.visitStatus === "VISITED" ? stop.visitedAt : null);

  if (!completedAt) {
    return null;
  }

  const completedTimestamp = Date.parse(completedAt);

  return Number.isFinite(completedTimestamp) ? completedTimestamp : null;
}

export function VisitTimesEditPopup({
  target,
  isSaving,
  onClose,
  onApply,
}: {
  target: VisitTimesEditTarget;
  isSaving: boolean;
  onClose: () => void;
  onApply: (
    target: VisitTimesEditTarget,
    checkedInAt: string,
    checkedOutAt: string | null
  ) => void;
}) {
  const text = useUiText();
  const isCompleted = target.stop.visitStatus === "VISITED";
  const initialCheckedInAt = getVisitTimeEditInitialArrival(target);
  const initialCheckedOutAt =
    target.stop.checkedOutAt ?? target.stop.visitedAt;
  const [checkedInValue, setCheckedInValue] = useState(() =>
    toLocalTimeInputValue(initialCheckedInAt)
  );
  const [checkedOutValue, setCheckedOutValue] = useState(() =>
    toLocalTimeInputValue(initialCheckedOutAt)
  );
  const [activeTimeField, setActiveTimeField] = useState<
    "arrival" | "completion"
  >("arrival");
  const [openedAt] = useState(() => Date.now());
  const orderedStops = [...target.routeDay.stops].sort(
    (left, right) => left.order - right.order
  );
  const stopIndex = orderedStops.findIndex(
    (candidateStop) => candidateStop.id === target.stop.id
  );
  const previousTimedStop =
    stopIndex > 0
      ? orderedStops
          .slice(0, stopIndex)
          .reverse()
          .find(
            (candidateStop) =>
              getRecordedStopCompletionTimestamp(candidateStop) != null ||
              getRecordedStopArrivalTimestamp(candidateStop) != null
          ) ?? null
      : null;
  const nextTimedStop =
    stopIndex >= 0
      ? orderedStops
          .slice(stopIndex + 1)
          .find(
            (candidateStop) =>
              getRecordedStopArrivalTimestamp(candidateStop) != null ||
              getRecordedStopCompletionTimestamp(candidateStop) != null
          ) ?? null
      : null;
  const previousCompletionTimestamp = previousTimedStop
    ? getRecordedStopCompletionTimestamp(previousTimedStop)
    : null;
  const previousArrivalWithoutCompletion = Boolean(
    previousTimedStop &&
    previousCompletionTimestamp == null &&
    getRecordedStopArrivalTimestamp(previousTimedStop) != null
  );
  const nextBoundaryTimestamp = nextTimedStop
    ? (getRecordedStopArrivalTimestamp(nextTimedStop) ??
      getRecordedStopCompletionTimestamp(nextTimedStop))
    : null;
  const checkedInTimestamp = combineDateWithTimeInput(
    initialCheckedInAt,
    checkedInValue
  );
  const checkedOutTimestamp = isCompleted
    ? combineDateWithTimeInput(initialCheckedOutAt, checkedOutValue)
    : Number.NaN;
  const hasRequiredValues =
    Number.isFinite(checkedInTimestamp) &&
    (!isCompleted || Number.isFinite(checkedOutTimestamp));
  const isFuture =
    checkedInTimestamp > openedAt + 60_000 ||
    (isCompleted && checkedOutTimestamp > openedAt + 60_000);
  const isInvalidOrder =
    isCompleted &&
    Number.isFinite(checkedOutTimestamp) &&
    checkedOutTimestamp < checkedInTimestamp;
  const isBeforePreviousStop = Boolean(
    previousCompletionTimestamp != null &&
    checkedInTimestamp < previousCompletionTimestamp
  );
  const currentBoundaryTimestamp = isCompleted
    ? checkedOutTimestamp
    : checkedInTimestamp;
  const isAfterNextStop = Boolean(
    nextBoundaryTimestamp != null &&
    Number.isFinite(currentBoundaryTimestamp) &&
    currentBoundaryTimestamp > nextBoundaryTimestamp
  );
  const durationMinutes =
    isCompleted && hasRequiredValues && !isInvalidOrder
      ? Math.max(
          1,
          Math.round((checkedOutTimestamp - checkedInTimestamp) / 60_000)
        )
      : null;
  const isTooLong = Boolean(durationMinutes && durationMinutes > 480);
  let validationMessage: string | null = null;

  if (isFuture) {
    validationMessage = text.dayRoute.visitTimeFutureError;
  } else if (isInvalidOrder) {
    validationMessage = text.dayRoute.visitTimeOrderError;
  } else if (isTooLong) {
    validationMessage = text.dayRoute.visitTimeMaxError;
  } else if (previousArrivalWithoutCompletion && previousTimedStop) {
    validationMessage = text.dayRoute.visitTimePreviousStopOngoingError(
      previousTimedStop.place.title
    );
  } else if (isBeforePreviousStop && previousTimedStop) {
    validationMessage = text.dayRoute.visitTimePreviousStopError(
      previousTimedStop.place.title
    );
  } else if (isAfterNextStop && nextTimedStop) {
    validationMessage = text.dayRoute.visitTimeNextStopError(
      nextTimedStop.place.title
    );
  }
  const isValid = hasRequiredValues && !validationMessage;
  const activeTimeValue =
    activeTimeField === "completion" ? checkedOutValue : checkedInValue;
  const formatVisitTimeLabel = (value: string) => {
    const [hourText, minuteText] = value.split(":");
    const hour = Number(hourText);
    const period = hour < 12 ? text.inputs.am : text.inputs.pm;
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;

    return `${period} ${hour12}:${minuteText}`;
  };
  const handleActiveTimeChange = (nextValue: string) => {
    if (activeTimeField === "completion") {
      setCheckedOutValue(nextValue);
      return;
    }

    setCheckedInValue(nextValue);
  };

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3200] flex items-center justify-center bg-slate-950/45 px-4">
      <button
        type="button"
        aria-label={text.common.close}
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[360px] rounded-[1.5rem] border border-brand-100 bg-white p-4 shadow-2xl dark:border-brand-400/20 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">VISIT TIME</p>
            <h3 className="mt-1 text-lg font-black text-slate-900 dark:text-white">
              {text.dayRoute.visitTimeEditTitle}
            </h3>
            <p className="mt-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200">
              {target.stop.place.title}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.common.close}
            disabled={isSaving}
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <MdClose />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {isCompleted ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setActiveTimeField("arrival")}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  activeTimeField === "arrival"
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-400/15 dark:text-brand-100"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="block text-[11px] font-black">
                  {text.dayRoute.arrivalTime}
                </span>
                <span className="mt-0.5 block text-sm font-black">
                  {formatVisitTimeLabel(checkedInValue)}
                </span>
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setActiveTimeField("completion")}
                className={`rounded-2xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50 ${
                  activeTimeField === "completion"
                    ? "border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-400/15 dark:text-brand-100"
                    : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                }`}
              >
                <span className="block text-[11px] font-black">
                  {text.dayRoute.completionTime}
                </span>
                <span className="mt-0.5 block text-sm font-black">
                  {formatVisitTimeLabel(checkedOutValue)}
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl bg-brand-50 px-3 py-2.5 text-brand-800 dark:bg-brand-400/10 dark:text-brand-100">
              <span className="text-xs font-black">
                {text.dayRoute.arrivalTime}
              </span>
              <span className="text-sm font-black">
                {formatVisitTimeLabel(checkedInValue)}
              </span>
            </div>
          )}

          <div className="relative">
            <TimeWheelPicker
              value={activeTimeValue}
              disabled={isSaving}
              onChange={handleActiveTimeChange}
            />
            {!isCompleted && validationMessage ? (
              <p className="absolute inset-x-2 bottom-2 z-20 rounded-xl border border-rose-200/80 bg-rose-50/95 px-3 py-2 text-xs font-bold leading-4 text-rose-600 shadow-lg backdrop-blur-sm dark:border-rose-300/20 dark:bg-rose-950/90 dark:text-rose-100">
                <span className="line-clamp-2">{validationMessage}</span>
              </p>
            ) : null}
          </div>
        </div>

        {isCompleted ? (
          <div className="mt-3 h-11">
            {validationMessage ? (
              <p className="flex h-full items-center rounded-2xl bg-rose-50 px-3 py-1.5 text-xs font-bold leading-4 text-rose-600 dark:bg-rose-400/10 dark:text-rose-200">
                <span className="line-clamp-2">{validationMessage}</span>
              </p>
            ) : durationMinutes ? (
              <p className="flex h-full w-full items-center justify-center gap-1.5 rounded-2xl bg-brand-50 px-3 py-1.5 text-sm font-black text-brand-700 dark:bg-brand-400/10 dark:text-brand-100">
                <MdAccessTime className="shrink-0 text-base" />
                {text.dayRoute.stayTimeAfterEdit(
                  formatStayMinutes(durationMinutes, text)
                )}
              </p>
            ) : null}
          </div>
        ) : null}

        {target.stop.verifiedAt ? (
          <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-semibold leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
            {text.dayRoute.gpsVerificationTimePreserved}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {text.common.cancel}
          </button>
          <button
            type="button"
            disabled={isSaving || !isValid}
            onClick={() =>
              onApply(
                target,
                new Date(checkedInTimestamp).toISOString(),
                isCompleted
                  ? new Date(checkedOutTimestamp).toISOString()
                  : null
              )
            }
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSaving ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {text.dayRoute.saveVisitTimes}
          </button>
        </div>
      </section>
    </div>
  );
}

export function PhotoPublicationPopup({
  target,
  isSaving,
  onKeepPrivate,
  onPublish,
}: {
  target: PhotoPublicationTarget;
  isSaving: boolean;
  onKeepPrivate: () => void;
  onPublish: (target: PhotoPublicationTarget) => void;
}) {
  const text = useUiText();
  const photoUrl = target.stop.verificationPhotoUrl;

  if (!photoUrl) {
    return null;
  }

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3400] flex items-center justify-center bg-slate-950/50 px-4">
      <button
        type="button"
        aria-label={text.dayRoute.keepPhotoPrivate}
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
        onClick={onKeepPrivate}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[360px] overflow-hidden rounded-[1.5rem] border border-brand-100 bg-white shadow-2xl dark:border-brand-400/20 dark:bg-slate-950">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
          <img
            src={photoUrl}
            alt={text.dayRoute.verificationImageAlt(
              target.stop.place.title,
              text.dayRoute.gpsVerificationPhoto
            )}
            className="size-20 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">SHARE PHOTO</p>
            <p className="mt-1 truncate text-sm font-black text-slate-900 dark:text-white">
              {target.stop.place.title}
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
              {text.dayRoute.gpsVerificationPhoto}
            </p>
          </div>
        </div>
        <div className="p-4">
          <h3 className="text-lg font-black leading-6 text-slate-900 dark:text-white">
            {text.dayRoute.photoPublicationQuestion}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
            {text.dayRoute.photoPublicationDescription(
              target.stop.place.title
            )}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs font-semibold leading-5 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
            <MdLockOutline className="mt-0.5 shrink-0 text-base text-brand-600" />
            <span>{text.dayRoute.photoPublicationPrivacy}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isSaving}
              onClick={onKeepPrivate}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              {text.dayRoute.keepPhotoPrivate}
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onPublish(target)}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            >
              {isSaving ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <MdPublic className="text-base" />
              )}
              {text.dayRoute.publishPhoto}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function StayMinutesPopup({
  target,
  onClose,
  onApply,
}: {
  target: StayMinutesEditTarget;
  onClose: () => void;
  onApply: (target: StayMinutesEditTarget, stayMinutes: number) => void;
}) {
  const text = useUiText();
  const [draftMinutesInput, setDraftMinutesInput] = useState(() =>
    String(target.stop.stayMinutes ?? 60)
  );
  const parsedDraftMinutes = Number(draftMinutesInput);
  const isDraftMinutesValid =
    draftMinutesInput.trim() !== "" &&
    Number.isInteger(parsedDraftMinutes) &&
    parsedDraftMinutes >= 10 &&
    parsedDraftMinutes <= 480;
  const draftMinutes = isDraftMinutesValid ? parsedDraftMinutes : null;
  const updateDraftMinutes = (nextMinutes: number) => {
    setDraftMinutesInput(String(clampStayMinutes(nextMinutes)));
  };

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
            onClick={() => updateDraftMinutes((draftMinutes ?? 20) - 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <MdRemove />
          </button>
          <label className="flex min-w-[132px] items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <input
              aria-label="머무는 시간(분)"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={draftMinutesInput}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                setDraftMinutesInput(sanitizeMinutesInput(event.target.value))
              }
              className="w-16 bg-transparent text-center text-2xl font-black text-slate-900 outline-none"
            />
            <span className="text-sm font-bold text-slate-500">
              {text.cart.minuteUnit}
            </span>
          </label>
          <button
            type="button"
            aria-label="머무는 시간 늘리기"
            onClick={() => updateDraftMinutes((draftMinutes ?? 0) + 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700"
          >
            <MdAdd />
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-black text-brand-700">
          {draftMinutes ? formatStayMinutes(draftMinutes, text) : "\u00a0"}
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
            disabled={!draftMinutes}
            onClick={() => {
              if (!draftMinutes) {
                return;
              }

              onApply(target, draftMinutes);
              onClose();
            }}
            className="rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            적용
          </button>
        </div>
      </section>
    </div>
  );
}

export function ActualStayMinutesPopup({
  target,
  isSaving,
  onClose,
  onCancelCheckIn,
  onApply,
}: {
  target: ActualStayMinutesTarget;
  isSaving: boolean;
  onClose: () => void;
  onCancelCheckIn: (target: ActualStayMinutesTarget) => void;
  onApply: (
    target: ActualStayMinutesTarget,
    actualStayMinutes: number | null
  ) => void;
}) {
  const text = useUiText();
  const isCheckedIn = Boolean(target.stop.checkedInAt);
  const [elapsedMinutes] = useState<number | null>(() => {
    const checkedInTimestamp = target.stop.checkedInAt
      ? Date.parse(target.stop.checkedInAt)
      : Number.NaN;

    return isCheckedIn && Number.isFinite(checkedInTimestamp)
      ? Math.max(
          1,
          Math.round((Date.now() - checkedInTimestamp) / (60 * 1000))
        )
      : null;
  });
  const [draftMinutesInput, setDraftMinutesInput] = useState(() =>
    String(elapsedMinutes ?? target.stop.stayMinutes ?? 60)
  );
  const [isEdited, setIsEdited] = useState(false);
  const parsedDraftMinutes = Number(draftMinutesInput);
  const isDraftMinutesValid =
    draftMinutesInput.trim() !== "" &&
    Number.isInteger(parsedDraftMinutes) &&
    parsedDraftMinutes >= 1 &&
    parsedDraftMinutes <= 480;
  const draftMinutes = isDraftMinutesValid ? parsedDraftMinutes : null;
  const updateDraftMinutes = (nextMinutes: number) => {
    setDraftMinutesInput(
      String(Math.max(1, Math.min(480, Math.round(nextMinutes))))
    );
    setIsEdited(true);
  };
  const handleDraftMinutesInputChange = (value: string) => {
    setDraftMinutesInput(sanitizeMinutesInput(value));
    setIsEdited(true);
  };

  return (
    <div className="center-modal-backdrop-enter fixed inset-0 z-[3100] flex items-center justify-center bg-slate-950/35 px-4">
      <button
        type="button"
        aria-label={text.common.close}
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative w-full max-w-[340px] rounded-[1.4rem] border border-brand-100 bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-trip text-sm text-brand-700">
              {isCheckedIn ? "STAY CHECK" : "ACTUAL STAY"}
            </p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {isCheckedIn
                ? text.dayRoute.visitFinishQuestion
                : text.dayRoute.actualStayQuestion}
            </h3>
            <p className="mt-1 truncate text-xs font-bold text-slate-700">
              {target.stop.place.title}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
              {isCheckedIn && elapsedMinutes
                ? text.dayRoute.elapsedSinceArrival(
                    formatStayMinutes(elapsedMinutes, text)
                  )
                : text.dayRoute.actualStayDescription}
            </p>
          </div>
          <button
            type="button"
            aria-label={text.common.close}
            disabled={isSaving}
            onClick={onClose}
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
            onClick={() => updateDraftMinutes((draftMinutes ?? 11) - 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 disabled:opacity-40"
          >
            <MdRemove />
          </button>
          <label className="flex min-w-[132px] items-center justify-center gap-1 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3">
            <input
              aria-label={text.cart.stayMinuteInputAria}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={3}
              value={draftMinutesInput}
              disabled={isSaving}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) =>
                handleDraftMinutesInputChange(event.target.value)
              }
              className="w-16 bg-transparent text-center text-2xl font-black text-slate-900 outline-none disabled:opacity-60"
            />
            <span className="text-sm font-bold text-slate-500">
              {text.cart.minuteUnit}
            </span>
          </label>
          <button
            type="button"
            aria-label="머문 시간 늘리기"
            disabled={isSaving}
            onClick={() => updateDraftMinutes((draftMinutes ?? 0) + 10)}
            className="flex size-11 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-brand-700 disabled:opacity-40"
          >
            <MdAdd />
          </button>
        </div>

        <p className="mt-3 text-center text-sm font-black text-brand-700">
          {draftMinutes ? formatStayMinutes(draftMinutes, text) : "\u00a0"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => {
              if (isCheckedIn) {
                onClose();
                return;
              }

              onApply(target, null);
            }}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            {isCheckedIn
              ? text.dayRoute.continueStay
              : text.dayRoute.skipActualStay}
          </button>
          <button
            type="button"
            disabled={isSaving || !draftMinutes}
            onClick={() => {
              if (!draftMinutes) {
                return;
              }

              onApply(
                target,
                isCheckedIn && !isEdited ? null : draftMinutes
              );
            }}
            className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSaving ? (
              <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : null}
            {isCheckedIn
              ? text.dayRoute.completeVisit
              : text.dayRoute.saveActualStay}
          </button>
        </div>
        {isCheckedIn ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onCancelCheckIn(target)}
            className="mt-3 w-full text-center text-xs font-bold text-slate-400 underline-offset-4 hover:underline disabled:opacity-40"
          >
            {text.dayRoute.cancelCheckIn}
          </button>
        ) : null}
      </section>
    </div>
  );
}

export function VisitCompletionPopup({
  target,
  isSaving,
  mode,
  onClose,
  onCompleteWithGps,
  onCompleteWithPhoto,
  onCompleteManually,
}: {
  target: VisitCompletionTarget;
  isSaving: boolean;
  mode: "live" | "retrospective";
  onClose: () => void;
  onCompleteWithGps: (target: VisitCompletionTarget) => void;
  onCompleteWithPhoto: (
    target: VisitCompletionTarget,
    source: VisitPhotoSource
  ) => void;
  onCompleteManually: (target: VisitCompletionTarget) => void;
}) {
  const text = useUiText();
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
            <p className="font-trip text-sm text-brand-700">
              {isRetrospective ? "VISIT RECORD" : "ARRIVAL CHECK"}
            </p>
            <h3 className="mt-1 truncate text-lg font-bold text-slate-900">
              {isRetrospective
                ? target.stop.place.title
                : text.dayRoute.arrivalCheckTitle}
            </h3>
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
        <p className="mt-1 text-balance text-xs font-semibold leading-5 text-slate-500">
          {isRetrospective
            ? text.dayRoute.retrospectiveCompletionDescription
            : text.dayRoute.arrivalCheckDescription}
        </p>

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
              {text.dayRoute.retrospectivePhotoCompletionAction}
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={photoActionDisabled}
                onClick={() => onCompleteWithGps(target)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-3 py-3 text-sm font-black text-white disabled:opacity-60"
              >
                {photoActionDisabled ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <MdMyLocation className="text-lg" />
                )}
                {text.dayRoute.gpsCheckIn}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={photoActionDisabled}
                  onClick={() => onCompleteWithPhoto(target, "camera")}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-3 py-3 text-sm font-black text-brand-700 disabled:opacity-60"
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
                  className="flex items-center justify-center gap-2 rounded-2xl border border-brand-200 bg-white px-3 py-3 text-sm font-black text-brand-700 disabled:opacity-60"
                >
                  <MdImage className="text-lg" />
                  앨범
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onCompleteManually(target)}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-60"
          >
            {isRetrospective
              ? text.dayRoute.retrospectiveCompletionAction
              : text.dayRoute.manualVisitCompletion}
          </button>
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

export function VerificationPhotoPreviewPopup({
  target,
  canManage,
  canReplace,
  isSaving,
  onClose,
  onChangePublication,
  onDelete,
  onReplace,
}: {
  target: VerificationPhotoPreviewTarget;
  canManage: boolean;
  canReplace: boolean;
  isSaving: boolean;
  onClose: () => void;
  onChangePublication: (
    target: VerificationPhotoPreviewTarget,
    published: boolean
  ) => void;
  onDelete: (target: VerificationPhotoPreviewTarget) => void;
  onReplace: (target: VerificationPhotoPreviewTarget) => void;
}) {
  const text = useUiText();
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const photoUrl = target.stop.verificationPhotoUrl;
  const isPublished =
    target.stop.verificationPhotoPublicationConsent === true ||
    Boolean(target.stop.verificationPhotoPublishedAt);
  const isGpsPhoto = target.stop.verificationStatus === "GPS_PHOTO";
  const previewTitle = isGpsPhoto ? "PHOTO VERIFIED" : "PHOTO RECORD";
  const previewLabel = isGpsPhoto
    ? text.dayRoute.gpsVerification
    : text.dayRoute.photoRecord;
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
        aria-label={text.dayRoute.closeImageAria(previewLabel)}
        className="absolute inset-0 cursor-default"
        disabled={isSaving}
        onClick={onClose}
      />
      <section className="center-modal-panel-enter relative flex max-h-full w-full max-w-[430px] flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-2xl dark:bg-slate-950">
        <div className="relative min-h-0 bg-slate-950">
          <img
            src={photoUrl}
            alt={text.dayRoute.verificationImageAlt(
              target.stop.place.title,
              previewLabel
            )}
            className="max-h-[68vh] w-full object-contain"
          />
          <button
            type="button"
            aria-label={text.common.close}
            disabled={isSaving}
            onClick={onClose}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-slate-950/65 text-lg text-white shadow-lg backdrop-blur disabled:opacity-50"
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
                {text.dayRoute.noGps}
              </span>
            )}
            {verifiedAtLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                {verifiedAtLabel}
              </span>
            ) : null}
          </div>
          {canManage ? (
            <div
              className={`mt-4 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-xs font-semibold leading-5 ${
                isPublished
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-300"
              }`}
            >
              {isPublished ? (
                <MdPublic className="mt-0.5 shrink-0 text-base" />
              ) : (
                <MdLockOutline className="mt-0.5 shrink-0 text-base" />
              )}
              <span>
                {isPublished
                  ? text.dayRoute.photoPublished
                  : text.dayRoute.photoPrivate}
              </span>
            </div>
          ) : null}
          {canReplace && !isDeleteConfirming ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onReplace(target)}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-700 disabled:opacity-50 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-100"
            >
              {isSaving ? (
                <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <MdImage className="text-base" />
              )}
              {text.dayRoute.replaceVisitPhoto}
            </button>
          ) : null}
          {canManage && isDeleteConfirming ? (
            <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-400/20 dark:bg-rose-400/10">
              <p className="text-sm font-black text-rose-700 dark:text-rose-200">
                {text.dayRoute.deletePhotoQuestion}
              </p>
              <p className="mt-1 text-xs font-semibold leading-5 text-rose-600/80 dark:text-rose-200/75">
                {text.dayRoute.deletePhotoDescription}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsDeleteConfirming(false)}
                  className="rounded-xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-700 disabled:opacity-50 dark:bg-slate-950"
                >
                  {text.dayRoute.cancelPhotoDelete}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => onDelete(target)}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {isSaving ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <MdDeleteOutline className="text-base" />
                  )}
                  {text.dayRoute.deletePhoto}
                </button>
              </div>
            </div>
          ) : canManage ? (
            <div className={`${canReplace ? "mt-2" : "mt-4"} grid grid-cols-2 gap-2`}>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setIsDeleteConfirming(true)}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-3 py-3 text-sm font-bold text-rose-600 disabled:opacity-50 dark:bg-slate-950"
              >
                <MdDeleteOutline className="text-base" />
                {text.dayRoute.deletePhoto}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => onChangePublication(target, !isPublished)}
                className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-3 text-sm font-bold disabled:opacity-50 ${
                  isPublished
                    ? "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    : "bg-brand-600 text-white"
                }`}
              >
                {isSaving ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : isPublished ? (
                  <MdLockOutline className="text-base" />
                ) : (
                  <MdPublic className="text-base" />
                )}
                {isPublished
                  ? text.dayRoute.unpublishPhoto
                  : text.dayRoute.publishPhoto}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function formatRouteDurationDays(days: number) {
  return days <= 1 ? "당일 여행" : `${days - 1}박 ${days}일`;
}

export function EarlyRouteCompletionPopup({
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
          실제 출발일
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
