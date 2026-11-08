import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToString } from "react-dom/server";

let server;
let buildWalkingGraph;
let calculateWalkingRoute;
let createWalkingDataPack;
let isWalkableOsmWay;
let fetchWalkingRoute;
const bounds = { south: 37.7, west: 128.8, north: 37.9, east: 129.0 };
const point = (lat, lng) => ({ lat, lng });
const asPoint = ([lat, lng]) => point(lat, lng);
const pack = (nodes, segments) => ({
  version: 1, regionId: "test", regionLabel: "테스트", bounds,
  downloadedAt: "2026-11-05T00:00:00Z", sourceTimestamp: "2026-11-05T00:00:00Z",
  attribution: "© OpenStreetMap contributors", license: "ODbL-1.0", nodes, segments,
});
const isCode = code => error => error.code === code;
const route = (data, start = asPoint(data.nodes[0]), goal = asPoint(data.nodes.at(-1))) =>
  calculateWalkingRoute(buildWalkingGraph(data), start, goal);

before(async () => {
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ buildWalkingGraph, calculateWalkingRoute } = await server.ssrLoadModule("/src/features/walking/walkingRouter.ts"));
  ({ createWalkingDataPack, isWalkableOsmWay } = await server.ssrLoadModule("/src/features/walking/osmWalkingData.ts"));
  ({ fetchWalkingRoute } = await server.ssrLoadModule("/src/features/walking/walkingDirections.ts"));
});
after(async () => { await server?.close(); });

test("직선이 아닌 연결된 보행로를 따라 우회하고 구간별 거리로 시간을 계산한다", () => {
  const data = pack([[37.75,128.9],[37.751,128.9],[37.751,128.901],[37.75,128.901]], [[0,1,0,0],[1,2,0,0],[2,3,0,0]]);
  const result = route(data);
  assert.ok(result.distanceM > 300);
  assert.ok(result.path.some(p => p.lat === 37.751));
  assert.ok(Math.abs(result.durationMs / 1000 - result.distanceM / (4000/3600)) < 1);
});

test("길 한가운데서 출발·도착하면 같은 선분의 부분 거리만 계산한다", () => {
  const data = pack([[37.75,128.9],[37.75,128.91]], [[0,1,0,0]]);
  const result = route(data, point(37.75,128.903), point(37.75,128.907));
  assert.ok(result.distanceM > 345 && result.distanceM < 360);
  assert.equal(result.path.length, 2);
  assert.deepEqual(result.path[0], point(37.75,128.903));
  assert.deepEqual(result.path.at(-1), point(37.75,128.907));
});

test("같은 위치면 거리와 시간이 0이며 경로를 부풀리지 않는다", () => {
  const data = pack([[37.75,128.9],[37.75,128.91]], [[0,1,0,0]]);
  const result = route(data, point(37.75,128.905), point(37.75,128.905));
  assert.equal(result.distanceM, 0);
  assert.equal(result.durationMs, 0);
});

test("서로 다른 선분의 끝점을 공유하는 지점도 연결할 수 있다", () => {
  const data = pack([[37.75,128.9],[37.75,128.901],[37.751,128.901]], [[0,1,0,0],[1,2,0,0]]);
  const result = route(data, point(37.75,128.901), point(37.751,128.901));
  assert.ok(result.distanceM > 100 && result.distanceM < 120);
});

test("뒤집은 출발·도착에서도 양방향 길의 거리와 시간이 같다", () => {
  const data = pack([[37.75,128.9],[37.751,128.9],[37.751,128.901]], [[0,1,0,0],[1,2,0,0]]);
  const forward = route(data);
  const backward = route(data, asPoint(data.nodes.at(-1)), asPoint(data.nodes[0]));
  assert.equal(forward.distanceM, backward.distanceM);
  assert.equal(forward.durationMs, backward.durationMs);
});

test("입체교차나 선의 교차만으로 연결되지 않은 길을 이어 붙이지 않는다", () => {
  const data = pack([[37.75,128.9],[37.75,128.902],[37.749,128.901],[37.751,128.901]], [[0,1,0,0],[2,3,0,0]]);
  assert.throws(() => route(data), isCode("NO_ROUTE"));
});

test("보행자 일방통행은 정방향만 허용하고 자동차 경로로 대신하지 않는다", () => {
  const data = pack([[37.75,128.9],[37.75,128.91]], [[0,1,0,1]]);
  assert.ok(route(data).distanceM > 0);
  assert.throws(() => route(data, point(37.75,128.908), point(37.75,128.902)), isCode("NO_ROUTE"));
  const reverseOnly = pack(data.nodes, [[0,1,0,-1]]);
  assert.throws(() => route(reverseOnly), isCode("NO_ROUTE"));
  assert.ok(route(reverseOnly, asPoint(data.nodes[1]), asPoint(data.nodes[0])).distanceM > 0);
});

test("계단 구간의 예상 속도를 줄이고 일반 길과 구분한다", () => {
  const nodes = [[37.75,128.9],[37.75,128.901]];
  const normal = route(pack(nodes, [[0,1,0,0]]));
  const steps = route(pack(nodes, [[0,1,1,0]]));
  assert.equal(steps.distanceM, normal.distanceM);
  assert.ok(Math.abs(steps.durationMs - normal.durationMs * 2) <= 1);
  assert.equal(steps.stepsDistanceM, steps.distanceM);
});

test("계단 지름길보다 예상 시간이 짧은 일반 길이 있으면 우회 경로를 고른다", () => {
  const data = pack([[37.75,128.9],[37.75,128.902],[37.7504,128.901]], [[0,1,1,0],[0,2,0,0],[2,1,0,0]]);
  const result = route(data, asPoint(data.nodes[0]), asPoint(data.nodes[1]));
  assert.ok(result.path.some(p => p.lat === 37.7504));
  assert.equal(result.stepsDistanceM, 0);
});

test("지도점에서 보행로까지의 미확인 접근 거리는 경로 합계에 넣지 않는다", () => {
  const data = pack([[37.75,128.9],[37.75,128.91]], [[0,1,0,0]]);
  const base = route(data, point(37.75,128.902), point(37.75,128.908));
  const offset = route(data, point(37.7502,128.902), point(37.7502,128.908));
  assert.equal(offset.distanceM, base.distanceM);
  assert.ok(offset.startAccessDistanceM >= 20);
  assert.ok(offset.goalAccessDistanceM >= 20);
  assert.equal(offset.path[0].lat, 37.75);
});

test("60m 넘게 떨어진 길로 스냅하거나 데이터 밖의 점을 계산하지 않는다", () => {
  const data = pack([[37.75,128.9],[37.75,128.91]], [[0,1,0,0]]);
  assert.throws(() => route(data, point(37.752,128.902), point(37.75,128.908)), isCode("NO_NEARBY_PATH"));
  assert.throws(() => route(data, point(37.6,128.9)), isCode("OUTSIDE_COVERAGE"));
  assert.throws(() => route(data, point(NaN,128.9)), isCode("INVALID_INPUT"));
});

test("손상된 그래프와 없는 노드 번호를 거부한다", () => {
  assert.throws(() => buildWalkingGraph(pack([],[])), isCode("DATA_UNAVAILABLE"));
  assert.throws(() => buildWalkingGraph(pack([[37.75,128.9]],[[0,5,0,0]])), isCode("DATA_UNAVAILABLE"));
  assert.throws(() => buildWalkingGraph(pack([[NaN,128.9]],[[0,0,0,0]])), isCode("DATA_UNAVAILABLE"));
});

test("보행 금지·사유지·자동차 전용·조건부 통행·어려운 등산로를 제외한다", () => {
  for (const tags of [
    { highway:"motorway" }, { highway:"trunk" }, { highway:"construction" },
    { highway:"residential", foot:"no" }, { highway:"footway", access:"private" },
    { highway:"primary", motorroad:"yes" }, { highway:"footway", "foot:conditional":"no @ (night)" },
    { highway:"path", sac_scale:"alpine_hiking" },
  ]) assert.equal(isWalkableOsmWay(tags), false, JSON.stringify(tags));
  assert.equal(isWalkableOsmWay({ highway:"footway" }), true);
  assert.equal(isWalkableOsmWay({ highway:"residential", access:"private", foot:"yes" }), true);
  assert.equal(isWalkableOsmWay({ highway:"residential", oneway:"yes" }), true);
});

test("누락 노드·잠긴 장벽 양쪽을 생략해 새로운 길을 만들지 않는다", () => {
  const input = { elements: [
    { type:"node", id:1, lat:37.75, lon:128.9 },
    { type:"node", id:2, lat:37.75, lon:128.901, tags:{ barrier:"gate", locked:"yes", foot:"yes" } },
    { type:"node", id:3, lat:37.75, lon:128.902 },
    { type:"way", id:10, nodes:[1,2,3], tags:{ highway:"footway" } },
    { type:"way", id:11, nodes:[1,999,3], tags:{ highway:"footway" } },
  ] };
  const data = createWalkingDataPack(input, { regionId:"test", regionLabel:"test", bounds, downloadedAt:"2026-11-05" });
  assert.equal(data.segments.length, 0);
});

test("자동차 일방통행과 보행자 방향 태그를 구분해 가져온다", () => {
  const input = { elements: [
    { type:"node", id:1, lat:37.75, lon:128.9 },
    { type:"node", id:2, lat:37.75, lon:128.901 },
    { type:"way", id:10, nodes:[1,2], tags:{ highway:"residential", oneway:"yes" } },
  ] };
  const options = { regionId:"test", regionLabel:"test", bounds, downloadedAt:"2026-11-05" };
  assert.equal(createWalkingDataPack(input, options).segments[0][3], 0);
  input.elements.at(-1).tags["oneway:foot"] = "-1";
  assert.equal(createWalkingDataPack(input, options).segments[0][3], -1);
});

test("지원 밖 좌표와 이미 취소된 요청은 Worker나 다운로드 전에 거부한다", async () => {
  await assert.rejects(fetchWalkingRoute({ start:point(37.5,127), goal:point(37.75,128.9) }), isCode("OUTSIDE_COVERAGE"));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchWalkingRoute({ start:point(37.75,128.9), goal:point(37.75,128.901), signal:controller.signal }), error => error.name === "AbortError");
});

test("라우터 밖의 전역 장소 상세에서도 도보 모드가 렌더링된다", async () => {
  const { default: PlaceDirectionsSection } = await server.ssrLoadModule("/src/features/place-sheet/components/PlaceDirectionsSection.tsx");
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  const origin = { coordinates:point(37.75,128.9), label:"강릉", isCurrentLocation:false };
  const props = {
    appLanguage:"ko", routeMode:"walking", onRouteModeChange:() => {}, onOriginChange:() => {}, walkingRoute:null,
    currentLocation:origin.coordinates, directionOrigin:origin,
    isCurrentLocationLookupPending:false, isDarkMode:false, isRouteLoading:false,
    routeDistanceText:null, routeDurationText:null, routeError:"테스트 오류", routePathPoints:[],
    selectedPlace:{ id:"test", contentId:"test", contentTypeId:"12", title:"테스트 장소", address:"강릉", lat:37.76, lng:128.91 },
    text:getUiText("ko"),
  };
  const html = renderToString(createElement(PlaceDirectionsSection, props));
  assert.ok(html.includes("도보"));
  assert.ok(html.includes("테스트 오류"));
  assert.ok(html.includes("OpenStreetMap"));
  assert.ok(html.includes("출발지 변경"));
  const result = route(pack([[37.75,128.9],[37.75,128.901]],[[0,1,0,0]]));
  const duration = `${Math.ceil(result.durationMs/60_000)}분`;
  const successHtml = renderToString(createElement(PlaceDirectionsSection, {
    ...props, routeError:null, routeDistanceText:`${result.distanceM} m`, routeDurationText:duration,
    walkingRoute:result, routePathPoints:result.path,
  }));
  assert.ok(successHtml.includes(`도보 ${duration}`));
  assert.equal(successHtml.includes(`차로 ${duration}`), false);
});

test("배포할 실제 강릉 데이터에서 예시 두 구간의 경로·거리·시간을 계산한다", async () => {
  const data = JSON.parse(await readFile(new URL("../public/walking-data/gangneung.json", import.meta.url), "utf8"));
  const examples = [
    { id:"station", start:point(37.7637,128.8995), goal:point(37.7536,128.9000) },
    { id:"lake", start:point(37.7951,128.8966), goal:point(37.8045,128.9080) },
  ];
  const graph = buildWalkingGraph(data);
  assert.ok(graph.points.length > 1000);
  for (const example of examples) {
    const result = calculateWalkingRoute(graph, example.start, example.goal);
    assert.ok(result.path.length > 5, example.id);
    assert.ok(result.distanceM > 500 && result.distanceM < 10_000, example.id);
    assert.ok(result.durationMs > 300_000 && result.durationMs < 10_000_000, example.id);
    assert.ok(result.startAccessDistanceM <= 60 && result.goalAccessDistanceM <= 60);
  }
});
