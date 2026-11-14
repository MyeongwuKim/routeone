import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let buildRoutePlan;
let recalculateRoutePlanDays;
let buildCreateRouteInput;

const origin = { lat: 37.76, lng: 128.89 };

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ buildRoutePlan, recalculateRoutePlanDays } = await server.ssrLoadModule(
    "/src/features/route-checkout/utils/routePlanBuilder.ts"
  ));
  ({ buildCreateRouteInput } = await server.ssrLoadModule("/src/api/routeCheckoutApi.ts"));
});

after(async () => { await server?.close(); });

function nearbyPlaces(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `place-${index}`,
    savedAt: index,
    thumbnailUrl: "",
    place: {
      id: `place-${index}`,
      contentId: `place-${index}`,
      contentTypeId: "12",
      contentTypeLabel: "관광지",
      categoryName: "자연관광",
      title: `테스트 장소 ${index}`,
      address: "테스트 주소",
      images: [],
      icon: "📍",
      lat: origin.lat,
      lng: origin.lng + index * 0.001,
    },
  }));
}

function plan(savedPlaces, overrides = {}) {
  return buildRoutePlan({
    savedPlaces,
    travelStartDate: "2026-11-30",
    tripDays: 2,
    dailyStartMinutes: 540,
    dailyEndMinutes: 1080,
    tempo: "balanced",
    stayOverrides: {},
    currentLocation: origin,
    ...overrides,
  });
}

function assertPlacesPreserved(routePlan, savedPlaces) {
  assert.deepEqual(
    routePlan.flatMap((day) => day.items.map((item) => item.id)).sort(),
    savedPlaces.map((item) => item.place.id).sort()
  );
}

test("하루에 모두 들어가도 선택한 2일에 장소를 나누고 저장 일수를 유지한다", () => {
  const places = nearbyPlaces(4);
  const routePlan = plan(places);
  assert.deepEqual(routePlan.map((day) => day.items.length), [2, 2]);
  assert.deepEqual(routePlan.map((day) => day.date), ["2026-11-30", "2026-12-01"]);
  assertPlacesPreserved(routePlan, places);
  const input = buildCreateRouteInput({
    routePlan,
    tripDays: 2,
    travelStartDate: "2026-11-30",
    dailyStartMinutes: 540,
    scheduleEndMinutes: 1080,
    startLocation: origin,
  });
  assert.equal(input.tripDays, 2);
  assert.deepEqual(input.stops.map((stop) => stop.dayIndex), [1, 1, 2, 2]);
});

test("템포별로 충분한 장소를 선택 일수에 고르게 배치하고 원본을 변경하지 않는다", () => {
  for (const tempo of ["relaxed", "balanced", "packed"]) {
    for (const [count, tripDays] of [[2, 2], [6, 3], [8, 2]]) {
      const places = nearbyPlaces(count);
      const original = structuredClone(places);
      const routePlan = plan(places, { tempo, tripDays });
      assert.deepEqual(routePlan.map((day) => day.items.length), Array(tripDays).fill(count / tripDays));
      assertPlacesPreserved(routePlan, places);
      assert.deepEqual(places, original);
      for (const day of routePlan) {
        assert.deepEqual(day.startLocation, origin);
        assert.ok(day.items.every((item) => !item.isOverSchedule));
      }
    }
  }
});

test("장소보다 일수가 많으면 앞 날짜부터 중복 없이 한 곳씩 배치한다", () => {
  const places = nearbyPlaces(2);
  const routePlan = plan(places, { tripDays: 5 });
  assert.deepEqual(routePlan.map((day) => day.items.length), [1, 1, 0, 0, 0]);
  assertPlacesPreserved(routePlan, places);
  assert.deepEqual(plan([], { tripDays: 3 }).map((day) => day.items), [[], [], []]);
});

test("담은 순서가 섞여도 가까운 장소끼리 같은 DAY에 묶고 출발지 없는 첫 이동을 만들지 않는다", () => {
  const places = nearbyPlaces(4);
  for (const index of [1, 3]) {
    places[index].place.lat = 37.87 + index * 0.001;
    places[index].place.lng = 127.73 + index * 0.001;
  }
  const routePlan = plan(places, { currentLocation: null });
  assertPlacesPreserved(routePlan, places);
  const groups = routePlan.map((day) => day.items.map((item) => item.id).sort());
  assert.deepEqual(groups.sort((left, right) => left[0].localeCompare(right[0])), [
    ["place-0", "place-2"],
    ["place-1", "place-3"],
  ]);
  assert.ok(routePlan.every((day) => day.items[0].travelMinutesFromPrevious === 0));
});

test("일정이 부족해도 장소를 버리지 않고 초과 상태를 표시한다", () => {
  const places = nearbyPlaces(5);
  const routePlan = plan(places, { dailyEndMinutes: 600 });
  assertPlacesPreserved(routePlan, places);
  assert.ok(routePlan.every((day) => day.items.length > 0));
  assert.ok(routePlan.flatMap((day) => day.items).some((item) => item.isOverSchedule));
});

test("편집 재계산은 사용자가 정한 날짜별 순서·출발지·체류시간을 보존한다", () => {
  const routePlan = plan(nearbyPlaces(4));
  const edited = routePlan.map((day) => ({
    ...day,
    startLocation: { lat: origin.lat + day.day * 0.01, lng: origin.lng },
    items: [...day.items].reverse().map((item) => ({ ...item, stayMinutes: 45 })),
  }));
  const original = structuredClone(edited);
  const recalculated = recalculateRoutePlanDays({
    routePlan: edited,
    dailyStartMinutes: 600,
    dailyEndMinutes: 1080,
    tempo: "relaxed",
    stayOverrides: {},
    currentLocation: origin,
  });
  assert.deepEqual(recalculated.map((day) => day.items.map((item) => item.id)), edited.map((day) => day.items.map((item) => item.id)));
  assert.deepEqual(recalculated.map((day) => day.startLocation), edited.map((day) => day.startLocation));
  assert.ok(recalculated.flatMap((day) => day.items).every((item) => item.stayMinutes === 45));
  assert.deepEqual(edited, original);
});
