import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { setImmediate as flushTasks } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import ts from "typescript";

let server;
let geometry;
const featurePath = "../src/features/my-route/";
const target = { stop: { id: "destination", place: { lat: 37.5, lng: 127.5, title: "목적지" } } };
const selected = { lat: 37.51, lng: 127.51 };
const real = { lat: 37.6, lng: 127.6 };
const messages = {
  gpsTestLocationUnavailable: "choose a location",
  gpsTestRealLocationUnavailable: "real GPS unavailable",
  gpsTestMoveFailed: "apply failed",
};

function compileHook(name) {
  return ts.transpileModule(readFileSync(new URL(`${featurePath}hooks/${name}.ts`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
const hookCode = compileHook("useGpsTestLocation");
const mapCode = compileHook("useGpsTestMap");

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  geometry = await server.ssrLoadModule("/src/features/my-route/utils/gpsTestLocation.ts");
});
after(async () => { await server?.close(); });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function result(position, active = true) {
  return { ...position, active, notificationScheduled: false };
}

// React의 저장 공간과 effect 실행만 대체하고 위치 처리 및 지도 이벤트는 실제 훅을 실행한다.
function createHookHarness(code, name, input, modules) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        slots[index] = { dependencies, callback };
      }
      return slots[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependencies.some((value, key) => !Object.is(value, previous.dependencies[key]))) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const exports = {};
  const imports = { react, ...modules };
  new Function("require", "exports", code)((specifier) => {
    assert.ok(Object.hasOwn(imports, specifier), `Unexpected import: ${specifier}`);
    return imports[specifier];
  }, exports);
  let output;
  return {
    render(patch = {}) {
      Object.assign(input, patch);
      cursor = 0;
      effects = [];
      output = exports[name](input);
      effects.forEach((effect) => effect());
      return output;
    },
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); },
  };
}

function createLocationHarness(t, overrides = {}, readPosition = async () => real) {
  const calls = [];
  const reads = [];
  const previousWindow = globalThis.window;
  globalThis.window = { setTimeout: (callback) => { queueMicrotask(callback); return 0; } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const harness = createHookHarness(hookCode, "useGpsTestLocation", {
    target,
    activeLocation: selected,
    onApply: async (_target, position, options) => { calls.push({ position, options }); return result(position); },
    onClear: async () => result(real, false),
    ...overrides,
  }, {
    "@/lib/uiText": { useUiText: () => ({ dayRoute: messages }) },
    "@/native-bridge": { nativeBridge: { location: { getCurrentPosition: (options) => { reads.push(options); return readPosition(); } } } },
    "../utils/gpsTestLocation": geometry,
  });
  t.after(() => harness.unmount());
  return { ...harness, calls, reads };
}

test("적용된 GPS가 있으면 실제 GPS 조회 없이 그 좌표에서 목적지로 이동한다", async (t) => {
  const h = createLocationHarness(t);
  const view = h.render();
  assert.equal(view.isResolving, false);
  await view.handleAutoWalk();
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.calls[0].position, selected);
  assert.ok(h.calls.length > 1);
  const final = h.render();
  const remaining = geometry.createAutoWalkSteps(final.location, target.stop.place)[0].distanceMeters;
  assert.ok(remaining < 31);
  assert.equal(final.operation, null);
});

test("다시 연 지도는 네이티브에 유지된 가상 GPS를 읽는다", async (t) => {
  const h = createLocationHarness(t, { activeLocation: null }, async () => selected);
  h.render();
  await flushTasks();
  assert.deepEqual(h.reads, [{ forceRefresh: true }]);
  assert.deepEqual(h.render().location, selected);
  await h.render().handleAutoWalk();
  assert.deepEqual(h.calls[0].position, selected);
});

test("마커 이동은 즉시 적용하고 연속 입력 중 마지막 좌표를 놓치지 않는다", async (t) => {
  const first = deferred();
  const applied = [];
  const middle = { lat: 37.52, lng: 127.52 };
  const last = { lat: 37.53, lng: 127.53 };
  const h = createLocationHarness(t, {
    onApply: async (_target, position) => {
      applied.push(position);
      return applied.length === 1 ? first.promise : result(position);
    },
  });
  const moving = h.render().handleSelectLocation(real);
  assert.deepEqual(applied, [real]);
  await h.render().handleSelectLocation(middle);
  await h.render().handleSelectLocation(last);
  assert.deepEqual(h.render().location, last);
  first.resolve(result(real));
  await moving;
  assert.deepEqual(applied, [real, last]);
  assert.deepEqual(h.render().location, last);
  await h.render().handleAutoWalk();
  assert.deepEqual(applied[2], last);
});

test("최초 GPS 응답이 늦어도 새로 지정한 위치를 덮지 않는다", async (t) => {
  const initial = deferred();
  const h = createLocationHarness(t, { activeLocation: null }, () => initial.promise);
  const view = h.render();
  await view.handleSelectLocation(selected);
  initial.resolve(real);
  await flushTasks();
  assert.deepEqual(h.render().location, selected);
  assert.equal(h.render().isResolving, false);
});

test("복귀는 실제 GPS를 바로 표시하며 다음 출발도 복귀한 좌표를 쓴다", async (t) => {
  const h = createLocationHarness(t);
  await h.render().handleRestoreLocation();
  assert.deepEqual(h.render().location, real);
  assert.equal(h.calls.length, 0);
  await h.render().handleAutoWalk();
  assert.deepEqual(h.calls[0].position, real);
});

test("복귀 실패 시 이전 가상 좌표를 실제 GPS로 표시하지 않는다", async (t) => {
  const h = createLocationHarness(t, { onClear: async () => null });
  await h.render().handleRestoreLocation();
  assert.equal(h.render().location, null);
  assert.equal(h.render().error, messages.gpsTestRealLocationUnavailable);
  await h.render().handleAutoWalk();
  assert.equal(h.calls.length, 0);
  await h.render().handleSelectLocation(selected);
  assert.deepEqual(h.render().location, selected);
  assert.equal(h.render().error, null);
});

test("GPS 조회에 실패해도 지도에서 지정하면 출발할 수 있다", async (t) => {
  const h = createLocationHarness(t, { activeLocation: null }, async () => { throw new Error("GPS unavailable"); });
  h.render();
  await flushTasks();
  assert.equal(h.render().isResolving, false);
  await h.render().handleSelectLocation(selected);
  assert.equal(h.render().error, null);
  await h.render().handleAutoWalk();
  assert.deepEqual(h.calls[1].position, selected);
});

test("적용 실패 시 마지막으로 적용된 좌표를 유지한다", async (t) => {
  const h = createLocationHarness(t, { onApply: async () => null });
  await h.render().handleSelectLocation(real);
  assert.deepEqual(h.render().location, selected);
  assert.equal(h.render().error, messages.gpsTestMoveFailed);
});

test("화면이 닫히면 대기 중인 추가 위치 변경을 실행하지 않는다", async (t) => {
  const pending = deferred();
  const calls = [];
  const h = createLocationHarness(t, {
    onApply: async (_target, position) => { calls.push(position); return pending.promise; },
  });
  const moving = h.render().handleSelectLocation(real);
  await h.render().handleSelectLocation(selected);
  h.unmount();
  pending.resolve(result(real));
  await moving;
  assert.deepEqual(calls, [real]);
});

test("지도 클릭·마커 이동은 최신 선택 핸들러로 전달하고 복귀 좌표를 같은 지도에 반영한다", (t) => {
  const listeners = [];
  const markers = [];
  const pans = [];
  class LatLng {
    constructor(lat, lng) { this.latitude = lat; this.longitude = lng; }
    lat() { return this.latitude; }
    lng() { return this.longitude; }
  }
  class Marker {
    constructor(options) { Object.assign(this, options); markers.push(this); }
    getPosition() { return this.position; }
    setPosition(position) { this.position = position; }
    setMap(map) { this.map = map; }
    setDraggable(draggable) { this.draggable = draggable; }
  }
  const naverMaps = {
    LatLng, Marker,
    Point: class {},
    LatLngBounds: class { extend() {} },
    Circle: class { setMap() {} },
    Event: {
      addListener: (target, event, handler) => { const listener = { target, event, handler }; listeners.push(listener); return listener; },
      removeListener: () => {}, trigger: () => {},
    },
  };
  const previousWindow = globalThis.window;
  globalThis.window = {
    naver: { maps: naverMaps }, requestAnimationFrame: () => 0, setTimeout: () => 0,
    cancelAnimationFrame: () => {}, clearTimeout: () => {},
  };
  t.after(() => { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; });
  const choices = [];
  const map = { panTo: (position) => pans.push(position), fitBounds: () => {} };
  const h = createHookHarness(mapCode, "useGpsTestMap", {
    placeLocation: target.stop.place, location: selected,
    verificationPolicy: { notificationRadiusMeters: 300, verificationRadiusMeters: 100 },
    disabled: false, onSelect: () => { throw new Error("Stale selection handler"); },
  }, { "../utils/gpsTestLocation": geometry });
  const cleanup = h.render()({ map, naverMaps });
  h.render({ onSelect: (position) => choices.push(position) });
  const marker = markers[1];
  marker.setPosition(new LatLng(real.lat, real.lng));
  listeners.find((listener) => listener.event === "dragend").handler();
  listeners.find((listener) => listener.event === "click").handler({ coord: new LatLng(selected.lat, selected.lng) });
  assert.deepEqual(choices, [real, selected]);
  h.render({ location: real });
  assert.equal(markers.length, 2);
  assert.equal(marker.getPosition().lat(), real.lat);
  assert.equal(pans.at(-1).lng(), real.lng);
  h.render({ disabled: true });
  listeners.find((listener) => listener.event === "click").handler({ coord: new LatLng(0, 0) });
  assert.equal(choices.length, 2);
  assert.equal(marker.draggable, false);
  h.render({ location: null });
  assert.equal(marker.map, null);
  cleanup();
  h.unmount();
});
