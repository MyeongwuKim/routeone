import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { countUnreadNotifications } from "../src/modules/notifications/notificationInbox.repository.ts";
import { getUnreadNotificationCount } from "../src/modules/notifications/notification.service.ts";
import { deliverPendingNotifications } from "../src/modules/notifications/pushDelivery.service.ts";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const now = new Date("2026-11-18T03:00:00Z");
const userId = "badge-user";

function notification(overrides = {}) {
  return {
    id: "notification-1", userId, type: "ROUTE_START",
    notificationKey: "route-start:route-1:day-1",
    routeId: "route-1", dayId: "day-1", routeStartAt: now,
    routeDayIndex: 1, festivalIds: [], festivalTitles: [],
    pushStatus: "PENDING", pushAttemptCount: 0,
    availableAt: now, readAt: null,
    ...overrides,
  };
}

function database(records = [notification()]) {
  const updates = [];
  const countQueries = [];
  const state = { records, countError: null };
  const prisma = {
    userNotificationSetting: { findUnique: async () => ({ routeStartEnabled: true }) },
    user: { findUnique: async () => ({ locale: "ko" }) },
    pushDevice: { findMany: async () => [{
      id: "device-1", expoPushToken: "ExponentPushToken[badge-test]", enabled: true,
    }] },
    userNotification: {
      findMany: async () => [notification()],
      updateMany: async () => ({ count: 1 }),
      update: async (query) => { updates.push(query); return query.data; },
      count: async ({ where }) => {
        if (state.countError) throw state.countError;
        countQueries.push(where);
        return state.records.filter((record) =>
          record.userId === where.userId &&
          where.OR.some((condition) => condition.readAt === null
            ? record.readAt === null
            : condition.readAt.isSet === false && !Object.hasOwn(record, "readAt")) &&
          record.availableAt >= where.availableAt.gte &&
          record.availableAt <= where.availableAt.lte
        ).length;
      },
    },
  };
  return { prisma, state, updates, countQueries };
}

function capturePushes() {
  const batches = [];
  globalThis.fetch = async (_url, options) => {
    const batch = JSON.parse(options.body);
    batches.push(batch);
    return new Response(JSON.stringify({ data: batch.map(() => ({ status: "ok", id: "test-ticket" })) }));
  };
  return batches;
}

test("배지는 현재 사용자의 최근 미확인 알림만 세고 읽음 필드가 없는 이전 기록도 포함한다", async () => {
  const legacy = notification({ id: "legacy" });
  delete legacy.readAt;
  const db = database([
    notification(), legacy,
    notification({ id: "read", readAt: now }),
    notification({ id: "other-user", userId: "other-user" }),
    notification({ id: "future", availableAt: new Date(now.getTime() + 1) }),
    notification({ id: "old", availableAt: new Date(now.getTime() - 181 * 86400_000) }),
  ]);
  assert.equal(await countUnreadNotifications(db.prisma, userId, now), 2);
  assert.equal(db.countQueries[0].availableAt.lte, now);
  assert.deepEqual(db.countQueries[0].OR, [{ readAt: null }, { readAt: { isSet: false } }]);
});

test("기존 알림함 API도 배지와 같은 미확인 조회 규칙을 사용한다", async () => {
  const db = database([notification({ availableAt: new Date() })]);
  assert.equal(await getUnreadNotificationCount(db.prisma, { id: userId }), 1);
  assert.equal(db.countQueries[0].userId, userId);
  assert.deepEqual(db.countQueries[0].OR, [{ readAt: null }, { readAt: { isSet: false } }]);
});

test("푸시 전송·재전송은 증가분이 아닌 현재 미확인 총개수를 보낸다", async () => {
  const db = database([notification(), notification({ id: "notification-2" })]);
  const batches = capturePushes();
  await deliverPendingNotifications(db.prisma, now, ["notification-1"]);
  await deliverPendingNotifications(db.prisma, now, ["notification-1"]);
  assert.deepEqual(batches.map((batch) => batch[0].badge), [2, 2]);

  db.state.records.forEach((record) => { record.readAt = now; });
  await deliverPendingNotifications(db.prisma, now, ["notification-1"]);
  assert.equal(batches[2][0].badge, 0);
  assert.equal(batches[0][0].data.type, "route-start");
  assert.equal(db.updates.at(-1).data.pushStatus, "SENT");
});

test("미확인 개수 조회 실패 시 기존 배지는 덮어쓰지 않고 푸시 알림은 전송한다", async () => {
  const db = database();
  db.state.countError = new Error("test count unavailable");
  const batches = capturePushes();
  await deliverPendingNotifications(db.prisma, now, ["notification-1"]);
  assert.equal(batches.length, 1);
  assert.equal(Object.hasOwn(batches[0][0], "badge"), false);
  assert.equal(db.updates.at(-1).data.pushStatus, "SENT");
});
