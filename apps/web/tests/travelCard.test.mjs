import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let cards;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  cards = await server.ssrLoadModule("/src/features/my-route/models/travelCard.ts");
});

after(async () => { await server?.close(); });

function makeRoute() {
  const stop = (id, order, visitStatus = "VISITED") => ({
    id, order, visitStatus, visitedAt: visitStatus === "VISITED" ? "2026-09-07T10:00:00Z" : null,
    verificationPhotoUrl: `https://example.test/${id}.jpg`,
    place: { title: id },
  });
  const days = [
    { id: "day-2", dayIndex: 2, date: "2026-09-08", stops: [stop("d", 2), stop("c", 1)] },
    { id: "day-1", dayIndex: 1, date: "2026-09-07", stops: [stop("b", 2), stop("skip", 3, "SKIPPED"), stop("a", 1)] },
    { id: "day-3", dayIndex: 3, date: "2026-09-09", stops: [stop("pending", 2, "PENDING"), stop("unfinished", 1)] },
  ];
  return { id: "trip-1", isMine: true, travelStartDate: "2026-09-07", travelEndDate: "2026-09-09", days, stops: days.flatMap(day => day.stops) };
}

test("여러 DAY의 실제 방문 사진을 순서대로 대표 카드 한 장의 초안에 담으며 루트는 변경하지 않는다", () => {
  const route = makeRoute();
  const original = structuredClone(route);
  const draft = cards.createTravelCardDraft(route, "ko");
  assert.equal(draft.routeId, "trip-1");
  assert.deepEqual(draft.photos.map(photo => photo.id), ["a", "b", "c", "d"]);
  assert.deepEqual(draft.candidates.map(photo => photo.id), ["a", "b", "c", "d"]);
  assert.equal(draft.title, "나의 여행 기록");
  assert.equal(draft.caption, "");
  assert.deepEqual(route, original);
});

test("전부 건너뛴 여행·미완료 여행·다른 사람의 루트는 생성할 수 없고 사진 없는 방문 기록은 앨범 선택으로 시작한다", () => {
  const route = makeRoute();
  for (const visitStatus of ["SKIPPED", "PENDING"]) {
    const invalid = structuredClone(route);
    invalid.days.forEach(day => day.stops.forEach(stop => { stop.visitStatus = visitStatus; stop.visitedAt = null; }));
    assert.throws(() => cards.createTravelCardDraft(invalid, "ko"));
  }
  assert.throws(() => cards.createTravelCardDraft({ ...route, isMine: false }, "ko"));
  route.days.forEach(day => day.stops.forEach(stop => { stop.verificationPhotoUrl = null; }));
  const draft = cards.createTravelCardDraft(route, "en");
  assert.deepEqual(draft.photos, []);
  assert.equal(draft.title, "My travel memories");
});

test("중복 사진을 제외하고 최대 네 장을 고르며 과거 DAY 없는 루트도 날짜와 함께 읽는다", () => {
  const route = makeRoute();
  route.days = [];
  route.stops = Array.from({ length: 7 }, (_, index) => ({
    ...route.stops[0], id: `stop-${index}`, order: index,
    verificationPhotoUrl: `https://example.test/photo-${Math.floor(index / 2)}.jpg`,
  }));
  const draft = cards.createTravelCardDraft(route, "ko");
  assert.deepEqual(draft.photos.map(photo => photo.id), ["stop-0", "stop-2", "stop-4", "stop-6"]);
  assert.ok(draft.dateLabel.includes("2026"));
  assert.ok(draft.dateLabel.includes("9월 7일"));
});

test("날짜가 없거나 잘못된 이전 여행은 날짜를 만들어 내지 않고 카드 편집을 시작한다", () => {
  for (const date of [null, "not-a-date", "2026-02-30"]) {
    const route = { ...makeRoute(), travelStartDate: date, travelEndDate: date };
    const draft = cards.createTravelCardDraft(route, "ko");
    assert.equal(draft.dateLabel, "");
    assert.equal(draft.photos.length, 4);
  }
});
