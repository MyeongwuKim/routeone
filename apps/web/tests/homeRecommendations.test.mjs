import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let readHomeSelection;
let createHomeSelectionParams;
let fetchTourCourseStops;
let fetchTourCourseStopPlace;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ readHomeSelection, createHomeSelectionParams } = await server.ssrLoadModule(
    "/src/features/home/recommendations/homeRecommendations.ts"
  ));
  ({ fetchTourCourseStops, fetchTourCourseStopPlace } =
    await server.ssrLoadModule("/src/lib/visitKoreaTourApi.ts"));
});

after(async () => { await server?.close(); });

function tourResponse(item, totalCount) {
  return Response.json({
    response: {
      header: { resultCode: "0000" },
      body: { items: { item }, totalCount },
    },
  });
}

test("시·도 전체와 기존 시·군·구 선택을 URL에서 복원한다", () => {
  assert.equal(readHomeSelection(new URLSearchParams("area=unknown&region=1")), null);
  assert.equal(readHomeSelection(new URLSearchParams("area=gangwon&region=999")), null);
  assert.equal(readHomeSelection(new URLSearchParams()), null);
  for (const query of ["area=gangwon", "area=gangwon&region=all"]) {
    assert.deepEqual(readHomeSelection(new URLSearchParams(query)), { areaId: "gangwon", regionCodes: [] });
  }
  for (const query of ["area=gangwon&region=1", "area=gangwon&region=1&transport=walking", "area=gangwon&region=1&transport=transit"]) {
    assert.deepEqual(readHomeSelection(new URLSearchParams(query)), { areaId: "gangwon", regionCodes: ["1"] });
  }
});

test("여러 시·군·구를 URL에 담고 선택 순서와 중복에 상관없이 같은 조회 범위를 복원한다", () => {
  const selection = { areaId: "gangwon", regionCodes: ["1", "5"] };
  const params = createHomeSelectionParams(selection);
  assert.deepEqual(params.getAll("region"), ["1", "5"]);
  assert.deepEqual(readHomeSelection(params), selection);
  assert.deepEqual(readHomeSelection(new URLSearchParams("area=gangwon&region=5&region=1&region=5")), selection);
});

test("코스의 공식 방문 순서를 복원하고 상세 ID가 없는 장소도 남긴다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url, "https://example.test");
    assert.equal(pathname, "/tour-api/B551011/KorService2/detailInfo2");
    assert.equal(searchParams.get("contentTypeId"), "25");
    assert.equal(searchParams.get("contentId"), "101");
    return tourResponse([
      { subnum: "10", subcontentid: "201", subname: "마지막 장소" },
      { subnum: "2", subname: "<b>산책 구간</b>" },
      { subnum: "0", subcontentid: "202", subname: "첫 장소" },
    ], 3);
  });

  const stops = await fetchTourCourseStops("test-key", "101");
  assert.deepEqual(stops.map(({ order, contentId, title }) => ({ order, contentId, title })), [
    { order: 0, contentId: "202", title: "첫 장소" },
    { order: 2, contentId: "", title: "산책 구간" },
    { order: 10, contentId: "201", title: "마지막 장소" },
  ]);
});

test("공식 방문 장소의 식별자와 좌표가 확인될 때만 상세를 연결한다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url, "https://example.test");
    assert.equal(pathname, "/tour-api/B551011/KorService2/detailCommon2");
    const id = searchParams.get("contentId");
    return tourResponse({
      contentid: id === "203" ? "999" : id,
      contenttypeid: "12",
      title: "공식 방문 장소",
      areacode: "32",
      sigungucode: "1",
      mapx: "128.88",
      mapy: id === "202" ? "" : "37.75",
    }, 1);
  });

  const stop = await fetchTourCourseStopPlace("test-key", "201");
  assert.equal(stop?.attraction.id, "201");
  assert.equal(stop?.attraction.lat, 37.75);
  assert.equal(stop?.areaCode, "32");
  assert.equal(await fetchTourCourseStopPlace("test-key", "202"), null);
  assert.equal(await fetchTourCourseStopPlace("test-key", "203"), null);
});
