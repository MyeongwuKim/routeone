import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  appendRouteDays,
  cloneRoute,
  createRoute,
  startRoute,
  updateRouteLayout,
  updateRouteStartLocation,
} from "../src/modules/routes/routeCommand.service.ts";
import {
  normalizeRouteDayInputs,
  normalizeRouteStartLocation,
} from "../src/modules/routes/routeDayInput.ts";

import { owner, origin, secondOrigin, changedOrigin, stopInput, routeRow, dayRow, memoryDatabase } from "./helpers/routeMemoryDatabase.mjs";

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
  assert.equal(db.state.routes[0].status, "DRAFT");
  assert.equal(db.state.routes[0].totalStopCount, 0);
  assert.equal(db.state.routes[0].completedStopCount, 0);
  assert.equal(db.writes.some((write) => write.model === "stops"), false);
});

test("creating more places keeps the single-DAY database call count constant", async () => {
  for (const stopCount of [2, 8, 20]) {
    const db = memoryDatabase();
    const calls = [];
    for (const model of ["route", "routeDay", "routeStop", "routeCreateRequest"]) {
      for (const [operation, method] of Object.entries(db.prisma[model])) {
        db.prisma[model][operation] = async function (...args) {
          calls.push(`${model}.${operation}`);
          return method.apply(this, args);
        };
      }
    }

    const route = await createRoute(db.prisma, owner, {
      clientRequestId: `batch-${stopCount}`,
      tripDays: 1,
      travelStartDate: new Date("2026-09-09T15:00:00.000Z"),
      startLocation: origin,
      stops: Array.from({ length: stopCount }, (_, index) => ({
        ...stopInput(1, `Place ${index + 1}`),
        stayMinutes: 70,
        travelMinutesFromPrevious: 4.6,
        memo: `  Stop ${index + 1}  `,
      })),
    });

    assert.equal(calls.length, 6, `${stopCount} places should need only six calls`);
    assert.equal(calls.filter((call) => call === "routeStop.createMany").length, 1);
    assert.equal(route.totalStopCount, stopCount);
    assert.equal(route.completedStopCount, 0);
    assert.equal(route.status, "ACTIVE");
    assert.equal(route.startedAt, null);
    assert.equal(route.completedAt, null);
    assert.equal(db.state.days.length, 1);
    assert.equal(db.state.stops.length, stopCount);
    assert.equal(db.state.requests[0].routeId, route.id);
    assert.ok(db.writes.every((write) => write.inTransaction));
    assert.deepEqual(
      db.state.stops.map((stop) => ({
        routeId: stop.routeId, dayId: stop.dayId, order: stop.order,
        title: stop.place.title, stayMinutes: stop.stayMinutes,
        travelMinutes: stop.travelMinutesFromPrevious,
        memo: stop.memo, visitStatus: stop.visitStatus,
      })),
      Array.from({ length: stopCount }, (_, index) => ({
        routeId: route.id, dayId: db.state.days[0].id, order: index + 1,
        title: `Place ${index + 1}`, stayMinutes: 70, travelMinutes: 5,
        memo: `Stop ${index + 1}`, visitStatus: "PENDING",
      }))
    );
  }
});

test("a failed place batch rolls back the route and DAYs even without a request ID", async () => {
  for (const clientRequestId of [undefined, "failed-batch"]) {
    const db = memoryDatabase();
    const createMany = db.prisma.routeStop.createMany.bind(db.prisma.routeStop);
    db.prisma.routeStop.createMany = async ({ data }) => {
      await createMany({ data: data.slice(0, 1) });
      throw new Error("forced place batch failure");
    };

    await assert.rejects(createRoute(db.prisma, owner, {
      clientRequestId,
      tripDays: 2,
      stops: [stopInput(1), stopInput(2)],
    }), /forced place batch failure/);

    assert.deepEqual(db.state, { routes: [], days: [], stops: [], requests: [] });
    assert.ok(db.writes.every((write) => write.inTransaction));
  }
});

test("a failed request record rolls back an already saved place batch", async () => {
  const db = memoryDatabase();
  db.prisma.routeCreateRequest.create = async () => {
    throw new Error("forced request record failure");
  };

  await assert.rejects(createRoute(db.prisma, owner, {
    clientRequestId: "failed-request-record",
    tripDays: 2,
    stops: [stopInput(1), stopInput(2)],
  }), /forced request record failure/);

  assert.deepEqual(db.state, { routes: [], days: [], stops: [], requests: [] });
});

test("repeating creation returns current saved progress without writing again", async () => {
  const db = memoryDatabase();
  const input = {
    clientRequestId: "completed-route-request",
    tripDays: 1,
    stops: [stopInput(1)],
  };
  await createRoute(db.prisma, owner, input);
  const completedAt = new Date("2026-09-10T02:00:00.000Z");
  Object.assign(db.state.routes[0], {
    status: "COMPLETED", completedStopCount: 1,
    startedAt: new Date("2026-09-10T00:00:00.000Z"), completedAt,
  });
  Object.assign(db.state.stops[0], { visitStatus: "VISITED", visitedAt: completedAt });
  const savedState = structuredClone(db.state);
  const writeCount = db.writes.length;

  const repeated = await createRoute(db.prisma, owner, input);

  assert.deepEqual(repeated, savedState.routes[0]);
  assert.deepEqual(db.state, savedState);
  assert.equal(db.writes.length, writeCount);
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

test("start updates every route record inside one transaction", async () => {
  const travelStartDate = new Date("2026-08-30T15:00:00.000Z");
  const actualStartedAt = new Date("2026-08-31T01:30:00.000Z");
  const db = memoryDatabase({
    routes: [routeRow()],
    days: [dayRow(1), dayRow(2, secondOrigin)],
    stops: [
      {
        id: "stop-1",
        routeId: "route",
        dayId: "day-1",
        order: 1,
        visitStatus: "PENDING",
      },
    ],
  });

  const startedRoute = await startRoute(db.prisma, owner, {
    routeId: "route",
    startedAt: travelStartDate,
    dayStartedAt: actualStartedAt,
  });

  assert.deepEqual(startedRoute.startedAt, actualStartedAt);
  assert.deepEqual(db.state.routes[0].travelStartDate, travelStartDate);
  assert.deepEqual(
    db.state.days.map((day) => day.date),
    [travelStartDate, new Date("2026-08-31T15:00:00.000Z")]
  );
  assert.deepEqual(db.state.days[0].startedAt, actualStartedAt);
  assert.ok(
    db.writes
      .filter((write) => write.model === "routes" || write.model === "days")
      .every((write) => write.inTransaction)
  );
});

test("repeating start preserves the first start dates and actual time", async () => {
  const firstTravelStartDate = new Date("2026-08-29T15:00:00.000Z");
  const firstActualStartedAt = new Date("2026-08-30T01:10:00.000Z");
  const firstDayDate = new Date("2026-08-29T15:00:00.000Z");
  const secondDayDate = new Date("2026-08-30T15:00:00.000Z");
  const db = memoryDatabase({
    routes: [
      routeRow({
        travelStartDate: firstTravelStartDate,
        travelEndDate: secondDayDate,
        startedAt: firstActualStartedAt,
      }),
    ],
    days: [
      dayRow(1, origin, {
        date: firstDayDate,
        startedAt: firstActualStartedAt,
      }),
      dayRow(2, secondOrigin, { date: secondDayDate }),
    ],
  });

  const repeatedRoute = await startRoute(db.prisma, owner, {
    routeId: "route",
    startedAt: new Date("2026-08-30T15:00:00.000Z"),
    dayStartedAt: new Date("2026-08-31T02:20:00.000Z"),
  });

  assert.deepEqual(repeatedRoute.startedAt, firstActualStartedAt);
  assert.deepEqual(db.state.routes[0].travelStartDate, firstTravelStartDate);
  assert.deepEqual(db.state.routes[0].travelEndDate, secondDayDate);
  assert.deepEqual(
    db.state.days.map((day) => day.date),
    [firstDayDate, secondDayDate]
  );
  assert.deepEqual(db.state.days[0].startedAt, firstActualStartedAt);
});

test("start rolls back DAY changes when the route write fails", async () => {
  const db = memoryDatabase({
    routes: [routeRow()],
    days: [dayRow(1), dayRow(2, secondOrigin)],
  });
  const updateRoute = db.prisma.route.update.bind(db.prisma.route);

  db.prisma.route.update = async (args) => {
    if (args.data.startedAt) {
      throw new Error("forced route start failure");
    }

    return updateRoute(args);
  };

  await assert.rejects(
    startRoute(db.prisma, owner, {
      routeId: "route",
      startedAt: new Date("2026-08-30T15:00:00.000Z"),
      dayStartedAt: new Date("2026-08-31T02:20:00.000Z"),
    }),
    /forced route start failure/
  );

  assert.equal(db.state.routes[0].startedAt, null);
  assert.equal(db.state.routes[0].travelStartDate, null);
  assert.deepEqual(
    db.state.days.map((day) => [day.date, day.startedAt]),
    [
      [null, null],
      [null, null],
    ]
  );
});
