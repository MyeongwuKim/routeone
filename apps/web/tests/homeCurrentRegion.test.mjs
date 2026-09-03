import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let isReliableHomeRegionPosition;
let resolveHomeRegionFromPosition;

before(async () => {
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
  ({
    isReliableHomeRegionPosition,
    resolveHomeRegionFromPosition,
  } = await server.ssrLoadModule(
    "/src/features/home/homeCurrentRegion.ts"
  ));
});

after(async () => {
  await server?.close();
});

const regions = [
  {
    label: "서쪽",
    sigunguCode: "west",
    adminCode: "1",
    center: { lat: 37.5, lng: 127 },
  },
  {
    label: "동쪽",
    sigunguCode: "east",
    adminCode: "2",
    center: { lat: 37.5, lng: 129 },
  },
];
const serviceArea = {
  id: "gangwon",
  label: "테스트",
  tourAreaCode: "1",
  tatsAreaCode: "1",
  center: { lat: 37.5, lng: 128 },
  defaultRegion: regions[0],
  regions,
  hasBoundaryAsset: true,
  hasFestivalSource: false,
};

function createPosition(overrides = {}) {
  return {
    lat: 37.5,
    lng: 128.8,
    accuracyMeters: 20,
    timestamp: Date.now(),
    ...overrides,
  };
}

test("정확도 1km 이내의 현재 위치만 지역 필터에 사용한다", () => {
  assert.equal(isReliableHomeRegionPosition(createPosition()), true);
  assert.equal(
    isReliableHomeRegionPosition(
      createPosition({ accuracyMeters: 1_001 })
    ),
    false
  );
  assert.equal(
    isReliableHomeRegionPosition(createPosition({ accuracyMeters: null })),
    false
  );
});

test("경계 정보가 없으면 현재 위치에서 가장 가까운 지역을 선택한다", () => {
  const region = resolveHomeRegionFromPosition(
    createPosition(),
    serviceArea,
    {}
  );

  assert.equal(region?.sigunguCode, "east");
});

test("지역 경계 안의 위치는 중심점 거리보다 경계 판정을 우선한다", () => {
  const region = resolveHomeRegionFromPosition(
    createPosition({ lng: 127.1 }),
    serviceArea,
    {
      east: [
        [
          [
            [127, 37.4],
            [127.2, 37.4],
            [127.2, 37.6],
            [127, 37.6],
            [127, 37.4],
          ],
        ],
      ],
    }
  );

  assert.equal(region?.sigunguCode, "east");
});
