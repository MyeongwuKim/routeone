import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "graphql";
import { createServer } from "vite";

const mutation = parse(`
  mutation CreateRoute($input: CreateRouteInput!) {
    createRoute(input: $input) { id }
  }
`);
const query = parse("query Route { route { id } }");
const variables = {
  input: { clientRequestId: "test-create-request", tripDays: 1, stops: [] },
};
const savedRoute = { createRoute: { id: "test-route" } };
const saveOptions = { timeoutMs: 30_000, maxRetryCount: 1, retryDelayMs: 1_000 };

let server;
let client;
let authApi;
let previousGlobals;
let fetchSteps;
let fetchCalls;
let timers;
let storage;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    define: {
      "import.meta.env.VITE_GRAPHQL_REQUEST_TIMEOUT_MS": "undefined",
      "import.meta.env.VITE_GRAPHQL_MAX_RETRY_COUNT": "undefined",
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  client = await server.ssrLoadModule("/src/lib/graphqlClient.ts");
  ({ authApi } = await server.ssrLoadModule("/src/api/authApi.ts"));
});

after(async () => {
  await server?.close();
});

beforeEach(() => {
  previousGlobals = new Map(
    ["window", "navigator", "fetch"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ])
  );
  fetchSteps = [];
  fetchCalls = [];
  timers = [];
  storage = new Map();
  const mockedGlobals = {
    window: {
      RouteOneRuntimeConfig: { graphqlEndpoint: "/graphql-test" },
      localStorage: {
        getItem: key => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key),
      },
      setTimeout(callback, delay) {
        const timer = { callback, delay, canceled: false, fired: false };
        timers.push(timer);
        return timer;
      },
      clearTimeout(timer) {
        timer.canceled = true;
      },
    },
    navigator: { onLine: true },
    async fetch(url, options) {
      fetchCalls.push({ url, ...options });
      const step = fetchSteps.shift();
      assert.ok(step, "예정하지 않은 fetch 호출이 발생했습니다.");
      return step(options);
    },
  };

  for (const [name, value] of Object.entries(mockedGlobals)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
});

afterEach(() => {
  for (const [name, descriptor] of previousGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
});

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("방문 기록 충돌 HTTP 409는 오류를 유지하고 자동 재전송하지 않는다", async () => {
  fetchSteps.push(() => jsonResponse({ errors: [{
    message: "방문 기록이 변경됐어요.", extensions: { code: "USER_FACING_ERROR" },
  }] }, 409));
  await assert.rejects(requestMutation(), error => {
    assert.equal(error.status, 409);
    assert.equal(error.code, "USER_FACING_ERROR");
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(fetchCalls.length, 1);
});

function successResponse() {
  return jsonResponse({ data: savedRoute });
}

function abortError() {
  return new DOMException("The operation was aborted", "AbortError");
}

function failingBodyResponse(error, status = 200) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.error(error);
      },
    }),
    { status }
  );
}

function waitForAbort(signal) {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(abortError()), { once: true });
  });
}

function abortingBodyResponse(signal) {
  return new Response(
    new ReadableStream({
      start(controller) {
        signal.addEventListener("abort", () => controller.error(abortError()), {
          once: true,
        });
      },
    })
  );
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

async function fireNextTimer(expectedDelay) {
  await flushPromises();
  const timer = timers.find((entry) => !entry.canceled && !entry.fired);
  assert.ok(timer, `실행할 ${expectedDelay}ms 타이머가 없습니다.`);
  assert.equal(timer.delay, expectedDelay);
  timer.fired = true;
  timer.callback();
  await flushPromises();
}

function requestMutation(options = saveOptions) {
  const request = client.requestGraphQL(mutation, variables, options);
  // Timer assertions may run before the request settles; keep rejected requests observed.
  void request.catch(() => undefined);
  return request;
}

function assertSameRetriedRequest() {
  assert.equal(fetchCalls.length, 2);
  assert.equal(fetchCalls[0].url, "/graphql-test");
  assert.equal(fetchCalls[0].method, "POST");
  assert.equal(fetchCalls[0].body, fetchCalls[1].body);
  assert.equal(JSON.parse(fetchCalls[1].body).variables.input.clientRequestId,
    variables.input.clientRequestId);
  assert.deepEqual(fetchCalls[0].headers, fetchCalls[1].headers);
  assert.notEqual(fetchCalls[0].signal, fetchCalls[1].signal);
}

function storeSession(token) {
  storage.set("routeone.authToken", token);
  storage.set("routeone.authSessionExpiresAt", String(Date.now() + 60_000));
}

function sessionRejectedResponse() {
  return jsonResponse({ errors: [{
    message: "다른 기기에서 로그인되어 로그아웃됐어요. 다시 로그인해 주세요.",
    extensions: { code: "UNAUTHENTICATED" },
  }] }, 401);
}

test("서버가 현재 로그인 세션을 거절하면 재시도 없이 로컬 세션도 종료한다", async () => {
  storeSession("fixture-session-a");
  fetchSteps.push(sessionRejectedResponse);
  await assert.rejects(requestMutation(), error => error.code === "UNAUTHENTICATED" && !error.retryable);
  assert.equal(storage.has("routeone.authToken"), false);
  assert.equal(storage.get("routeone.authSessionExpired"), "true");
  assert.equal(fetchCalls.length, 1);
});

test("이전 세션의 늦은 인증 거절은 새로 로그인한 세션을 종료하지 않는다", async () => {
  storeSession("fixture-session-a");
  let resolveResponse;
  fetchSteps.push(() => new Promise(resolve => { resolveResponse = resolve; }));
  const request = requestMutation();
  await flushPromises();
  storeSession("fixture-session-b");
  resolveResponse(sessionRejectedResponse());
  await assert.rejects(request, error => error.code === "UNAUTHENTICATED");
  assert.equal(storage.get("routeone.authToken"), "fixture-session-b");
  assert.equal(storage.has("routeone.authSessionExpired"), false);
});

test("명시적으로 다른 토큰을 쓴 정리 요청의 거절은 현재 세션을 종료하지 않는다", async () => {
  storeSession("fixture-session-b");
  fetchSteps.push(sessionRejectedResponse);
  await assert.rejects(requestMutation({ authToken: "fixture-session-a" }), error => error.code === "UNAUTHENTICATED");
  assert.equal(storage.get("routeone.authToken"), "fixture-session-b");
});

test("재로그인 요청은 이전 인증값 없이 보내 종료된 세션에 막히지 않는다", async () => {
  storeSession("fixture-session-a");
  fetchSteps.push(() => jsonResponse({ data: { loginWithPassword: { token: "new-session", user: { id: "fixture-user" } } } }));
  await authApi.loginWithPassword({ accountId: "fixture-user", password: "fixture-password" });
  assert.equal(fetchCalls[0].headers.Authorization, undefined);
});

for (const phase of ["headers", "body"]) {
  test(`${phase} 수신 중 timeout이면 같은 요청을 1초 뒤 한 번 재시도한다`, async () => {
    fetchSteps.push(
      ({ signal }) => phase === "headers"
        ? waitForAbort(signal)
        : abortingBodyResponse(signal),
      successResponse
    );
    const request = requestMutation();

    await fireNextTimer(30_000);
    assert.equal(fetchCalls[0].signal.aborted, true);
    await fireNextTimer(1_000);

    assert.deepEqual(await request, savedRoute);
    assertSameRetriedRequest();
    assert.deepEqual(timers.map((timer) => timer.delay), [30_000, 1_000, 30_000]);
    assert.equal(fetchCalls[1].signal.aborted, false);
  });
}

test("200 응답 body의 네트워크 TypeError도 고정 1초 뒤 재시도한다", async () => {
  fetchSteps.push(
    () => failingBodyResponse(new TypeError("terminated")),
    successResponse
  );
  const request = requestMutation();

  await fireNextTimer(1_000);

  assert.deepEqual(await request, savedRoute);
  assertSameRetriedRequest();
  assert.deepEqual(timers.map((timer) => timer.delay), [30_000, 1_000, 30_000]);
});

test("두 번째 body 읽기도 실패하면 더 재시도하지 않고 네트워크 오류를 반환한다", async () => {
  fetchSteps.push(
    () => failingBodyResponse(new TypeError("terminated")),
    () => failingBodyResponse(new TypeError("terminated"))
  );
  const rejected = assert.rejects(requestMutation(), (error) => {
    assert.equal(client.isGraphQLRequestError(error), true);
    assert.equal(error.retryable, true);
    assert.match(error.message, /네트워크 연결/);
    return true;
  });

  await fireNextTimer(1_000);
  await rejected;

  assertSameRetriedRequest();
  assert.deepEqual(timers.map((timer) => timer.delay), [30_000, 1_000, 30_000]);
  assert.equal(timers.some((timer) => !timer.canceled && !timer.fired), false);
});

test("기본 mutation은 12초 timeout 후 자동 재시도하지 않는다", async () => {
  fetchSteps.push(({ signal }) => waitForAbort(signal));
  const rejected = assert.rejects(
    client.requestGraphQL(mutation, variables),
    (error) => {
      assert.equal(error.retryable, true);
      assert.match(error.message, /응답 시간이 초과/);
      return true;
    }
  );

  await fireNextTimer(12_000);
  await rejected;

  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(timers.map((timer) => timer.delay), [12_000]);
});

test("로컬 로그아웃 뒤에도 전달받은 인증값으로 정리 요청을 보낸다", async () => {
  fetchSteps.push(successResponse);

  await client.requestGraphQL(mutation, variables, {
    authToken: "logout-cleanup-token",
  });

  assert.equal(
    fetchCalls[0].headers.Authorization,
    "Bearer logout-cleanup-token"
  );
});

test("기본 mutation은 body 네트워크 오류와 HTTP 503도 자동 재시도하지 않는다", async () => {
  for (const response of [
    () => failingBodyResponse(new TypeError("terminated")),
    () => jsonResponse({ errors: [{ message: "Unavailable" }] }, 503),
  ]) {
    fetchSteps.push(response);
    await assert.rejects(client.requestGraphQL(mutation, variables), (error) => {
      assert.equal(error.retryable, true);
      return true;
    });
  }

  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(timers.map((timer) => timer.delay), [12_000, 12_000]);
});

test("401과 403은 body 형식이나 읽기 오류와 관계없이 재시도하지 않는다", async () => {
  for (const status of [401, 403]) {
    for (const response of [
      () => jsonResponse({ errors: [{ message: "Unauthorized" }] }, status),
      () => new Response("<html>Unauthorized</html>", { status }),
      () => failingBodyResponse(abortError(), status),
      () => failingBodyResponse(new TypeError("terminated"), status),
    ]) {
      fetchSteps.push(response);
      await assert.rejects(requestMutation(), (error) => {
        assert.equal(error.retryable, false);
        assert.equal(error.status, status);
        return true;
      });
    }
  }

  assert.equal(fetchCalls.length, 8);
  assert.deepEqual(timers.map((timer) => timer.delay), Array(8).fill(30_000));
});

test("GraphQL validation 오류는 HTTP 200이나 400이어도 재시도하지 않는다", async () => {
  for (const status of [200, 400]) {
    fetchSteps.push(() => jsonResponse({
      errors: [{ message: "Invalid input", extensions: { code: "GRAPHQL_VALIDATION_FAILED" } }],
    }, status));
    await assert.rejects(requestMutation(), (error) => {
      assert.equal(error.retryable, false);
      assert.equal(error.status, status);
      assert.equal(error.code, "GRAPHQL_VALIDATION_FAILED");
      assert.equal(error.message, "Invalid input");
      return true;
    });
  }

  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(timers.map((timer) => timer.delay), [30_000, 30_000]);
});

test("HTTP 200의 잘못된 JSON은 네트워크 오류로 간주하지 않는다", async () => {
  fetchSteps.push(() => new Response("not JSON"));

  await assert.rejects(requestMutation(), (error) => {
    assert.equal(error.retryable, false);
    assert.equal(error.status, 200);
    return true;
  });

  assert.equal(fetchCalls.length, 1);
  assert.deepEqual(timers.map((timer) => timer.delay), [30_000]);
});

for (const format of ["json", "html"]) {
  test(`HTTP 503 ${format} 응답은 명시한 정책으로 한 번 재시도한다`, async () => {
    fetchSteps.push(
      () => format === "json"
        ? jsonResponse({ errors: [{ message: "Unavailable" }] }, 503)
        : new Response("<html>Unavailable</html>", { status: 503 }),
      successResponse
    );
    const request = requestMutation();

    await fireNextTimer(1_000);

    assert.deepEqual(await request, savedRoute);
    assertSameRetriedRequest();
    assert.deepEqual(timers.map((timer) => timer.delay), [30_000, 1_000, 30_000]);
  });
}

test("기본 query는 12초 timeout과 한 번의 지수 지연 재시도를 유지한다", async (context) => {
  context.mock.method(Math, "random", () => 0.5);
  fetchSteps.push(
    () => { throw new TypeError("Failed to fetch"); },
    () => jsonResponse({ data: { route: { id: "test-route" } } })
  );
  const request = client.requestGraphQL(query);
  void request.catch(() => undefined);

  await fireNextTimer(725);

  assert.deepEqual(await request, { route: { id: "test-route" } });
  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(timers.map((timer) => timer.delay), [12_000, 725, 12_000]);
});

test("고정 대기를 지정하지 않으면 재시도 횟수에 따라 지수 지연과 jitter를 적용한다", async (context) => {
  context.mock.method(Math, "random", () => 0.5);
  fetchSteps.push(
    () => { throw new TypeError("Failed to fetch"); },
    () => { throw new TypeError("Failed to fetch"); },
    successResponse
  );
  const request = requestMutation({ maxRetryCount: 2 });

  await fireNextTimer(725);
  await fireNextTimer(1_325);

  assert.deepEqual(await request, savedRoute);
  assert.equal(fetchCalls.length, 3);
  assert.deepEqual(timers.map((timer) => timer.delay), [
    12_000, 725, 12_000, 1_325, 12_000,
  ]);
});
