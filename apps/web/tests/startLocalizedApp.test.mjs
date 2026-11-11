import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

let server;
let startLocalizedApp;
let languageStore;
let toastStore;

before(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL("..", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ startLocalizedApp } = await server.ssrLoadModule("/src/lib/startLocalizedApp.ts"));
  ({ useAppLanguageStore: languageStore } = await server.ssrLoadModule("/src/stores/appLanguageStore.ts"));
  ({ useUiToastStore: toastStore } = await server.ssrLoadModule("/src/stores/uiToastStore.ts"));
});

after(async () => { await server?.close(); });

function useLanguage(t, language) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const messages = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    localStorage: { getItem: () => language },
    ReactNativeWebView: { postMessage: (message) => messages.push(JSON.parse(message)) },
  } });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete globalThis.window;
  });
  return messages;
}

test("영어팩이 준비될 때까지 화면 렌더링을 보류하고 시작 화면에 진행률을 보낸다", async (t) => {
  const messages = useLanguage(t, "en");
  const events = [];
  let finishDownload;
  t.mock.method(languageStore.getState(), "setLanguage", async (language, onProgress) => {
    assert.equal(language, "en");
    onProgress(0.5);
    await new Promise((resolve) => { finishDownload = resolve; });
    events.push("english-ready");
    return true;
  });

  const startup = startLocalizedApp(() => events.push("render"));
  assert.deepEqual(events, []);
  assert.deepEqual(messages, [
    { type: "routeone:startup-language-progress", progress: null },
    { type: "routeone:startup-language-progress", progress: 0.5 },
  ]);
  finishDownload();
  await startup;
  assert.deepEqual(events, ["english-ready", "render"]);
  assert.deepEqual(messages.at(-1), { type: "routeone:startup-language-complete" });
});

test("한국어 사용자는 영어팩을 요청하지 않고 화면을 연다", async (t) => {
  const messages = useLanguage(t, "ko");
  const download = t.mock.method(languageStore.getState(), "setLanguage");
  let rendered = 0;
  await startLocalizedApp(() => { rendered += 1; });
  assert.equal(rendered, 1);
  assert.equal(download.mock.callCount(), 0);
  assert.deepEqual(messages, []);
});

test("영어팩 준비에 실패하면 다운로드 종료 후 안내와 함께 한국어 화면을 연다", async (t) => {
  useLanguage(t, "en");
  const events = [];
  t.mock.method(languageStore.getState(), "setLanguage", async () => {
    events.push("failed");
    return false;
  });
  t.mock.method(toastStore.getState(), "showToast", (message) => {
    assert.match(message, /한국어로 시작/);
    events.push("notice");
  });
  await startLocalizedApp(() => events.push("render"));
  assert.deepEqual(events, ["failed", "notice", "render"]);
});
