import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  appendRouteDays,
  cloneRoute,
  createRoute,
  updateRouteLayout,
  updateRouteStartLocation,
} from "../src/modules/routes/routeCommand.service.ts";
import {
  normalizeRouteDayInputs,
  normalizeRouteStartLocation,
} from "../src/modules/routes/routeDayInput.ts";

const owner = { id: "owner" };
const origin = { lat: 37, lng: 127 };
const secondOrigin = { lat: 36, lng: 128 };
const changedOrigin = { lat: 35, lng: 129 };

function stopInput(dayIndex, title = `Place ${dayIndex}`) {
  return { dayIndex, place: { provider: "CUSTOM", title, lat: 37, lng: 127 } };
}

function routeRow(overrides = {}) {
  return {
    id: "route",
    ownerId: owner.id,
    tripDays: 2,
    status: "ACTIVE",
    visibility: "PRIVATE",
    countryCode: "KR",
    travelStartDate: null,
    travelEndDate: null,
    dailyStartMinutes: null,
    scheduleEndMinutes: null,
    startLocation: origin,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function dayRow(dayIndex, startLocation = origin, overrides = {}) {
  return {
    id: `day-${dayIndex}`,
    routeId: "route",
    dayIndex,
    date: null,
    plannedStartMinutes: null,
    startedAt: null,
    startLocation,
    ...overrides,
  };
}

function memoryDatabase(initial = {}) {
  const state = structuredClone({ routes: [], days: [], stops: [], requests: [], ...initial });
  const writes = [];
  let nextId = 1;
  let transactionDepth = 0;
  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) =>
      value && typeof value === "object" && "in" in value
        ? value.in.includes(row[key])
        : row[key] === value
    );
  const recordWrite = (model, operation, data) => {
    writes.push({ model, operation, data: structuredClone(data), inTransaction: transactionDepth > 0 });
  };
  const table = (name, defaults = {}) => ({
    async findUnique({ where }) {
      return structuredClone(state[name].find((row) => matches(row, where)) ?? null);
    },
    async findMany({ where, orderBy } = {}) {
      const rows = state[name].filter((row) => matches(row, where));
      const orderKey = Object.keys(orderBy ?? {})[0];
      if (orderKey) rows.sort((left, right) => left[orderKey] - right[orderKey]);
      return structuredClone(rows);
    },
    async count({ where }) {
      return state[name].filter((row) => matches(row, where)).length;
    },
    async create({ data }) {
      const row = structuredClone({ ...defaults, ...data, id: `created-${name}-${nextId++}` });
      state[name].push(row);
      recordWrite(name, "create", row);
      return structuredClone(row);
    },
    async update({ where, data }) {
      const row = state[name].find((item) => matches(item, where));
      assert.ok(row, `${name} row must exist for update`);
      Object.assign(row, structuredClone(data));
      recordWrite(name, "update", { id: row.id, ...data });
      return structuredClone(row);
    },
    async deleteMany({ where }) {
      const rows = state[name].filter((row) => !matches(row, where));
      const count = state[name].length - rows.length;
      state[name].splice(0, state[name].length, ...rows);
      recordWrite(name, "deleteMany", where);
      return { count };
    },
    async delete({ where }) {
      return this.deleteMany({ where });
    },
  });
  const route = table("routes", routeRow());
  const baseFindRoute = route.findUnique;
  route.findUnique = async (args) => {
    const row = await baseFindRoute(args);
    return row && args.include
      ? {
          ...row,
          days: structuredClone(state.days.filter((day) => day.routeId === row.id)),
          stops: structuredClone(state.stops.filter((stop) => stop.routeId === row.id)),
        }
      : row;
  };
  route.findFirst = async () => null;
  const requests = table("requests");
  requests.findUnique = async ({ where }) =>
    structuredClone(state.requests.find((row) => matches(row, where.ownerId_requestId)) ?? null);

  const prisma = {
    route,
    routeDay: table("days", { date: null, startLocation: null }),
    routeStop: table("stops", { visitStatus: "PENDING" }),
    routeCreateRequest: requests,
    userNotification: { deleteMany: async () => ({ count: 0 }) },
    placePhoto: { deleteMany: async () => ({ count: 0 }) },
    async $transaction(operation) {
      const before = structuredClone(state);
      transactionDepth += 1;
      try {
        return await operation(prisma);
      } catch (error) {
        for (const name of Object.keys(state)) state[name].splice(0, state[name].length, ...before[name]);
        throw error;
      } finally {
        transactionDepth -= 1;
      }
    },
  };
  return { prisma, state, writes };
}

test("create compacts stop DAYs and their origins together, dropping empty DAY overrides", async () => {
  const db = memoryDatabase();
  await createRoute(db.prisma, owner, {
    tripDays: 4,
    startLocation: origin,
    stops: [stopInput(2), stopInput(4)],
    dayStartLocations: [
      { dayIndex: 4, startLocation: secondOrigin },
      { dayIndex: 1, startLocation: changedOrigin },
    ],
  });

  assert.equal(db.state.routes[0].tripDays, 2);
  assert.deepEqual(db.state.routes[0].startLocation, origin);
  assert.deepEqual(db.state.days.map((day) => [day.dayIndex, day.startLocation]), [
    [1, origin], [2, secondOrigin],
  ]);
  assert.deepEqual(db.state.stops.map((stop) => stop.dayId), db.state.days.map((day) => day.id));
});

test("create stores the default independently on each DAY", async () => {
  const db = memoryDatabase();
  const route = await createRoute(db.prisma, owner, {
    tripDays: 2, startLocation: origin, stops: [stopInput(1), stopInput(2)],
  });
  await updateRouteStartLocation(db.prisma, owner, {
    routeId: route.id, dayId: db.state.days[0].id, startLocation: changedOrigin,
  });

  assert.deepEqual(db.state.days.map((day) => day.startLocation), [changedOrigin, origin]);
  assert.deepEqual(db.state.routes[0].startLocation, origin);
});

test("an empty draft retains only DAY 1 and its origin", async () => {
  const db = memoryDatabase();
  await createRoute(db.prisma, owner, {
    tripDays: 3,
    startLocation: origin,
    dayStartLocations: [
      { dayIndex: 1, startLocation: secondOrigin },
      { dayIndex: 3, startLocation: changedOrigin },
    ],
  });

  assert.deepEqual(db.state.days.map((day) => day.startLocation), [secondOrigin]);
  assert.equal(db.state.routes[0].tripDays, 1);
});

test("invalid coordinates are rejected before any route or DAY writes", async () => {
  for (const location of [
    { lat: NaN, lng: 127 }, { lat: 37, lng: Infinity },
    { lat: 90.1, lng: 127 }, { lat: -90.1, lng: 127 },
    { lat: 37, lng: 180.1 }, { lat: 37, lng: -180.1 },
  ]) {
    for (const fields of [
      { startLocation: location },
      { dayStartLocations: [{ dayIndex: 1, startLocation: location }] },
    ]) {
      const db = memoryDatabase();
      await assert.rejects(createRoute(db.prisma, owner, { tripDays: 1, ...fields }), /좌표/);
      assert.equal(db.writes.length, 0);
    }
  }
  assert.deepEqual(normalizeRouteStartLocation({ lat: -90, lng: 180 }), { lat: -90, lng: 180 });
});

test("invalid or duplicate origin DAY indexes are rejected", () => {
  for (const dayIndex of [0, -1, 1.5, 4, NaN, Infinity]) {
    assert.throws(() => normalizeRouteDayInputs(3, [stopInput(1)], [
      { dayIndex, startLocation: origin },
    ]), /DAY/);
  }
  assert.throws(() => normalizeRouteDayInputs(3, [stopInput(1)], [
    { dayIndex: 1, startLocation: origin },
    { dayIndex: 1, startLocation: secondOrigin },
  ]), /중복/);
});

test("append writes new DAY origins without changing existing DAYs or root fallback", async () => {
  const db = memoryDatabase({ routes: [routeRow()], days: [dayRow(1), dayRow(2, secondOrigin)] });
  const previousDays = structuredClone(db.state.days);
  await appendRouteDays(db.prisma, owner, {
    routeId: "route", tripDays: 4, startLocation: changedOrigin,
    stops: [stopInput(2), stopInput(4)],
    dayStartLocations: [{ dayIndex: 4, startLocation: secondOrigin }],
  });

  assert.deepEqual(db.state.days.slice(0, 2), previousDays);
  assert.deepEqual(db.state.days.slice(2).map((day) => [day.dayIndex, day.startLocation]), [
    [3, changedOrigin], [4, secondOrigin],
  ]);
  assert.deepEqual(db.state.routes[0].startLocation, origin);
  assert.deepEqual(db.state.stops.map((stop) => stop.dayId), db.state.days.slice(2).map((day) => day.id));
});

test("append without an input default uses the existing route default", async () => {
  const db = memoryDatabase({ routes: [routeRow()], days: [dayRow(1), dayRow(2)] });
  await appendRouteDays(db.prisma, owner, { routeId: "route", tripDays: 1, stops: [stopInput(1)] });
  assert.deepEqual(db.state.days[2].startLocation, origin);
});

test("append does not fill a null root fallback used by older DAYs", async () => {
  const legacyDay = dayRow(1);
  delete legacyDay.startLocation;
  const db = memoryDatabase({ routes: [routeRow({ tripDays: 1, startLocation: null })], days: [legacyDay] });
  await appendRouteDays(db.prisma, owner, {
    routeId: "route", tripDays: 1, startLocation: changedOrigin, stops: [stopInput(1)],
  });

  assert.equal(db.state.routes[0].startLocation, null);
  assert.equal(db.state.days[0].startLocation, undefined);
  assert.deepEqual(db.state.days[1].startLocation, changedOrigin);
});

test("DAY mutation checks ownership and route/DAY relationship before writes", async () => {
  for (const [actingUser, dayId] of [[{ id: "other-owner" }, "day-1"], [owner, "foreign-day"], [owner, "missing-day"], [owner, ""]]) {
    const db = memoryDatabase({
      routes: [routeRow()],
      days: [dayRow(1), dayRow(2, origin, { id: "foreign-day", routeId: "another-route" })],
    });
    await assert.rejects(updateRouteStartLocation(db.prisma, actingUser, {
      routeId: "route", dayId, startLocation: changedOrigin,
    }));
    assert.equal(db.writes.length, 0);
  }
});

test("omitting dayId keeps the legacy root-only mutation", async () => {
  const db = memoryDatabase({ routes: [routeRow()], days: [dayRow(1), dayRow(2, secondOrigin)] });
  await updateRouteStartLocation(db.prisma, owner, { routeId: "route", startLocation: changedOrigin });

  assert.deepEqual(db.state.routes[0].startLocation, changedOrigin);
  assert.deepEqual(db.state.days.map((day) => day.startLocation), [origin, secondOrigin]);
});

test("clone preserves DAY overrides and snapshots legacy root fallbacks", async () => {
  const missingOriginDay = dayRow(3);
  delete missingOriginDay.startLocation;
  const db = memoryDatabase({
    routes: [routeRow({ ownerId: "source-owner", visibility: "PUBLIC", tripDays: 3 })],
    days: [dayRow(1, secondOrigin), dayRow(2, null), missingOriginDay],
    stops: [{ id: "source-stop", routeId: "route", dayId: "day-1", order: 1, place: stopInput(1).place }],
  });
  const copied = await cloneRoute(db.prisma, owner, { routeId: "route" });
  const copiedDays = db.state.days.filter((day) => day.routeId === copied.id);

  assert.deepEqual(copiedDays.map((day) => day.startLocation), [secondOrigin, origin, origin]);
  assert.deepEqual(copied.startLocation, origin);
  assert.equal(db.state.stops.find((stop) => stop.routeId === copied.id).dayId, copiedDays[0].id);
  assert.equal(db.state.days[2].startLocation, undefined);
});

test("create idempotency includes normalized DAY origins and ignores input list order", async () => {
  const db = memoryDatabase();
  const input = {
    clientRequestId: "request-with-day-origins", tripDays: 2,
    stops: [stopInput(1), stopInput(2)], startLocation: origin,
    dayStartLocations: [
      { dayIndex: 1, startLocation: origin },
      { dayIndex: 2, startLocation: secondOrigin },
    ],
  };
  const first = await createRoute(db.prisma, owner, input);
  const repeated = await createRoute(db.prisma, owner, {
    ...input, dayStartLocations: [...input.dayStartLocations].reverse(),
  });
  assert.equal(repeated.id, first.id);
  assert.equal(db.state.routes.length, 1);
  await assert.rejects(createRoute(db.prisma, owner, {
    ...input,
    dayStartLocations: [{ dayIndex: 1, startLocation: origin }, { dayIndex: 2, startLocation: changedOrigin }],
  }), /서로 다른/);
  assert.deepEqual(db.state.days.map((day) => day.startLocation), [origin, secondOrigin]);
});

test("requests without DAY origins retain the previous input hash", async () => {
  // Exact canonical payload used before the optional DAY-origin field existed.
  const legacyPayload = '{"countryCode":"KR","dailyStartMinutes":null,"primaryRegionCode":null,"primaryRegionLabelKey":null,"scheduleEndMinutes":null,"startLocation":{"lat":37,"lng":127},"stops":[],"travelEndDate":null,"travelStartDate":null,"tripDays":1}';
  const legacyHash = createHash("sha256").update(legacyPayload).digest("hex");
  const db = memoryDatabase({
    routes: [routeRow({ tripDays: 1 })],
    requests: [{ id: "legacy-request", ownerId: owner.id, requestId: "legacy", routeId: "route", inputHash: legacyHash }],
  });
  for (const dayStartLocations of [undefined, null, []]) {
    const route = await createRoute(db.prisma, owner, {
      clientRequestId: "legacy", tripDays: 1, startLocation: origin, dayStartLocations,
    });
    assert.equal(route.id, "route");
  }
  assert.equal(db.state.routes.length, 1);
  assert.equal(db.state.days.length, 0);
});

test("layout persists only the supplied DAY origin inside its existing transaction", async () => {
  const db = memoryDatabase({
    routes: [routeRow({ tripDays: 3 })],
    days: [dayRow(1, secondOrigin), dayRow(2, origin), dayRow(3, null)],
  });
  await updateRouteLayout(db.prisma, owner, {
    routeId: "route",
    days: [
      { dayId: "day-1", stops: [], startLocation: null },
      { dayId: "day-2", stops: [], startLocation: changedOrigin },
      { dayId: "day-3", stops: [] },
    ],
  });

  assert.deepEqual(db.state.days.map((day) => day.startLocation), [secondOrigin, changedOrigin, null]);
  assert.deepEqual(db.state.routes[0].startLocation, origin);
  const originWrites = db.writes.filter((write) => write.model === "days" && "startLocation" in write.data);
  assert.equal(originWrites.length, 1);
  assert.equal(originWrites[0].inTransaction, true);
});

test("layout validates origins before deleting or changing any DAY", async () => {
  const db = memoryDatabase({ routes: [routeRow()], days: [dayRow(1), dayRow(2)] });
  await assert.rejects(updateRouteLayout(db.prisma, owner, {
    routeId: "route", deletedDayIds: ["day-1"],
    days: [{ dayId: "day-2", stops: [], startLocation: { lat: 91, lng: 127 } }],
  }), /좌표/);
  assert.equal(db.writes.length, 0);
});

test("removing a DAY from layout preserves origins on the surviving DAY IDs", async () => {
  const db = memoryDatabase({
    routes: [routeRow({ tripDays: 3 })],
    days: [dayRow(1), dayRow(2, secondOrigin), dayRow(3, changedOrigin)],
  });
  await updateRouteLayout(db.prisma, owner, {
    routeId: "route", deletedDayIds: ["day-1"],
    days: [{ dayId: "day-2", stops: [] }, { dayId: "day-3", stops: [] }],
  });

  assert.deepEqual(db.state.days.map((day) => [day.id, day.dayIndex, day.startLocation]), [
    ["day-2", 1, secondOrigin], ["day-3", 2, changedOrigin],
  ]);
});
