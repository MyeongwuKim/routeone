const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function compileTypeScript(relativePath) {
  const compiled = ts.transpileModule(
    readFileSync(path.join(__dirname, relativePath), "utf8"),
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
    compiled.diagnostics.length,
    0,
    compiled.diagnostics
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      )
      .join("\n")
  );

  return compiled.outputText;
}

const cleanupCode = compileTypeScript(
  "../src/auth/nativeSessionCleanup.ts"
);
const authStorageCode = compileTypeScript(
  "../src/auth/nativeAuthStorage.ts"
);
const CLEANUP_KEY = "routeone:native-session-cleanup-pending:v1";
const AUTH_TOKEN_KEY = "routeone:native-auth-token:v1";
const AUTH_EXPIRES_AT_KEY = "routeone:native-auth-expires-at:v1";
const AUTH_ROLE_KEY = "routeone:native-auth-role:v1";

function createCleanupHarness() {
  const storage = new Map();
  const events = [];
  const state = {
    routeCleanupError: null,
  };
  const exports = {};

  vm.runInNewContext(cleanupCode, {
    exports,
    require: (specifier) => {
      if (specifier === "@/auth/nativeAuthStorage") {
        return {
          clearNativeSessionCleanupPending: async () => {
            events.push(`remove:${CLEANUP_KEY}`);
            storage.delete(CLEANUP_KEY);
          },
          clearStoredNativeAuthToken: async () => {
            events.push("clear-auth");
          },
          isNativeSessionCleanupPending: async () =>
            storage.get(CLEANUP_KEY) === "pending",
          markNativeSessionCleanupPending: async () => {
            events.push(`set:${CLEANUP_KEY}`);
            storage.set(CLEANUP_KEY, "pending");
          },
        };
      }
      if (
        specifier ===
        "@/webview/bridge/routeArrivalNotificationBridge"
      ) {
        return {
          clearNativeRouteArrivalNotificationsForSession: async () => {
            events.push("clear-route-targets");
            if (state.routeCleanupError) {
              throw state.routeCleanupError;
            }
          },
        };
      }

      throw new Error(`Unexpected module: ${specifier}`);
    },
  });

  return { events, exports, state, storage };
}

test("유효한 세션이고 미완료 표식이 없으면 위치 감시를 유지한다", async () => {
  const harness = createCleanupHarness();

  assert.equal(
    await harness.exports.reconcileNativeSessionCleanup(true),
    false
  );
  assert.deepEqual(harness.events, []);
});

test("세션 정리는 표식·위치 감시·인증·표식 순서로 처리한다", async () => {
  const harness = createCleanupHarness();

  await harness.exports.clearNativeSessionForAccountChange();

  assert.deepEqual(harness.events, [
    `set:${CLEANUP_KEY}`,
    "clear-route-targets",
    "clear-auth",
    `remove:${CLEANUP_KEY}`,
  ]);
  assert.equal(harness.storage.has(CLEANUP_KEY), false);
});

test("위치 감시 해제 도중 실패하면 표식을 남기고 다음 부팅에서 재시도한다", async () => {
  const harness = createCleanupHarness();
  harness.state.routeCleanupError = new Error("clear failed");

  await assert.rejects(
    harness.exports.clearNativeSessionForAccountChange(),
    /clear failed/
  );
  assert.equal(harness.storage.get(CLEANUP_KEY), "pending");
  assert.equal(harness.events.includes("clear-auth"), false);

  harness.state.routeCleanupError = null;
  harness.events.length = 0;

  assert.equal(
    await harness.exports.reconcileNativeSessionCleanup(true),
    true
  );
  assert.deepEqual(harness.events, [
    `set:${CLEANUP_KEY}`,
    "clear-route-targets",
    "clear-auth",
    `remove:${CLEANUP_KEY}`,
  ]);
});

test("만료 세션 조회는 부팅 정리가 끝나기 전에 인증값을 먼저 지우지 않는다", async () => {
  const storage = new Map([
    [AUTH_TOKEN_KEY, "expired-token"],
    [AUTH_EXPIRES_AT_KEY, "1"],
    [AUTH_ROLE_KEY, "USER"],
  ]);
  const removeEvents = [];
  const exports = {};

  vm.runInNewContext(authStorageCode, {
    exports,
    require: (specifier) => {
      assert.equal(
        specifier,
        "@react-native-async-storage/async-storage"
      );
      return {
        __esModule: true,
        default: {
          getItem: async (key) => storage.get(key) ?? null,
          setItem: async (key, value) => storage.set(key, value),
          removeItem: async (key) => {
            removeEvents.push(key);
            storage.delete(key);
          },
        },
      };
    },
    Date,
  });

  assert.deepEqual(
    JSON.parse(
      JSON.stringify(await exports.readStoredNativeAuthSession())
    ),
    {
      token: null,
      expiresAt: null,
      expired: true,
      role: null,
      sessionId: null,
    }
  );
  assert.equal(storage.get(AUTH_TOKEN_KEY), "expired-token");
  assert.deepEqual(removeEvents, []);
});
