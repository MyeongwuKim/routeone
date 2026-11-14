import assert from "node:assert/strict";
import test from "node:test";
import { syncRouteArrivalNotificationInbox } from "../src/modules/notifications/notification.service.ts";

const user = { id: "owner" };
const routeId = "route-1";
const dayId = "day-1";
const stopId = "stop-1";

function createPrisma(visitStatus = "PENDING") {
  const upserts = [];

  return {
    prisma: {
      route: {
        findMany: async () => [{ id: routeId }],
      },
      routeStop: {
        findMany: async () => [
          {
            id: stopId,
            routeId,
            dayId,
            visitStatus,
            place: { title: "테스트 장소" },
          },
        ],
      },
      async $transaction(operation) { return operation(this); },
      async $runCommandRaw(command) {
        assert.equal(command.update, "UserNotification");
        upserts.push(...command.updates);
        return { ok: 1, n: command.updates.length };
      },
    },
    upserts,
  };
}

function createInput(notificationKey) {
  return {
    notificationKey,
    routeId,
    routeTitle: "테스트 여행",
    dayId,
    stopId,
    placeTitle: "테스트 장소",
    dateKey: "2026-09-03",
    deliveredAt: new Date("2026-09-03T03:00:00.000Z"),
  };
}

test("같은 장소의 GPS 테스트 알림도 고유 식별자별로 저장한다", async () => {
  const { prisma, upserts } = createPrisma();
  const firstKey = `arrival-test:${routeId}:${stopId}:1788404400000`;
  const secondKey = `arrival-test:${routeId}:${stopId}:1788404401000`;

  const result = await syncRouteArrivalNotificationInbox(prisma, user, [
    createInput(firstKey),
    createInput(secondKey),
  ]);

  assert.deepEqual(result.notificationKeys, [firstKey, secondKey]);
  assert.deepEqual(
    upserts.map(
      (entry) => entry.q.notificationKey
    ),
    [firstKey, secondKey]
  );
});

test("일반 도착 알림은 기존 장소·날짜 식별자만 허용한다", async () => {
  const { prisma } = createPrisma();

  await assert.rejects(
    syncRouteArrivalNotificationInbox(prisma, user, [
      createInput("arrival-test:another-route:stop-1:1788404400000"),
    ]),
    /도착 알림 식별자/
  );
});

test("건너뛴 장소의 늦게 도착한 네이티브 알림은 다시 저장하지 않는다", async () => {
  const { prisma, upserts } = createPrisma("SKIPPED");
  const input = createInput(`arrival-test:${routeId}:${stopId}:${Date.now()}`);
  input.deliveredAt = new Date();
  const result = await syncRouteArrivalNotificationInbox(prisma, user, [input]);
  assert.equal(result.syncedCount, 0);
  assert.deepEqual(result.notificationKeys, []);
  assert.equal(upserts.length, 0);
});
