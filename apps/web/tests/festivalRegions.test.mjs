import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server, resolveRegion, normalizeCodes, toAttraction, serviceAreas, serverRegions;
before(async () => {
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ resolveFestivalRegion: resolveRegion, normalizeFestivalRegionCodes: normalizeCodes } = await server.ssrLoadModule("/src/lib/festivalRegions.ts"));
  ({ createFestivalAttraction: toAttraction } = await server.ssrLoadModule("/src/lib/festivalAttraction.ts"));
  ({ SERVICE_AREA_LIST: serviceAreas } = await server.ssrLoadModule("/src/data/serviceAreas.ts"));
  ({ FESTIVAL_REGION_BY_CODE: serverRegions } = await server.ssrLoadModule(fileURLToPath(new URL("../../api/src/modules/notifications/festivalRegions.ts", import.meta.url))));
});
after(async () => { await server?.close(); });

test("알림 지역은 행정 코드로 권역을 찾으며 기존 강원 단축 코드도 복원한다", () => {
  assert.equal(resolveRegion("13").region.label, "춘천");
  assert.equal(resolveRegion("46130").area.id, "jeonnam");
  assert.equal(resolveRegion("46130").region.label, "여수시");
  assert.equal(resolveRegion("26350").area.id, "busan");
  assert.equal(resolveRegion("MULTIPLE"), null);
  assert.deepEqual(normalizeCodes(["1", "51150", "46130", "invalid"]), ["51150", "46130"]);
});

test("축제의 행정 코드를 관광공사 지도 필터 코드와 구분하고 진행 날짜를 적용한다", () => {
  const attraction = toAttraction({
    id: "festival", title: "여수 축제", address: "전남 여수시", lat: 34.76, lng: 127.66,
    regionCode: "46130", areaCode: "38", sigunguCode: "13",
    startDate: "2026-11-01", endDate: "2026-11-10", imageUrl: "",
  }, "20261103");
  assert.equal(attraction.tourApiSigunguCode, "13");
  assert.equal(attraction.isTodayFestival, true);
  assert.equal(attraction.eventStartDate, "20261101");
});

test("모든 선택 지역에서 축제를 열고 프런트·서버 지역 코드가 일치한다", () => {
  for (const area of serviceAreas) {
    assert.equal(area.hasFestivalSource, true, area.label);
    for (const region of area.regions) {
      const serverRegion = serverRegions[region.adminCode];
      assert.ok(serverRegion, `${area.label} ${region.label}`);
      assert.equal(serverRegion.areaCode, area.tourAreaCode);
      assert.equal(serverRegion.tourCode, region.sigunguCode);
      assert.equal(serverRegion.label, region.label);
    }
  }
});
