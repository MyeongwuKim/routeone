import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let resolveHomeLoadingPhase;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
      alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ resolveHomeLoadingPhase } = await server.ssrLoadModule(
    "/src/features/home/homeLoadingPhase.ts"
  ));
});

after(async () => {
  await server?.close();
});

const idleState = {
  attractionLoadingPhase: "idle",
  canShowAttractionLoading: true,
  hasAttractionData: true,
  isAttractionFetching: false,
  isInitialRegionLoading: false,
  isRenderingMarkers: false,
  isSearchPopupOpen: false,
};

test("검색 팝업이 열리면 홈 전역 로딩을 숨긴다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      attractionLoadingPhase: "fetching-places",
      isAttractionFetching: true,
      isSearchPopupOpen: true,
    }),
    null
  );
});

test("최초 지역 확인이 다른 홈 로딩보다 우선한다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      attractionLoadingPhase: "fetching-places",
      isAttractionFetching: true,
      isInitialRegionLoading: true,
      isRenderingMarkers: true,
    }),
    "location"
  );
});

test("최초 장소 조회 중에는 장소 로딩을 표시한다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      attractionLoadingPhase: "fetching-places",
      hasAttractionData: false,
      isAttractionFetching: true,
    }),
    "places"
  );
});

test("기존 데이터의 백그라운드 갱신은 순위 계산 단계로 표시한다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      isAttractionFetching: true,
    }),
    "ranking"
  );
});

test("장소 조회와 마커 렌더링이 겹치면 장소 조회를 우선한다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      attractionLoadingPhase: "fetching-places",
      isAttractionFetching: true,
      isRenderingMarkers: true,
    }),
    "places"
  );
});

test("데이터 처리가 끝난 뒤 마커 렌더링 상태를 표시한다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      isRenderingMarkers: true,
    }),
    "markers"
  );
});

test("지도 오류 등으로 장소 로딩을 표시할 수 없으면 숨긴다", () => {
  assert.equal(
    resolveHomeLoadingPhase({
      ...idleState,
      attractionLoadingPhase: "fetching-places",
      canShowAttractionLoading: false,
      isAttractionFetching: true,
    }),
    null
  );
});
