import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { createServer } from "vite";

let server;
let readHomeSelection;
let createHomeSelectionParams;
let loadAvailableHomeCoursePage;
let getHomeCourseRetryInterval;
let formatTourCourseMeasurement;
let fetchTourCourseFacts;
let fetchTourCourseOverview;
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
  ({ readHomeSelection, createHomeSelectionParams, loadAvailableHomeCoursePage, getHomeCourseRetryInterval, formatTourCourseMeasurement } = await server.ssrLoadModule(
    "/src/features/home/recommendations/homeRecommendations.ts"
  ));
  ({ fetchTourCourseFacts, fetchTourCourseOverview, fetchTourCourseStops, fetchTourCourseStopPlace } =
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

test("코스의 공식 방문 순서와 설명을 복원하고 상세 ID가 없는 장소도 남긴다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url, "https://example.test");
    assert.equal(pathname, "/tour-api/B551011/KorService2/detailInfo2");
    assert.equal(searchParams.get("contentTypeId"), "25");
    assert.equal(searchParams.get("contentId"), "101");
    return tourResponse([
      { subnum: "10", subcontentid: "201", subname: "마지막 장소" },
      { subnum: "2", subname: "<b>산책 구간</b>", subdetailoverview: "<p>산책 설명</p>" },
      { subnum: "0", subcontentid: "202", subname: "첫 장소", subdetailoverview: "첫 설명<br>다음 문장\\n" },
    ], 3);
  });

  const stops = await fetchTourCourseStops("test-key", "101");
  assert.deepEqual(stops.map(({ order, contentId, title, description }) => ({ order, contentId, title, description })), [
    { order: 0, contentId: "202", title: "첫 장소", description: "첫 설명 다음 문장" },
    { order: 2, contentId: "", title: "산책 구간", description: "산책 설명" },
    { order: 10, contentId: "201", title: "마지막 장소", description: "" },
  ]);
});

test("코스 상세 요청이 끝나지 않으면 제한 시간에 중단한다", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener("abort", () => reject(options.signal.reason), { once: true });
  }));
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    assert.equal(delay, 12_000);
    queueMicrotask(callback);
    return 1;
  });
  t.mock.method(globalThis, "clearTimeout", () => {});

  const outcome = await Promise.race([
    fetchTourCourseStops("test-key", "101").then(() => "resolved", (error) => error.name),
    sleep(25).then(() => "pending"),
  ]);
  assert.equal(outcome, "AbortError");
});

test("코스 전체 소개는 공통 상세에서 읽고 빈 설명은 표시하지 않는다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url, "https://example.test");
    assert.equal(pathname, "/tour-api/B551011/KorService2/detailCommon2");
    assert.equal(searchParams.has("contentTypeId"), false);
    const id = searchParams.get("contentId");
    return tourResponse({
      contentid: id,
      contenttypeid: id === "103" ? "12" : "25",
      overview: id === "102" ? "<p> </p>" : "<p>코스 전체<br>소개</p>",
    }, 1);
  });

  assert.equal(await fetchTourCourseOverview("test-key", "101"), "코스 전체 소개");
  assert.equal(await fetchTourCourseOverview("test-key", "102"), "");
  assert.equal(await fetchTourCourseOverview("test-key", "103"), "");
});

test("코스 소개 상세에서 거리·시간을 읽고 미등록 값과 기관 분류값은 비운다", async (t) => {
  t.mock.method(globalThis, "fetch", async (url) => {
    const { pathname, searchParams } = new URL(url, "https://example.test");
    assert.equal(pathname, "/tour-api/B551011/KorService2/detailIntro2");
    assert.equal(searchParams.get("contentTypeId"), "25");
    return tourResponse([{
      contentid: "101",
      distance: "<p>5.5㎞</p>",
      taketime: " 약 2시간30분 ",
      theme: "<p>&nbsp;</p>",
    }, {
      contentid: "103",
      distance: "7km",
      theme: "지자체",
    }, {
      contentid: "104",
      theme: "자연여행",
    }, {
      contentid: "105",
      theme: "Local government",
    }], 4);
  });
  assert.deepEqual(await fetchTourCourseFacts("test-key", "101"), {
    distance: "5.5㎞", duration: "약 2시간30분", theme: "",
  });
  assert.deepEqual(await fetchTourCourseFacts("test-key", "102"), {
    distance: "", duration: "", theme: "",
  });
  assert.deepEqual(await fetchTourCourseFacts("test-key", "103"), {
    distance: "7km", duration: "", theme: "",
  });
  assert.equal((await fetchTourCourseFacts("test-key", "104")).theme, "자연여행");
  assert.equal((await fetchTourCourseFacts("test-key", "105")).theme, "");
});

test("거리와 시간은 영어 모드에서 숫자를 유지하면서 단위를 변환한다", () => {
  assert.equal(formatTourCourseMeasurement("약 2시간30분", "en"), "About 2 hr 30 min");
  assert.equal(formatTourCourseMeasurement("5.5㎞", "en"), "5.5 km");
  assert.equal(formatTourCourseMeasurement("2~3시간", "en"), "2~3 hr");
  assert.equal(formatTourCourseMeasurement("약 2시간30분", "ko"), "약 2시간30분");
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

test("방문지 하나라도 지도에 연결할 수 없으면 코스 전체를 제외하고 다음 페이지를 확인한다", async () => {
  const sourcePages = [
    [{ id: "missing-place" }, { id: "missing-id" }, { id: "no-stops" }],
    [{ id: "complete" }, { id: "also-complete" }],
    [{ id: "missing-place" }],
  ];
  const stopsByCourse = {
    "missing-place": ["201", "202"],
    "missing-id": ["201", ""],
    "no-stops": [],
    complete: ["201", "203", "201"],
    "also-complete": ["203"],
  };
  const requestedPages = [];
  const loaders = {
    signal: new AbortController().signal,
    loadPage: async (page) => {
      requestedPages.push(page);
      return { courses: sourcePages[page - 1], totalCount: 25 };
    },
    loadStops: async (id) => stopsByCourse[id].map((contentId) => ({ contentId })),
    loadPlace: async (id) => id === "202" ? null : { id },
  };

  assert.deepEqual(await loadAvailableHomeCoursePage(1, loaders), {
    courses: [{ id: "complete" }, { id: "also-complete" }],
    nextPage: 3,
  });
  assert.deepEqual(await loadAvailableHomeCoursePage(3, loaders), { courses: [], nextPage: undefined });
  assert.deepEqual(requestedPages, [1, 2, 3]);
});

test("모든 코스의 상세 조회가 정상이라면 추천 순서와 다음 페이지를 유지한다", async () => {
  const result = await loadAvailableHomeCoursePage(1, {
    signal: new AbortController().signal,
    loadPage: async () => ({ courses: [{ id: "first" }, { id: "second" }], totalCount: 13 }),
    loadStops: async (id) => [{ contentId: id === "first" ? "201" : "202" }],
    loadPlace: async (id) => ({ id }),
  });

  assert.deepEqual(result, {
    courses: [{ id: "first" }, { id: "second" }],
    nextPage: 2,
  });
});

test("코스 조회 일부가 실패해도 정상 코스를 원래 순서로 표시하고 다음 페이지를 유지한다", async () => {
  const pages = [
    [{ id: "first" }, { id: "failed" }, { id: "second" }],
    [{ id: "third" }],
  ];
  const loaders = {
    signal: new AbortController().signal,
    loadPage: async (page) => ({ courses: pages[page - 1], totalCount: 13 }),
    loadStops: async (id) => {
      if (id === "failed") throw new Error("TourAPI unavailable");
      return [{ contentId: id === "first" ? "201" : id === "second" ? "202" : "203" }];
    },
    loadPlace: async (id) => ({ id }),
  };

  assert.deepEqual(await loadAvailableHomeCoursePage(1, loaders), {
    courses: [{ id: "first" }, { id: "second" }],
    nextPage: 2,
    hadLookupError: true,
  });
  assert.deepEqual(await loadAvailableHomeCoursePage(2, loaders), {
    courses: [{ id: "third" }],
    nextPage: undefined,
  });
});

test("모든 코스의 상세 조회가 실패하면 빈 목록 대신 오류를 유지한다", async () => {
  const error = new Error("TourAPI unavailable");
  await assert.rejects(loadAvailableHomeCoursePage(1, {
    signal: new AbortController().signal,
    loadPage: async () => ({ courses: [{ id: "first" }, { id: "second" }], totalCount: 2 }),
    loadStops: async () => { throw error; },
    loadPlace: async () => ({ id: "201" }),
  }), error);
});

test("장소 정보 없음과 조회 실패가 섞여 있으면 전체 조회 오류로 처리하지 않는다", async () => {
  const result = await loadAvailableHomeCoursePage(1, {
    signal: new AbortController().signal,
    loadPage: async () => ({ courses: [{ id: "missing" }, { id: "failed" }], totalCount: 2 }),
    loadStops: async (id) => {
      if (id === "failed") throw new Error("TourAPI unavailable");
      return [{ contentId: "201" }];
    },
    loadPlace: async () => null,
  });

  assert.deepEqual(result, { courses: [], nextPage: undefined, hadLookupError: true });
});

test("부분 실패 결과만 재조회하고 일시적 실패가 회복되면 재조회를 멈춘다", async () => {
  let shouldFail = true;
  const loaders = {
    signal: new AbortController().signal,
    loadPage: async () => ({ courses: [{ id: "first" }, { id: "second" }], totalCount: 2 }),
    loadStops: async (id) => {
      if (id === "second" && shouldFail) throw new Error("TourAPI unavailable");
      return [{ contentId: id === "first" ? "201" : "202" }];
    },
    loadPlace: async (id) => ({ id }),
  };

  const partial = await loadAvailableHomeCoursePage(1, loaders);
  assert.equal(getHomeCourseRetryInterval([partial]), 30_000);
  shouldFail = false;
  const recovered = await loadAvailableHomeCoursePage(1, loaders);
  assert.deepEqual(recovered.courses, [{ id: "first" }, { id: "second" }]);
  assert.equal(getHomeCourseRetryInterval([recovered]), false);
});

test("장소 조회 실패는 장소 정보 누락으로 처리하지 않는다", async () => {
  const error = new Error("TourAPI unavailable");
  await assert.rejects(loadAvailableHomeCoursePage(1, {
    signal: new AbortController().signal,
    loadPage: async () => ({ courses: [{ id: "course" }], totalCount: 1 }),
    loadStops: async () => [{ contentId: "201" }],
    loadPlace: async () => { throw error; },
  }), error);
});
