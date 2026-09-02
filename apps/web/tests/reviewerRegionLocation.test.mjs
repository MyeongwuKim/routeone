import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let previousWindow;
let runtime;
let locationBridge;
let server;
let receivedOptions;

before(async () => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      RouteOneRuntimeConfig: { testAccountMode: true },
      RouteOneNative: {
        setRouteArrivalTestLocation(options) {
          receivedOptions = options;
          return Promise.resolve({
            active: options.position !== null,
            stopId: null,
            lat: options.position?.lat ?? null,
            lng: options.position?.lng ?? null,
            distanceMeters: null,
            withinRadius: null,
            notificationScheduled: false,
            backgroundNotificationStatus: null,
          });
        },
      },
    },
  });

  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  runtime = await server.ssrLoadModule("/src/native-bridge/runtime.ts");
  locationBridge = await server.ssrLoadModule("/src/native-bridge/location.ts");
});

after(async () => {
  await server?.close();

  if (previousWindow) {
    Object.defineProperty(globalThis, "window", previousWindow);
  } else {
    delete globalThis.window;
  }
});

test("네이티브가 허용한 테스트 기능 모드만 활성화한다", () => {
  assert.equal(runtime.isNativeTestAccountMode(), true);
  window.RouteOneRuntimeConfig.testAccountMode = false;
  assert.equal(runtime.isNativeTestAccountMode(), false);
  window.RouteOneRuntimeConfig.testAccountMode = true;
});

test("지역 중심 좌표를 알림 장소 없이 네이티브 테스트 위치로 전달한다", async () => {
  const position = { lat: 37.8813, lng: 127.7298 };
  const result = await locationBridge.setNativeTestPosition({
    position,
    language: "ko",
  });

  assert.equal(receivedOptions.place, null);
  assert.equal(receivedOptions.position, position);
  assert.equal(receivedOptions.language, "ko");
  assert.equal(result.active, true);
  assert.equal(result.lat, position.lat);
  assert.equal(result.lng, position.lng);
});
