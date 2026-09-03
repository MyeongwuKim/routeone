import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let previousNavigator;
let positionResult;
let server;
let useCurrentPositionStore;

before(async () => {
  previousNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator"
  );
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    writable: true,
    value: {
      geolocation: {
        getCurrentPosition(resolve, reject) {
          if (positionResult instanceof Error) {
            reject(positionResult);
            return;
          }

          resolve({
            coords: {
              latitude: positionResult.lat,
              longitude: positionResult.lng,
              accuracy: positionResult.accuracyMeters,
            },
            timestamp: positionResult.timestamp,
          });
        },
      },
    },
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
  ({ useCurrentPositionStore } = await server.ssrLoadModule(
    "/src/stores/currentPositionStore.ts"
  ));
});

after(async () => {
  await server?.close();

  if (previousNavigator) {
    Object.defineProperty(globalThis, "navigator", previousNavigator);
  } else {
    delete globalThis.navigator;
  }
});

test("GPS 재요청 실패 시 마지막으로 확인한 위치를 유지한다", async () => {
  const previousPosition = {
    lat: 37.5,
    lng: 127.5,
    accuracyMeters: 20,
    timestamp: Date.now() - 60_000,
  };
  useCurrentPositionStore.getState().applyPosition(previousPosition);
  positionResult = new Error("temporary GPS failure");

  await assert.rejects(
    useCurrentPositionStore
      .getState()
      .requestCurrentPosition({ forceRefresh: true }),
    /현재 위치를 확인하지 못했어요/
  );

  const state = useCurrentPositionStore.getState();
  assert.equal(state.status, "error");
  assert.equal(state.error, "현재 위치를 확인하지 못했어요.");
  assert.deepEqual(state.position, previousPosition);
});

test("테스트 위치를 해제하면 캐시를 비우고 실제 GPS를 다시 조회한다", async () => {
  const virtualPosition = {
    lat: 37.1,
    lng: 127.1,
    accuracyMeters: 1,
    timestamp: Date.now(),
  };
  const realPosition = {
    lat: 37.5,
    lng: 126.9,
    accuracyMeters: 18,
    timestamp: Date.now() + 1,
  };
  const store = useCurrentPositionStore.getState();

  store.applyPosition(virtualPosition);
  store.clearPosition();
  positionResult = realPosition;

  assert.equal(useCurrentPositionStore.getState().position, null);
  assert.deepEqual(
    await useCurrentPositionStore
      .getState()
      .requestCurrentPosition({ forceRefresh: true }),
    realPosition
  );
  assert.deepEqual(useCurrentPositionStore.getState().position, realPosition);
});
