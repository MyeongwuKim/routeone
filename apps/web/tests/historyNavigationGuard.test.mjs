import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let guard;
let previousWindow;
let browser;
let routerEvents = 0;
const movements = [];

before(async () => {
  previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  browser = Object.assign(new EventTarget(), {
    history: { state: { idx: 5 }, go: (delta) => movements.push(delta) },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: browser });
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  guard = await server.ssrLoadModule("/src/lib/historyNavigationGuard.ts");
  guard.installHistoryNavigationGuard();
  // 실제 BrowserRouter처럼 이동 보호를 설치한 뒤 라우터 리스너를 등록한다.
  browser.addEventListener("popstate", () => { routerEvents += 1; });
});

beforeEach(() => {
  browser.history.state = { idx: 5 };
  movements.length = 0;
  routerEvents = 0;
});

after(async () => {
  await server?.close();
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else delete globalThis.window;
});

function navigate(index) {
  browser.history.state = { idx: index };
  browser.dispatchEvent(new Event("popstate"));
}

test("잠금이 없을 때 라우터의 이동 처리를 유지한다", () => {
  navigate(4);
  assert.equal(routerEvents, 1);
  assert.deepEqual(movements, []);
});

test("저장 중 뒤로가기는 라우터에 전달하지 않고 진입 위치로 되돌린다", () => {
  const unlock = guard.lockHistoryNavigation();
  try {
    guard.installHistoryNavigationGuard();
    navigate(2);
    assert.equal(routerEvents, 0);
    assert.deepEqual(movements, [3]);
    navigate(5);
    assert.equal(routerEvents, 1);
    assert.deepEqual(movements, [3]);
  } finally { unlock(); }
});

test("저장 중 앞으로가기도 진입 위치로 되돌린다", () => {
  const unlock = guard.lockHistoryNavigation();
  try {
    navigate(7);
    assert.deepEqual(movements, [-2]);
    assert.equal(routerEvents, 0);
  } finally { unlock(); }
});

test("중첩 잠금은 마지막 해제 후 이동을 허용하고 중복 해제는 무시한다", () => {
  const first = guard.lockHistoryNavigation();
  const second = guard.lockHistoryNavigation();
  try {
    first();
    first();
    navigate(4);
    assert.equal(routerEvents, 0);
    second();
    navigate(3);
    assert.equal(routerEvents, 1);
    assert.deepEqual(movements, [1]);
  } finally { first(); second(); }
});

test("라우터 위치 정보가 없는 기록에 임의의 이동을 추가하지 않는다", () => {
  browser.history.state = null;
  const unlock = guard.lockHistoryNavigation();
  try {
    navigate(4);
    assert.equal(routerEvents, 1);
    assert.deepEqual(movements, []);
  } finally { unlock(); }
});
