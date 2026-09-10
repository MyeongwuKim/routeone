/**
 * 개발 MongoDB를 명시했을 때만 실행한다. 모든 fixture와 변경은 강제 롤백하며,
 * 트랜잭션 밖에서 계정·일정·사진·알림·통계가 남지 않았는지 다시 확인한다.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { mongoId, runMongoUpdates } from "../src/lib/mongoBatch.ts";
import { createRoute, appendRouteDays, cloneRoute, deleteRoute, deleteRouteDay, startRoute, updateRouteLayout } from "../src/modules/routes/routeCommand.service.ts";
import { removeRouteStopStayContributions } from "../src/modules/routes/routeBatch.repository.ts";
import { shareRoute } from "../src/modules/routes/routeSocial.service.ts";
import { buildPlaceStayStatSnapshotData, getPrimaryPlaceStayStatKey, normalizePlaceSnapshot } from "../src/modules/routes/route.shared.ts";
import { deleteUserAccount } from "../src/modules/user/userAccount.service.ts";
import { syncFestivalNotificationInbox, syncRouteReviewNotificationInbox, syncRouteArrivalNotificationInbox } from "../src/modules/notifications/notification.service.ts";

const databaseUrl = process.env.ROUTEONE_TRANSACTION_TEST_DATABASE_URL;

test("MongoDB transaction batches preserve data and roll back together", { skip: !databaseUrl }, async t => {
  const url = new URL(databaseUrl);
  assert.equal(url.pathname, "/routeone_dev", "only the development database is allowed");
  assert.equal(url.hostname, "cluster0.nnjurjy.mongodb.net");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const id = () => randomBytes(12).toString("hex");
  try {
    await prisma.$connect();
    async function rollbackCase(name, operation) {
      await t.test(name, async () => {
        const userId = id();
        const rollback = new Error("ROLLBACK_TRANSACTION_BATCH_FIXTURE");
        const routeIds = [];
        const place = (suffix, extra = {}) => normalizePlaceSnapshot({
          provider: "CUSTOM", externalId: `${userId}-${suffix}`, title: `Transaction test ${suffix}`,
          lat: 37, lng: 127, ...extra,
        });
        await assert.rejects(prisma.$transaction(async tx => {
          const user = await tx.user.create({ data: { id: userId } });
          const facade = new Proxy(tx, { get(target, key) {
            return key === "$transaction" ? operation => operation(target) : Reflect.get(target, key);
          } });
          const route = async (data = {}) => {
            const row = await tx.route.create({ data: { ownerId: userId, ...data } });
            routeIds.push(row.id);
            return row;
          };
          const measured = async (label, action, expectedCalls) => {
            const calls = [];
            const instrumented = new Proxy(tx, { get(target, model) {
              if (model === "$transaction") return operation => operation(instrumented);
              const value = Reflect.get(target, model);
              if (model === "$runCommandRaw") return args => {
                calls.push(`batch:${args.update}`); return value.call(target, args);
              };
              if (!value || typeof value !== "object" || String(model).startsWith("$")) return value;
              return new Proxy(value, { get(delegate, method) {
                const fn = Reflect.get(delegate, method);
                return typeof fn !== "function" ? fn : (...args) => {
                  calls.push(`${String(model)}.${String(method)}`); return fn.apply(delegate, args);
                };
              } });
            } });
            const started = performance.now();
            const result = await action(instrumented);
            if (expectedCalls != null) assert.equal(calls.length, expectedCalls, calls.join(", "));
            t.diagnostic(`${label}: ${calls.length} client calls, ${Math.round(performance.now() - started)} ms (local → dev DB)`);
            return result;
          };
          await operation({ tx, facade, user, route, routeIds, place, measured });
          throw rollback;
        }, { timeout: 30_000 }), error => error === rollback);
        // Fixture setup and assertions need extra time; application transaction timeouts are unchanged.
        assert.equal(await prisma.user.count({ where: { id: userId } }), 0);
        assert.equal(await prisma.route.count({ where: { OR: [{ ownerId: userId }, { id: { in: routeIds } }] } }), 0);
        for (const model of ["routeDay", "routeStop"]) {
          assert.equal(await prisma[model].count({ where: { routeId: { in: routeIds } } }), 0);
        }
        for (const model of ["placePhoto", "userNotification", "routeLike", "routeSave"]) {
          assert.equal(await prisma[model].count({ where: { userId } }), 0);
        }
        assert.equal(await prisma.placeStayStat.count({ where: { externalId: { startsWith: userId } } }), 0);
      });
    }

    await rollbackCase("visit contributions group repeated places, ignore unsynced visits, clamp at zero", async ({ tx, place }) => {
      const repeated = place("same", { title: "$literal title" });
      const clamped = place("clamped");
      const missing = place("missing");
      const lastVisitedAt = new Date("2026-09-01T00:00:00Z");
      await tx.placeStayStat.createMany({ data: [
        { placeKey: getPrimaryPlaceStayStatKey(repeated), ...buildPlaceStayStatSnapshotData(repeated), totalActualStayMinutes: 140, visitCount: 3, lastVisitedAt },
        { placeKey: getPrimaryPlaceStayStatKey(clamped), ...buildPlaceStayStatSnapshotData(clamped), totalActualStayMinutes: 5, visitCount: 1, lastVisitedAt },
      ] });
      const contribution = (place, minutes, synced = true) => ({ place, actualStayMinutes: minutes, visitStatus: "VISITED", stayStatSyncedAt: synced ? lastVisitedAt : null });
      await removeRouteStopStayContributions(tx, [contribution(repeated, 40), contribution(repeated, 60), contribution(repeated, 500, false), contribution(clamped, 30), contribution(clamped, 30), contribution(missing, 10)]);
      const saved = await tx.placeStayStat.findUnique({ where: { placeKey: getPrimaryPlaceStayStatKey(repeated) } });
      assert.equal(saved.totalActualStayMinutes, 40);
      assert.equal(saved.visitCount, 1);
      assert.equal(saved.title, "$literal title");
      assert.deepEqual(saved.lastVisitedAt, lastVisitedAt);
      assert.ok(saved.updatedAt instanceof Date);
      const zero = await tx.placeStayStat.findUnique({ where: { placeKey: getPrimaryPlaceStayStatKey(clamped) } });
      assert.equal(zero.totalActualStayMinutes, 0);
      assert.equal(zero.visitCount, 0);
      assert.equal(zero.lastVisitedAt, null);
      assert.equal(await tx.placeStayStat.count({ where: { placeKey: getPrimaryPlaceStayStatKey(missing) } }), 0);
    });

    await rollbackCase("sharing eight places preserves consent, photo dates, IDs and deletion state", async ({ tx, user, route, place, measured }) => {
      const r = await route();
      const day = await tx.routeDay.create({ data: { routeId: r.id, dayIndex: 1 } });
      const stopIds = Array.from({ length: 8 }, id);
      const verifiedAt = new Date("2026-09-01T01:00:00Z");
      await tx.routeStop.createMany({ data: stopIds.map((stopId, index) => ({
        id: stopId, routeId: r.id, dayId: day.id, order: index + 1, place: place(index), visitStatus: "VISITED",
        verificationStatus: index < 2 ? "GPS_PHOTO" : "NONE", verifiedAt,
        verificationPhotoUrl: index < 2 ? `https://example.com/${user.id}-${index}.jpg` : null,
        verificationPhotoPublicationConsent: index === 0,
      })) });
      await tx.placePhoto.create({ data: {
        placeKey: "old", provider: "CUSTOM", title: "old", lat: 37, lng: 127, userId: user.id,
        routeId: r.id, routeStopId: stopIds[2], routeDayId: day.id, imageUrl: "https://example.com/old.jpg",
      } });
      const shared = await measured("share 8 stops", api => shareRoute(api, user, r.id), 5);
      assert.equal(shared.visibility, "PUBLIC");
      assert.equal(shared.totalStopCount, 8);
      assert.equal(shared.completedStopCount, 8);
      assert.equal(shared.status, "COMPLETED");
      const photos = await tx.placePhoto.findMany({ where: { routeId: r.id } });
      const byStop = new Map(photos.map(photo => [photo.routeStopId, photo]));
      assert.equal(byStop.get(stopIds[0]).status, "ACTIVE");
      assert.equal(byStop.get(stopIds[1]).status, "HIDDEN");
      assert.equal(byStop.get(stopIds[2]).status, "DELETED");
      assert.equal(byStop.get(stopIds[0]).routeDayId, day.id);
      assert.deepEqual(byStop.get(stopIds[0]).publishedAt, verifiedAt);
      assert.equal(byStop.get(stopIds[1]).publishedAt, null);
      await measured("share replay", api => shareRoute(api, user, r.id), 5);
      const repeated = await tx.placePhoto.findUnique({ where: { routeStopId: stopIds[0] } });
      assert.equal(repeated.id, byStop.get(stopIds[0]).id);
      assert.deepEqual(repeated.createdAt, byStop.get(stopIds[0]).createdAt);
    });

    await rollbackCase("festival batches retain read and delivery records while cleaning obsolete schedules", async ({ tx, user, measured }) => {
      const past = new Date(Date.now() - 60_000);
      await tx.userNotification.createMany({ data: [
        { userId: user.id, notificationKey: "festival-0", type: "FESTIVAL_SUMMARY", availableAt: past, readAt: past, pushStatus: "SENT", pushAttemptCount: 2, pushTicketIds: ["ticket"] },
        { userId: user.id, notificationKey: "obsolete", type: "FESTIVAL_SUMMARY", availableAt: new Date(Date.now() + 3_600_000) },
      ] });
      const inputs = Array.from({ length: 48 }, (_, index) => ({
        notificationKey: `festival-${index}`, kind: "TODAY", regionCode: "test", regionLabel: "test",
        dateKey: new Date().toISOString().slice(0, 10), festivalIds: ["a"], festivalTitles: [`festival ${index}`],
      }));
      await measured("festival 48 notifications", api => syncFestivalNotificationInbox(api, user, inputs), 2);
      const rows = await tx.userNotification.findMany({ where: { userId: user.id } });
      assert.equal(rows.length, 48);
      const old = rows.find(row => row.notificationKey === "festival-0");
      assert.deepEqual(old.availableAt, past);
      assert.deepEqual(old.readAt, past);
      assert.equal(old.pushStatus, "SENT");
      assert.equal(old.pushAttemptCount, 2);
      assert.deepEqual(old.pushTicketIds, ["ticket"]);
      const fresh = rows.find(row => row.notificationKey === "festival-1");
      assert.equal(fresh.readAt, null);
      assert.equal(fresh.pushAttemptCount, 0);
      assert.deepEqual(fresh.pushTicketIds, []);
      assert.ok(fresh.availableAt instanceof Date);
      assert.ok(fresh.createdAt instanceof Date);
      assert.equal(await tx.userNotification.count({ where: { userId: user.id, readAt: null } }), 47);
    });

    await rollbackCase("review and arrival batches validate ownership and preserve already delivered dates", async ({ tx, user, route, place, measured }) => {
      const r = await route();
      const day = await tx.routeDay.create({ data: { routeId: r.id, dayIndex: 1 } });
      const stop = await tx.routeStop.create({ data: { routeId: r.id, dayId: day.id, order: 1, place: place("arrival") } });
      const past = new Date(Date.now() - 60_000);
      await tx.userNotification.createMany({ data: [
        { userId: user.id, notificationKey: "review-0", type: "ROUTE_REVIEW", routeId: r.id, dayId: day.id, availableAt: new Date(Date.now() + 3_600_000) },
        { userId: user.id, notificationKey: "review-1", type: "ROUTE_REVIEW", routeId: r.id, dayId: day.id, availableAt: past, readAt: past },
        { userId: user.id, notificationKey: "obsolete-review", type: "ROUTE_REVIEW", availableAt: new Date(Date.now() + 3_600_000) },
      ] });
      const reviewInputs = Array.from({ length: 47 }, (_, index) => ({
        notificationKey: `review-${index}`, kind: "COMPLETED", routeId: r.id, dayId: day.id, routeTitle: "test", correctionDeadlineAt: new Date(Date.now() + 86_400_000),
      }));
      reviewInputs.push({ ...reviewInputs[0], notificationKey: "foreign", routeId: id() });
      const result = await measured("review 48 candidates", api => syncRouteReviewNotificationInbox(api, user, reviewInputs), 5);
      assert.equal(result.syncedCount, 47);
      const reviews = await tx.userNotification.findMany({ where: { userId: user.id, type: "ROUTE_REVIEW" } });
      assert.equal(reviews.length, 47);
      assert.ok(reviews.find(row => row.notificationKey === "review-0").availableAt <= new Date());
      assert.deepEqual(reviews.find(row => row.notificationKey === "review-1").availableAt, past);
      const arrivalInputs = Array.from({ length: 120 }, (_, index) => ({
        notificationKey: `arrival-test:${r.id}:${stop.id}:${Date.now() + index}`,
        routeId: r.id, dayId: day.id, stopId: stop.id, placeTitle: "client title",
        dateKey: new Date().toISOString().slice(0, 10), deliveredAt: past,
      }));
      const arrivals = await measured("arrival 120 notifications", api => syncRouteArrivalNotificationInbox(api, user, arrivalInputs), 4);
      assert.equal(arrivals.syncedCount, 120);
      await measured("arrival replay", api => syncRouteArrivalNotificationInbox(api, user, arrivalInputs.slice(0, 1)), 3);
      assert.equal(await tx.userNotification.count({ where: { userId: user.id, type: "ROUTE_ARRIVAL" } }), 120);
      const row = await tx.userNotification.findUnique({ where: { userId_notificationKey: { userId: user.id, notificationKey: arrivalInputs[0].notificationKey } } });
      assert.equal(row.placeTitle, stop.place.title);
      assert.equal(row.stopId, stop.id);
      assert.deepEqual(row.availableAt, past);
    });

    await rollbackCase("account deletion decrements other routes once and removes DB photos without remote deletion", async ({ tx, user, route, routeIds, place, measured }) => {
      const own = await route();
      const otherOwnerId = id();
      const externalIds = Array.from({ length: 8 }, id);
      routeIds.push(...externalIds);
      await tx.route.createMany({ data: externalIds.map((routeId, index) => ({ id: routeId, ownerId: otherOwnerId, likeCount: index ? 3 : 0, saveCount: index ? 2 : 0 })) });
      await tx.routeLike.createMany({ data: [own.id, ...externalIds].map(routeId => ({ userId: user.id, routeId })) });
      await tx.routeSave.createMany({ data: externalIds.map(routeId => ({ userId: user.id, routeId })) });
      const day = await tx.routeDay.create({ data: { routeId: own.id, dayIndex: 1 } });
      const snapshot = place("account");
      const stopIds = [id(), id()];
      const now = new Date();
      const imageId = `${user.id}-shared-image`;
      await tx.routeStop.createMany({ data: stopIds.map((stopId, index) => ({
        id: stopId, routeId: own.id, dayId: day.id, order: index + 1, place: snapshot, visitStatus: "VISITED",
        actualStayMinutes: 30, stayStatSyncedAt: now, verificationPhotoImageId: imageId,
      })) });
      await tx.placeStayStat.create({ data: { placeKey: getPrimaryPlaceStayStatKey(snapshot), ...buildPlaceStayStatSnapshotData(snapshot), visitCount: 3, totalActualStayMinutes: 90 } });
      const copied = await tx.routeStop.create({ data: { routeId: externalIds[1], order: 1, place: { ...snapshot, imageUrl: `https://example.com/${imageId}` } } });
      await tx.placePhoto.createMany({ data: stopIds.map(stopId => ({
        placeKey: getPrimaryPlaceStayStatKey(snapshot), provider: "CUSTOM", title: "photo", lat: 37, lng: 127,
        userId: user.id, routeId: own.id, routeStopId: stopId, imageId, imageUrl: `https://example.com/${imageId}`,
      })) });
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => { throw new Error("account deletion must not call external image APIs"); };
      try { await measured("account deletion, 8 likes + 8 saves", api => deleteUserAccount(api, user.id), 19); }
      finally { globalThis.fetch = originalFetch; }
      assert.equal(await tx.user.count({ where: { id: user.id } }), 0);
      assert.equal(await tx.route.count({ where: { ownerId: user.id } }), 0);
      assert.equal(await tx.placePhoto.count({ where: { userId: user.id } }), 0);
      assert.equal(await tx.routeLike.count({ where: { userId: user.id } }), 0);
      assert.equal(await tx.routeSave.count({ where: { userId: user.id } }), 0);
      const others = await tx.route.findMany({ where: { id: { in: externalIds } } });
      assert.ok(others.every(row => row.likeCount === (row.id === externalIds[0] ? 0 : 2)));
      assert.ok(others.every(row => row.saveCount === (row.id === externalIds[0] ? 0 : 1)));
      assert.ok(await tx.routeStop.findUnique({ where: { id: copied.id } }));
      const stat = await tx.placeStayStat.findUnique({ where: { placeKey: getPrimaryPlaceStayStatKey(snapshot) } });
      assert.equal(stat.visitCount, 1);
      assert.equal(stat.totalActualStayMinutes, 30);
    });

    await rollbackCase("multi-DAY lifecycle batches preserve dates, links, progress and deletion", async ({ tx, facade, user, routeIds, place, measured }) => {
      const input = { tripDays: 4, stops: Array.from({ length: 8 }, (_, index) => ({ dayIndex: Math.floor(index / 2) + 1, place: place(index), stayMinutes: 70 })) };
      const r = await measured("create 4 DAYs / 8 stops", api => createRoute(api, user, input), 3);
      routeIds.push(r.id);
      await measured("append 4 DAYs / 8 stops", api => appendRouteDays(api, user, { ...input, routeId: r.id, stops: input.stops.map((stop, index) => ({ ...stop, place: place(index + 8) })) }), 7);
      const startDate = new Date(Date.now() - 10 * 86_400_000);
      await measured("start 8 DAYs", api => startRoute(api, user, { routeId: r.id, startedAt: startDate }), 7);
      const days = await tx.routeDay.findMany({ where: { routeId: r.id }, orderBy: { dayIndex: "asc" } });
      const stops = await tx.routeStop.findMany({ where: { routeId: r.id }, orderBy: { order: "asc" } });
      assert.equal(days.length, 8);
      assert.equal(stops.length, 16);
      const layout = days.map(day => ({ dayId: day.id, stops: stops.filter(stop => stop.dayId === day.id).map(stop => ({ stopId: stop.id, stayMinutes: 70 })) }));
      await measured("layout 8 DAYs / 16 stops", api => updateRouteLayout(api, user, { routeId: r.id, days: layout }), 5);
      await deleteRouteDay(facade, user, days[0].id);
      const updated = await tx.route.findUnique({ where: { id: r.id } });
      assert.equal(updated.tripDays, 7);
      assert.equal(updated.totalStopCount, 14);
      await tx.route.update({ where: { id: r.id }, data: { visibility: "PUBLIC" } });
      const copy = await measured("clone 7 DAYs / 14 stops", api => cloneRoute(api, user, { routeId: r.id }), 4);
      routeIds.push(copy.id);
      assert.equal(copy.totalStopCount, 14);
      assert.equal(copy.completedStopCount, 0);
      assert.equal(copy.startedAt, null);
      assert.equal(await tx.routeDay.count({ where: { routeId: copy.id } }), 7);
      await measured("delete 14 unvisited stops", api => deleteRoute(api, user, r.id), 10);
      assert.equal(await tx.routeStop.count({ where: { routeId: r.id } }), 0);
      assert.equal(await tx.routeStop.count({ where: { routeId: copy.id } }), 14);
    });

    await rollbackCase("MongoDB duplicate errors remain recognizable as retryable conflicts", async ({ tx, route }) => {
      const r = await route();
      const dayIds = [id(), id()];
      await tx.routeDay.createMany({ data: dayIds.map((dayId, index) => ({ id: dayId, routeId: r.id, dayIndex: index + 1 })) });
      await assert.rejects(runMongoUpdates(tx, "RouteDay", [
        { q: { _id: mongoId(dayIds[1]) }, u: { $set: { dayIndex: 1 } } },
      ]), error => {
        assert.equal(error.code, "P2002");
        return true;
      });
    });

    await rollbackCase("raw write errors abort preceding writes rather than returning success", async ({ tx, route }) => {
      const r = await route();
      const day = await tx.routeDay.create({ data: { routeId: r.id, dayIndex: 1 } });
      await assert.rejects(runMongoUpdates(tx, "RouteDay", [
        { q: { _id: mongoId(day.id) }, u: { $set: { plannedStartMinutes: 600 } } },
        { q: { _id: mongoId(day.id) }, u: { $unsupportedOperator: { dayIndex: 2 } } },
      ]));
    });
  } finally { await prisma.$disconnect(); }
});
