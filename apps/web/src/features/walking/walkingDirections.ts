import { WALKING_COVERAGE } from "./walkingCoverage";
import { isWalkingPoint, isWithinWalkingBounds } from "./walkingGeometry";
import { WalkingRoutingError, type WalkingErrorCode, type WalkingPoint, type WalkingRouteResult } from "./walkingTypes";
import WalkingRouteWorker from "./walkingRoute.worker?worker&inline";

// 정적 문자열을 유지해야 네이티브 패키징이 가상 호스트의 파일 요청을 data: URL로 바꿀 수 있다.
const WALKING_DATA_URL = `${import.meta.env.BASE_URL}walking-data/gangneung.json`;

/**
 * 같은 사이트의 공개 보행로 파일로 도보 경로를 자체 계산한다. 유료 길찾기 API나 공개 OSM 서버를 실시간 호출하지 않는다.
 * Worker 코드는 인라인해 data: 모듈로 실행되는 WebView에서도 별도 스크립트 URL 없이 시작한다.
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
    const worker = new WalkingRouteWorker();
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
      packUrl: new URL(WALKING_DATA_URL, document.baseURI).href });
  });
}
