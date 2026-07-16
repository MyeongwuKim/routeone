import { useState } from "react";
import {
  MdAdd,
  MdClose,
  MdImage,
  MdMyLocation,
  MdPhotoCamera,
  MdRemove,
} from "react-icons/md";
import { useUiText } from "@/lib/uiText";
import {
  clampStayMinutes,
  formatStayMinutes,
} from "../../utils/dayRouteFormatting";
import type { VisitPhotoSource } from "../../services/visitPhotoService";
import type {
  ActualStayMinutesTarget,
  EarlyRouteCompletionTarget,
  StayMinutesEditTarget,
  VerificationPhotoPreviewTarget,
  VisitCompletionTarget,
} from "../../models/dayRouteDialogTypes";

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

export function ActualStayMinutesPopup({
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
                : "장소 반경 100m 안이면 GPS 인증, 사진을 남기면 사진+GPS 인증으로 저장해요."}
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
                GPS 인증
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
            {isRetrospective ? "수동" : "인증 없이 완료"}
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
  onClose,
}: {
  target: VerificationPhotoPreviewTarget;
  onClose: () => void;
}) {
  const text = useUiText();
  const photoUrl = target.stop.verificationPhotoUrl;
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
                {text.dayRoute.noGps}
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
