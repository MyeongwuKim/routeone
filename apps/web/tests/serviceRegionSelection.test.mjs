import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, areas, regions, boundaries, findRegion, buildBoundaryMap, getUiText;
before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ SERVICE_AREAS: areas, SERVICE_REGION_LIST: regions } = await server.ssrLoadModule("/src/data/serviceAreas.ts"));
  ({ findServiceRegionAtLocation: findRegion } = await server.ssrLoadModule("/src/features/home/map/serviceRegionSelection.ts"));
  ({ buildBoundaryMapByRegions: buildBoundaryMap } = await server.ssrLoadModule("/src/lib/gangwonBoundaryUtils.ts"));
  ({ getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts"));
  const collection = JSON.parse(await readFile(new URL("../public/service-region-boundary.json", import.meta.url), "utf8"));
  boundaries = buildBoundaryMap(collection, regions.map(({ region }) => ({ ...region, sigunguCode: region.adminCode })));
});
after(async () => { await server?.close(); });

test("웹 지도와 독립 배포되는 API가 같은 시군구 경계를 사용한다", async () => {
  const [webBoundary, apiBoundary] = await Promise.all([
    readFile(new URL("../public/service-region-boundary.json", import.meta.url)),
    readFile(new URL("../../api/src/assets/service-region-boundary.json", import.meta.url)),
  ]);
  assert.ok(webBoundary.equals(apiBoundary), "웹과 API의 시군구 경계 파일을 함께 갱신해야 한다.");
});

test("지방 14개 시도와 기존 서울의 모든 시군구에 중복 없는 행정 코드와 실제 경계를 제공한다", () => {
  assert.equal(Object.keys(areas).length, 15);
  assert.equal(new Set(regions.map(({ region }) => region.adminCode)).size, regions.length);
  for (const area of Object.values(areas)) {
    assert.ok(area.regions.length);
    assert.ok(area.regions.includes(area.defaultRegion));
    assert.equal(new Set(area.regions.map(region => region.sigunguCode)).size, area.regions.length);
    for (const region of area.regions) assert.ok(boundaries[region.adminCode]?.length, `${area.label} ${region.label}`);
  }
});

test("지도 좌표로 도와 시군구를 함께 선택한다", () => {
  for (const [position, areaId, regionLabel] of [
    [{ lat: 34.7604, lng: 127.6622 }, "jeonnam", "여수시"],
    [{ lat: 34.9507, lng: 127.4872 }, "jeonnam", "순천시"],
    [{ lat: 35.1631, lng: 129.1635 }, "busan", "해운대구"],
    [{ lat: 33.4996, lng: 126.5312 }, "jeju", "제주시"],
    [{ lat: 35.8242, lng: 127.148 }, "jeonbuk", "전주시"],
    [{ lat: 37.7519, lng: 128.8761 }, "gangwon", "강릉"],
    [{ lat: 37.5735, lng: 126.979 }, "seoul", "종로구"],
  ]) {
    const selection = findRegion(position, boundaries);
    assert.equal(selection?.area.id, areaId);
    assert.equal(selection?.region.label, regionLabel);
  }
});

test("시군구 조회 코드가 같아도 다른 도의 지역을 혼동하지 않는다", () => {
  assert.equal(areas.gangwon.regions[0].sigunguCode, areas.busan.regions[0].sigunguCode);
  const gangwon = findRegion({ lat: 37.7519, lng: 128.8761 }, boundaries);
  const busan = findRegion({ lat: 35.212, lng: 128.981 }, boundaries);
  assert.equal(gangwon?.area.id, "gangwon");
  assert.equal(busan?.area.id, "busan");
});

test("지원 경계 밖의 바다·해외·유효하지 않은 좌표는 선택을 바꾸지 않는다", () => {
  for (const position of [{ lat: 35, lng: 125 }, { lat: 35, lng: 139 }, { lat: NaN, lng: 127 }]) {
    assert.equal(findRegion(position, boundaries), null);
  }
});

test("전국 데이터에서 이름이 같은 중구는 행정 코드로 구분한다", () => {
  assert.notDeepEqual(boundaries["11140"], boundaries["26110"]);
  assert.notDeepEqual(boundaries["26110"], boundaries["27110"]);
});


test("영문 시 선택에서 하위 구 이름 대신 시 이름을 표시한다", () => {
  const labels = getUiText("en").labels.regions;
  for (const [name, expected] of [["청주시", "Cheongju-si"], ["천안시", "Cheonan-si"], ["전주시", "Jeonju-si"], ["포항시", "Pohang-si"], ["창원시", "Changwon-si"]]) {
    assert.equal(labels[name], expected);
  }
});
