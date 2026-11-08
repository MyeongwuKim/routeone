import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let buildHomeSearchResults;

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
  ({ buildHomeSearchResults } = await server.ssrLoadModule(
    "/src/features/home/homeSearchResults.ts"
  ));
});

after(async () => {
  await server?.close();
});

function createAttraction(overrides) {
  return {
    id: "place",
    title: "장소",
    address: "강원특별자치도",
    lat: 37.5,
    lng: 128.9,
    contentTypeId: "12",
    lclsSystm1: "TOUR",
    lclsSystm2: "",
    lclsSystm3: "",
    firstImage: "",
    secondImage: "",
    eventStartDate: "",
    eventEndDate: "",
    isTodayFestival: false,
    tourApiSigunguCode: "1",
    ...overrides,
  };
}

function buildResults({
  attractions,
  sourceAttractions = attractions,
  currentLocation = null,
  searchFilter = "all",
  searchKeyword = "",
  ranks = [],
  trendNames = [],
}) {
  return buildHomeSearchResults({
    attractionData: {
      allAttractions: attractions,
      sourceAttractions,
      sigunguCode: "1",
      topAttractions: [],
      lclsNameByCode: {
        TOUR: "관광지",
        FOOD: "음식점",
      },
      isLocalized: true,
    },
    currentLocation,
    searchFilter,
    searchKeyword,
    topRankByAttractionId: new Map(ranks),
    trendNameByAttractionId: new Map(trendNames),
  });
}

test("검색어는 제목 일치, 제목 시작, 주소 일치 순으로 정렬한다", () => {
  const results = buildResults({
    attractions: [
      createAttraction({ id: "address", title: "전망대", address: "해변로" }),
      createAttraction({ id: "unmatched", title: "산책로", address: "숲길" }),
      createAttraction({ id: "prefix", title: "해변 산책로" }),
      createAttraction({ id: "exact", title: "해변" }),
    ],
    searchKeyword: "해변",
  });

  assert.deepEqual(
    results.map((result) => result.attraction.id),
    ["exact", "prefix", "address"]
  );
});

test("영문 화면에서도 한글 장소명과 주소를 검색해 영문 장소를 표시한다", () => {
  const localized = createAttraction({
    id: "beach",
    title: "Gyeongpo Beach",
    address: "514 Changhae-ro, Gangneung",
  });
  const source = {
    ...localized,
    title: "경포해변",
    address: "강원특별자치도 강릉시 창해로 514",
  };

  for (const searchKeyword of [" 경포해변\n", source.address, localized.title]) {
    const results = buildResults({
      attractions: [localized],
      sourceAttractions: [source],
      searchKeyword,
    });

    assert.deepEqual(results.map((result) => result.attraction), [localized]);
  }
});

test("영문 표시값과 한글 원문 중 더 정확한 검색 일치도로 정렬한다", () => {
  const beach = createAttraction({
    id: "beach",
    title: "Gyeongpo Beach",
    address: "경포해변 인근",
  });
  const trail = createAttraction({ id: "trail", title: "Gyeongpo Beach Trail" });

  const results = buildResults({
    attractions: [trail, beach],
    sourceAttractions: [
      { ...beach, title: "경포해변" },
      { ...trail, title: "경포해변 산책로" },
    ],
    searchKeyword: "경포해변",
  });

  assert.deepEqual(results.map((result) => result.attraction), [beach, trail]);
});

test("ID가 같아도 장소 유형이 다르거나 영문 목록에 없으면 원문을 매칭하지 않는다", () => {
  const results = buildResults({
    attractions: [createAttraction({ id: "shared", title: "Beach" })],
    sourceAttractions: [
      createAttraction({ id: "shared", title: "한글 검색어", contentTypeId: "39" }),
      createAttraction({ id: "source-only", title: "한글 검색어" }),
    ],
    searchKeyword: "한글 검색어",
  });

  assert.deepEqual(results, []);
});

test("선택한 장소 유형과 일치하지 않는 결과는 제외한다", () => {
  const results = buildResults({
    attractions: [
      createAttraction({ id: "tourist" }),
      createAttraction({
        id: "food",
        contentTypeId: "39",
        lclsSystm1: "FOOD",
      }),
    ],
    searchFilter: "food",
  });

  assert.deepEqual(
    results.map((result) => result.attraction.id),
    ["food"]
  );
});

test("같은 검색 우선순위에서는 현재 위치와 가까운 장소를 먼저 둔다", () => {
  const results = buildResults({
    attractions: [
      createAttraction({ id: "far", lat: 37.7, lng: 129.1 }),
      createAttraction({ id: "near", lat: 37.5001, lng: 128.9001 }),
    ],
    currentLocation: { lat: 37.5, lng: 128.9 },
    ranks: [
      ["far", 1],
      ["near", 10],
    ],
  });

  assert.deepEqual(
    results.map((result) => result.attraction.id),
    ["near", "far"]
  );
});

test("현재 위치가 없으면 순위와 이름 순으로 정렬하고 표시값을 보완한다", () => {
  const results = buildResults({
    attractions: [
      createAttraction({ id: "name-b", title: "나 장소" }),
      createAttraction({
        id: "ranked",
        title: "다 장소",
        secondImage: "fallback.jpg",
      }),
      createAttraction({ id: "name-a", title: "가 장소" }),
    ],
    ranks: [["ranked", 2]],
    trendNames: [["ranked", "관광 데이터 이름"]],
  });

  assert.deepEqual(
    results.map((result) => result.attraction.id),
    ["ranked", "name-a", "name-b"]
  );
  assert.equal(results[0].thumbnailUrl, "fallback.jpg");
  assert.equal(results[0].touristTrendName, "관광 데이터 이름");
  assert.equal(results[1].touristTrendName, "가 장소");
});
