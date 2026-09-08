/**
 * 사용 위치: DAY 일정 화면 하단, 방문 시간 팝업이 열려 있을 때도 같은 자리
 *
 * 용도:
 * 팝업과 장소 카드의 크기를 바꾸지 않고 방문 처리 단계를 안내한다.
 * 0.5초 안에 끝나는 작업은 표시하지 않으며, 처리 중에는 자동으로 사라지지 않는다.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MdCheckCircle } from "react-icons/md";
import { UI_LAYER_CLASS } from "@/lib/uiLayers";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type {
  RouteVisitProgress,
  RouteVisitProgressOperation,
  RouteVisitProgressStage,
} from "../../hooks/useRouteVisitProgress";

const messages = {
  ko: {
    complete: {
      preparing: ["도착 알림 준비 중", "방문 저장 전 알림을 준비해요."],
      saving: ["방문 완료 저장 중", "통신이 느리면 잠시 걸릴 수 있어요."],
      syncing: ["다음 장소 알림 설정 중", "방문 기록에 맞춰 알림을 준비해요."],
      waiting: ["알림 처리 대기 중", "이전 작업이 끝나면 이어서 진행해요."],
      locating: ["현재 위치 확인 중", "위치 신호를 기다리고 있어요."],
      recovering: ["방문 완료 여부 확인 중", "다시 누르지 않아도 돼요."],
    },
    "cancel-completion": {
      preparing: ["알림 복구 준비 중", "방문 전 상태로 되돌릴 준비를 해요."],
      saving: ["방문 완료 취소 중", "방문 기록을 되돌리고 있어요."],
      syncing: ["도착 알림 다시 설정 중", "취소한 장소부터 알림을 준비해요."],
      waiting: ["알림 처리 대기 중", "이전 작업이 끝나면 이어서 진행해요."],
      locating: ["현재 위치 확인 중", "다시 시작할 장소의 알림을 확인해요."],
      recovering: ["방문 완료 취소 확인 중", "다시 누르지 않아도 돼요."],
    },
    "cancel-arrival": {
      preparing: ["알림 복구 준비 중", "도착 전 상태로 되돌릴 준비를 해요."],
      saving: ["도착 인증 취소 중", "도착 기록을 되돌리고 있어요."],
      syncing: ["도착 알림 다시 설정 중", "취소한 장소부터 알림을 준비해요."],
      waiting: ["알림 처리 대기 중", "이전 작업이 끝나면 이어서 진행해요."],
      locating: ["현재 위치 확인 중", "다시 시작할 장소의 알림을 확인해요."],
      recovering: ["도착 인증 취소 확인 중", "다시 누르지 않아도 돼요."],
    },
  },
  en: {
    complete: {
      preparing: ["Preparing arrival alerts", "Preparing alerts before saving your visit."],
      saving: ["Saving visit completion", "A slow connection may take longer."],
      syncing: ["Setting the next arrival alert", "Matching alerts to your visit."],
      waiting: ["Waiting for alert update", "Continuing after the previous update."],
      locating: ["Finding your location", "Waiting for a location signal."],
      recovering: ["Checking visit completion", "You don’t need to tap again."],
    },
    "cancel-completion": {
      preparing: ["Preparing alert restoration", "Preparing to restore the pre-visit state."],
      saving: ["Canceling visit completion", "Restoring the visit record."],
      syncing: ["Restoring arrival alerts", "Starting alerts again from this place."],
      waiting: ["Waiting for alert update", "Continuing after the previous update."],
      locating: ["Finding your location", "Checking alerts for the restored place."],
      recovering: ["Checking completion cancellation", "You don’t need to tap again."],
    },
    "cancel-arrival": {
      preparing: ["Preparing alert restoration", "Preparing to restore the pre-arrival state."],
      saving: ["Canceling arrival check-in", "Restoring the arrival record."],
      syncing: ["Restoring arrival alerts", "Starting alerts again from this place."],
      waiting: ["Waiting for alert update", "Continuing after the previous update."],
      locating: ["Finding your location", "Checking alerts for the restored place."],
      recovering: ["Checking arrival cancellation", "You don’t need to tap again."],
    },
  },
} satisfies Record<
  "ko" | "en",
  Record<
    RouteVisitProgressOperation,
    Record<RouteVisitProgressStage, [string, string]>
  >
>;

export default function RouteVisitProgressToast({
  progress,
}: {
  progress: RouteVisitProgress;
}) {
  const language = useAppLanguageStore((state) => state.language);
  const [isVisible, setIsVisible] = useState(false);
  const [title, description] =
    messages[language][progress.operation][progress.stage];
  const savedText =
    language === "en"
      ? progress.operation === "cancel-completion"
        ? "Visit completion cancellation saved"
        : progress.operation === "cancel-arrival"
          ? "Arrival cancellation saved"
          : "Your visit has been saved"
      : progress.operation === "cancel-completion"
        ? "방문 완료 취소는 저장됐어요"
        : progress.operation === "cancel-arrival"
          ? "도착 인증 취소는 저장됐어요"
          : "방문 기록은 저장됐어요";

  useEffect(() => {
    const timer = window.setTimeout(() => setIsVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return createPortal(
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+var(--app-safe-area-bottom))] ${UI_LAYER_CLASS.toast} flex justify-center px-4`}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="route-checkout-bottom-sheet-enter flex h-20 w-full max-w-sm items-center gap-3 rounded-2xl border border-brand-200 bg-white/95 px-4 shadow-[0_8px_32px_rgba(15,23,42,0.16)] backdrop-blur dark:border-brand-400/25 dark:bg-[#0b211f]/95"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 dark:bg-brand-400/10"
        >
          <span className="size-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent motion-reduce:animate-none dark:border-brand-200 dark:border-t-transparent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-bold leading-5 text-slate-800 dark:text-slate-100">
            {title}
          </p>
          <p className="mt-0.5 flex items-start gap-1 text-xs font-medium leading-4 text-slate-500 dark:text-slate-300">
            {progress.isSaved ? (
              <MdCheckCircle
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-200"
              />
            ) : null}
            <span className="line-clamp-2">{progress.isSaved ? savedText : description}</span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
