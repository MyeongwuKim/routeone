/**
 * 사용 위치: 방문 시간 입력창과 DAY 일정의 장소 카드
 *
 * 용도:
 * 방문 기록이 저장됐는지와 지금 기다리는 작업을 함께 보여준다.
 * 현재 위치 안내는 네이티브에서 실제 위치 조회 시작을 알려준 경우에만 표시한다.
 */
import { MdCheckCircle, MdMyLocation } from "react-icons/md";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type {
  RouteVisitProgress,
  RouteVisitProgressStage,
} from "../../hooks/useRouteVisitProgress";

const messages = {
  ko: {
    preparing: ["도착 알림을 준비하고 있어요", "방문 저장 전 알림 등록을 확인하고 있어요."],
    saving: ["방문 기록을 저장하고 있어요", "통신 상태에 따라 시간이 걸릴 수 있어요."],
    syncing: ["도착 알림을 정리하고 있어요", "변경된 방문 기록에 맞춰 알림을 준비해요."],
    waiting: ["앞선 알림 처리를 기다리고 있어요", "이전 처리가 끝나면 자동으로 이어서 진행해요."],
    locating: ["현재 위치를 찾고 있어요", "도착 알림을 위해 내 위치를 확인해요. 위치 신호가 약하면 시간이 걸릴 수 있어요."],
    recovering: ["방문 저장 결과를 확인하고 있어요", "저장된 기록을 다시 확인해요. 다시 누르지 않아도 돼요."],
  },
  en: {
    preparing: ["Preparing arrival alerts", "Checking alert registration before saving your visit."],
    saving: ["Saving your visit", "This may take longer on a slow connection."],
    syncing: ["Updating arrival alerts", "Matching your alerts to the saved visit."],
    waiting: ["Waiting for the previous alert update", "This will continue automatically when it finishes."],
    locating: ["Finding your current location", "Checking your location for arrival alerts. A weak location signal can take longer."],
    recovering: ["Checking whether your visit was saved", "Checking the saved record. You don’t need to tap again."],
  },
} satisfies Record<"ko" | "en", Record<RouteVisitProgressStage, [string, string]>>;

export default function RouteVisitProgressNotice({ progress }: {
  progress: RouteVisitProgress;
}) {
  const language = useAppLanguageStore((state) => state.language);
  const [title, description] = messages[language][progress.stage];
  const savedText = language === "en"
    ? progress.isCancellation ? "Visit cancellation saved" : "Your visit has been saved"
    : progress.isCancellation ? "방문 취소는 저장됐어요" : "방문 기록은 저장됐어요";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="mt-3 rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-2.5 text-left dark:border-brand-400/25 dark:bg-brand-400/10"
    >
      {progress.isSaved ? (
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-brand-700 dark:text-brand-200">
          <MdCheckCircle aria-hidden="true" className="shrink-0 text-sm" />
          {savedText}
        </p>
      ) : null}
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-100">
        {progress.stage === "locating" ? (
          <MdMyLocation aria-hidden="true" className="shrink-0 text-sm text-brand-600 dark:text-brand-200" />
        ) : (
          <span aria-hidden="true" className="size-3 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent motion-reduce:animate-none dark:border-brand-200 dark:border-t-transparent" />
        )}
        {title}
      </p>
      <p className="mt-1 text-[11px] font-medium leading-[1.6] text-slate-600 dark:text-slate-300">
        {description}
      </p>
    </div>
  );
}
