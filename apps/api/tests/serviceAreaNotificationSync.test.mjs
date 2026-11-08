import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import { syncFestivalRegionWithServiceArea } from "../src/modules/notifications/notificationSettings.service.ts";
import { notificationResolvers, notificationTypeDefs } from "../src/modules/notifications/notification.resolver.ts";
import { dateTimeScalar } from "../src/graphql/scalars.ts";

function database({ enabled = true, turnOffBeforeUpdate = false, failCancellation = false } = {}) {
  let state = {
    id: "setting", userId: "user", festivalEnabled: enabled,
    festivalRegionCodes: enabled ? ["51150", "51110"] : [], festivalLastEvaluationKey: "evaluated",
    routeStartEnabled: false, routeReviewEnabled: true, routeArrivalEnabled: false,
    createdAt: new Date("2026-11-01T00:00:00Z"), updatedAt: new Date("2026-11-01T00:00:00Z"),
  };
  const cancellations = [];
  const updates = [];
  const prisma = {
    userNotificationSetting: {
      upsert: async () => structuredClone(state),
      updateMany: async ({ where, data }) => {
        updates.push({ where, data });
        if (turnOffBeforeUpdate) { state.festivalEnabled = false; state.festivalRegionCodes = []; }
        if (state.userId !== where.userId || state.festivalEnabled !== where.festivalEnabled) return { count: 0 };
        Object.assign(state, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => structuredClone(state),
    },
    userNotification: { updateMany: async query => {
      if (failCancellation) throw new Error("cancellation failed");
      cancellations.push(query); return { count: 1 };
    } },
    $transaction: async callback => {
      const snapshot = structuredClone(state);
      try { return await callback(prisma); }
      catch (error) { state = snapshot; throw error; }
    },
  };
  return { prisma, cancellations, updates, current: () => structuredClone(state) };
}

test("기본 지역 변경은 켜진 축제 알림을 새 시군구로 맞추고 기존 미발송 알림을 취소한다", async () => {
  const db = database();
  const result = await syncFestivalRegionWithServiceArea(db.prisma, { id: "user" }, "46130");
  assert.equal(result.festivalEnabled, true);
  assert.deepEqual(result.festivalRegionCodes, ["46130"]);
  assert.equal(result.festivalLastEvaluationKey, null);
  assert.equal(result.routeStartEnabled, false);
  assert.equal(result.routeReviewEnabled, true);
  assert.equal(result.routeArrivalEnabled, false);
  assert.equal(db.cancellations.length, 1);
  assert.deepEqual(db.cancellations[0].where.pushStatus.in, ["PENDING", "FAILED"]);
  assert.equal(db.cancellations[0].where.NOT.notificationKey.startsWith, "festival:test:");
  assert.equal(Object.hasOwn(db.updates[0].data, "festivalEnabled"), false);
});

test("축제 알림이 꺼져 있으면 지역을 바꿔도 알림 설정을 건드리지 않는다", async () => {
  const db = database({ enabled: false });
  const before = db.current();
  const result = await syncFestivalRegionWithServiceArea(db.prisma, { id: "user" }, "46130");
  assert.deepEqual(result, before);
  assert.equal(db.cancellations.length, 0);
});

test("저장 도중 알림을 끈 경우에도 새 지역 적용이 알림을 다시 켜지 않는다", async () => {
  const db = database({ turnOffBeforeUpdate: true });
  const result = await syncFestivalRegionWithServiceArea(db.prisma, { id: "user" }, "46130");
  assert.equal(result.festivalEnabled, false);
  assert.deepEqual(result.festivalRegionCodes, []);
  assert.equal(db.cancellations.length, 0);
});

test("알림 취소 실패 시 지역 교체와 평가 초기화도 함께 롤백한다", async () => {
  const db = database({ failCancellation: true });
  const before = db.current();
  await assert.rejects(syncFestivalRegionWithServiceArea(db.prisma, { id: "user" }, "46130"), /cancellation failed/);
  assert.deepEqual(db.current(), before);
});

test("지원하지 않는 지역은 기존 알림을 변경하기 전에 거절한다", async () => {
  const db = database();
  const before = db.current();
  await assert.rejects(syncFestivalRegionWithServiceArea(db.prisma, { id: "user" }, "99999"));
  assert.deepEqual(db.current(), before);
  assert.equal(db.updates.length, 0);
});

test("기본 지역 동기화 GraphQL 요청은 로그인 사용자에게만 적용된다", async () => {
  const db = database();
  const server = new ApolloServer({
    typeDefs: [gql`scalar DateTime\n type Query { _empty: String }\n type Mutation { _empty: String }`, notificationTypeDefs],
    resolvers: { ...notificationResolvers, DateTime: dateTimeScalar },
  });
  try {
    const query = await readFile(new URL("../../web/src/graphql/notifications/sync-festival-region-with-service-area.graphql", import.meta.url), "utf8");
    const denied = await server.executeOperation({ query, variables: { regionCode: "46130" } }, { contextValue: { prisma: db.prisma, authenticatedUserId: null, user: null } });
    assert.ok(denied.body.singleResult.errors?.length);
    assert.equal(db.updates.length, 0);
    const result = await server.executeOperation({ query, variables: { regionCode: "46130" } }, { contextValue: { prisma: db.prisma, authenticatedUserId: "user", user: { id: "user" } } });
    assert.equal(result.body.singleResult.errors, undefined);
    assert.deepEqual(result.body.singleResult.data.syncFestivalRegionWithServiceArea.festivalRegionCodes, ["46130"]);
  } finally { await server.stop(); }
});
