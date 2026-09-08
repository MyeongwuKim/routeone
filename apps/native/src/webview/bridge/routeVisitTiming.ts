/**
 * 용도:
 * 개발 앱에서 방문 저장과 도착 알림 처리의 지연 구간을 확인한다.
 *
 * 동작 방식:
 * 요청별로 대기·등록·위치 조회의 시작과 종료 시간을 기록한다.
 * 좌표나 요청 본문은 기록하지 않으며 실제 처리 결과와 오류는 그대로 반환한다.
 */
export function createRouteVisitTiming(operation: string, requestId: string) {
  const enabled = typeof __DEV__ !== "undefined" && __DEV__;
  const now = () => globalThis.performance?.now() ?? Date.now();
  const startedAt = now();
  const write = (
    stage: string,
    event: "start" | "success" | "error",
    durationMs?: number
  ) => {
    if (!enabled) return;

    console.log(
      "[routeone-visit-timing]",
      JSON.stringify({
        operation,
        requestId,
        stage,
        event,
        ...(durationMs === undefined ? {} : { durationMs: Math.round(durationMs) }),
        elapsedMs: Math.round(now() - startedAt),
      })
    );
  };
  const start = (stage: string) => {
    const stageStartedAt = now();
    write(stage, "start");
    return (event: "success" | "error" = "success") => {
      write(stage, event, now() - stageStartedAt);
    };
  };

  write("total", "start");

  return {
    start,
    async measure<T>(stage: string, work: () => Promise<T>): Promise<T> {
      const end = start(stage);
      try {
        const result = await work();
        end();
        return result;
      } catch (error) {
        end("error");
        throw error;
      }
    },
    finish(event: "success" | "error" = "success") {
      write("total", event, now() - startedAt);
    },
  };
}

export type RouteVisitTiming = ReturnType<typeof createRouteVisitTiming>;
