import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, buildResults, buildItems, cart, previousStorage;
const storage = new Map();

before(async () => {
  previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
  });
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ buildHomeSearchResults: buildResults } = await server.ssrLoadModule("/src/features/home/homeSearchResults.ts"));
  ({ buildHomePlaceListItems: buildItems } = await server.ssrLoadModule("/src/features/home/homePlaceListModel.ts"));
  ({ usePlaceCartStore: cart } = await server.ssrLoadModule("/src/stores/placeCartStore.ts"));
});

beforeEach(() => cart.setState({ savedPlaceIds: [], savedPlaces: [], isSavedListOpen: false }));

after(async () => {
  await server?.close();
  if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
  else delete globalThis.localStorage;
});

function results() {
  const attractions = ["a", "b", "c"].map((id, index) => ({
    id, title: `테스트 장소 ${id}`, address: `강릉 테스트 주소 ${id}`,
    lat: 37.75 + index * 0.001, lng: 128.9,
    contentTypeId: "12", lclsSystm1: "TOUR", lclsSystm2: "", lclsSystm3: "",
    firstImage: "", secondImage: `https://example.test/${id}.jpg`,
    eventStartDate: "", eventEndDate: "", isTodayFestival: false,
    tourApiSigunguCode: "1",
  }));
  return buildResults({
    attractionData: { allAttractions: attractions, lclsNameByCode: { TOUR: "관광지" } },
    currentLocation: null, searchFilter: "all", searchKeyword: "",
    topRankByAttractionId: new Map(), trendNameByAttractionId: new Map(),
  });
}

function items(source = results()) {
  return buildItems({ results: source, savedPlaces: cart.getState().savedPlaces.map(item => item.place), areaCode: "32", signguCode: "51150" });
}

test("목록 장소를 연속으로 담으면 기존 카트에 쌓이고 검토 화면은 자동으로 열리지 않는다", () => {
  for (const item of items()) cart.getState().toggleSavedPlace(item.place, item.result.thumbnailUrl, "ko");
  assert.equal(cart.getState().savedPlaces.length, 3);
  assert.equal(cart.getState().isSavedListOpen, false);
  assert.ok(items().every(item => item.isSaved));
  assert.deepEqual(cart.getState().savedPlaceIds, ["c-12", "b-12", "a-12"]);
  const saved = cart.getState().savedPlaces[0];
  assert.equal(saved.place.contentId, "c");
  assert.equal(saved.place.areaCode, "32");
  assert.equal(saved.place.signguCode, "51150");
  assert.equal(saved.place.lat, 37.752);
  assert.equal(saved.thumbnailUrl, "https://example.test/c.jpg");
  assert.equal(saved.labelLanguage, "ko");
});

test("다른 ID로 담긴 같은 장소도 담음으로 표시하고 다시 누르면 그 장소만 취소한다", () => {
  const [first, second] = items();
  cart.getState().toggleSavedPlace({ ...first.place, id: "legacy-id" }, "", "ko");
  cart.getState().toggleSavedPlace(second.place, "", "ko");
  const [selected] = items();
  assert.equal(selected.isSaved, true);
  cart.getState().toggleSavedPlace(selected.place, "", "ko");
  assert.equal(items()[0].isSaved, false);
  assert.deepEqual(cart.getState().savedPlaceIds, [second.place.id]);
});

test("새로고침으로 카트를 복원해도 목록의 선택 상태와 담은 개수가 일치한다", async () => {
  const [first] = items();
  cart.getState().toggleSavedPlace(first.place, first.result.thumbnailUrl, "ko");
  const saved = storage.get("routeone-place-cart");
  cart.setState({ savedPlaceIds: [], savedPlaces: [] });
  storage.set("routeone-place-cart", saved);
  await cart.persist.rehydrate();
  assert.equal(items()[0].isSaved, true);
  assert.equal(cart.getState().savedPlaces.length, 1);
  assert.equal(cart.getState().savedPlaces[0].thumbnailUrl, first.result.thumbnailUrl);
});

test("지역·필터로 목록이 바뀌어도 기존 담은 장소와 나머지 결과 순서는 유지된다", () => {
  const source = results();
  const [first] = items(source);
  cart.getState().toggleSavedPlace(first.place, "", "ko");
  const filtered = items(source.slice(1));
  assert.deepEqual(filtered.map(item => item.place.contentId), ["b", "c"]);
  assert.ok(filtered.every(item => !item.isSaved));
  assert.equal(cart.getState().savedPlaces.length, 1);
  assert.deepEqual(source.map(item => item.attraction.id), ["a", "b", "c"]);
});

test("추천 코스를 한 번에 담아도 기존 장소가 남고 다시 누르면 중복되지 않는다", (t) => {
  const [first, second, third] = items().map((item) => item.place);
  const existing = { ...first, id: "legacy-id" };
  cart.getState().toggleSavedPlace(existing, "https://example.test/saved.jpg", "ko");
  const existingItem = cart.getState().savedPlaces[0];
  const translated = { ...second, title: "Test place", address: "Test address" };
  const course = [first, translated, { ...translated, id: "duplicate-id" }, third];
  const updates = [];
  t.after(cart.subscribe((state) => updates.push(state.savedPlaceIds)));

  cart.getState().addSavedPlaces(course, "en");
  cart.getState().addSavedPlaces(course, "en");

  const { savedPlaceIds, savedPlaces, isSavedListOpen } = cart.getState();
  assert.deepEqual(updates, [[second.id, third.id, existing.id]]);
  assert.deepEqual(savedPlaceIds, savedPlaces.map((item) => item.id));
  assert.equal(savedPlaces[0].labelLanguage, "en");
  assert.equal(savedPlaces[0].thumbnailUrl, "https://example.test/b.jpg");
  assert.equal(savedPlaces[1].labelLanguage, undefined);
  assert.equal(savedPlaces[2], existingItem);
  assert.equal(isSavedListOpen, false);
});
