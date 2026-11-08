import { buildWalkingGraph, calculateWalkingRoute } from "./walkingRouter";
import { WalkingRoutingError, type WalkingDataPack, type WalkingPoint } from "./walkingTypes";

/** 도로 파일 읽기와 A* 탐색을 화면 스레드 밖에서 수행한다. 취소 시 호출자가 Worker를 종료한다. */
self.addEventListener("message", async (event: MessageEvent<{
  packUrl: string; start: WalkingPoint; goal: WalkingPoint;
}>) => {
  try {
    const response = await fetch(event.data.packUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new WalkingRoutingError("DATA_UNAVAILABLE");
    const pack = await response.json() as WalkingDataPack;
    const graph = buildWalkingGraph(pack);
    self.postMessage({ result: calculateWalkingRoute(graph, event.data.start, event.data.goal) });
  } catch (error) {
    self.postMessage({ error: error instanceof WalkingRoutingError ? error.code : "DATA_UNAVAILABLE" });
  }
});
