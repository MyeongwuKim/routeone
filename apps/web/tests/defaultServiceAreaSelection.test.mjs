import assert from "node:assert/strict";
import { before, beforeEach, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, saveDefault, explore, defaults, home, previousGlobals;
let respond;
const storage = new Map();
const requests = [];
const flush = () => new Promise(resolve => setImmediate(resolve));
const notificationSettings = (enabled = true) => ({
  festivalEnabled: enabled, festivalRegionCodes: enabled ? ["46130"] : [],
  routeStartEnabled: true, routeReviewEnabled: true, routeArrivalEnabled: true,
  createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z",
});
const response = (settings = notificationSettings()) => Response.json({ data: { syncFestivalRegionWithServiceArea: settings } });
function login(token = "test-token") {
  storage.set("routeone.authToken", token);
  storage.set("routeone.authSessionExpiresAt", String(Date.now() + 60_000));
}

before(async () => {
  previousGlobals = new Map(["window", "navigator", "fetch"].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    RouteOneRuntimeConfig: { graphqlEndpoint: "/graphql-test" },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    location: { href: "http://localhost/me/service-area", origin: "http://localhost", pathname: "/me/service-area" },
    setTimeout, clearTimeout,
  } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (url, options) => {
    assert.equal(url, "/graphql-test");
    const body = JSON.parse(options.body);
    assert.ok(body.query.includes("SyncFestivalRegionWithServiceArea"));
    requests.push(body.variables);
    return respond(body.variables);
  } });
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL("..", import.meta.url)), envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ saveDefaultServiceRegion: saveDefault, selectExploreRegion: explore } = await server.ssrLoadModule("/src/features/service-area/serviceAreaSelection.ts"));
  ({ useServiceAreaStore: defaults } = await server.ssrLoadModule("/src/stores/serviceAreaStore.ts"));
  ({ useHomeExploreStore: home } = await server.ssrLoadModule("/src/stores/homeExploreStore.ts"));
});
beforeEach(() => {
  defaults.setState({ selectedAreaId: "gangwon", selectedRegionCode: "1" });
  home.getState().resetForArea("1");
  storage.clear(); requests.length = 0;
  respond = async () => response();
});
after(async () => {
  await server?.close();
  for (const [name, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
});

test("지도에서 다른 도를 둘러봐도 저장된 기본 지역과 알림은 바뀌지 않는다", () => {
  explore("jeonnam", "13");
  assert.equal(home.getState().exploreAreaId, "jeonnam");
  assert.equal(home.getState().selectedSigunguCode, "13");
  assert.equal(defaults.getState().selectedAreaId, "gangwon");
  assert.equal(defaults.getState().selectedRegionCode, "1");
  assert.equal(requests.length, 0);
});

test("설정에서 지역을 바꾸면 서버 알림 반영 후 기본 지역과 탐색 지역을 함께 저장한다", async () => {
  login();
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = saveDefault({ areaId: "jeonnam", regionCode: "13" });
  await flush();
  assert.equal(defaults.getState().selectedAreaId, "gangwon");
  finish(response());
  const result = await pending;
  assert.deepEqual(requests, [{ regionCode: "46130" }]);
  assert.equal(result.notificationSettings.festivalEnabled, true);
  assert.equal(defaults.getState().selectedAreaId, "jeonnam");
  assert.equal(home.getState().exploreAreaId, "jeonnam");
  assert.equal(home.getState().selectedSigunguCode, "13");
  assert.equal(JSON.parse(storage.get("routeone-dev-service-area")).state.selectedAreaId, "jeonnam");
});

test("꺼진 알림은 켜 달라는 요청 없이 꺼진 응답을 유지한다", async () => {
  login();
  respond = async () => response(notificationSettings(false));
  const result = await saveDefault({ areaId: "jeonnam", regionCode: "13" });
  assert.deepEqual(requests[0], { regionCode: "46130" });
  assert.equal(result.notificationSettings.festivalEnabled, false);
  assert.deepEqual(result.notificationSettings.festivalRegionCodes, []);
});

test("로그아웃 상태에서는 서버 알림을 건드리지 않고 기기의 기본 지역만 저장한다", async () => {
  const result = await saveDefault({ areaId: "jeonnam", regionCode: "13" });
  assert.equal(requests.length, 0);
  assert.equal(result.notificationSettings, null);
  assert.equal(defaults.getState().selectedAreaId, "jeonnam");
});

test("저장 실패 시 기본 지역과 현재 지도 탐색 위치를 유지한다", async () => {
  login();
  respond = async () => Response.json({ errors: [{ message: "저장 실패", extensions: { code: "BAD_USER_INPUT" } }] });
  await assert.rejects(saveDefault({ areaId: "jeonnam", regionCode: "13" }));
  assert.equal(defaults.getState().selectedAreaId, "gangwon");
  assert.equal(home.getState().exploreAreaId, null);
});

test("저장 도중 다른 지역을 둘러보기 시작하면 늦은 저장 완료가 지도를 덮어쓰지 않는다", async () => {
  login();
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = saveDefault({ areaId: "jeonnam", regionCode: "13" });
  await flush();
  explore("busan", "16");
  finish(response());
  await pending;
  assert.equal(defaults.getState().selectedAreaId, "jeonnam");
  assert.equal(home.getState().exploreAreaId, "busan");
  assert.equal(home.getState().selectedSigunguCode, "16");
});

test("로그아웃 후 늦게 끝난 저장은 새 세션의 기본 지역을 덮어쓰지 않는다", async () => {
  login();
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = saveDefault({ areaId: "jeonnam", regionCode: "13" });
  await flush();
  storage.delete("routeone.authToken");
  finish(response());
  await assert.rejects(pending);
  assert.equal(defaults.getState().selectedAreaId, "gangwon");
});

test("연속으로 저장하면 요청을 순서대로 처리하고 마지막 기본 지역을 유지한다", async () => {
  login();
  const finishes = [];
  respond = () => new Promise(resolve => { finishes.push(resolve); });
  const first = saveDefault({ areaId: "jeonnam", regionCode: "13" });
  const second = saveDefault({ areaId: "busan", regionCode: "16" });
  await flush();
  assert.equal(requests.length, 1);
  finishes[0](response());
  await flush();
  assert.equal(requests.length, 2);
  finishes[1](response({ ...notificationSettings(), festivalRegionCodes: ["26350"] }));
  await Promise.all([first, second]);
  assert.deepEqual(requests, [{ regionCode: "46130" }, { regionCode: "26350" }]);
  assert.equal(defaults.getState().selectedAreaId, "busan");
  assert.equal(home.getState().exploreAreaId, "busan");
});

test("저장 중 다른 지역을 탐색했다 돌아와도 최신 탐색 선택을 유지한다", async () => {
  login();
  explore("gangwon", "1");
  let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  const pending = saveDefault({ areaId: "jeonnam", regionCode: "13" });
  await flush();
  explore("busan", "16");
  explore("gangwon", "1");
  finish(response());
  await pending;
  assert.equal(defaults.getState().selectedAreaId, "jeonnam");
  assert.equal(home.getState().exploreAreaId, "gangwon");
  assert.equal(home.getState().selectedSigunguCode, "1");
});
