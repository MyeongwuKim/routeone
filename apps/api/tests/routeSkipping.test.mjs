import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import * as visits from "../src/modules/routes/routeVisit.service.ts";
import { dayRow, memoryDatabase, owner, routeRow, stopInput } from "./helpers/routeMemoryDatabase.mjs";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
const date = new Date(`${today}T00:00:00.000Z`);
const startedAt = new Date();

function scenario(statuses = ["VISITED", "PENDING", "PENDING"]) {
  return memoryDatabase({
    photos: [], stats: [], notifications: [],
    routes: [routeRow({ tripDays: 1, startedAt, travelStartDate: date, travelEndDate: date, totalStopCount: 3 })],
    days: [dayRow(1, null, { date, startedAt })],
    stops: statuses.map((visitStatus, index) => ({
      id: `stop-${index + 1}`, routeId: "route", dayId: "day-1", order: index + 1,
      place: stopInput(1, `장소 ${index + 1}`).place,
      visitStatus, visitedAt: visitStatus === "VISITED" ? startedAt : null,
      verificationStatus: "NONE", checkedInAt: null, checkedOutAt: null,
      actualStayMinutes: null, stayStatSyncedAt: null,
    })),
  });
}

test("가운데 장소를 건너뛰면 방문으로 세지 않고 다음 미방문 장소를 남긴다", async () => {
  const db = scenario();
  const result = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.completedStopCount, 1);
  assert.deepEqual(db.state.stops.map((stop) => stop.visitStatus), ["VISITED", "SKIPPED", "PENDING"]);
  assert.equal(db.state.stops[1].visitedAt, null);
  assert.equal(db.state.stops.find((stop) => stop.visitStatus === "PENDING").id, "stop-3");
});

test("방문 두 곳과 건너뜀 한 곳이면 방문 수를 늘리지 않고 루트를 완료한다", async () => {
  const db = scenario(["VISITED", "PENDING", "VISITED"]);
  const result = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.completedStopCount, 2);
  assert.equal(result.totalStopCount, 3);
  assert.ok(result.completedAt);
  assert.equal(db.state.stops[1].visitedAt, null);
  assert.equal(db.state.stats.length, 0);
});

test("DAY 마무리는 선택한 DAY의 미방문 장소만 건너뛰고 미래 DAY는 그대로 둔다", async () => {
  const db = scenario();
  db.state.days.push(dayRow(2, null, { date: new Date(date.getTime() + 86_400_000) }));
  db.state.stops.push({ ...db.state.stops[2], id: "future-stop", dayId: "day-2", order: 4 });
  const result = await visits.finishRouteDay(db.prisma, owner, "day-1");
  assert.deepEqual(db.state.stops.map((stop) => stop.visitStatus), ["VISITED", "SKIPPED", "SKIPPED", "PENDING"]);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.completedStopCount, 1);
  assert.equal(db.state.stops[1].visitedAt, null);
  assert.equal(db.state.stops[2].visitedAt, null);
  assert.ok(db.writes.every((write) => write.inTransaction));
});

test("완료 루트의 건너뜀을 되돌리면 미방문으로 열고 공유를 해제한다", async () => {
  const db = scenario(["VISITED", "SKIPPED", "VISITED"]);
  Object.assign(db.state.routes[0], {
    status: "COMPLETED", visibility: "PUBLIC", completedAt: startedAt,
    sharedAt: startedAt, shareTags: ["region:test"], completedStopCount: 2,
  });
  const result = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", false);
  assert.equal(result.status, "ACTIVE");
  assert.equal(result.visibility, "PRIVATE");
  assert.equal(result.sharedAt, null);
  assert.deepEqual(result.shareTags, []);
  assert.equal(result.completedAt, null);
  assert.equal(result.completedStopCount, 2);
  assert.equal(db.state.stops[1].visitStatus, "PENDING");
  assert.equal(db.state.stops[1].checkedInAt, null);
});

test("건너뛴 장소를 방문 처리하려면 먼저 건너뜀을 되돌려야 한다", async () => {
  for (const operation of ["mark", "check-in", "complete"]) {
    const db = scenario(["VISITED", "SKIPPED", "PENDING"]);
    const action = operation === "mark"
      ? visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" })
      : operation === "check-in"
        ? visits.checkInRouteStop(db.prisma, owner, "stop-2", { status: "GPS", lat: 37, lng: 127, accuracyMeters: 1 })
        : visits.completeRouteStopVisit(db.prisma, owner, "stop-2");
    await assert.rejects(action, /건너뜀을.*되돌/);
    assert.equal(db.state.stops[1].visitStatus, "SKIPPED");
  }
});

test("조회 뒤 다른 요청이 건너뛴 장소를 늦은 방문·도착 요청이 덮어쓰지 않는다", async () => {
  for (const operation of ["mark", "check-in", "complete"]) {
    const db = scenario();
    if (operation === "complete") db.state.stops[1].checkedInAt = startedAt;
    const findRoute = db.prisma.route.findUnique;
    db.prisma.route.findUnique = async (args) => {
      const result = await findRoute(args);
      db.state.stops[1].visitStatus = "SKIPPED";
      return result;
    };
    const action = operation === "mark"
      ? visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" })
      : operation === "check-in"
        ? visits.checkInRouteStop(db.prisma, owner, "stop-2", { status: "GPS", lat: 37, lng: 127, accuracyMeters: 1 })
        : visits.completeRouteStopVisit(db.prisma, owner, "stop-2");
    await assert.rejects(action);
    assert.equal(db.state.stops[1].visitStatus, "SKIPPED");
  }
});

test("건너뜀과 DAY 마무리 재요청은 상태와 완료 시각을 중복 변경하지 않는다", async () => {
  const db = scenario(["VISITED", "PENDING", "VISITED"]);
  const first = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  const writeCount = db.writes.length;
  const second = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  const third = await visits.finishRouteDay(db.prisma, owner, "day-1");
  assert.equal(db.writes.length, writeCount);
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
});

test("모두 건너뛰어도 완료할 수 있지만 실제 방문 수와 장소 체류 통계는 0이다", async () => {
  const db = scenario(["PENDING", "PENDING", "PENDING"]);
  const result = await visits.finishRouteDay(db.prisma, owner, "day-1");
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.completedStopCount, 0);
  assert.equal(result.totalStopCount, 3);
  assert.ok(db.state.stops.every((stop) => stop.visitedAt === null && stop.actualStayMinutes === null));
  for (const stop of db.state.stops) {
    assert.deepEqual(await visits.getPlaceStaySummary(db.prisma, stop.place), {
      averageActualStayMinutes: null, visitCount: 0, lastVisitedAt: null,
    });
  }
});

test("도착 인증 중 건너뛰면 인증 정보·공개 사진·해당 장소 도착 알림을 정리하고 실제 방문 통계는 유지한다", async () => {
  const db = scenario();
  Object.assign(db.state.stops[1], {
    checkedInAt: startedAt, verifiedAt: startedAt, verificationStatus: "GPS_PHOTO",
    verificationPhotoImageId: "test-check-in-photo", verificationPhotoUrl: "routeone-test://visit-photo/test",
    verificationPhotoPublicationConsent: true, verificationPhotoPublishedAt: startedAt,
    verificationLat: 37, verificationLng: 127, verificationAccuracyMeters: 5,
  });
  db.state.photos.push({ id: "photo", routeStopId: "stop-2", status: "ACTIVE", publicationConsent: true, publishedAt: startedAt });
  db.state.notifications.push(
    { id: "arrival-2", userId: owner.id, routeId: "route", stopId: "stop-2", type: "ROUTE_ARRIVAL" },
    { id: "arrival-3", userId: owner.id, routeId: "route", stopId: "stop-3", type: "ROUTE_ARRIVAL" },
  );
  db.state.stats.push({
    placeKey: "geo:장소 1|37.00000|127.00000", totalActualStayMinutes: 40,
    visitCount: 1, lastVisitedAt: startedAt,
  });
  await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  const skipped = db.state.stops[1];
  for (const field of ["visitedAt", "verifiedAt", "verificationPhotoImageId", "verificationPhotoUrl", "verificationPhotoPublishedAt", "verificationLat", "verificationLng", "verificationAccuracyMeters", "checkedInAt", "checkedOutAt", "actualStayMinutes", "visitTimeEditedAt", "stayStatSyncedAt"]) {
    assert.equal(skipped[field], null, field);
  }
  assert.equal(skipped.verificationStatus, "NONE");
  assert.equal(skipped.verificationPhotoPublicationConsent, false);
  assert.equal(db.state.photos[0].status, "DELETED");
  assert.equal(db.state.photos[0].publicationConsent, false);
  assert.equal(db.state.photos[0].publishedAt, null);
  assert.deepEqual(db.state.notifications.map((item) => item.id), ["arrival-3"]);
  assert.deepEqual(await visits.getPlaceStaySummary(db.prisma, db.state.stops[0].place), {
    averageActualStayMinutes: 40, visitCount: 1, lastVisitedAt: startedAt,
  });
  assert.equal((await visits.getPlaceStaySummary(db.prisma, skipped.place)).visitCount, 0);
});

test("방문한 장소를 바로 건너뛰면 방문 취소를 안내하고 기록을 변경하지 않는다", async () => {
  const db = scenario();
  const before = structuredClone(db.state);
  await assert.rejects(visits.setRouteStopSkipped(db.prisma, owner, "stop-1", true), /방문 취소/);
  assert.deepEqual(db.state, before);
});

for (const action of ["skip", "finish"]) {
  const perform = (db, user = owner) => action === "skip"
    ? visits.setRouteStopSkipped(db.prisma, user, "stop-2", true)
    : visits.finishRouteDay(db.prisma, user, "day-1");

  test(`${action}: 다른 계정, 시작 전, 미래 DAY와 수정 기한 경과를 거절한다`, async () => {
    const cases = [
      { change() {}, user: { id: "another-owner" }, error: /접근/ },
      { change(db) { db.state.routes[0].startedAt = null; }, error: /먼저 시작/ },
      { change(db) { db.state.days[0].startedAt = null; }, error: /DAY를 먼저 시작/ },
      { change(db) { db.state.days[0].date = new Date(date.getTime() + 86_400_000); }, error: /DAY 날짜에만/ },
      { change(db) { db.state.routes[0].travelEndDate = new Date(date.getTime() - 8 * 86_400_000); }, error: /7일/ },
    ];
    for (const item of cases) {
      const db = scenario();
      item.change(db);
      const before = structuredClone(db.state);
      await assert.rejects(perform(db, item.user), item.error);
      assert.deepEqual(db.state, before);
    }
  });

  test(`${action}: 사진 정리에 실패하면 장소·알림·루트 진행 상태가 모두 롤백된다`, async () => {
    const db = scenario(["VISITED", "PENDING", "PENDING"]);
    const before = structuredClone(db.state);
    db.prisma.placePhoto.updateMany = async () => { throw new Error("사진 정리 실패"); };
    await assert.rejects(perform(db), /사진 정리 실패/);
    assert.deepEqual(db.state, before);
  });

  test(`${action}: 마지막 진행 집계가 실패해도 사진·알림 정리를 포함해 모두 롤백된다`, async () => {
    const db = scenario();
    db.state.photos.push({ id: "photo-2", routeStopId: "stop-2", status: "ACTIVE" });
    db.state.notifications.push({ id: "arrival-2", userId: owner.id, routeId: "route", stopId: "stop-2", type: "ROUTE_ARRIVAL" });
    const before = structuredClone(db.state);
    db.prisma.route.update = async () => { throw new Error("진행 집계 실패"); };
    await assert.rejects(perform(db), /진행 집계 실패/);
    assert.deepEqual(db.state, before);
  });
}

test("트랜잭션 충돌 뒤 재시도해도 건너뜀과 완료 시각을 한 번만 확정한다", async () => {
  const db = scenario(["VISITED", "PENDING", "VISITED"]);
  const update = db.prisma.route.update;
  let attempts = 0;
  db.prisma.route.update = async (args) => {
    if (++attempts === 1) {
      throw new Prisma.PrismaClientKnownRequestError("transaction conflict", { code: "P2034", clientVersion: "test" });
    }
    return update(args);
  };
  const result = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  assert.equal(attempts, 2);
  assert.equal(result.status, "COMPLETED");
  assert.equal(result.completedStopCount, 2);
  assert.equal(db.state.stops[1].visitStatus, "SKIPPED");
  const repeated = await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  assert.deepEqual(repeated.completedAt, result.completedAt);
  assert.equal(attempts, 2);
});
