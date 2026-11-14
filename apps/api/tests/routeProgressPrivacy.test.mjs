import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { getPlacePhotos, markRouteStopVisited, setRouteStopSkipped } from "../src/modules/routes/routeVisit.service.ts";
import { getPrimaryPlaceStayStatKey, refreshRouteProgress } from "../src/modules/routes/route.shared.ts";
import { dayRow, memoryDatabase, owner, routeRow, stopInput } from "./helpers/routeMemoryDatabase.mjs";

const now = new Date();
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);
const date = new Date(`${today}T00:00:00.000Z`);

// 실제 getPlacePhotos가 만든 공개 조건을 평가해 저장 플래그뿐 아니라 외부 노출을 확인한다.
function matchesPhotoQuery(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return value.every((entry) => matchesPhotoQuery(row, entry));
    if (key === "OR") return value.some((entry) => matchesPhotoQuery(row, entry));
    if (value === null || typeof value !== "object") return row[key] === value;
    if ("in" in value) return value.in.includes(row[key]);
    if ("notIn" in value) return !value.notIn.includes(row[key]);
    if ("hasSome" in value) return row[key]?.some((item) => value.hasSome.includes(item)) ?? false;
    if ("isSet" in value) return (key in row) === value.isSet;
    throw new Error(`Unsupported photo predicate: ${key}`);
  });
}

function scenario() {
  const place = stopInput(1, "테스트 방문 장소").place;
  const photoConsents = [true, null, undefined, true, false];
  const db = memoryDatabase({
    routes: [routeRow({
      tripDays: 1, startedAt: now, travelStartDate: date, travelEndDate: date,
      totalStopCount: 5, completedStopCount: 5, status: "COMPLETED", completedAt: now,
      visibility: "PUBLIC", sharedAt: now, shareTags: ["테스트 공유 태그"],
    })],
    days: [dayRow(1, null, { date, startedAt: now })],
    stops: photoConsents.map((consent, index) => ({
      id: `stop-${index + 1}`, routeId: "route", dayId: "day-1", order: index + 1, place,
      visitStatus: "VISITED", visitedAt: now, verificationStatus: "MANUAL",
      checkedInAt: null, checkedOutAt: null, actualStayMinutes: null, stayStatSyncedAt: null,
    })),
    photos: photoConsents.map((consent, index) => ({
      id: `photo-${index + 1}`, routeId: "route", routeStopId: `stop-${index + 1}`,
      status: "ACTIVE", routeVisibility: "PUBLIC", placeKey: getPrimaryPlaceStayStatKey(place),
      ...(consent === undefined ? {} : { publicationConsent: consent }),
      imageUrl: `routeone-test://visit-photo/${index + 1}`, verifiedAt: now, publishedAt: now,
    })),
    stats: [],
    notifications: [
      { id: "review", routeId: "route", type: "ROUTE_REVIEW" },
      { id: "other", routeId: "route", type: "ROUTE_START" },
    ],
  });
  db.prisma.placePhoto.findMany = async ({ where }) =>
    structuredClone(db.state.photos.filter((row) => matchesPhotoQuery(row, where)));
  return db;
}

async function assertReopenedPrivacy(db) {
  const route = db.state.routes[0];
  assert.equal(route.status, "ACTIVE");
  assert.equal(route.visibility, "PRIVATE");
  assert.equal(route.completedStopCount, 4);
  assert.equal(route.completedAt, null);
  assert.equal(route.sharedAt, null);
  assert.deepEqual(route.shareTags, []);
  assert.ok(db.state.photos.every((photo) => photo.routeVisibility === "PRIVATE"));
  assert.deepEqual(db.state.notifications.map((row) => row.id), ["other"]);
  assert.deepEqual(
    (await getPlacePhotos(db.prisma, db.state.stops[1].place)).map((photo) => photo.id),
    ["photo-4"],
    "only the remaining visited stop's explicit public opt-in stays visible",
  );
  assert.equal(db.state.photos[3].publicationConsent, true);
  assert.equal(db.state.photos[3].status, "ACTIVE");
  assert.equal(db.state.photos[4].publicationConsent, false);
}

function failCleanupOnce(db, kind, error = new Error(`${kind} cleanup failed`)) {
  const model = kind === "photo" ? db.prisma.placePhoto : db.prisma.userNotification;
  const method = kind === "photo" ? "updateMany" : "deleteMany";
  const original = model[method];
  let failures = 0;
  model[method] = async (args) => {
    if (args.where.routeId === "route" && failures++ === 0) throw error;
    return original(args);
  };
}

for (const kind of ["photo", "review"]) {
  test(`visit cancellation rolls back with ${kind} cleanup and safely retries`, async () => {
    const db = scenario();
    const before = structuredClone(db.state);
    failCleanupOnce(db, kind);
    await assert.rejects(markRouteStopVisited(db.prisma, owner, "stop-1", false), /cleanup failed/);
    assert.deepEqual(db.state, before, "visit, progress, photos and review inbox must roll back together");
    await markRouteStopVisited(db.prisma, owner, "stop-1", false);
    await assertReopenedPrivacy(db);
    assert.ok(db.writes.every((write) => write.inTransaction));
  });

  test(`root progress refresh rolls back with ${kind} cleanup for other callers`, async () => {
    const db = scenario();
    db.state.stops[0].visitStatus = "PENDING";
    // 이 경로에서는 방문 변경이 이미 저장된 호출자의 진행 집계 원자성을 확인한다.
    db.state.photos[0].status = "DELETED";
    const before = structuredClone(db.state);
    failCleanupOnce(db, kind);
    await assert.rejects(refreshRouteProgress(db.prisma, "route"), /cleanup failed/);
    assert.deepEqual(db.state, before);
    await refreshRouteProgress(db.prisma, "route");
    await assertReopenedPrivacy(db);
    assert.ok(db.writes.every((write) => write.inTransaction));
  });
}

test("an already partially reopened PRIVATE route repairs legacy photos and review inbox on cancellation retry", async () => {
  const db = scenario();
  Object.assign(db.state.routes[0], {
    status: "ACTIVE", visibility: "PRIVATE", completedAt: null, completedStopCount: 4,
    sharedAt: null, shareTags: [],
  });
  db.state.stops[0].visitStatus = "PENDING";
  db.state.photos[0].status = "DELETED";
  await markRouteStopVisited(db.prisma, owner, "stop-1", false);
  await assertReopenedPrivacy(db);
});

test("PRIVATE completed routes repair legacy visibility without removing their valid review inbox", async () => {
  const db = scenario();
  db.state.routes[0].visibility = "PRIVATE";
  await refreshRouteProgress(db.prisma, "route");
  assert.deepEqual(db.state.notifications.map((row) => row.id), ["review", "other"]);
  assert.ok(db.state.photos.every((photo) => photo.routeVisibility === "PRIVATE"));
  assert.deepEqual(
    (await getPlacePhotos(db.prisma, db.state.stops[1].place)).map((photo) => photo.id),
    ["photo-1", "photo-4"],
  );
});

test("transaction conflicts retry visit cancellation and cleanup as one unit", async () => {
  const db = scenario();
  failCleanupOnce(db, "photo", new Prisma.PrismaClientKnownRequestError("write conflict", {
    code: "P2034", clientVersion: "test",
  }));
  await markRouteStopVisited(db.prisma, owner, "stop-1", false);
  await assertReopenedPrivacy(db);
});

test("progress refresh reuses the skip transaction when reopening a public completed route", async () => {
  const db = scenario();
  db.state.stops[0].visitStatus = "SKIPPED";
  db.state.routes[0].completedStopCount = 4;
  let transactions = 0;
  const transaction = db.prisma.$transaction;
  db.prisma.$transaction = (...args) => {
    transactions++;
    return transaction(...args);
  };
  await setRouteStopSkipped(db.prisma, owner, "stop-1", false);
  assert.equal(transactions, 1, "an existing transaction must not open a nested transaction");
  await assertReopenedPrivacy(db);
});
