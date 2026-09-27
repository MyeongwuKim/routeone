/**
 * 용도:
 * 방문 저장과 도착 알림 처리의 현재 단계를 화면에 전달한다.
 *
 * 동작 방식:
 * 서버에서 저장을 확인한 뒤에만 저장 완료로 표시한다.
 * 요청마다 별도 보고 함수를 만들어 이전 요청의 늦은 응답은 무시한다.
 */
import { useRef, useState } from "react";
import type { NativeArrivalNotificationProgress } from "@/native-bridge";

export type RouteVisitProgressStage =
  | "preparing"
  | "saving"
  | "syncing"
  | "waiting"
  | "locating"
  | "recovering";

export type RouteVisitProgressOperation =
  | "complete"
  | "cancel-completion"
  | "cancel-arrival";

export type RouteVisitProgress = {
  stopId: string;
  stage: RouteVisitProgressStage;
  isSaved: boolean;
  operation: RouteVisitProgressOperation;
};

export type RouteVisitProgressReporter = {
  setStage: (stage: RouteVisitProgressStage) => void;
  markSaved: () => void;
  onNativeProgress: (stage: NativeArrivalNotificationProgress) => void;
  finish: () => void;
};

/**
 * 방문 완료·완료 취소·도착 취소 요청 하나의 진행 상태를 관리한다. begin이 반환한 reporter는
 * 해당 요청 Symbol이 여전히 최신일 때만 상태를 변경해 이전 요청의 늦은 콜백을 무시한다.
 */
export function useRouteVisitProgress() {
  const [progress, setProgress] = useState<RouteVisitProgress | null>(null);
  const activeRequest = useRef<symbol | null>(null);

  /** 새 요청을 preparing 단계로 시작하고 그 요청에만 유효한 단계 보고 함수를 반환한다. */
  const begin = (
    stopId: string,
    operation: RouteVisitProgressOperation
  ): RouteVisitProgressReporter => {
    const request = Symbol();
    activeRequest.current = request;
    setProgress({ stopId, stage: "preparing", isSaved: false, operation });

    const update = (
      change: (current: RouteVisitProgress) => RouteVisitProgress
    ) => {
      setProgress((current) =>
        activeRequest.current === request && current ? change(current) : current
      );
    };

    return {
      setStage: (stage) => update((current) => ({ ...current, stage })),
      markSaved: () => update((current) => ({
        ...current,
        isSaved: true,
        stage: "syncing",
      })),
      onNativeProgress: (stage) => update((current) => ({
        ...current,
        stage: stage === "queued"
          ? "waiting"
          : stage === "locating"
            ? "locating"
            : current.isSaved ? "syncing" : "preparing",
      })),
      finish: () => {
        if (activeRequest.current === request) {
          activeRequest.current = null;
          setProgress(null);
        }
      },
    };
  };

  return { progress, begin };
}
