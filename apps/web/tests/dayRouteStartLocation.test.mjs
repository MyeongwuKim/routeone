import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createServer } from "vite";

let server;
let startLocation;
let layout;
let adapters;
let travelSegments;
let DayRouteAccordionItem;
let useRouteStartLocationMutation;
let useUiToastStore;
let routeQueryKey;
let historyQueryKey;
let text;

const routeStart = { lat: 37, lng: 127 };
const secondDayStart = { lat: 38, lng: 128 };
const nextStart = { lat: 38.15, lng: 128.15 };

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  startLocation = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteStartLocation.ts");
  layout = await server.ssrLoadModule("/src/features/my-route/utils/dayRouteLayout.ts");
  adapters = await server.ssrLoadModule("/src/features/my-route/adapters/dayRouteAdapters.ts");
  travelSegments = await server.ssrLoadModule("/src/features/my-route/hooks/useDayRouteTravelSegments.ts");
  ({ default: DayRouteAccordionItem } = await server.ssrLoadModule("/src/features/my-route/components/day-route/DayRouteAccordionItem.tsx"));
  ({ useRouteStartLocationMutation } = await server.ssrLoadModule("/src/features/my-route/hooks/useRouteStartLocationMutation.ts"));
  ({ useUiToastStore } = await server.ssrLoadModule("/src/stores/uiToastStore.ts"));
  ({ MY_ROUTES_QUERY_KEY: routeQueryKey, MY_ROUTE_HISTORY_QUERY_KEY: historyQueryKey } = await server.ssrLoadModule("/src/features/my-route/myRouteCache.ts"));
  const { getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts");
  text = getUiText("ko");
});

beforeEach((t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("DAY 출발지 테스트에서 외부 요청을 실행할 수 없습니다.");
  });
});

after(async () => { await server?.close(); });

function createRoute() {
  const days = [null, secondDayStart].map((point, index) => ({
    id: `day-${index + 1}`,
    dayIndex: index + 1,
    date: `2026-09-0${index + 1}T00:00:00.000Z`,
    plannedStartMinutes: 540,
    startedAt: null,
    startLocation: point,
    stops: [1, 2].map((stopIndex) => ({
      id: `day-${index + 1}-stop-${stopIndex}`,
      order: stopIndex,
      stayMinutes: 60,
      travelMinutesFromPrevious: stopIndex === 1 ? 4 : 15,
      visitStatus: "PENDING",
      verificationStatus: "NONE",
      visitedAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      actualStayMinutes: null,
      place: {
        externalId: `place-${index + 1}-${stopIndex}`,
        contentId: `place-${index + 1}-${stopIndex}`,
        contentTypeId: "12",
        title: `DAY ${index + 1} 장소 ${stopIndex}`,
        address: "테스트 주소",
        lat: 37 + index + stopIndex * 0.01,
        lng: 127 + index,
        categoryLabel: "관광지",
        categoryName: "자연관광",
        regionCode: "1",
        regionLabelKey: "32:1",
        imageUrl: null,
      },
    })),
  }));

  return {
    id: "route-start-test",
    isMine: true,
    startLocation: routeStart,
    dailyStartMinutes: 540,
    days,
    stops: days.flatMap((day) => day.stops),
  };
}

function createTravelRequests(route, options = {}) {
  return travelSegments.createDayRouteTravelSegmentRequests({
    days: route.days,
    activeDayId: route.days[0].id,
    orderedStops: route.days[0].stops,
    routeStartLocation: route.startLocation,
    ...options,
  });
}

function renderDay(route, day, props = {}) {
  return renderToStaticMarkup(createElement(DayRouteAccordionItem, {
    routeDay: day,
    orderedStops: day.stops,
    startLocation: startLocation.getDayRouteStartLocation(day, route.startLocation),
    dailyStartMinutes: route.dailyStartMinutes,
    isExpanded: true,
    isOrderEditing: false,
    isReadOnly: false,
    canEditStartLocation: true,
    travelSegmentByKey: {},
    ...props,
  }));
}

function replaceGlobal(t, name, value) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, name, original);
    else delete globalThis[name];
  });
}

function createMutationHarness(t, route) {
  replaceGlobal(t, "window", {
    localStorage: { getItem: () => null },
    setTimeout,
    clearTimeout,
  });
  replaceGlobal(t, "navigator", { onLine: true });
  const toast = t.mock.method(useUiToastStore.getInitialState(), "showToast", () => {});
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  t.after(() => client.clear());
  const otherRoute = { ...createRoute(), id: "another-route" };
  client.setQueryData(routeQueryKey, { myRoutes: [route, otherRoute] });
  client.setQueryData(historyQueryKey, { items: [] });
  let mutation;
  function MutationProbe() {
    mutation = useRouteStartLocationMutation();
    return null;
  }
  renderToStaticMarkup(createElement(
    QueryClientProvider,
    { client },
    createElement(MutationProbe)
  ));
  return { client, mutation, toast, otherRoute };
}

function routeResponse(route) {
  return new Response(JSON.stringify({ data: { updateRouteStartLocation: route } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("DAY 출발지를 우선하고 null 또는 예전 응답의 누락 필드만 루트 출발지로 대체한다", () => {
  assert.equal(startLocation.getDayRouteStartLocation({ startLocation: secondDayStart }, routeStart), secondDayStart);
  assert.equal(startLocation.getDayRouteStartLocation({ startLocation: null }, routeStart), routeStart);
  assert.equal(startLocation.getDayRouteStartLocation({}, routeStart), routeStart);
  assert.equal(startLocation.getDayRouteStartLocation({ startLocation: null }, null), null);
  assert.deepEqual(startLocation.getDayRouteStartLocation({ startLocation: { lat: 0, lng: 0 } }, routeStart), { lat: 0, lng: 0 });
});

test("지도 변환은 각 DAY의 출발지와 기존 장소 순서를 보존한다", () => {
  const route = createRoute();
  const original = structuredClone(route);
  const planned = route.days.map((day) => adapters.createPlannedRouteDay(day, day.stops, route.startLocation));
  assert.deepEqual(planned.map((day) => day.startLocation), [routeStart, secondDayStart]);
  assert.deepEqual(planned.map((day) => day.items.map((item) => item.id)), route.days.map((day) => day.stops.map((stop) => stop.id)));
  assert.ok(planned.every((day) => day.startsFromCurrentLocation));
  const noStart = adapters.createPlannedRouteDay(route.days[0], route.days[0].stops);
  assert.equal(noStart.startLocation, null);
  assert.equal(noStart.startsFromCurrentLocation, false);
  assert.deepEqual(route, original);
});

test("첫 구간 이동시간 요청은 각 DAY 출발지에서 해당 DAY 첫 장소로 향한다", () => {
  const route = createRoute();
  const requests = createTravelRequests(route);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests.map(({ from, to }) => ({ from, to })), route.days.map((day, index) => ({
    from: index === 0 ? routeStart : secondDayStart,
    to: day.stops[0].place,
  })));
  assert.ok(requests.every((request) => request.key === travelSegments.getTravelSegmentKey(request.from, request.to)));
});

test("DAY 2 출발지와 첫 장소를 임시 변경하면 DAY 1 구간키는 그대로 유지한다", () => {
  const route = createRoute();
  const before = createTravelRequests(route);
  const secondDay = route.days[1];
  const draftStops = [...secondDay.stops].reverse();
  const after = createTravelRequests(route, {
    days: [route.days[0], { ...secondDay, startLocation: nextStart }],
    stopsByDayId: { [secondDay.id]: draftStops },
  });
  assert.deepEqual(after[0], before[0]);
  assert.deepEqual(after[1].from, nextStart);
  assert.equal(after[1].to, draftStops[0].place);
  assert.notEqual(after[1].key, before[1].key);
  assert.equal(after.some((request) => request.key === before[1].key), false);
});

test("출발지가 없는 DAY는 가짜 출발 구간 없이 장소 사이 구간만 조회한다", () => {
  const route = createRoute();
  const firstDay = { ...route.days[0], stops: route.days[0].stops.map((stop) => ({ ...stop, travelMinutesFromPrevious: null })) };
  const requests = createTravelRequests({ ...route, startLocation: null, days: [firstDay] });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].from, firstDay.stops[0].place);
  assert.equal(requests[0].to, firstDay.stops[1].place);
});

test("DAY별 출발지 draft는 다른 DAY를 유지하고 저장된 값으로 되돌리면 해당 변경만 제거한다", () => {
  const route = createRoute();
  const original = structuredClone(route);
  const firstDraft = startLocation.updateDayRouteStartLocationDraft({}, route.days[0], route.startLocation, nextStart);
  const bothDrafts = startLocation.updateDayRouteStartLocationDraft(firstDraft, route.days[1], route.startLocation, { lat: 38.2, lng: 128.2 });
  assert.deepEqual(firstDraft, { "day-1": nextStart });
  assert.deepEqual(bothDrafts["day-1"], nextStart);
  const secondOnly = startLocation.updateDayRouteStartLocationDraft(bothDrafts, route.days[0], route.startLocation, routeStart);
  assert.deepEqual(secondOnly, { "day-2": { lat: 38.2, lng: 128.2 } });
  const restored = startLocation.updateDayRouteStartLocationDraft(secondOnly, route.days[1], route.startLocation, secondDayStart);
  assert.deepEqual(restored, {});
  assert.deepEqual(route, original);
});

test("출발지만 바꿔도 일정 편집이 dirty가 되고 저장에는 변경한 DAY의 출발지만 포함한다", () => {
  const route = createRoute();
  const stopsByDayId = layout.createRouteStopsByDayId(route.days);
  const deletedDayIds = new Set();
  const draft = { "day-2": nextStart };
  const baseline = layout.createRouteLayoutSignature(route.days, stopsByDayId, deletedDayIds);
  assert.notEqual(layout.createRouteLayoutSignature(route.days, stopsByDayId, deletedDayIds, draft), baseline);
  assert.equal(layout.createRouteLayoutSignature(route.days, stopsByDayId, deletedDayIds, {}), baseline);
  const input = layout.createRouteLayoutInput({ routeId: route.id, days: route.days, stopsByDayId, deletedDayIds, startLocationsByDayId: draft });
  assert.equal(input.routeId, route.id);
  assert.equal(Object.hasOwn(input.days[0], "startLocation"), false);
  assert.deepEqual(input.days[1].startLocation, nextStart);
  assert.deepEqual(input.days.map((day) => day.stops), route.days.map((day) => day.stops.map((stop) => ({ stopId: stop.id, stayMinutes: stop.stayMinutes }))));
  assert.equal(Object.hasOwn(input, "startLocation"), false);
});

test("삭제한 DAY의 출발지 draft는 저장과 dirty 비교에서 제외하고 다른 DAY의 정렬을 보존한다", () => {
  const route = createRoute();
  const reordered = [...route.days[0].stops].reverse();
  const stopsByDayId = layout.createRouteStopsByDayId(route.days, route.days[0].id, reordered);
  const deletedDayIds = new Set([route.days[1].id]);
  const draft = { "day-2": nextStart };
  assert.equal(
    layout.createRouteLayoutSignature(route.days, stopsByDayId, deletedDayIds, draft),
    layout.createRouteLayoutSignature(route.days, stopsByDayId, deletedDayIds)
  );
  const input = layout.createRouteLayoutInput({ routeId: route.id, days: route.days, stopsByDayId, deletedDayIds, startLocationsByDayId: draft });
  assert.deepEqual(input.deletedDayIds, ["day-2"]);
  assert.deepEqual(input.days, [{ dayId: "day-1", stops: reordered.map((stop) => ({ stopId: stop.id, stayMinutes: 60 })) }]);
});

test("picker 대상은 DAY의 고유 ID와 편집 모드를 담고 출발지 없는 DAY의 첫 표시 장소로 초기화한다", () => {
  const route = createRoute();
  const options = { route, day: route.days[1], stops: route.days[1].stops, isOrderEditing: false, fallbackLocation: { lat: 36, lng: 126 } };
  assert.deepEqual(startLocation.createDayRouteStartLocationTarget(options), {
    routeId: route.id,
    dayId: "day-2",
    dayIndex: 2,
    mode: "saved",
    initialLocation: secondDayStart,
  });
  const noStartOptions = {
    ...options,
    route: { ...route, startLocation: null },
    day: route.days[0],
    stops: [...route.days[0].stops].reverse(),
    isOrderEditing: true,
  };
  const target = startLocation.createDayRouteStartLocationTarget(noStartOptions);
  assert.equal(target.dayId, "day-1");
  assert.equal(target.mode, "draft");
  assert.deepEqual(target.initialLocation, { lat: 37.02, lng: 127 });
  assert.deepEqual(startLocation.createDayRouteStartLocationTarget({ ...noStartOptions, stops: [] }).initialLocation, options.fallbackLocation);
});

test("DAY 시간표와 START 표시는 공통 출발지의 이전 구간 대신 해당 DAY 구간을 사용한다", () => {
  const route = createRoute();
  const day = { ...route.days[1], stops: [route.days[1].stops[0]] };
  const segmentByKey = {
    [travelSegments.getTravelSegmentKey(routeStart, day.stops[0].place)]: { status: "success", minutes: 4 },
    [travelSegments.getTravelSegmentKey(secondDayStart, day.stops[0].place)]: { status: "success", minutes: 23 },
  };
  const markup = renderDay(route, day, { travelSegmentByKey: segmentByKey });
  assert.ok(markup.includes(`aria-label="DAY 2 ${text.dayRoute.editStartLocationAria}"`));
  assert.ok(markup.includes(text.dayRoute.travelByCar(text.dayRoute.minutes(23))));
  assert.ok(markup.includes("09:23"));
  assert.ok(markup.includes("10:23"));
  assert.equal(markup.includes("09:04"), false);
});

test("출발지 없는 기존 DAY와 빈 DAY에도 설정 버튼이 있고 읽기 전용 화면에는 없다", () => {
  const route = { ...createRoute(), startLocation: null };
  for (const day of [route.days[0], { ...route.days[0], stops: [] }]) {
    const markup = renderDay(route, day);
    assert.ok(markup.includes(`aria-label="DAY 1 ${text.dayRoute.editStartLocationAria}"`));
    assert.ok(markup.includes(text.dayRoute.setStartLocation));
    const readOnlyMarkup = renderDay(route, day, { isReadOnly: true, canEditStartLocation: false });
    assert.equal(readOnlyMarkup.includes(text.dayRoute.editStartLocationAria), false);
  }
});

test("즉시 저장은 선택 DAY ID를 전송하고 중복 적용을 막으며 완료된 루트만 캐시에 반영한다", async (t) => {
  const route = createRoute();
  const nextRoute = { ...route, days: [route.days[0], { ...route.days[1], startLocation: nextStart }] };
  const harness = createMutationHarness(t, route);
  let finishRequest;
  const pending = new Promise((resolve) => { finishRequest = resolve; });
  const requests = [];
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return pending;
  });
  const input = { routeId: route.id, dayId: "day-2", startLocation: nextStart };
  const save = harness.mutation.updateRouteStartLocation(input, 2);
  assert.equal(await harness.mutation.updateRouteStartLocation(input, 2), false);
  await flushTasks();
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].variables, { input });
  assert.match(requests[0].query, /mutation UpdateRouteStartLocation/);
  assert.deepEqual(harness.client.getQueryData(routeQueryKey).myRoutes[0], route);
  finishRequest(routeResponse(nextRoute));
  assert.equal(await save, true);
  assert.deepEqual(harness.client.getQueryData(routeQueryKey).myRoutes, [nextRoute, harness.otherRoute]);
  assert.equal(harness.toast.mock.calls[0].arguments[0], text.dayRoute.startLocationSaved(2));
  assert.equal(harness.client.getQueryState(historyQueryKey).isInvalidated, true);
});

test("출발지 저장 실패는 기존 캐시를 유지하고 잠금을 풀어 같은 DAY를 다시 저장할 수 있다", async (t) => {
  const route = createRoute();
  const harness = createMutationHarness(t, route);
  const nextRoute = { ...route, days: [{ ...route.days[0], startLocation: nextStart }, route.days[1]] };
  const responses = [
    new Response(JSON.stringify({ errors: [{ message: "테스트 저장 실패" }] }), { status: 400 }),
    routeResponse(nextRoute),
  ];
  const request = t.mock.method(globalThis, "fetch", async () => {
    const response = responses.shift();
    assert.ok(response, "예정하지 않은 추가 저장 요청");
    return response;
  });
  const input = { routeId: route.id, dayId: "day-1", startLocation: nextStart };
  assert.equal(await harness.mutation.updateRouteStartLocation(input, 1), false);
  assert.equal(request.mock.callCount(), 1);
  assert.deepEqual(harness.client.getQueryData(routeQueryKey).myRoutes[0], route);
  assert.equal(harness.toast.mock.calls[0].arguments[0], "테스트 저장 실패");
  assert.equal(await harness.mutation.updateRouteStartLocation(input, 1), true);
  assert.equal(request.mock.callCount(), 2);
  assert.deepEqual(harness.client.getQueryData(routeQueryKey).myRoutes[0], nextRoute);
});
