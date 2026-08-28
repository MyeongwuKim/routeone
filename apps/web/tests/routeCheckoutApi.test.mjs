import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let routeApi;
let checkout;
let transport;
const originalGlobals = new Map(
  ["window", "navigator", "fetch"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ])
);

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  checkout = await server.ssrLoadModule("/src/api/routeCheckoutApi.ts");
  ({ routeApi } = await server.ssrLoadModule("/src/api/routeApi.ts"));
});

after(async () => {
  await server?.close();
});

beforeEach(() => {
  transport = createTransport();
  for (const [name, value] of Object.entries({
    window: transport.window,
    navigator: { onLine: true },
    fetch: transport.fetch,
  })) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
});

afterEach(() => {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
});

function createTransport() {
  const requests = [];
  const timerDelays = [];
  const pendingTimers = new Map();
  let nextTimerId = 0;
  let respond = () => {
    throw new Error("테스트 응답이 지정되지 않았습니다.");
  };

  return {
    requests,
    timerDelays,
    pendingTimers,
    window: {
      localStorage: { getItem: () => null },
      setTimeout(callback, delay) {
        const id = ++nextTimerId;
        timerDelays.push(delay);
        pendingTimers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        pendingTimers.delete(id);
      },
    },
    fetch(url, options = {}) {
      const request = { url: String(url), ...options };
      requests.push(request);
      return respond(request, requests.length);
    },
    respondWith(handler) {
      respond = handler;
    },
    async runTimer(delay) {
      await flushTasks();
      const entry = [...pendingTimers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `${delay}ms 타이머가 예약되어 있어야 합니다.`);
      pendingTimers.delete(entry[0]);
      entry[1].callback();
      await flushTasks();
    },
  };
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function waitForAbort({ signal }) {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => {
      reject(new DOMException("테스트 요청 시간 초과", "AbortError"));
    });
  });
}

function createPlace(id, offset = 0) {
  return {
    id,
    contentId: id,
    contentTypeId: "12",
    areaCode: "32",
    signguCode: "1",
    touristTrendName: id,
    topRank: null,
    title: id,
    address: "강원 강릉시 테스트 주소",
    lat: 37.78 + offset,
    lng: 128.88 + offset,
    contentTypeLabel: "관광지",
    categoryName: "자연관광",
    icon: "📍",
    images: [],
  };
}

function createPlanInput() {
  return {
    routePlan: [{
      day: 1,
      items: [
        { place: createPlace("place-a"), stayMinutes: 60, travelMinutesFromPrevious: 8 },
        { place: createPlace("place-b", 0.01), stayMinutes: 45, travelMinutesFromPrevious: 12 },
      ],
    }],
    travelStartDate: "2026-09-04",
    tripDays: 1,
    dailyStartMinutes: 540,
    scheduleEndMinutes: 1080,
    startLocation: { lat: 37.77, lng: 128.87 },
  };
}

function createMutationInput(clientRequestId) {
  return {
    ...checkout.buildCreateRouteInput(createPlanInput()),
    clientRequestId,
  };
}

test("입력 빌더는 동기적으로 빈 날짜를 정리하고 이동시간 0과 null을 보존한다", () => {
  const input = createPlanInput();
  input.tripDays = 7;
  input.routePlan = [
    { day: 7, startLocation: { lat: 0, lng: 0 }, items: [{ place: createPlace("zero"), stayMinutes: 60, travelMinutesFromPrevious: 0 }] },
    { day: 1, startLocation: { lat: 10, lng: 20 }, items: [] },
    { day: 3, startLocation: { lat: 35.2, lng: 129.1 }, items: [
      { place: createPlace("null"), stayMinutes: 45, travelMinutesFromPrevious: null },
      { place: createPlace("missing"), stayMinutes: 30 },
    ] },
  ];
  const previousInput = structuredClone(input);
  const result = checkout.buildCreateRouteInput(input);

  assert.equal(typeof result.then, "undefined");
  assert.equal(result.tripDays, 2);
  assert.equal(checkout.getEffectiveRoutePlanTripDays(input.routePlan), 2);
  assert.deepEqual(result.stops.map((stop) => stop.dayIndex), [1, 1, 2]);
  assert.deepEqual(result.stops.map((stop) => stop.order), [1, 2, 3]);
  assert.deepEqual(result.stops.map((stop) => stop.travelMinutesFromPrevious), [null, null, 0]);
  assert.deepEqual(result.dayStartLocations, [
    { dayIndex: 1, startLocation: { lat: 35.2, lng: 129.1 } },
    { dayIndex: 2, startLocation: { lat: 0, lng: 0 } },
  ]);
  assert.deepEqual(result, checkout.buildCreateRouteInput(input));
  assert.deepEqual(input, previousInput);
  assert.deepEqual(transport.requests, []);
});

test("DAY 출발지가 없으면 공통 출발지를 쓰고 출발지 편집은 저장 요청 키에 반영한다", () => {
  const input = createPlanInput();
  input.startLocation = { lat: 0, lng: 127.5 };
  input.routePlan.push({
    day: 2,
    startLocation: null,
    items: [{ place: createPlace("second-day"), stayMinutes: 30 }],
  });
  const before = checkout.buildCreateRouteInput(input);
  assert.deepEqual(before.dayStartLocations, [
    { dayIndex: 1, startLocation: input.startLocation },
    { dayIndex: 2, startLocation: input.startLocation },
  ]);

  input.routePlan[1].startLocation = { lat: 35.2, lng: 129.1 };
  const after = checkout.buildCreateRouteInput(input);
  assert.deepEqual(after.dayStartLocations[0], before.dayStartLocations[0]);
  assert.deepEqual(after.dayStartLocations[1].startLocation, input.routePlan[1].startLocation);
  assert.notEqual(JSON.stringify(after), JSON.stringify(before));
  assert.deepEqual(after.stops, before.stops);
});

test("공통 출발지가 없으면 좌표가 있는 DAY만 출발지 입력에 포함한다", () => {
  const input = createPlanInput();
  input.startLocation = null;
  input.routePlan.push({
    day: 2,
    startLocation: { lat: 0, lng: 0 },
    items: [{ place: createPlace("second-day"), stayMinutes: 30 }],
  });
  assert.deepEqual(checkout.buildCreateRouteInput(input).dayStartLocations, [
    { dayIndex: 2, startLocation: { lat: 0, lng: 0 } },
  ]);
});

test("장소가 전혀 없는 입력은 빈 stops와 기본 하루 일정으로 정규화한다", () => {
  const input = createPlanInput();
  input.routePlan = [{ day: 2, items: [] }, { day: 4, items: [] }];

  assert.equal(checkout.buildCreateRouteInput(input).tripDays, 1);
  assert.deepEqual(checkout.buildCreateRouteInput(input).stops, []);
  assert.deepEqual(checkout.buildCreateRouteInput(input).dayStartLocations, []);
  assert.equal(checkout.getEffectiveRoutePlanTripDays(input.routePlan), 1);
  assert.deepEqual(transport.requests, []);
});

test("식별자가 있는 생성은 30초 시간 초과 후 1초 뒤 같은 본문으로 한 번 재시도한다", async () => {
  const input = createMutationInput("create-request-1");
  transport.respondWith((request, attempt) => attempt === 1
    ? waitForAbort(request)
    : jsonResponse({ data: { createRoute: { id: "saved-route" } } }));
  const result = routeApi.createRoute(input);

  assert.equal(transport.requests.length, 1);
  assert.deepEqual(transport.timerDelays, [30_000]);
  await transport.runTimer(30_000);
  assert.equal(transport.requests.length, 1);
  assert.deepEqual(transport.timerDelays, [30_000, 1_000]);
  await transport.runTimer(1_000);

  assert.deepEqual(await result, { createRoute: { id: "saved-route" } });
  assert.equal(transport.requests.length, 2);
  assert.deepEqual(transport.timerDelays, [30_000, 1_000, 30_000]);
  assert.equal(transport.requests[0].body, transport.requests[1].body);
  assert.equal(JSON.parse(transport.requests[1].body).variables.input.clientRequestId, input.clientRequestId);
  assert.notEqual(transport.requests[0].signal, transport.requests[1].signal);
  assert.equal(transport.pendingTimers.size, 0);
});

test("자동 재시도 실패 후 같은 입력을 수동 재시도해도 본문이 같고 길찾기를 호출하지 않는다", async () => {
  const input = createPlanInput();
  input.routePlan.push({ day: 2, items: [] }, {
    day: 3,
    startLocation: { lat: 0, lng: 0 },
    items: [{ place: createPlace("second-day"), stayMinutes: 30, travelMinutesFromPrevious: 21 }],
  });
  const previousInput = structuredClone(input);
  let createAttempts = 0;
  let directionsCalls = 0;
  transport.respondWith((request) => {
    if (request.url.startsWith("/map-direction/")) {
      directionsCalls += 1;
      return jsonResponse({ code: 0, route: { traoptimal: [{
        summary: { duration: (10 + directionsCalls) * 60_000, distance: 1000 },
        path: [[128.87, 37.77], [128.88, 37.78]],
      }] } });
    }
    assert.equal(request.url, "/graphql");
    createAttempts += 1;
    return createAttempts <= 2
      ? jsonResponse({ errors: [{ message: "테스트 서버 일시 오류" }] }, 503)
      : jsonResponse({ data: { createRoute: { id: "saved-route" } } });
  });

  const failure = assert.rejects(
    checkout.routeCheckoutApi.saveRoutePlan(input, "stable-request"),
    (error) => error.retryable === true && error.status === 503
  );
  await transport.runTimer(1_000);
  await failure;
  assert.equal(createAttempts, 2);
  assert.equal(transport.pendingTimers.size, 0);

  await checkout.routeCheckoutApi.saveRoutePlan(input, "stable-request");
  const createRequests = transport.requests.filter((request) => request.url === "/graphql");
  assert.equal(createAttempts, 3);
  assert.equal(new Set(createRequests.map((request) => request.body)).size, 1);
  const savedInput = JSON.parse(createRequests[0].body).variables.input;
  assert.deepEqual(savedInput.stops.map((stop) => stop.travelMinutesFromPrevious), [8, 12, 21]);
  assert.deepEqual(savedInput.dayStartLocations, [
    { dayIndex: 1, startLocation: input.startLocation },
    { dayIndex: 2, startLocation: { lat: 0, lng: 0 } },
  ]);
  assert.equal(directionsCalls, 0);
  assert.deepEqual(input, previousInput);
  assert.deepEqual(transport.timerDelays, [30_000, 1_000, 30_000, 30_000]);
});

for (const clientRequestId of [undefined, null, "", "   "]) {
  test(`유효한 식별자가 없는 생성(${JSON.stringify(clientRequestId)})은 30초 뒤 재시도하지 않는다`, async () => {
    transport.respondWith(waitForAbort);
    const failure = assert.rejects(
      routeApi.createRoute(createMutationInput(clientRequestId)),
      (error) => error.retryable === true
    );
    await transport.runTimer(30_000);
    await failure;

    assert.equal(transport.requests.length, 1);
    assert.deepEqual(transport.timerDelays, [30_000]);
    assert.equal(transport.pendingTimers.size, 0);
  });
}

test("일정 추가는 기존 이동시간으로 요청하고 30초 뒤 재시도하지 않는다", async () => {
  transport.respondWith(waitForAbort);
  const input = createPlanInput();
  input.routePlan.push({ day: 2, items: [] }, {
    day: 4,
    startLocation: { lat: 0, lng: 0 },
    items: [{ place: createPlace("appended-day"), stayMinutes: 30, travelMinutesFromPrevious: 0 }],
  });
  const failure = assert.rejects(
    checkout.routeCheckoutApi.appendRouteDays("existing-route", input),
    (error) => error.retryable === true
  );
  await transport.runTimer(30_000);
  await failure;

  assert.equal(transport.requests.length, 1);
  assert.equal(transport.requests[0].url, "/graphql");
  const { query, variables } = JSON.parse(transport.requests[0].body);
  assert.match(query, /mutation AppendRouteDays/);
  assert.equal(variables.input.routeId, "existing-route");
  assert.deepEqual(variables.input.stops.map((stop) => stop.travelMinutesFromPrevious), [8, 12, 0]);
  assert.deepEqual(variables.input.dayStartLocations, [
    { dayIndex: 1, startLocation: input.startLocation },
    { dayIndex: 2, startLocation: { lat: 0, lng: 0 } },
  ]);
  assert.deepEqual(transport.timerDelays, [30_000]);
  assert.equal(transport.pendingTimers.size, 0);
});

test("생성 식별자가 있어도 업무 오류는 재시도하지 않는다", async () => {
  transport.respondWith(() => jsonResponse({ errors: [{ message: "일정이 겹칩니다." }] }));

  await assert.rejects(routeApi.createRoute(createMutationInput("request-1")), {
    message: "일정이 겹칩니다.",
    retryable: false,
  });
  assert.equal(transport.requests.length, 1);
  assert.deepEqual(transport.timerDelays, [30_000]);
});

test("myRoutes는 기존 첫 인자와 기본 제한을 유지한다", async () => {
  transport.respondWith(() => jsonResponse({ data: { myRoutes: [] } }));
  const variables = { status: "ACTIVE" };

  assert.deepEqual(await routeApi.myRoutes(variables), { myRoutes: [] });
  assert.deepEqual(JSON.parse(transport.requests[0].body).variables, variables);
  assert.deepEqual(transport.timerDelays, [12_000]);
});

test("myRoutes는 두 번째 인자의 30초 제한과 재시도 금지를 전달한다", async () => {
  transport.respondWith(waitForAbort);
  const failure = assert.rejects(
    routeApi.myRoutes(undefined, { timeoutMs: 30_000, maxRetryCount: 0 }),
    (error) => error.retryable === true
  );
  await transport.runTimer(30_000);
  await failure;

  assert.equal(transport.requests.length, 1);
  assert.deepEqual(transport.timerDelays, [30_000]);
  assert.equal(transport.pendingTimers.size, 0);
});
