import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { ApolloServer, HeaderMap } from "@apollo/server";
import * as visits from "../src/modules/routes/routeVisit.service.ts";
import { clearRoute } from "../src/modules/routes/routeCommand.service.ts";
import { updateRouteStopVisitVersion } from "../src/modules/routes/routeStopVisitVersion.ts";
import { RouteStopVisitConflictError, formatRouteOneGraphQLError } from "../src/graphql/userFacingError.ts";
import { dayRow, memoryDatabase, owner, routeRow, stopInput } from "./helpers/routeMemoryDatabase.mjs";

function scenario(revision) {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const startedAt = new Date();
  return memoryDatabase({
    photos: [], stats: [], notifications: [],
    routes: [routeRow({ tripDays: 1, startedAt, travelStartDate: date, travelEndDate: date, totalStopCount: 3 })],
    days: [dayRow(1, null, { date, startedAt })],
    stops: ["VISITED", "PENDING", "PENDING"].map((visitStatus, index) => ({
      id: `stop-${index + 1}`, routeId: "route", dayId: "day-1", order: index + 1,
      place: stopInput(1, `장소 ${index + 1}`).place, visitStatus,
      ...(revision === undefined ? {} : { visitRevision: revision }),
      visitedAt: visitStatus === "VISITED" ? startedAt : null,
      verificationStatus: "NONE", checkedInAt: null, checkedOutAt: null,
      actualStayMinutes: null, stayStatSyncedAt: null,
    })),
  });
}

/** 실제 서비스가 읽은 스냅샷만 보류하며, 이후 두 요청의 저장은 순서대로 완료한다. */
function pauseFirstRead(db) {
  let release;
  let reached;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { reached = resolve; });
  const find = db.prisma.routeStop.findUnique;
  let first = true;
  db.prisma.routeStop.findUnique = async args => {
    const row = await find(args);
    if (first && args.where.id === "stop-2") {
      first = false;
      reached();
      await gate;
    }
    return row;
  };
  return { ready, release };
}

const isConflict = error => error?.name === "UserFacingError" && /변경/.test(error.message);

function photoScenario(t, onDelete) {
  const db = scenario(0);
  Object.assign(db.state.stops[1], { visitStatus: "VISITED", visitedAt: new Date(),
    verificationPhotoImageId: "synthetic-active-image", verificationPhotoUrl: "https://example.test/active.jpg" });
  db.state.photos.push({ id: "photo-2", routeStopId: "stop-2", routeId: "route", status: "ACTIVE" });
  const previous = { account: process.env.CF_ACCOUNT, token: process.env.CF_TOKEN };
  process.env.CF_ACCOUNT = "synthetic-account";
  process.env.CF_TOKEN = "synthetic-token";
  t.after(() => {
    for (const [key, value] of [["CF_ACCOUNT", previous.account], ["CF_TOKEN", previous.token]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.method, "DELETE");
    onDelete(db);
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  });
  return db;
}

test("충돌로 거절된 사진 삭제는 현재 사용 중인 원본 이미지를 삭제하지 않는다", async t => {
  let deletions = 0;
  const db = photoScenario(t, () => { deletions += 1; });
  const pause = pauseFirstRead(db);
  const old = visits.deleteRouteStopVisitPhoto(db.prisma, owner, "stop-2").then(() => null, error => error);
  await pause.ready;
  let expected;
  try {
    const current = await db.prisma.routeStop.findUnique({ where: { id: "stop-2" } });
    await updateRouteStopVisitVersion(db.prisma, current, { actualStayMinutes: 15 });
    expected = structuredClone(db.state);
  } finally { pause.release(); }
  assert.ok(isConflict(await old));
  assert.equal(deletions, 0);
  assert.deepEqual(db.state, expected);
});

test("사진 원본 정리는 변경 번호가 일치하는 기록 삭제를 저장한 뒤 실행한다", async t => {
  let deletions = 0;
  let atDeletion;
  const db = photoScenario(t, current => {
    deletions += 1;
    atDeletion = { url: current.state.stops[1].verificationPhotoUrl,
      revision: current.state.stops[1].visitRevision, status: current.state.photos[0].status };
  });
  await visits.deleteRouteStopVisitPhoto(db.prisma, owner, "stop-2");
  assert.equal(deletions, 1);
  assert.deepEqual(atDeletion, { url: null, revision: 1, status: "DELETED" });
  assert.equal(db.state.stops[1].visitStatus, "VISITED");
});

test("원본 정리 실패는 로그로 남기고 확정된 사진 기록 삭제를 되돌리지 않는다", async t => {
  const logs = [];
  t.mock.method(console, "error", (...args) => { logs.push(args[0]); });
  const db = photoScenario(t, () => { throw new Error("synthetic cleanup failure"); });
  await visits.deleteRouteStopVisitPhoto(db.prisma, owner, "stop-2");
  assert.equal(db.state.stops[1].verificationPhotoUrl, null);
  assert.equal(db.state.stops[1].visitRevision, 1);
  assert.equal(db.state.photos[0].status, "DELETED");
  assert.ok(logs.includes("[visit-photo] deleted image cleanup failed"));
});

for (const revision of [undefined, null, 0, 8]) {
  for (const kind of ["mark", "check-in", "complete"]) {
    test(`이전 ${kind} 요청은 건너뛰기·취소 후 거절한다 (기존 번호 ${String(revision)})`, async () => {
      const db = scenario(revision);
      if (kind === "complete") db.state.stops[1].checkedInAt = new Date(Date.now() - 60_000);
      const pause = pauseFirstRead(db);
      const request = kind === "mark"
        ? visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" })
        : kind === "check-in"
          ? visits.checkInRouteStop(db.prisma, owner, "stop-2", { status: "GPS", lat: 37, lng: 127, accuracyMeters: 1 })
          : visits.completeRouteStopVisit(db.prisma, owner, "stop-2");
      const result = request.then(() => null, error => error);
      await pause.ready;
      let expected;
      try {
        await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
        await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", false);
        expected = structuredClone(db.state);
      } finally { pause.release(); }
      const error = await result;
      assert.ok(isConflict(error), "오래된 요청을 상태 변경 오류로 거절해야 한다");
      assert.deepEqual(db.state, expected, "최신 방문 상태·사진·통계·알림을 유지해야 한다");
      assert.equal(db.state.stops[1].visitRevision, (revision ?? 0) + 2);
    });
  }
}

test("같은 미방문 상태로 새 취소가 끝나도 이전 방문 요청을 적용하지 않는다", async () => {
  const db = scenario(2);
  const pause = pauseFirstRead(db);
  const result = visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" })
    .then(() => null, error => error);
  await pause.ready;
  try { await visits.markRouteStopVisited(db.prisma, owner, "stop-2", false); }
  finally { pause.release(); }
  assert.ok(isConflict(await result));
  assert.equal(db.state.stops[1].visitStatus, "PENDING");
  assert.equal(db.state.stops[1].visitRevision, 3);
});

test("서로 다른 변경 번호의 DAY 장소를 함께 마무리하고 재요청은 번호를 올리지 않는다", async () => {
  const db = scenario();
  Object.assign(db.state.stops[0], { visitStatus: "PENDING", visitedAt: null });
  db.state.stops[1].visitRevision = null;
  db.state.stops[2].visitRevision = 5;
  await visits.finishRouteDay(db.prisma, owner, "day-1");
  assert.deepEqual(db.state.stops.map(stop => stop.visitRevision), [1, 1, 6]);
  assert.ok(db.state.stops.every(stop => stop.visitStatus === "SKIPPED"));
  const before = structuredClone(db.state);
  await visits.finishRouteDay(db.prisma, owner, "day-1");
  assert.deepEqual(db.state, before);
});

test("방문·취소·건너뛰기·복원은 정상 저장되고 변경 번호를 이어서 올린다", async () => {
  const db = scenario();
  await visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" });
  assert.equal(db.state.stops[1].visitRevision, 1);
  await visits.markRouteStopVisited(db.prisma, owner, "stop-2", false);
  await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", true);
  await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", false);
  assert.equal(db.state.stops[1].visitRevision, 4);
  assert.equal(db.state.stops[1].visitStatus, "PENDING");
});

test("트랜잭션 재시도도 최초 변경 번호를 유지해 오래된 요청을 되살리지 않는다", async () => {
  const db = scenario(0);
  const transaction = db.prisma.$transaction;
  let attempts = 0;
  db.prisma.$transaction = async (...args) => {
    if (++attempts === 1) {
      db.state.stops[1].visitRevision = 2;
      throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
    }
    return transaction(...args);
  };
  await assert.rejects(visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" }), isConflict);
  assert.equal(attempts, 2);
  assert.equal(db.state.stops[1].visitStatus, "PENDING");
  assert.equal(db.state.stops[1].visitRevision, 2);
});

test("전체 완료 경로도 변경 번호를 올려 이전 방문 취소가 덮어쓰지 못한다", async () => {
  const db = scenario(4);
  Object.assign(db.state.stops[1], { visitStatus: "VISITED", visitedAt: new Date() });
  const pause = pauseFirstRead(db);
  const old = visits.markRouteStopVisited(db.prisma, owner, "stop-2", false).then(() => null, error => error);
  await pause.ready;
  try { await clearRoute(db.prisma, owner, "route"); }
  finally { pause.release(); }
  assert.ok(isConflict(await old));
  assert.ok(db.state.stops.every(stop => stop.visitStatus === "VISITED" && stop.visitRevision === 5));
  assert.ok(db.writes.every(write => write.inTransaction));
});

for (const skipped of [true, false]) test(`이전 건너뜀 변경(${skipped})도 상태가 한 바퀴 돌아온 뒤에는 거절한다`, async () => {
  const db = scenario(0);
  if (!skipped) db.state.stops[1].visitStatus = "SKIPPED";
  const pause = pauseFirstRead(db);
  const old = visits.setRouteStopSkipped(db.prisma, owner, "stop-2", skipped).then(() => null, error => error);
  await pause.ready;
  let expected;
  try {
    await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", skipped);
    await visits.setRouteStopSkipped(db.prisma, owner, "stop-2", !skipped);
    expected = structuredClone(db.state);
  } finally { pause.release(); }
  assert.ok(isConflict(await old));
  assert.deepEqual(db.state, expected);
});

test("늦은 DAY 마무리는 새 방문을 보존하고 다른 장소의 부분 변경도 원복한다", async () => {
  const db = scenario(0);
  const find = db.prisma.routeStop.findMany;
  let ready;
  let release;
  const reached = new Promise(resolve => { ready = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let first = true;
  db.prisma.routeStop.findMany = async args => {
    const stops = await find(args);
    if (first) { first = false; ready(); await gate; }
    return stops;
  };
  const old = visits.finishRouteDay(db.prisma, owner, "day-1").then(() => null, error => error);
  await reached;
  let expected;
  try {
    await visits.markRouteStopVisited(db.prisma, owner, "stop-2", true, { status: "MANUAL" });
    expected = structuredClone(db.state);
  } finally { release(); }
  assert.ok(isConflict(await old));
  assert.deepEqual(db.state, expected);
});

test("방문 기록 충돌은 재시도하지 않을 HTTP 409와 사용자 오류로 전달한다", async () => {
  const server = new ApolloServer({
    typeDefs: "type Query { ready: Boolean } type Mutation { updateVisit: Boolean }",
    resolvers: { Mutation: { updateVisit() { throw new RouteStopVisitConflictError(); } } },
    formatError: formatRouteOneGraphQLError,
  });
  await server.start();
  try {
    const response = await server.executeHTTPGraphQLRequest({
      context: async () => ({}),
      httpGraphQLRequest: { method: "POST", headers: new HeaderMap([["content-type", "application/json"]]),
        search: "", body: { query: "mutation { updateVisit }" } },
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.kind, "complete");
    const body = JSON.parse(response.body.string);
    assert.equal(body.errors[0].extensions.code, "USER_FACING_ERROR");
    assert.match(body.errors[0].message, /변경/);
  } finally { await server.stop(); }
});
