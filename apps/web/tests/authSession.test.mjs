import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const AUTH_TOKEN_KEY = "routeone.authToken";
const AUTH_EXPIRES_AT_KEY = "routeone.authSessionExpiresAt";

let authSession;
let authToken;
let previousGlobals;
let resolveFetch;
let server;
const nativeMessages = [];
const storage = new Map();

before(async () => {
  previousGlobals = new Map(
    ["window", "navigator", "fetch"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ])
  );
  storage.set(AUTH_TOKEN_KEY, "token-before-refresh");
  storage.set(AUTH_EXPIRES_AT_KEY, String(Date.now() + 60_000));

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      __ROUTEONE_NATIVE_AUTH_SESSION_ID__: "native-session-1",
      RouteOneRuntimeConfig: { graphqlEndpoint: "/graphql-test" },
      ReactNativeWebView: {
        postMessage(message) {
          nativeMessages.push(JSON.parse(message));
        },
      },
      localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        removeItem: (key) => storage.delete(key),
        setItem: (key, value) => storage.set(key, String(value)),
      },
      setTimeout,
      clearTimeout,
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: { onLine: true },
  });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    writable: true,
    value: () =>
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
  });

  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: {
      alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
    },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  authSession = await server.ssrLoadModule("/src/lib/authSession.ts");
  authToken = await server.ssrLoadModule("/src/lib/authToken.ts");
});

after(async () => {
  await server?.close();

  for (const [name, descriptor] of previousGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor);
    } else {
      delete globalThis[name];
    }
  }
});

test("로그아웃 뒤 늦게 끝난 세션 갱신은 이전 토큰을 되살리지 않는다", async () => {
  const refresh = authSession.refreshAuthSessionIfNeeded();

  await new Promise((resolve) => setImmediate(resolve));
  authToken.clearAuthToken("logout");
  resolveFetch(
    new Response(
      JSON.stringify({
        data: {
          refreshAuthSession: {
            token: "late-refreshed-token",
            user: { id: "user-1" },
          },
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );

  assert.equal(await refresh, "skipped");
  assert.equal(storage.has(AUTH_TOKEN_KEY), false);
  assert.deepEqual(
    nativeMessages.map(({ sessionId, token }) => ({ sessionId, token })),
    [{ sessionId: "native-session-1", token: null }]
  );
});
