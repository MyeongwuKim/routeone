import { WALKING_COVERAGE } from "./walkingCoverage";
import { isWalkingPoint, isWithinWalkingBounds } from "./walkingGeometry";
import { WalkingRoutingError, type WalkingErrorCode, type WalkingPoint, type WalkingRouteResult } from "./walkingTypes";

/**
 * 같은 사이트의 공개 보행로 파일로 도보 경로를 자체 계산한다. 유료 길찾기 API나 공개 OSM 서버를 실시간 호출하지 않는다.
 * 좌표가 지원 범위 밖이면 데이터 다운로드 전에 실패한다. 요청 취소·제한 시간 초과 시 탐색 Worker도 종료한다.
 */
export function fetchWalkingRoute(options: {
  start: WalkingPoint; goal: WalkingPoint; signal?: AbortSignal;
}): Promise<WalkingRouteResult> {
  const { start, goal, signal } = options;
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  if (!isWalkingPoint(start) || !isWalkingPoint(goal)) return Promise.reject(new WalkingRoutingError("INVALID_INPUT"));
  if (!isWithinWalkingBounds(start, WALKING_COVERAGE.bounds) || !isWithinWalkingBounds(goal, WALKING_COVERAGE.bounds)) {
    return Promise.reject(new WalkingRoutingError("OUTSIDE_COVERAGE"));
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./walkingRoute.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new WalkingRoutingError("DATA_UNAVAILABLE"));
    }, 25_000);
    signal?.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<{ result?: WalkingRouteResult; error?: WalkingErrorCode }>) => {
      cleanup();
      if (event.data.result) resolve(event.data.result);
      else reject(new WalkingRoutingError(event.data.error ?? "DATA_UNAVAILABLE"));
    };
    worker.onerror = () => {
      cleanup();
      reject(new WalkingRoutingError("DATA_UNAVAILABLE"));
    };
    worker.postMessage({ start, goal,
      packUrl: new URL(`${import.meta.env.BASE_URL}walking-data/${WALKING_COVERAGE.filename}`, window.location.href).href });
  });
}
