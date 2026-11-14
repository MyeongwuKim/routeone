import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let createRouteCheckoutDraftStore;
let getCheckoutPlacesKey;
let getDraftContextKey;
let createPlannedRouteDay;
let createSavedPlacesFromRoutePlan;
const storageKey = "routeone-route-checkout-draft";

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ createRouteCheckoutDraftStore } = await server.ssrLoadModule("/src/stores/routeCheckoutDraftStore.ts"));
  ({ getCheckoutPlacesKey, getDraftContextKey } = await server.ssrLoadModule("/src/features/route-checkout/models/routeCheckoutDraft.ts"));
  ({ createPlannedRouteDay } = await server.ssrLoadModule("/src/features/my-route/adapters/dayRouteAdapters.ts"));
  ({ createSavedPlacesFromRoutePlan } = await server.ssrLoadModule("/src/features/shared-route/sharedRouteCheckout.ts"));
});

after(async () => { await server?.close(); });

function memoryStorage(initialValue = null) {
  const values = new Map(initialValue === null ? [] : [[storageKey, initialValue]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

function place(id, lat = 37.76) {
  return {
    id, contentId: id, contentTypeId: "12", areaCode: "32", signguCode: "1",
    touristTrendName: "", topRank: null, title: `테스트 ${id}`, address: "테스트 주소",
    lat, lng: 128.9, contentTypeLabel: "관광지", categoryName: "자연관광", icon: "📍", images: [],
  };
}

function createDraft() {
  const places = [place("first"), place("second", 37.77)];
  const plan = [{
    day: 1, date: "2026-11-30", startsFromCurrentLocation: true,
    startLocation: { lat: 37.75, lng: 128.9 },
    items: places.map((item) => ({
      id: item.id, place: item, stayMinutes: 60, recommendedStayMinutes: 60,
      startMinutes: 540, endMinutes: 600, travelMinutesFromPrevious: 8, isOverSchedule: false,
    })),
  }];
  const applied = { stayOverrides: {}, manualInsertions: [], removedPlaceIds: [], routePlanOverride: plan };
  const draft = {
    ...applied,
    stayOverrides: { first: 95 },
    routePlanOverride: [{ ...plan[0], items: [...plan[0].items].reverse() }],
  };
  return {
    id: "draft-one", ownerUserId: null, context: { mode: "new" },
    savedPlaces: places.map((item, index) => ({ id: item.id, place: item, savedAt: index, thumbnailUrl: "" })),
    initialRoutePlan: null, initialStep: "cart",
    form: {
      step: "result", travelStartDate: "2026-11-30", tripDays: 1,
      dailyStartTime: "09:00", scheduleEndTime: "18:00", tempo: "balanced",
      startLocationSelection: { location: { lat: 37.75, lng: 128.9 }, source: "map" },
    },
    editor: { applied, draft },
    createAttempt: { inputKey: "same-save-body", requestId: "same-request-id" },
    updatedAt: 1234,
  };
}

test("새 저장소를 열면 날짜·출발지·적용 전후 편집과 저장 요청 ID를 복원한다", () => {
  const storage = memoryStorage();
  const first = createRouteCheckoutDraftStore(storage);
  first.getState().saveDraft(createDraft());
  const persisted = JSON.parse(storage.getItem(storageKey));
  assert.equal(persisted.version, 1);
  const restored = createRouteCheckoutDraftStore(storage);
  assert.equal(restored.persist.hasHydrated(), true);
  assert.deepEqual(restored.getState().draft, first.getState().draft);
  assert.equal(restored.getState().draft.form.step, "result");
  assert.deepEqual(restored.getState().draft.editor.draft.routePlanOverride[0].items.map((item) => item.id), ["second", "first"]);
  assert.deepEqual(restored.getState().draft.editor.applied.routePlanOverride[0].items.map((item) => item.id), ["first", "second"]);
  assert.equal(restored.getState().draft.editor.draft.stayOverrides.first, 95);
  assert.equal(restored.getState().draft.createAttempt.requestId, "same-request-id");
});

test("작성자 승계는 비로그인 초안만 허용하고 다른 계정의 초안은 삭제한다", () => {
  const storage = memoryStorage();
  const store = createRouteCheckoutDraftStore(storage);
  store.getState().saveDraft(createDraft());
  store.getState().reconcileOwner(null);
  assert.equal(store.getState().draft.ownerUserId, null);
  store.getState().reconcileOwner("account-a");
  assert.equal(store.getState().draft.ownerUserId, "account-a");
  store.getState().reconcileOwner(null);
  assert.equal(store.getState().draft.ownerUserId, "account-a", "세션 만료만으로 초안을 잃지 않는다");
  store.getState().reconcileOwner("account-a");
  assert.ok(store.getState().draft);
  store.getState().reconcileOwner("account-b");
  assert.equal(store.getState().draft, null);
  assert.equal(createRouteCheckoutDraftStore(storage).getState().draft, null);
});

test("관광 분류가 없던 이전 공유 루트도 실제 변환 결과 그대로 저장하고 복원한다", () => {
  const routePlan = [createPlannedRouteDay({ dayIndex: 1, date: "2026-11-30", startLocation: null }, [{
    id: "legacy-stop", stayMinutes: null,
    place: {
      externalId: null, contentId: "legacy-place", contentTypeId: null,
      title: "이전 저장 장소", address: null, lat: 37.76, lng: 128.9,
      regionLabelKey: null, regionCode: null, categoryLabel: null, categoryName: null,
    },
  }])];
  assert.equal(routePlan[0].items[0].place.contentTypeId, "");
  const storage = memoryStorage();
  const store = createRouteCheckoutDraftStore(storage);
  store.getState().saveDraft({
    ...createDraft(), context: { mode: "shared-copy", sourceRouteId: "legacy-route" },
    savedPlaces: createSavedPlacesFromRoutePlan(routePlan),
    initialStep: "schedule", initialRoutePlan: routePlan, editor: null,
  });
  const restored = createRouteCheckoutDraftStore(storage).getState().draft;
  assert.ok(restored, "분류가 없다는 이유로 유효한 기존 일정의 초안을 버리면 안 된다");
  assert.deepEqual(restored.initialRoutePlan, JSON.parse(JSON.stringify(routePlan)));
  assert.equal(restored.savedPlaces[0].place.contentTypeId, "");
});

test("이전 모달의 늦은 갱신이나 정리는 새 초안을 덮어쓰지 않는다", () => {
  const store = createRouteCheckoutDraftStore(memoryStorage());
  store.getState().saveDraft(createDraft());
  store.getState().saveDraft({ ...createDraft(), id: "draft-two" });
  store.getState().updateDraft("draft-one", { form: { ...createDraft().form, tripDays: 9 } });
  store.getState().clearDraft("draft-one");
  assert.equal(store.getState().draft.id, "draft-two");
  assert.equal(store.getState().draft.form.tripDays, 1);
  store.getState().updateDraft("draft-two", { createAttempt: null });
  assert.equal(store.getState().draft.createAttempt, null);
  store.getState().clearDraft("draft-two");
  assert.equal(store.getState().draft, null);
});

test("손상·다른 저장 버전·유효하지 않은 필드는 복원하지 않는다", () => {
  const invalidDrafts = [
    { ...createDraft(), form: { ...createDraft().form, step: "unknown" } },
    { ...createDraft(), form: { ...createDraft().form, tripDays: 0 } },
    { ...createDraft(), form: { ...createDraft().form, dailyStartTime: "26:99" } },
    { ...createDraft(), form: { ...createDraft().form, travelStartDate: "2026-02-30" } },
    { ...createDraft(), savedPlaces: [{ ...createDraft().savedPlaces[0], place: { ...place("bad"), lat: 200 } }] },
    { ...createDraft(), editor: { applied: {}, draft: {} } },
    { ...createDraft(), createAttempt: { inputKey: "body", requestId: "" } },
    { ...createDraft(), context: { mode: "append", target: { routeId: "missing-fields" } } },
  ];
  for (const raw of [
    "{invalid-json", "null", "{}",
    JSON.stringify({ version: 2, state: { draft: createDraft() } }),
    ...invalidDrafts.map((draft) => JSON.stringify({ version: 1, state: { draft } })),
  ]) {
    const store = createRouteCheckoutDraftStore(memoryStorage(raw));
    assert.equal(store.getState().draft, null);
    assert.equal(store.persist.hasHydrated(), true);
  }
});

test("저장 공간 접근 실패에도 메모리 편집을 유지하고 입력 객체를 참조하지 않는다", () => {
  const storage = {
    getItem() { throw new Error("storage unavailable"); },
    setItem() { throw new Error("storage full"); },
    removeItem() { throw new Error("storage unavailable"); },
  };
  const store = createRouteCheckoutDraftStore(storage);
  const source = createDraft();
  assert.doesNotThrow(() => store.getState().saveDraft(source));
  source.form.tripDays = 99;
  source.editor.draft.stayOverrides.first = 1;
  assert.equal(store.getState().draft.form.tripDays, 1);
  assert.equal(store.getState().draft.editor.draft.stayOverrides.first, 95);
  assert.doesNotThrow(() => store.getState().updateDraft("draft-one", { form: { ...createDraft().form, tripDays: 2 } }));
  assert.equal(store.getState().draft.form.tripDays, 2);
  assert.doesNotThrow(() => store.getState().clearDraft());
  assert.equal(store.getState().draft, null);
});

test("과거 날짜는 보존하고 잘못된 갱신은 기존 초안을 변경하지 않는다", () => {
  const store = createRouteCheckoutDraftStore(memoryStorage());
  store.getState().saveDraft({ ...createDraft(), form: { ...createDraft().form, travelStartDate: "2020-01-01" } });
  assert.equal(store.getState().draft.form.travelStartDate, "2020-01-01");
  store.getState().updateDraft("draft-one", { editor: { applied: {}, draft: {} } });
  assert.equal(store.getState().draft.editor.draft.stayOverrides.first, 95);
});

test("장소 비교는 담은 시각·번역에 흔들리지 않고 출처와 추가 대상을 구분한다", () => {
  const places = createDraft().savedPlaces;
  const translated = places.map((item) => ({ ...item, savedAt: Date.now(), labelLanguage: "en", place: { ...item.place, title: "English title", address: "English address" } }));
  assert.equal(getCheckoutPlacesKey(places), getCheckoutPlacesKey(translated));
  assert.notEqual(getCheckoutPlacesKey(places), getCheckoutPlacesKey([...places].reverse()));
  assert.notEqual(getCheckoutPlacesKey(places), getCheckoutPlacesKey([{ ...places[0], place: { ...places[0].place, lng: 129 } }, places[1]]));
  assert.notEqual(getDraftContextKey({ mode: "new" }), getDraftContextKey({ mode: "shared-copy", sourceRouteId: "one" }));
  const target = { routeId: "route-a", routeTitle: "제목", nextDayIndex: 2, suggestedStartDate: "2026-12-01" };
  assert.equal(getDraftContextKey({ mode: "append", target }), getDraftContextKey({ mode: "append", target: { ...target, routeTitle: "Translated title" } }));
  assert.notEqual(getDraftContextKey({ mode: "append", target }), getDraftContextKey({ mode: "append", target: { ...target, nextDayIndex: 3 } }));
});
