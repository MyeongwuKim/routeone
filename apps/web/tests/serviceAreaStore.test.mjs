import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, store, resolveRegion, previousWindow;
const storage = new Map();
before(async () => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    } },
  });
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ useServiceAreaStore: store } = await server.ssrLoadModule("/src/stores/serviceAreaStore.ts"));
  ({ resolveServiceRegion: resolveRegion } = await server.ssrLoadModule("/src/data/serviceAreas.ts"));
});
after(async () => {
  await server?.close();
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else delete globalThis.window;
});

test("새 지방 권역과 선택한 시군구를 함께 저장하고 복원한다", async () => {
  store.getState().setSelectedRegion("jeonnam", "13");
  const saved = storage.get("routeone-dev-service-area");
  assert.deepEqual(JSON.parse(saved).state, { selectedAreaId: "jeonnam", selectedRegionCode: "13" });
  store.setState({ selectedAreaId: "gangwon", selectedRegionCode: null });
  storage.set("routeone-dev-service-area", saved);
  await store.persist.rehydrate();
  assert.equal(store.getState().selectedAreaId, "jeonnam");
  assert.equal(store.getState().selectedRegionCode, "13");
});

test("권역에 없는 시군구 코드는 선택값을 바꾸지 않는다", () => {
  store.getState().setSelectedRegion("jeju", "999");
  assert.equal(store.getState().selectedAreaId, "jeonnam");
  assert.equal(store.getState().selectedRegionCode, "13");
});

test("기존 지역만 저장한 값은 지역을 유지하고 잘못된 시군구만 초기화한다", async () => {
  storage.set("routeone-dev-service-area", JSON.stringify({ state: { selectedAreaId: "seoul" }, version: 0 }));
  await store.persist.rehydrate();
  assert.equal(store.getState().selectedAreaId, "seoul");
  assert.equal(store.getState().selectedRegionCode, null);
});

test("세종과 경남의 겹치는 권역 코드를 장소의 전체 행정 코드로 구분한다", () => {
  assert.equal(resolveRegion("36:36110", "36110")?.area.id, "sejong");
  assert.equal(resolveRegion("48:48120", "48120")?.area.id, "gyeongnam");
  assert.equal(resolveRegion("36:16", "16")?.area.id, "gyeongnam");
  assert.equal(resolveRegion("중구", null), null);
});
