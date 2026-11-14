import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let buildHomeAttractionData;
let hasHomeAttractionLocalizedText;
let applyHomeAttractionLocalization;

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
  ({
    buildHomeAttractionData,
    hasHomeAttractionLocalizedText,
    applyHomeAttractionLocalization,
  } = await server.ssrLoadModule("/src/features/home/homeAttractionModel.ts"));
});

after(async () => {
  await server?.close();
});

function attraction(overrides = {}) {
  return {
    id: "beach",
    title: "경포해변",
    address: "강릉시 창해로",
    lat: 37.8,
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

function concentration(touristName, concentrationRate, baseYmd = "20261113") {
  return {
    touristName,
    concentrationRate,
    baseYmd,
    areaCode: "32",
    signguCode: "51150",
  };
}

function input(overrides = {}) {
  return {
    attractions: [],
    festivals: [],
    concentrationPoints: [],
    lclsNameByCode: { TOUR: "관광지", FOOD: "음식점", HIDDEN: "교회" },
    sigunguCode: "1",
    isLocalized: false,
    ...overrides,
  };
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("관광지와 축제를 합칠 때 이름·주소를 정규화해 첫 항목을 남긴 뒤 숨김 규칙을 적용한다", () => {
  const first = attraction({ id: "first", title: "  Harbor  ", address: " Gangneung " });
  const otherAddress = attraction({ id: "other-address", title: "harbor", address: "Sokcho" });
  const hiddenFirst = attraction({ id: "hidden-first", title: "역사관", lclsSystm1: "HIDDEN" });
  const festival = attraction({ id: "festival", title: "바다축제", contentTypeId: "15" });
  const source = freeze(input({
    attractions: [
      first,
      attraction({ id: "place-duplicate", title: "harbor", address: "gangneung" }),
      otherAddress,
      hiddenFirst,
      attraction({ id: "parking", title: "항구 Parking" }),
    ],
    festivals: [
      attraction({ id: "festival-duplicate", title: "HARBOR", address: "GANGNEUNG", contentTypeId: "15" }),
      attraction({ id: "visible-duplicate", title: "역사관", contentTypeId: "15" }),
      festival,
    ],
  }));

  const result = buildHomeAttractionData(source);

  assert.deepEqual(result.allAttractions, [first, otherAddress, festival]);
  assert.equal(result.allAttractions[0], first);
  assert.equal(result.sourceAttractions, result.allAttractions);
  assert.equal(result.lclsNameByCode, source.lclsNameByCode);
  assert.equal(result.sigunguCode, "1");
  assert.equal(result.isLocalized, false);
  assert.deepEqual(result.topAttractions, []);
  assert.equal(source.attractions.length, 5);
  assert.equal(source.festivals.length, 3);
});

test("최신 혼잡도를 내림차순으로 매칭하고 음식점·축제·숨김 장소와 일치하지 않는 이름은 순위에서 제외한다", () => {
  const trail = attraction({ id: "trail", title: "경포해변 산책로" });
  const beach = attraction();
  const lookout = attraction({ id: "lookout", title: "바다전망대" });
  const food = attraction({ id: "food", title: "해물식당", contentTypeId: "39" });
  const festival = attraction({ id: "festival", title: "바다축제", contentTypeId: "15" });
  const source = freeze(input({
    attractions: [trail, beach, lookout, food, attraction({ id: "hidden", title: "교회" })],
    festivals: [festival],
    concentrationPoints: [
      concentration("경포해변", 900, "20261112"),
      concentration("해물식당", 800),
      concentration("바다축제", 700),
      concentration("교회", 600),
      concentration("없는명소", 500),
      concentration("바다전망대", 80),
      concentration("경포 해변", 20),
      concentration("경포해변 산책로", 10),
    ],
  }));

  const result = buildHomeAttractionData(source);

  assert.deepEqual(result.topAttractions, [
    { attraction: lookout, touristTrendName: "바다전망대" },
    { attraction: beach, touristTrendName: "경포 해변" },
    { attraction: trail, touristTrendName: "경포해변 산책로" },
  ]);
  assert.ok(result.allAttractions.includes(food));
  assert.ok(result.allAttractions.includes(festival));
  assert.equal(source.concentrationPoints[0].baseYmd, "20261112");
});

test("점수가 같으면 원본 순서를 유지하고 장소 유형이 달라도 같은 ID를 순위에 두 번 넣지 않는다", () => {
  const first = attraction({ id: "shared", title: "솔숲공원 산책길" });
  const tied = attraction({ id: "tied", title: "솔숲공원 전망길" });
  const sameId = attraction({ id: "shared", title: "호수정원", contentTypeId: "76" });
  const result = buildHomeAttractionData(freeze(input({
    attractions: [first, tied, sameId],
    concentrationPoints: [
      concentration("솔숲공원", 80),
      concentration("호수정원", 70),
    ],
  })));

  assert.deepEqual(result.topAttractions, [{ attraction: first, touristTrendName: "솔숲공원" }]);
});

test("순위는 혼잡도 상위 10곳으로 제한하고 빈 응답도 원본 목록과 지역 정보를 유지한다", () => {
  const attractions = Array.from({ length: 12 }, (_, index) =>
    attraction({ id: `place-${index}`, title: `명소 ${String.fromCharCode(65 + index)}` })
  );
  const result = buildHomeAttractionData(freeze(input({
    attractions,
    concentrationPoints: attractions.map((item, index) => concentration(item.title, index)),
    isLocalized: true,
  })));

  assert.deepEqual(result.topAttractions.map((item) => item.attraction.id), [
    "place-11", "place-10", "place-9", "place-8", "place-7",
    "place-6", "place-5", "place-4", "place-3", "place-2",
  ]);
  assert.equal(result.allAttractions.length, 12);
  assert.equal(result.isLocalized, true);
  const empty = buildHomeAttractionData(freeze(input({ sigunguCode: "" })));
  assert.deepEqual(empty.allAttractions, []);
  assert.equal(empty.sourceAttractions, empty.allAttractions);
  assert.deepEqual(empty.topAttractions, []);
  assert.equal(empty.sigunguCode, "");
});

test("번역 반영 여부는 ID·장소 유형이 같은 원문의 이름과 주소만 비교한다", () => {
  const source = freeze([attraction()]);
  for (const localized of [
    [],
    [attraction()],
    [attraction({ firstImage: "translated-image.jpg" })],
    [attraction({ title: "Beach", contentTypeId: "76" })],
    [attraction({ title: "Beach", id: "other" })],
  ]) {
    assert.equal(hasHomeAttractionLocalizedText(source, freeze(localized)), false);
  }
  assert.equal(hasHomeAttractionLocalizedText(source, freeze([attraction({ title: "Gyeongpo Beach" })])), true);
  assert.equal(hasHomeAttractionLocalizedText(source, freeze([attraction({ address: "Changhae-ro" })])), true);
});

test("번역 목록을 표시하되 한글 원문·현재 캐시의 이미지·지역과 분류명은 유지한다", () => {
  const tourist = attraction({ firstImage: "source-first.jpg", secondImage: "source-second.jpg" });
  const food = attraction({ id: "beach", contentTypeId: "39", title: "바다식당" });
  const untranslated = attraction({ id: "untranslated", title: "전망대" });
  const sourceAttractions = freeze([tourist, food, untranslated]);
  const currentData = freeze({
    ...buildHomeAttractionData(input({ attractions: sourceAttractions })),
    allAttractions: [
      { ...tourist, firstImage: "cache-first.jpg", secondImage: "" },
      { ...food, firstImage: "", secondImage: "cache-food-second.jpg" },
      untranslated,
    ],
    topAttractions: [
      { attraction: tourist, touristTrendName: "경포 해변" },
      { attraction: untranslated, touristTrendName: "전망대" },
    ],
  });
  const localizedFood = attraction({ ...food, title: "Seafood Restaurant", address: "Restaurant road", firstImage: "food-first.jpg", secondImage: "food-second.jpg" });
  const localizedTourist = attraction({ ...tourist, title: "Gyeongpo Beach", address: "Changhae-ro", firstImage: "translated-first.jpg", secondImage: "translated-second.jpg" });
  const newPlace = attraction({ id: "new", title: "New Place", firstImage: "new-first.jpg" });
  const localized = freeze([localizedFood, localizedTourist, newPlace]);

  const result = applyHomeAttractionLocalization(currentData, sourceAttractions, localized);

  assert.deepEqual(result.allAttractions.map((item) => item.title), ["Seafood Restaurant", "Gyeongpo Beach", "New Place"]);
  assert.equal(result.sourceAttractions, sourceAttractions);
  assert.equal(result.sourceAttractions[0].title, "경포해변");
  assert.equal(result.sourceAttractions[0].address, "강릉시 창해로");
  assert.equal(result.allAttractions[0].firstImage, "food-first.jpg");
  assert.equal(result.allAttractions[0].secondImage, "cache-food-second.jpg");
  assert.equal(result.allAttractions[1].firstImage, "cache-first.jpg");
  assert.equal(result.allAttractions[1].secondImage, "translated-second.jpg");
  assert.equal(result.allAttractions[2], newPlace);
  assert.equal(result.lclsNameByCode, currentData.lclsNameByCode);
  assert.equal(result.sigunguCode, currentData.sigunguCode);
  assert.equal(result.isLocalized, true);
  assert.equal(currentData.isLocalized, false);
  assert.equal(currentData.allAttractions[0].title, "경포해변");
  assert.equal(localizedTourist.firstImage, "translated-first.jpg");
  assert.equal(result.topAttractions[0].attraction, localizedTourist);
  assert.notEqual(result.topAttractions[0].attraction, result.allAttractions[1]);
  assert.equal(result.topAttractions[0].touristTrendName, "경포 해변");
  assert.equal(result.topAttractions[1].attraction, untranslated);
  assert.equal(result.topAttractions[1].touristTrendName, "전망대");
});

test("캐시가 없거나 이미 번역된 캐시는 같은 객체로 반환한다", () => {
  const sourceAttractions = freeze([attraction()]);
  const localized = freeze([attraction({ title: "Beach" })]);
  const currentData = freeze(buildHomeAttractionData(input({
    attractions: sourceAttractions,
    isLocalized: true,
  })));

  assert.equal(applyHomeAttractionLocalization(undefined, sourceAttractions, localized), undefined);
  assert.equal(applyHomeAttractionLocalization(currentData, sourceAttractions, localized), currentData);
  assert.equal(currentData.allAttractions[0].title, "경포해변");
});
