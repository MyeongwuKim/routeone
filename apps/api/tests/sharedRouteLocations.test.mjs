import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { ApolloServer } from "@apollo/server";
import { PrismaClient } from "@prisma/client";
import { print } from "graphql";
import { SharedRouteByIdDocument } from "../../web/src/generated/graphql.ts";
import { typeDefs, resolvers } from "../src/schema.ts";
import { routeResolvers } from "../src/modules/routes/route.resolver.ts";
import { normalizePlaceSnapshot } from "../src/modules/routes/route.shared.ts";
import { cloneRoute } from "../src/modules/routes/routeCommand.service.ts";
import { dayRow, memoryDatabase, owner, routeRow } from "./helpers/routeMemoryDatabase.mjs";

const privateStart = { lat: 37.231234, lng: 128.341234 };
const publicStart = { lat: 37.351234, lng: 128.451234 };
const placePin = { lat: 37.461234, lng: 128.561234 };
const proof = {
  verificationLat: 37.471234,
  verificationLng: 128.571234,
  verificationAccuracyMeters: 13.25,
};
const anotherUser = { id: "visitor" };
const now = new Date("2026-11-24T10:00:00.000Z");
const fields = `
  startLocation { lat lng }
  stops { ...Stop day { startLocation { lat lng } stops { ...Stop } } }
  days { startLocation { lat lng } stops { ...Stop } }
`;
const stopFields = `fragment Stop on RouteStop {
  place { lat lng }
  visitStatus visitedAt verificationStatus
  verificationLat verificationLng verificationAccuracyMeters
}`;
const shareMutation = `mutation Publish($locations: [ShareRouteStartLocationInput!]!) {
  shareRoute(routeId: "route", startLocations: $locations) { visibility startLocation { lat lng } }
}`;

function fixture(overrides = {}) {
  const db = memoryDatabase({
    routes: [routeRow({
      tripDays: 2, startLocation: privateStart, startedAt: now, completedAt: now,
      totalStopCount: 2, completedStopCount: 2, status: "COMPLETED", ...overrides,
    })],
    days: [dayRow(1, null), dayRow(2, privateStart)],
    stops: [1, 2].map((index) => ({
      id: `stop-${index}`, routeId: "route", dayId: `day-${index}`, order: index,
      place: { provider: "CUSTOM", title: "테스트 관광지", ...placePin },
      visitStatus: "VISITED", visitedAt: now, verificationStatus: "GPS", ...proof,
    })),
  });
  db.prisma.sharedRouteReport = { findFirst: async () => null, findMany: async () => [] };
  db.prisma.userBlock = { findUnique: async () => null, findMany: async () => [] };
  db.prisma.user = { findUnique: async () => ({ id: owner.id }) };
  db.prisma.routeLike = {
    findUnique: async () => ({ id: "like" }),
    findMany: async ({ cursor }) => cursor ? [] : [{ id: "like", routeId: "route" }],
  };
  return db;
}

async function request(server, prisma, query, user = null, variables) {
  const result = await server.executeOperation({ query, variables }, {
    contextValue: { prisma, user, authenticatedUserId: user?.id ?? null },
  });
  assert.equal(result.body.kind, "single");
  return JSON.parse(JSON.stringify(result.body.singleResult));
}

function assertStop(stop, visibleProof) {
  assert.deepEqual(stop.place, placePin);
  assert.equal(stop.visitStatus, "VISITED");
  assert.equal(stop.visitedAt, now.toISOString());
  assert.equal(stop.verificationStatus, "GPS");
  for (const key of Object.keys(proof)) assert.equal(stop[key], visibleProof ? proof[key] : null);
}

test("public detail, lists and nested stops exclude GPS while owner detail retains it", async (t) => {
  const server = new ApolloServer({ typeDefs, resolvers });
  t.after(() => server.stop());
  const { prisma, state } = fixture({ visibility: "PUBLIC", sharedAt: now, likeCount: 0, saveCount: 0, createdAt: now, updatedAt: now });
  const detail = `{ route(id: "route") { ${fields} } } ${stopFields}`;
  const feed = `{ sharedRoutes { ${fields} } sharedRouteConnection { nodes { ${fields} } } } ${stopFields}`;
  const liked = `{ likedRouteConnection { nodes { ${fields} } } } ${stopFields}`;
  const anonymous = await request(server, prisma, detail);
  const visitor = await request(server, prisma, detail, anotherUser);
  const visitorFeed = await request(server, prisma, feed, anotherUser);
  const visitorLiked = await request(server, prisma, liked, anotherUser);
  const authorFeed = await request(server, prisma, feed, owner);
  for (const response of [anonymous, visitor, visitorFeed, visitorLiked, authorFeed]) {
    assert.equal(response.errors, undefined, JSON.stringify(response.errors));
  }
  for (const route of [
    anonymous.data.route, visitor.data.route, visitorFeed.data.sharedRoutes[0],
    visitorFeed.data.sharedRouteConnection.nodes[0], visitorLiked.data.likedRouteConnection.nodes[0],
    authorFeed.data.sharedRoutes[0],
  ]) {
    assert.deepEqual(route.startLocation, privateStart, "legacy public start is preserved");
    assert.deepEqual(route.days.map((day) => day.startLocation), [null, privateStart]);
    assertStop(route.stops[0], false);
    assertStop(route.stops[0].day.stops[0], false);
    assertStop(route.days[0].stops[0], false);
  }
  const ownRoute = (await request(server, prisma, detail, owner)).data.route;
  assertStop(ownRoute.stops[0], true);
  assertStop(ownRoute.days[0].stops[0], true);
  const projected = await routeResolvers.Route.stops(state.routes[0], {}, { prisma, user: anotherUser });
  for (const key of Object.keys(proof)) assert.equal(Object.hasOwn(projected[0], key), false);

  const publicDetail = await request(server, prisma, print(SharedRouteByIdDocument), anotherUser, { id: "route" });
  assert.equal(publicDetail.errors, undefined, JSON.stringify(publicDetail.errors));
  assert.deepEqual(publicDetail.data.route.days[0].stops[0].place.lat, placePin.lat);
  for (const key of Object.keys(proof)) assert.equal(Object.hasOwn(publicDetail.data.route.days[0].stops[0], key), false);
});

test("publishing validates all DAYs, stores only confirmed public starts and preserves the private itinerary", async (t) => {
  const server = new ApolloServer({ typeDefs, resolvers });
  t.after(() => server.stop());
  const { prisma, state, writes } = fixture();
  const invalid = await request(server, prisma, shareMutation, owner, {
    locations: [{ dayId: "day-1", startLocation: publicStart }],
  });
  assert.match(invalid.errors[0].message, /공개할 출발지를 다시 확인/);
  assert.equal(state.routes[0].visibility, "PRIVATE");
  assert.equal(writes.length, 0);

  const locations = [
    { dayId: "day-1", startLocation: publicStart },
    { dayId: "day-2", startLocation: null },
  ];
  const unauthorized = await request(server, prisma, shareMutation, anotherUser, { locations });
  assert.ok(unauthorized.errors);
  assert.equal(writes.length, 0);

  const published = await request(server, prisma, shareMutation, owner, { locations });
  assert.equal(published.errors, undefined, JSON.stringify(published.errors));
  assert.equal(published.data.shareRoute.visibility, "PUBLIC");
  assert.deepEqual(published.data.shareRoute.startLocation, privateStart);
  assert.deepEqual(state.routes[0].sharedStartLocations, { startLocation: null, days: locations });
  assert.deepEqual(state.days.map((day) => day.startLocation), [null, privateStart]);
  assert.ok(writes.every((write) => write.inTransaction));

  const replay = await request(server, prisma, shareMutation, owner, {
    locations: [{ dayId: "day-1", startLocation: privateStart }, locations[1]],
  });
  assert.equal(replay.errors, undefined, JSON.stringify(replay.errors));
  const publicDetail = `{ route(id: "route", sharedView: true) { ${fields} } } ${stopFields}`;
  for (const user of [null, owner, anotherUser]) {
    const result = await request(server, prisma, publicDetail, user);
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    assert.equal(result.data.route.startLocation, null);
    assert.deepEqual(result.data.route.days.map((day) => day.startLocation), [publicStart, null]);
    assert.deepEqual(result.data.route.stops[0].day.startLocation, publicStart);
  }
  const own = (await request(server, prisma, `{ route(id: "route") { ${fields} } } ${stopFields}`, owner)).data.route;
  assert.deepEqual(own.startLocation, privateStart);
  assert.deepEqual(own.days.map((day) => day.startLocation), [null, privateStart]);
  assertStop(own.stops[0], true);
  const clone = await cloneRoute(prisma, anotherUser, { routeId: "route" });
  assert.equal(clone.startLocation, null);
  assert.deepEqual(
    state.days.filter((day) => day.routeId === clone.id).map((day) => day.startLocation),
    [publicStart, null]
  );
});

test("local MongoDB persists the confirmed public start and retains the original starts", {
  skip: process.env.ROUTEONE_TEST_SHARED_LOCAL_MONGO !== "1",
}, async (t) => {
  const database = `masil_shared_location_${randomBytes(5).toString("hex")}`;
  const prisma = new PrismaClient({ datasources: { db: {
    url: `mongodb://127.0.0.1:27187/${database}?directConnection=true&serverSelectionTimeoutMS=3000`,
  } } });
  const server = new ApolloServer({ typeDefs, resolvers });
  t.after(async () => {
    await server.stop();
    try {
      await prisma.$runCommandRaw({ dropDatabase: 1 });
    } finally {
      await prisma.$disconnect();
    }
  });
  const user = await prisma.user.create({ data: {} });
  const route = await prisma.route.create({ data: { ownerId: user.id, startLocation: privateStart } });
  const day = await prisma.routeDay.create({ data: { routeId: route.id, dayIndex: 1, startLocation: privateStart } });
  await prisma.routeStop.create({ data: {
    routeId: route.id, dayId: day.id, order: 1,
    place: normalizePlaceSnapshot({ provider: "CUSTOM", title: "테스트 관광지", ...placePin }),
    visitStatus: "VISITED", visitedAt: now, verificationStatus: "GPS", ...proof,
  } });
  const locations = [{ dayId: day.id, startLocation: publicStart }];
  const published = await request(server, prisma, shareMutation.replace('"route"', JSON.stringify(route.id)), user, { locations });
  assert.equal(published.errors, undefined, JSON.stringify(published.errors));
  const saved = await prisma.route.findUniqueOrThrow({ where: { id: route.id } });
  assert.deepEqual(saved.sharedStartLocations, { startLocation: publicStart, days: locations });
  assert.deepEqual(saved.startLocation, privateStart);
  assert.deepEqual((await prisma.routeDay.findUniqueOrThrow({ where: { id: day.id } })).startLocation, privateStart);
  const result = await request(server, prisma, `{ route(id: "${route.id}") { ${fields} } } ${stopFields}`);
  assert.equal(result.errors, undefined, JSON.stringify(result.errors));
  assert.deepEqual(result.data.route.startLocation, publicStart);
  assert.deepEqual(result.data.route.days[0].startLocation, publicStart);
  assertStop(result.data.route.days[0].stops[0], false);
});
