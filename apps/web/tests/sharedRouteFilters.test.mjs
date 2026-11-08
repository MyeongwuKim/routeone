import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let filters;
let getUiText;
let serviceArea;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  filters = await server.ssrLoadModule("/src/features/shared-route/sharedRouteFilters.ts");
  ({ getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts"));
  const { SERVICE_AREAS } = await server.ssrLoadModule("/src/data/serviceAreas.ts");
  serviceArea = SERVICE_AREAS.gangwon;
});

after(async () => { await server?.close(); });

function createRoute(regions, tags = ["1박 2일"]) {
  const stops = regions.map((label, index) => {
    const region = serviceArea.regions.find((candidate) => candidate.label === label);
    return {
      id: `stop-${index}`,
      place: {
        title: `${label} 장소`,
        regionCode: region.sigunguCode,
        regionLabelKey: `32:${region.sigunguCode}`,
        categoryLabel: "관광지",
      },
    };
  });
  return {
    stops,
    primaryRegionCode: stops[0].place.regionCode,
    primaryRegionLabelKey: stops[0].place.regionLabelKey,
    shareTags: tags,
    tripDays: 2,
    totalStopCount: stops.length,
  };
}

test("기본 상태에는 지역이 선택되지 않고 모든 루트가 표시된다", () => {
  assert.equal(filters.getActiveFilterCount(filters.EMPTY_SHARED_ROUTE_FILTERS), 0);
  for (const region of ["철원", "정선", "삼척"]) {
    assert.equal(filters.routeMatchesFilters(createRoute([region]), filters.EMPTY_SHARED_ROUTE_FILTERS, getUiText("ko")), true);
  }
});

test("지역만 선택해도 다른 지역의 루트가 제외된다", () => {
  const selected = filters.addFilterCandidate(filters.EMPTY_SHARED_ROUTE_FILTERS, { type: "region", value: "철원" });
  assert.equal(filters.getActiveFilterCount(selected), 1);
  assert.equal(filters.routeMatchesFilters(createRoute(["철원"]), selected, getUiText("ko")), true);
  assert.equal(filters.routeMatchesFilters(createRoute(["정선"]), selected, getUiText("ko")), false);
  assert.equal(filters.routeMatchesFilters(createRoute(["삼척"]), selected, getUiText("ko")), false);
});

test("여러 지역을 선택하면 그중 한 지역이 포함된 루트가 표시된다", () => {
  const selected = { tags: [], regions: ["철원", "정선"], places: [] };
  assert.equal(filters.routeMatchesFilters(createRoute(["정선"]), selected, getUiText("ko")), true);
  assert.equal(filters.routeMatchesFilters(createRoute(["삼척", "철원"]), selected, getUiText("ko")), true);
  assert.equal(filters.routeMatchesFilters(createRoute(["삼척"]), selected, getUiText("ko")), false);
});

test("추천 코스에 공유 루트에서 선택한 시·군·구를 모두 넘긴다", () => {
  assert.deepEqual(filters.getSharedRouteRecommendationSelection("gangwon", ["강릉", "속초"]), {
    areaId: "gangwon", regionCodes: ["1", "5"],
  });
  assert.deepEqual(filters.getSharedRouteRecommendationSelection("gangwon", []), {
    areaId: "gangwon", regionCodes: [],
  });
  assert.deepEqual(filters.getSharedRouteRecommendationSelection("gangwon", ["강릉", "종로구"]), {
    areaId: "gangwon", regionCodes: ["1"],
  });
  assert.deepEqual(filters.getSharedRouteRecommendationSelection("gangwon", ["강남구", "종로구"]), {
    areaId: "seoul", regionCodes: ["1", "23"],
  });
});

test("장소 목록이 없는 루트는 대표 지역으로 판별한다", () => {
  const route = { ...createRoute(["철원"]), stops: [] };
  assert.equal(filters.routeMatchesFilters(route, { tags: [], regions: ["철원"], places: [] }, getUiText("ko")), true);
  assert.equal(filters.routeMatchesFilters(route, { tags: [], regions: ["정선"], places: [] }, getUiText("ko")), false);
});

test("지역과 태그, 장소 조건을 함께 적용한다", () => {
  const selected = {
    regions: ["철원"],
    tags: ["1박 2일"],
    places: [{ name: "철원 장소", region: "철원", category: "관광지" }],
  };
  assert.equal(filters.routeMatchesFilters(createRoute(["철원"]), selected, getUiText("ko")), true);
  assert.equal(filters.routeMatchesFilters(createRoute(["철원"], ["2박 3일"]), selected, getUiText("ko")), false);
  const otherPlace = createRoute(["철원"]);
  otherPlace.stops[0].place.title = "다른 장소";
  assert.equal(filters.routeMatchesFilters(otherPlace, selected, getUiText("ko")), false);
});

test("장소 바로가기는 해당 지역도 선택하고 지역 해제 시 그 장소 조건도 제거한다", () => {
  const selected = filters.addFilterCandidate(filters.EMPTY_SHARED_ROUTE_FILTERS, { type: "place", value: "철원 장소", region: "철원" });
  assert.deepEqual(selected.regions, ["철원"]);
  const withAnotherRegion = filters.addFilterCandidate(selected, { type: "region", value: "정선" });
  const removed = filters.removeFilterCandidate(withAnotherRegion, { type: "region", value: "철원" });
  assert.deepEqual(removed, { tags: [], regions: ["정선"], places: [] });
  assert.equal(selected.places.length, 1);
});

test("지역 중복 추가와 토글이 다른 조건을 바꾸지 않는다", () => {
  const selected = { tags: ["1박 2일"], regions: ["철원"], places: [] };
  assert.equal(filters.addFilterCandidate(selected, { type: "region", value: "철원" }), selected);
  assert.deepEqual(filters.toggleFilterCandidate(selected, { type: "region", value: "철원" }), { tags: ["1박 2일"], regions: [], places: [] });
});

test("영문 화면에서도 지역 이름의 표시 언어와 무관하게 필터가 적용된다", () => {
  const selected = { tags: [], regions: ["철원"], places: [] };
  assert.equal(filters.routeMatchesFilters(createRoute(["철원"]), selected, getUiText("en")), true);
  assert.equal(filters.routeMatchesFilters(createRoute(["정선"]), selected, getUiText("en")), false);
  assert.equal(filters.getFilterLabel({ type: "region", value: "철원" }, getUiText("en")), "Region: Cheorwon");
});

test("공개 공유 루트는 재시작 시 시도만 복원하고 좋아요 목록은 별도 선택을 사용한다", async () => {
  const storageKey = "routeone-shared-route-area";
  const storage = new Map();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    } },
  });

  try {
    const { createSharedRouteSelectionStore, sharedRouteFeedSelectionStore: feed } = await server.ssrLoadModule(
      "/src/features/shared-route/stores/sharedRouteSelectionStore.ts"
    );
    feed.getState().selectArea("busan");
    feed.getState().updateFilters("busan", "ko", () => ({ tags: [], regions: ["해운대구"], places: [] }));
    assert.deepEqual(feed.getState().applied?.filters.regions, ["해운대구"]);
    const saved = storage.get(storageKey);
    assert.deepEqual(JSON.parse(saved).state, { areaId: "busan" });

    const liked = createSharedRouteSelectionStore();
    liked.getState().selectArea("seoul");
    assert.equal(storage.get(storageKey), saved);

    feed.setState({ areaId: null, applied: null });
    storage.set(storageKey, saved);
    await feed.persist.rehydrate();
    assert.equal(feed.getState().areaId, "busan");
    assert.equal(feed.getState().applied, null);
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
});
