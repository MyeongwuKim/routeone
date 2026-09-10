/**
 * 용도: 실제 앱의 일정 저장 GraphQL 요청을 로컬 API에 동시에 보내 지연을 확인한다.
 * 실행 없이 호출하면 계획만 출력한다. --run을 주면 개발 DB에 전용 계정을 만들고,
 * 최대 3개 동시 요청으로 짧게 측정한 뒤 생성한 데이터만 삭제하고 잔여 여부를 검사한다.
 * Cloud Run의 콜드 스타트·확장이나 운영 환경의 최대 처리량을 측정하는 테스트는 아니다.
 */
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { parse } from "dotenv";
import { print } from "graphql";
import { CreateRouteDocument } from "../../../web/src/generated/graphql.ts";

const stages = [1, 2, 3];
const waves = 2;
const scenarios = [{ stops: 2, days: 1 }, { stops: 8, days: 1 }];
const plan = { target: "local API → routeone_dev", stages, waves, scenarios, maxRequests: 27, stopAtHttpMs: 5000 };
if (!process.argv.includes("--run")) {
  console.log(JSON.stringify({ plan, run: "node --import tsx tests/load/routeSave.load.mjs --run" }, null, 2));
  process.exit(0);
}

const config = parse(await readFile(fileURLToPath(new URL("../../.env", import.meta.url))));
const databaseUrl = new URL(config.DATABASE_URL);
assert.equal(databaseUrl.pathname, "/routeone_dev", "only routeone_dev is allowed");
assert.equal(databaseUrl.hostname, "cluster0.nnjurjy.mongodb.net");
// Test tokens are valid only in this local process; external API secrets are not needed.
process.env.DATABASE_URL = config.DATABASE_URL;
process.env.AUTH_TOKEN_SECRET = randomBytes(32).toString("hex");
process.env.NODE_ENV = "test";
delete process.env.SENTRY_DSN;
const runId = randomBytes(12).toString("hex");
const outputPath = join(tmpdir(), `routeone-route-save-load-${runId}.json`);
const users = Array.from({ length: 3 }, (_, index) => ({
  id: randomBytes(12).toString("hex"), accountId: `load-test-${runId}-${index}`,
}));
const userIds = users.map(user => user.id);
const trace = new AsyncLocalStorage();
const samples = [];
const activeTransactions = new Set();
const database = new PrismaClient();
let app;
let interrupted = false;
let stoppedReason = null;
let cleanupVerified = false;
let failure = null;
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const onSignal = () => { interrupted = true; };
process.on("SIGINT", onSignal);
process.on("SIGTERM", onSignal);

function instrument(client) {
  return new Proxy(client, { get(target, key) {
    const value = Reflect.get(target, key);
    if (key === "$transaction") return (operation, ...options) => {
      const sample = trace.getStore();
      const started = performance.now();
      const pending = value.call(target, async tx => {
        const acquired = performance.now();
        try { return await operation(instrument(tx)); }
        finally { sample?.transactionBodyMs.push(performance.now() - acquired); }
      }, ...options);
      activeTransactions.add(pending);
      return pending.finally(() => {
        sample?.transactionWallMs.push(performance.now() - started);
        activeTransactions.delete(pending);
      });
    };
    if (key === "$runCommandRaw") return (...args) => {
      trace.getStore()?.dbCalls.push(`batch:${args[0].update}`);
      return value.apply(target, args);
    };
    if (!value || typeof value !== "object" || String(key).startsWith("$")) return value;
    return new Proxy(value, { get(delegate, operation) {
      const method = Reflect.get(delegate, operation);
      if (typeof method !== "function") return method;
      return (...args) => {
        trace.getStore()?.dbCalls.push(`${String(key)}.${String(operation)}`);
        return method.apply(delegate, args);
      };
    } });
  } });
}

const report = () => ({
  runId, target: plan.target, startedAt, plan, stoppedReason,
  cleanupVerified, failure,
  scope: "warm local HTTP API, authenticated test users, real app GraphQL selection and committed development DB writes; small samples, no capacity claim",
  summary: [...new Set(samples.map(sample => sample.group))].map(group => {
    const rows = samples.filter(sample => sample.group === group);
    return {
      group, requests: rows.length, failures: rows.filter(row => !row.ok).length,
      meanHttpMs: Math.round(rows.reduce((sum, row) => sum + row.httpMs, 0) / rows.length),
      maxHttpMs: Math.round(Math.max(...rows.map(row => row.httpMs))),
      maxTransactionBodyMs: Math.round(Math.max(0, ...rows.flatMap(row => row.transactionBodyMs))),
      maxTransactionWallMs: Math.round(Math.max(0, ...rows.flatMap(row => row.transactionWallMs))),
      dbCallsPerRequest: [...new Set(rows.map(row => row.dbCalls.length))],
    };
  }),
  samples,
});
const startedAt = new Date().toISOString();

try {
  globalThis.prisma = instrument(database);
  const { buildApp } = await import("../../src/app.ts");
  const { createAuthToken } = await import("../../src/lib/auth.ts");
  await database.$connect();
  await database.user.createMany({ data: users });
  const tokens = users.map(user => createAuthToken(user.id));
  app = await buildApp();
  app.log.level = "silent";
  const pendingSamples = new Map();
  app.addHook("onRequest", (request, _reply, done) => {
    trace.run(pendingSamples.get(request.headers["x-load-test-id"]), done);
  });
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const query = print(CreateRouteDocument);
  await fetch(`${origin}/health`);
  let serial = 0;

  function inputFor(scenario) {
    const requestId = `load-${runId}-${serial++}`;
    // Distinct historical dates avoid colliding with other test requests or scheduled alerts.
    const travelStartDate = new Date(Date.UTC(2001, 0, serial * 2)).toISOString();
    return {
      clientRequestId: requestId, tripDays: scenario.days, travelStartDate,
      startLocation: { lat: 37.5213, lng: 126.9252 },
      stops: Array.from({ length: scenario.stops }, (_, index) => ({
        dayIndex: 1, order: index + 1, stayMinutes: 70, travelMinutesFromPrevious: 5,
        place: { provider: "CUSTOM", externalId: `${requestId}-${index}`, title: `Load test ${index + 1}`, lat: 37.52, lng: 126.92 },
      })),
    };
  }

  async function request(group, userIndex, input) {
    const sample = { group, requestId: input.clientRequestId, httpMs: 0, ok: false, dbCalls: [], transactionBodyMs: [], transactionWallMs: [] };
    const traceId = randomBytes(8).toString("hex");
    pendingSamples.set(traceId, sample);
    const started = performance.now();
    try {
      const response = await fetch(`${origin}/graphql`, {
        method: "POST", signal: AbortSignal.timeout(60_000),
        headers: { "content-type": "application/json", authorization: `Bearer ${tokens[userIndex]}`, "x-load-test-id": traceId },
        body: JSON.stringify({ query, variables: { input } }),
      });
      sample.httpStatus = response.status;
      const body = await response.json();
      sample.errorCodes = body.errors?.map(error => error.extensions?.code ?? "UNKNOWN") ?? [];
      const route = body.data?.createRoute;
      if (!response.ok || body.errors?.length) throw new Error("HTTP or GraphQL request failed");
      assert.equal(route.totalStopCount, input.stops.length);
      assert.equal(route.completedStopCount, 0);
      assert.equal(route.stops.length, input.stops.length);
      assert.equal(route.days.length, input.tripDays);
      assert.equal(route.days.flatMap(day => day.stops).length, input.stops.length);
      assert.ok(route.stops.every(stop => stop.dayId === route.days[0].id));
      sample.routeId = route.id;
      sample.ok = true;
    } catch (error) {
      sample.failure = error instanceof Error ? error.name : "UnknownError";
    } finally {
      sample.httpMs = Math.round(performance.now() - started);
      samples.push(sample);
      pendingSamples.delete(traceId);
    }
    return sample;
  }

  for (const scenario of scenarios) {
    for (const concurrency of stages) {
      if (interrupted || stoppedReason) break;
      const group = `${scenario.stops} stops / concurrent ${concurrency}`;
      for (let wave = 0; wave < waves; wave++) {
        if (interrupted || stoppedReason) break;
        const results = await Promise.all(Array.from({ length: concurrency }, (_, index) => request(group, index, inputFor(scenario))));
        if (results.some(row => !row.ok)) stoppedReason = "request failure";
        else if (results.some(row => row.httpMs >= plan.stopAtHttpMs)) stoppedReason = "HTTP latency reached 5 seconds";
        else if (results.some(row => row.transactionBodyMs.some(ms => ms >= 4000))) stoppedReason = "transaction body reached 4 seconds";
        await sleep(1000);
      }
      console.log(JSON.stringify(report().summary.find(row => row.group === group)));
    }
  }
  if (!interrupted && !stoppedReason) {
    const input = inputFor({ stops: 8, days: 1 });
    const results = await Promise.all(Array.from({ length: 3 }, () => request("same save request / concurrent 3", 0, input)));
    assert.ok(results.every(row => row.ok));
    assert.equal(new Set(results.map(row => row.routeId)).size, 1, "concurrent retries must return the same route");
    assert.equal(await database.routeCreateRequest.count({ where: { ownerId: users[0].id, requestId: input.clientRequestId } }), 1);
    console.log(JSON.stringify(report().summary.at(-1)));
  }
  if (interrupted) stoppedReason = "interrupted";
  const expectedRouteIds = [...new Set(samples.filter(sample => sample.ok).map(sample => sample.routeId))];
  const actual = await database.route.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
  assert.deepEqual(actual.map(row => row.id).sort(), expectedRouteIds.sort(), "failed requests must not leave unexpected routes");
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown failure";
  process.exitCode = 1;
} finally {
  try {
    if (app) await app.close();
    await Promise.allSettled([...activeTransactions]);
    const actualUsers = await database.user.findMany({ where: { id: { in: userIds } }, select: { id: true, accountId: true } });
    assert.ok(actualUsers.every(user => user.accountId?.startsWith(`load-test-${runId}-`)), "cleanup ownership mismatch");
    const ownedRoutes = await database.route.findMany({ where: { ownerId: { in: userIds } }, select: { id: true } });
    const routeIds = ownedRoutes.map(route => route.id);
    const linked = { routeId: { in: routeIds } };
    // Remove only this run's synthetic data. No Cloudflare or push APIs are involved.
    for (const model of ["placePhoto", "routeLike", "routeSave", "userNotification"]) {
      await database[model].deleteMany({ where: { OR: [{ userId: { in: userIds } }, linked] } });
    }
    for (const model of ["routeStop", "routeDay"]) await database[model].deleteMany({ where: linked });
    await database.routeCreateRequest.deleteMany({ where: { ownerId: { in: userIds } } });
    await database.route.deleteMany({ where: { id: { in: routeIds } } });
    for (const model of ["authAccount", "pushDevice", "userNotificationSetting"]) {
      await database[model].deleteMany({ where: { userId: { in: userIds } } });
    }
    await database.user.deleteMany({ where: { id: { in: userIds }, accountId: { startsWith: `load-test-${runId}-` } } });
    for (const model of ["routeStop", "routeDay"]) assert.equal(await database[model].count({ where: linked }), 0);
    assert.equal(await database.route.count({ where: { ownerId: { in: userIds } } }), 0);
    assert.equal(await database.routeCreateRequest.count({ where: { ownerId: { in: userIds } } }), 0);
    assert.equal(await database.user.count({ where: { id: { in: userIds } } }), 0);
    cleanupVerified = true;
  } catch (error) {
    failure = `cleanup verification failed: ${error instanceof Error ? error.message : "unknown"}`;
    process.exitCode = 1;
  }
  await database.$disconnect();
  delete globalThis.prisma;
  process.off("SIGINT", onSignal);
  process.off("SIGTERM", onSignal);
  await writeFile(outputPath, JSON.stringify(report(), null, 2));
  console.log(JSON.stringify({ outputPath, cleanupVerified, stoppedReason, failure }));
}
