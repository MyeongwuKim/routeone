const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const bridgePath = path.join(
  __dirname,
  "../src/webview/bridge/authTokenBridge.ts"
);
const compiledBridge = ts.transpileModule(
  readFileSync(bridgePath, "utf8"),
  {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }
);

assert.equal(
  compiledBridge.diagnostics.length,
  0,
  compiledBridge.diagnostics
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    )
    .join("\n")
);

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function createHarness() {
  const state = {
    cleanupPending: false,
    events: [],
    onStore: null,
    session: {
      token: "token-a",
      expiresAt: Date.now() + 60_000,
      expired: false,
      role: "USER",
      sessionId: "session-a",
    },
  };
  let operationQueue = Promise.resolve();
  const exports = {};

  vm.runInNewContext(compiledBridge.outputText, {
    exports,
    require: (specifier) => {
      if (specifier === "@/auth/nativeAuthStorage") {
        return {
          enqueueNativeAuthSessionOperation: (operation) => {
            const request = operationQueue.then(operation);
            operationQueue = request.then(
              () => undefined,
              () => undefined
            );
            return request;
          },
          isNativeSessionCleanupPending: async () =>
            state.cleanupPending,
          NATIVE_AUTH_SESSION_DURATION_MS: 60_000,
          readStoredNativeAuthSession: async () => ({
            ...state.session,
          }),
          storeNativeAuthToken: async (
            token,
            expiresAt,
            role,
            sessionId
          ) => {
            state.events.push(`store:${sessionId}`);
            await state.onStore?.();
            state.session = {
              token,
              expiresAt,
              expired: false,
              role,
              sessionId,
            };
          },
        };
      }
      if (specifier === "@/auth/nativeSessionCleanup") {
        return {
          clearNativeSessionForAccountChange: async () => {
            state.events.push("cleanup");
            state.session = {
              token: null,
              expiresAt: null,
              expired: false,
              role: null,
              sessionId: null,
            };
          },
        };
      }
      if (specifier === "./locationBridge") {
        return {
          setNativeRouteArrivalTestPosition: () =>
            state.events.push("reset-test-position"),
        };
      }
      if (specifier === "./routeArrivalNotificationBridge") {
        return {
          resetNativeRouteArrivalTestState: () =>
            state.events.push("reset-test-state"),
        };
      }

      throw new Error(`Unexpected module: ${specifier}`);
    },
    Date,
  });

  const send = (message) =>
    exports.handleNativeAuthTokenMessage({
      type: "routeone:native-auth-token",
      sessionId: "session-a",
      ...message,
    });

  return { send, state };
}

test("현재 세션의 토큰 갱신만 같은 세션 ID로 저장한다", async () => {
  const harness = createHarness();

  const result = await harness.send({
    token: "token-a-refreshed",
    expiresAt: Date.now() + 120_000,
  });

  assert.equal(result.sessionId, "session-a");
  assert.equal(harness.state.session.token, "token-a-refreshed");
  assert.deepEqual(harness.state.events, ["store:session-a"]);
});

test("정리 중이거나 세션 ID가 다른 토큰 갱신을 거절한다", async () => {
  const pending = createHarness();
  pending.state.cleanupPending = true;

  await assert.rejects(
    pending.send({ token: "late-token" }),
    /Inactive native auth session/
  );
  assert.deepEqual(pending.state.events, []);

  const stale = createHarness();

  await assert.rejects(
    stale.send({ sessionId: "session-old", token: "late-token" }),
    /Stale native auth session/
  );
  assert.deepEqual(stale.state.events, []);
});

test("토큰 갱신 뒤 로그아웃이 겹쳐도 직렬화해 최종 세션을 제거한다", async () => {
  const harness = createHarness();
  const storeStarted = createDeferred();
  const releaseStore = createDeferred();
  harness.state.onStore = async () => {
    storeStarted.resolve();
    await releaseStore.promise;
  };

  const refresh = harness.send({ token: "token-a-refreshed" });
  await storeStarted.promise;
  const logout = harness.send({ token: null, reason: "logout" });

  releaseStore.resolve();
  await refresh;
  await logout;

  assert.equal(harness.state.session.token, null);
  assert.deepEqual(harness.state.events, [
    "store:session-a",
    "cleanup",
    "reset-test-position",
    "reset-test-state",
  ]);
});

test("로그아웃 뒤 늦게 도착한 토큰 갱신은 세션을 되살리지 않는다", async () => {
  const harness = createHarness();
  const logout = harness.send({ token: null, reason: "logout" });
  const lateRefresh = harness.send({ token: "late-token" });

  await logout;
  await assert.rejects(lateRefresh, /Stale native auth session/);

  assert.equal(harness.state.session.token, null);
  assert.equal(
    harness.state.events.some((event) => event.startsWith("store:")),
    false
  );
});
