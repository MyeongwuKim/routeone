import assert from "node:assert/strict";
import test from "node:test";
import {
  registerPushDevice,
  unregisterPushDevice,
} from "../src/modules/notifications/notificationSettings.service.ts";

const expoPushToken = "ExponentPushToken[push-device-lifecycle]";
const firstUser = {
  id: "user-1",
  locale: "ko",
};
const secondUser = {
  id: "user-2",
  locale: "ko",
};

function createPrisma() {
  let pushDevice = null;

  return {
    getPushDevice() {
      return pushDevice ? structuredClone(pushDevice) : null;
    },
    prisma: {
      userNotificationSetting: {
        async upsert() {
          return {};
        },
      },
      user: {
        async update() {
          return {};
        },
      },
      pushDevice: {
        async upsert({ create, update }) {
          pushDevice = pushDevice
            ? { ...pushDevice, ...update }
            : { id: "push-device-1", ...create };
          return structuredClone(pushDevice);
        },
        async updateMany({ where, data }) {
          if (
            !pushDevice ||
            pushDevice.userId !== where.userId ||
            pushDevice.expoPushToken !== where.expoPushToken ||
            pushDevice.enabled !== where.enabled
          ) {
            return { count: 0 };
          }

          pushDevice = { ...pushDevice, ...data };
          return { count: 1 };
        },
      },
    },
  };
}

test("로그아웃한 푸시 기기는 재로그인과 계정 전환 시 다시 활성화한다", async () => {
  const db = createPrisma();
  const firstSessionExpiresAt = new Date("2026-10-01T00:00:00.000Z");
  const secondSessionExpiresAt = new Date("2026-10-08T00:00:00.000Z");

  await registerPushDevice(
    db.prisma,
    firstUser,
    {
      expoPushToken,
      platform: "IOS",
      appVariant: "prod",
      locale: "ko",
    },
    firstSessionExpiresAt
  );

  assert.equal(db.getPushDevice().userId, firstUser.id);
  assert.equal(db.getPushDevice().enabled, true);
  assert.deepEqual(db.getPushDevice().sessionExpiresAt, firstSessionExpiresAt);

  assert.deepEqual(
    await unregisterPushDevice(db.prisma, firstUser, expoPushToken),
    { updatedCount: 1 }
  );
  assert.equal(db.getPushDevice().enabled, false);
  assert.equal(db.getPushDevice().sessionExpiresAt, null);
  assert.ok(db.getPushDevice().disabledAt instanceof Date);

  await registerPushDevice(
    db.prisma,
    firstUser,
    {
      expoPushToken,
      platform: "IOS",
      appVariant: "prod",
      locale: "ko",
    },
    secondSessionExpiresAt
  );

  assert.equal(db.getPushDevice().userId, firstUser.id);
  assert.equal(db.getPushDevice().enabled, true);
  assert.deepEqual(db.getPushDevice().sessionExpiresAt, secondSessionExpiresAt);
  assert.equal(db.getPushDevice().disabledAt, null);

  await registerPushDevice(
    db.prisma,
    secondUser,
    {
      expoPushToken,
      platform: "IOS",
      appVariant: "prod",
      locale: "ko",
    },
    secondSessionExpiresAt
  );

  assert.equal(db.getPushDevice().userId, secondUser.id);
  assert.equal(db.getPushDevice().enabled, true);
});
