import assert from "node:assert/strict";
import test from "node:test";
import { appendRouteDays, cloneRoute, createRoute, deleteRouteDay, reorderRouteStops, updateRouteLayout } from "../src/modules/routes/routeCommand.service.ts";
import { owner, origin, stopInput, routeRow, dayRow, memoryDatabase } from "./helpers/routeMemoryDatabase.mjs";

const stops = (count, overrides = {}) => Array.from({ length: count }, (_, index) => ({
  id: `stop-${index + 1}`, routeId: "route", dayId: "day-1", order: index + 1,
  place: stopInput(1, `Place ${index + 1}`).place, stayMinutes: 70,
  travelMinutesFromPrevious: null, visitStatus: "PENDING", ...overrides,
}));

test("many DAYs and places are linked by preallocated IDs in two batch writes", async () => {
  const db = memoryDatabase();
  await createRoute(db.prisma, owner, {
    tripDays: 8, startLocation: origin,
    stops: Array.from({ length: 8 }, (_, index) => stopInput(index + 1)),
  });
  assert.equal(db.state.days.length, 8);
  assert.deepEqual(db.state.stops.map(stop => stop.dayId), db.state.days.map(day => day.id));
  assert.equal(db.writes.filter(write => write.model === "days").length, 1);
  assert.equal(db.writes.filter(write => write.model === "stops").length, 1);
});

test("append and clone roll back DAYs and places after a partially successful batch", async () => {
  for (const operation of ["append", "clone"]) {
    const db = memoryDatabase({
      routes: [routeRow({ visibility: "PUBLIC" })], days: [dayRow(1), dayRow(2)], stops: stops(8),
    });
    const before = structuredClone(db.state);
    const insert = db.prisma.routeStop.createMany;
    db.prisma.routeStop.createMany = async ({ data }) => {
      await insert({ data: data.slice(0, 1) });
      throw new Error("interrupted batch");
    };
    const action = operation === "append"
      ? appendRouteDays(db.prisma, owner, { routeId: "route", tripDays: 2, stops: [stopInput(1), stopInput(2)] })
      : cloneRoute(db.prisma, owner, { routeId: "route" });
    await assert.rejects(action, /interrupted batch/);
    assert.deepEqual(db.state, before);
  }
});

test("saving an unchanged layout performs no writes; changing one stay updates only that stop", async () => {
  const db = memoryDatabase({ routes: [routeRow({ tripDays: 1, totalStopCount: 8 })], days: [dayRow(1)], stops: stops(8) });
  const input = { routeId: "route", days: [{ dayId: "day-1", stops: db.state.stops.map(stop => ({ stopId: stop.id, stayMinutes: 70 })) }] };
  await updateRouteLayout(db.prisma, owner, input);
  assert.equal(db.writes.length, 0);
  input.days[0].stops[3].stayMinutes = 90;
  await updateRouteLayout(db.prisma, owner, input);
  assert.deepEqual(db.state.stops.map(stop => stop.stayMinutes), [70, 70, 70, 90, 70, 70, 70, 70]);
  assert.equal(db.writes.filter(write => write.model === "stops").length, 1);
  assert.equal(db.writes.filter(write => write.model === "days").length, 0);
});

test("layout moves are atomic and retained visited stops determine progress", async () => {
  const db = memoryDatabase({
    routes: [routeRow({ totalStopCount: 8 })], days: [dayRow(1), dayRow(2)],
    stops: stops(8).map((stop, index) => ({ ...stop, visitStatus: index < 2 ? "VISITED" : "PENDING" })),
  });
  const result = await updateRouteLayout(db.prisma, owner, {
    routeId: "route", deletedDayIds: ["day-1"],
    days: [{ dayId: "day-2", stops: [{ stopId: "stop-2", stayMinutes: 60 }, { stopId: "stop-1", stayMinutes: 70 }] }],
  });
  assert.equal(result.totalStopCount, 2);
  assert.equal(result.completedStopCount, 2);
  assert.equal(result.status, "COMPLETED");
  assert.deepEqual(db.state.stops.map(stop => [stop.id, stop.dayId, stop.order]), [["stop-1", "day-2", 2], ["stop-2", "day-2", 1]]);
  assert.ok(db.writes.every(write => write.inTransaction));
});

test("layout raw errors roll back earlier deletions and progress changes", async () => {
  const db = memoryDatabase({ routes: [routeRow()], days: [dayRow(1), dayRow(2)], stops: stops(2) });
  const before = structuredClone(db.state);
  db.prisma.$runCommandRaw = async () => ({ ok: 1, writeErrors: [{ code: 121 }] });
  await assert.rejects(updateRouteLayout(db.prisma, owner, {
    routeId: "route", deletedDayIds: ["day-1"], days: [{ dayId: "day-2", stops: [{ stopId: "stop-1" }] }],
  }), /저장 실패/);
  assert.deepEqual(db.state, before);
});

test("reordering batches the changed order and does not recalculate progress", async () => {
  const db = memoryDatabase({ routes: [routeRow({ totalStopCount: 8, completedStopCount: 3 })], days: [dayRow(1)], stops: stops(8) });
  const input = { routeId: "route", dayId: "day-1", stopIds: db.state.stops.map(stop => stop.id) };
  await reorderRouteStops(db.prisma, owner, input);
  assert.equal(db.writes.length, 0);
  const result = await reorderRouteStops(db.prisma, owner, { ...input, stopIds: [...input.stopIds].reverse() });
  assert.deepEqual(db.state.stops.map(stop => stop.order), [8, 7, 6, 5, 4, 3, 2, 1]);
  assert.equal(result.completedStopCount, 3);
  assert.equal(db.writes.filter(write => write.model === "raw").length, 1);
});

test("deleting a DAY reindexes survivors and returns their progress in the same transaction", async () => {
  const db = memoryDatabase({
    routes: [routeRow({ totalStopCount: 3, completedStopCount: 1 })], days: [dayRow(1), dayRow(2)],
    stops: [...stops(2), { ...stops(1, { visitStatus: "VISITED", dayId: "day-2" })[0], id: "visited" }],
  });
  const result = await deleteRouteDay(db.prisma, owner, "day-1");
  assert.equal(result.totalStopCount, 1);
  assert.equal(result.completedStopCount, 1);
  assert.equal(result.status, "COMPLETED");
  assert.equal(db.state.days[0].id, "day-2");
  assert.equal(db.state.days[0].dayIndex, 1);
  assert.ok(db.writes.every(write => write.inTransaction));
});
