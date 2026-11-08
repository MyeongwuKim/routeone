import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let recommendTripDuration;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ recommendTripDuration } = await server.ssrLoadModule(
    "/src/features/route-checkout/utils/tripDurationRecommendation.ts"
  ));
});

after(async () => { await server?.close(); });

function savedPlace(id, coordinates) {
  return {
    id,
    place: {
      id,
      contentTypeId: "12",
      contentTypeLabel: "관광지",
      ...coordinates,
    },
  };
}

function nearbyPlaces(count) {
  return Array.from({ length: count }, (_, index) =>
    savedPlace(`place-${index}`, { lat: 37.76, lng: 128.89 + index * 0.001 })
  );
}

function recommend(savedPlaces, overrides) {
  return recommendTripDuration({
    savedPlaces,
    dailyStartMinutes: 9 * 60,
    dailyEndMinutes: 18 * 60,
    tempo: "balanced",
    ...overrides,
  });
}

test("담은 장소의 수와 체류·이동 시간에 따라 1~3일을 추천한다", () => {
  for (const [count, days] of [[3, 1], [7, 2], [12, 3]]) {
    assert.deepEqual(recommend(nearbyPlaces(count)), { days, fitsDailyHours: true });
  }
});

test("일일 시간 범위와 여행 템포에 따라 추천을 다시 계산한다", () => {
  const places = nearbyPlaces(6);
  assert.deepEqual(recommend(places), { days: 2, fitsDailyHours: true });
  assert.deepEqual(recommend(places, { dailyEndMinutes: 19 * 60 }), {
    days: 1,
    fitsDailyHours: true,
  });
  assert.deepEqual(recommend(places, { tempo: "packed" }), {
    days: 1,
    fitsDailyHours: true,
  });
});

test("같은 수의 장소라도 구간 이동이 길면 일정을 나눈다", () => {
  const nearby = nearbyPlaces(2);
  const farApart = [
    nearby[0],
    savedPlace("seoul", { lat: 37.57, lng: 126.98 }),
  ];
  const hours = { dailyEndMinutes: 13 * 60 };

  assert.deepEqual(recommend(nearby, hours), { days: 1, fitsDailyHours: true });
  assert.deepEqual(recommend(farApart, hours), { days: 2, fitsDailyHours: true });
  assert.deepEqual(recommend([...farApart].reverse(), hours), {
    days: 2,
    fitsDailyHours: true,
  });
});

test("일일 시간 범위가 한 장소 체류보다 짧거나 3일이 부족하면 초과로 표시한다", () => {
  const overflow = { days: 3, fitsDailyHours: false };

  assert.deepEqual(recommend(nearbyPlaces(16)), overflow);
  assert.deepEqual(recommend(nearbyPlaces(1), { dailyEndMinutes: 10 * 60 }), overflow);
  assert.deepEqual(recommend(nearbyPlaces(1000)), overflow);
});

test("빈 목록이나 잘못된 좌표·시간은 추천하지 않는다", () => {
  assert.equal(recommend([]), null);
  for (const coordinates of [
    { lat: NaN, lng: 128 },
    { lat: 91, lng: 128 },
    { lat: 0, lng: 0 },
  ]) {
    assert.equal(recommend([savedPlace("invalid", coordinates)]), null);
  }
  for (const hours of [
    { dailyStartMinutes: -1 },
    { dailyEndMinutes: 9 * 60 },
    { dailyEndMinutes: 25 * 60 },
    { dailyEndMinutes: NaN },
  ]) {
    assert.equal(recommend(nearbyPlaces(2), hours), null);
  }
});
