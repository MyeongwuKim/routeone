/** 로컬 MongoDB 전용 검증이다. 별도 DB의 fixture는 매 사례 롤백하고 테스트 DB도 정리한다. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { updateRouteStopVisitVersion, updateRouteStopVisitVersions } from "../src/modules/routes/routeStopVisitVersion.ts";
import { normalizePlaceSnapshot } from "../src/modules/routes/route.shared.ts";

test("실제 MongoDB에서 누락·null·기존 변경 번호를 비교하고 지연 저장을 거절한다", {
  skip: process.env.ROUTEONE_TEST_LOCAL_MONGO !== "1",
}, async () => {
  const database = `masil_visit_revision_verify_${randomBytes(5).toString("hex")}`;
  const prisma = new PrismaClient({ datasources: { db: {
    url: `mongodb://127.0.0.1:27017/${database}?directConnection=true&serverSelectionTimeoutMS=3000`,
  } } });
  let canCleanup = false;
  try {
    await prisma.$connect();
    const hello = await prisma.$runCommandRaw({ hello: 1 });
    assert.ok(hello.setName, "로컬 MongoDB의 트랜잭션 지원이 필요합니다.");
    canCleanup = true;
    for (const initial of ["missing", null, 0, 7]) {
      const rollback = new Error("ROLLBACK_VISIT_REVISION_FIXTURE");
      await assert.rejects(prisma.$transaction(async transaction => {
        const created = await transaction.routeStop.create({ data: {
          routeId: randomBytes(12).toString("hex"), order: 1,
          place: normalizePlaceSnapshot({ provider: "CUSTOM", title: "변경 번호 테스트", lat: 37, lng: 127 }),
          visitRevision: initial === "missing" ? 0 : initial,
        } });
        if (initial === "missing") await transaction.$runCommandRaw({ update: "RouteStop", updates: [{
          q: { _id: { $oid: created.id } }, u: { $unset: { visitRevision: "" } },
        }] });
        const old = await transaction.routeStop.findUnique({ where: { id: created.id } });
        const skipped = await updateRouteStopVisitVersion(transaction, old, { visitStatus: "SKIPPED" });
        const restored = await updateRouteStopVisitVersion(transaction, skipped, { visitStatus: "PENDING" });
        assert.equal(restored.visitRevision, (initial === "missing" ? 0 : initial ?? 0) + 2);
        await assert.rejects(updateRouteStopVisitVersion(transaction, old, { visitStatus: "VISITED" }), error =>
          error.extensions?.http?.status === 409);
        const latest = await transaction.routeStop.findUnique({ where: { id: created.id } });
        assert.equal(latest.visitStatus, "PENDING");
        await updateRouteStopVisitVersions(transaction, [latest], { visitStatus: "SKIPPED" });
        assert.equal((await transaction.routeStop.findUnique({ where: { id: created.id } })).visitRevision,
          restored.visitRevision + 1);
        throw rollback;
      }, { timeout: 15_000 }), error => error === rollback);
      assert.equal(await prisma.routeStop.count(), 0, "테스트 데이터가 남지 않아야 합니다.");
    }
  } finally {
    if (canCleanup) await prisma.$runCommandRaw({ dropDatabase: 1 });
    await prisma.$disconnect();
  }
});
