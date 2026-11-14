import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let createRouteEditorState;
let routeEditorReducer;
let resolveRouteEditorSnapshot;

const origin = { lat: 37, lng: 127 };
const options = {
  savedPlaces: [],
  travelStartDate: "2026-12-31",
  tripDays: 1,
  dailyStartMinutes: 540,
  dailyEndMinutes: 1080,
  tempo: "balanced",
  isScheduleValid: true,
  currentLocation: origin,
};

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ createRouteEditorState, routeEditorReducer, resolveRouteEditorSnapshot } =
    await server.ssrLoadModule("/src/features/route-checkout/models/routeResultEditorState.ts"));
});

after(async () => { await server?.close(); });

function place(id, offset = 0) {
  return {
    id,
    contentId: id,
    contentTypeId: "12",
    title: id,
    address: "테스트 주소",
    lat: origin.lat,
    lng: origin.lng + offset * 0.001,
    contentTypeLabel: "관광지",
    categoryName: "자연관광",
    icon: "📍",
    images: [],
  };
}

function day(dayNumber, places, startLocation = origin) {
  return {
    day: dayNumber,
    date: "2026-01-01",
    startLocation,
    startsFromCurrentLocation: Boolean(startLocation),
    items: places.map((itemPlace) => ({
      id: itemPlace.id,
      place: itemPlace,
      stayMinutes: 60,
      recommendedStayMinutes: 60,
      startMinutes: 0,
      endMinutes: 0,
      travelMinutesFromPrevious: 0,
      isOverSchedule: false,
    })),
  };
}

function insertion(itemPlace, insertIndex = 0, dayNumber = 1) {
  const point = { title: "테스트 지점", subtitle: "", ...origin };
  return { place: itemPlace, request: { day: dayNumber, insertIndex, from: point, to: point } };
}

function freeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test("초기 적용·편집은 같은 snapshot이고 복원 상태는 초기 일정보다 우선해 그대로 반환한다", () => {
  const initialPlan = [day(1, [place("initial")])];
  const initial = createRouteEditorState(initialPlan);
  assert.equal(initial.applied, initial.draft);
  assert.equal(initial.draft.routePlanOverride, initialPlan);

  const restored = routeEditorReducer(initial, { type: "change-stay-minutes", placeId: "initial", minutes: 95 });
  freeze(restored);
  assert.equal(createRouteEditorState([], restored), restored);
});

test("체류시간 변경은 적용 기준을 보존하고 적용·취소는 기존 snapshot 참조를 공유한다", () => {
  const initial = freeze(createRouteEditorState(null));
  const edited = routeEditorReducer(initial, { type: "change-stay-minutes", placeId: "one", minutes: 95 });
  assert.equal(edited.applied, initial.applied);
  assert.notEqual(edited.draft, initial.draft);
  assert.deepEqual(initial.draft.stayOverrides, {});

  const applied = freeze(routeEditorReducer(edited, { type: "apply-draft" }));
  assert.equal(applied.applied, edited.draft);
  assert.equal(applied.draft, edited.draft);
  const changedAgain = routeEditorReducer(applied, { type: "change-stay-minutes", placeId: "one", minutes: 125 });
  const cancelled = routeEditorReducer(changedAgain, { type: "cancel-draft" });
  assert.equal(cancelled.applied, applied.applied);
  assert.equal(cancelled.draft, applied.applied);
  assert.equal(cancelled.draft.stayOverrides.one, 95);
});

test("삽입·계획에서 삭제·순서 변경은 수동 배치를 보존하고 자동 배치용 변경을 정리한다", () => {
  const initial = createRouteEditorState(null);
  const restored = freeze({
    applied: initial.applied,
    draft: {
      ...initial.draft,
      stayOverrides: { one: 95, two: 85 },
      manualInsertions: [insertion(place("one"))],
      removedPlaceIds: ["one", "two"],
    },
  });
  const nextPlan = freeze([day(1, [place("one")])]);
  const inserted = routeEditorReducer(restored, { type: "insert-place", placeId: "one", routePlanOverride: nextPlan });
  assert.equal(inserted.applied, restored.applied);
  assert.equal(inserted.draft.routePlanOverride, nextPlan);
  assert.deepEqual(inserted.draft.removedPlaceIds, ["two"]);
  assert.deepEqual(inserted.draft.manualInsertions, []);

  const removed = routeEditorReducer(restored, { type: "remove-place-from-plan", placeId: "one", routePlanOverride: nextPlan });
  assert.equal(removed.draft.routePlanOverride, nextPlan);
  assert.deepEqual(removed.draft.stayOverrides, { two: 85 });
  assert.deepEqual(removed.draft.manualInsertions, []);
  assert.deepEqual(removed.draft.removedPlaceIds, []);

  const reordered = routeEditorReducer(restored, { type: "reorder-route-plan", routePlanOverride: nextPlan });
  assert.equal(reordered.draft.routePlanOverride, nextPlan);
  assert.equal(reordered.draft.stayOverrides, restored.draft.stayOverrides);
  assert.deepEqual(reordered.draft.manualInsertions, []);
  assert.deepEqual(reordered.draft.removedPlaceIds, []);
  assert.equal(reordered.applied, restored.applied);
});

test("빈 계획에서 삭제하면 체류시간·수동 삽입을 제거하고 반복 삭제 ID를 늘리지 않는다", () => {
  const initial = createRouteEditorState(null);
  const state = freeze({
    applied: initial.applied,
    draft: {
      ...initial.draft,
      stayOverrides: { one: 95, two: 85 },
      manualInsertions: [insertion(place("one")), insertion(place("two"))],
    },
  });
  const removed = routeEditorReducer(state, { type: "remove-place-from-empty-plan", placeId: "one" });
  assert.equal(removed.applied, state.applied);
  assert.deepEqual(removed.draft.stayOverrides, { two: 85 });
  assert.deepEqual(removed.draft.manualInsertions.map((entry) => entry.place.id), ["two"]);
  assert.deepEqual(removed.draft.removedPlaceIds, ["one"]);
  const removedAgain = routeEditorReducer(removed, { type: "remove-place-from-empty-plan", placeId: "one" });
  assert.equal(removedAgain.draft.removedPlaceIds, removed.draft.removedPlaceIds);
});

test("자동 배치의 삭제·삽입 순서·중복 제외·체류시간을 함께 반영해 시각을 재계산한다", () => {
  const baseA = place("base-a", 1);
  const baseB = place("base-b", 2);
  const snapshot = freeze({
    ...createRouteEditorState(null).draft,
    stayOverrides: { "base-a": 45, "manual-second": 35 },
    removedPlaceIds: ["base-b"],
    manualInsertions: [
      insertion(place("manual-end", 3), 99),
      insertion(place("manual-first", 4), 0),
      insertion(place("manual-second", 5), 0),
      insertion({ ...baseA, id: "duplicate-content" }, 1),
      insertion(place("other-day"), 0, 2),
    ],
  });
  const result = resolveRouteEditorSnapshot(snapshot, {
    ...options,
    savedPlaces: freeze([{ place: baseA }, { place: baseB }]),
    dailyEndMinutes: 800,
  });
  assert.deepEqual(result[0].items.map((item) => item.id), ["manual-first", "manual-second", "base-a", "manual-end"]);
  assert.deepEqual(result[0].items.map((item) => item.stayMinutes), [90, 35, 45, 90]);
  assert.deepEqual(result[0].items.map((item) => [item.startMinutes, item.endMinutes]), [[548, 638], [646, 681], [689, 734], [742, 832]]);
  assert.deepEqual(result[0].items.map((item) => item.isOverSchedule), [false, false, false, true]);
});

test("일수를 줄이면 DAY 순서대로 넘친 장소를 마지막 날에 합치고 날짜·출발지·수동 순서를 유지한다", () => {
  const dayStart = { lat: 37, lng: 127.001 };
  const snapshot = freeze({
    ...createRouteEditorState(null).draft,
    stayOverrides: { first: 95 },
    routePlanOverride: [day(9, [place("last")]), day(2, [place("first")], null), day(5, [place("second")], dayStart)],
  });
  const result = resolveRouteEditorSnapshot(snapshot, { ...options, tripDays: 2 });
  assert.deepEqual(result.map((entry) => entry.day), [1, 2]);
  assert.deepEqual(result.map((entry) => entry.date), ["2026-12-31", "2027-01-01"]);
  assert.deepEqual(result.map((entry) => entry.startLocation), [origin, dayStart]);
  assert.deepEqual(result.map((entry) => entry.items.map((item) => item.id)), [["first"], ["second", "last"]]);
  assert.equal(result[0].items[0].stayMinutes, 95);
  assert.equal(result[1].items[1].startMinutes, result[1].items[0].endMinutes + 8);
});

test("일수를 늘리면 빈 DAY에 공통 출발지를 넣고 출발지 없는 기존 DAY도 처리한다", () => {
  const snapshot = freeze(createRouteEditorState([day(3, [place("one")], null)]).draft);
  const result = resolveRouteEditorSnapshot(snapshot, { ...options, tripDays: 3, currentLocation: null });
  assert.deepEqual(result.map((entry) => entry.items.length), [1, 0, 0]);
  assert.deepEqual(result.map((entry) => entry.date), ["2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.ok(result.every((entry) => entry.startLocation === null && !entry.startsFromCurrentLocation));
  assert.equal(result[0].items[0].startMinutes, 540);

  const withStart = resolveRouteEditorSnapshot(snapshot, { ...options, tripDays: 3 });
  assert.ok(withStart.every((entry) => entry.startLocation === origin && entry.startsFromCurrentLocation));
});

test("미완성 일정은 빈 결과이고 빈 수동 배치는 담은 장소의 자동 배치와 구분한다", () => {
  const snapshot = createRouteEditorState([]).draft;
  assert.deepEqual(resolveRouteEditorSnapshot(snapshot, { ...options, tempo: null }), []);
  assert.deepEqual(resolveRouteEditorSnapshot(snapshot, { ...options, isScheduleValid: false }), []);
  const result = resolveRouteEditorSnapshot(snapshot, { ...options, savedPlaces: [{ place: place("ignored") }], tripDays: 2 });
  assert.deepEqual(result.map((entry) => entry.items), [[], []]);
});
