import assert from "node:assert/strict";
import test from "node:test";
import { syncRouteArrivalNotificationInbox } from "../src/modules/notifications/notification.service.ts";

const user = { id: "owner" };
const routeId = "route-1";
const dayId = "day-1";
const stopId = "stop-1";

function createPrisma() {
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
            place: { title: "테스트 장소" },
          },
        ],
      },
      userNotification: {
        upsert: async (input) => {
          upserts.push(input);
          return input.create;
        },
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
      (entry) => entry.where.userId_notificationKey.notificationKey
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
