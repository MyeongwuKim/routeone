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

export type RouteVisitProgress = {
  stopId: string;
  stage: RouteVisitProgressStage;
  isSaved: boolean;
  isCancellation: boolean;
};

export type RouteVisitProgressReporter = {
  setStage: (stage: RouteVisitProgressStage) => void;
  markSaved: () => void;
  onNativeProgress: (stage: NativeArrivalNotificationProgress) => void;
  finish: () => void;
};

export function useRouteVisitProgress() {
  const [progress, setProgress] = useState<RouteVisitProgress | null>(null);
  const activeRequest = useRef<symbol | null>(null);

  const begin = (
    stopId: string,
    isCancellation: boolean
  ): RouteVisitProgressReporter => {
    const request = Symbol();
    activeRequest.current = request;
    setProgress({ stopId, stage: "preparing", isSaved: false, isCancellation });

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
