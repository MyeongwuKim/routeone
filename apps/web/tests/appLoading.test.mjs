import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

let server, AppLoadingCard, AppLoadingOverlay, store, getUiText;

before(async () => {
  server = await createServer({
    configFile: false, root: fileURLToPath(new URL("..", import.meta.url)),
    envDir: fileURLToPath(new URL(".", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  ({ AppLoadingCard, default: AppLoadingOverlay } = await server.ssrLoadModule("/src/components/feedback/AppLoadingOverlay.tsx"));
  ({ useUiLoadingStore: store } = await server.ssrLoadModule("/src/stores/uiLoadingStore.ts"));
  ({ getUiText } = await server.ssrLoadModule("/src/lib/uiText.ts"));
});
after(async () => { await server?.close(); });

test("기존 작업 단계들을 라우터 없이 같은 진행 아이콘으로 렌더링한다", () => {
  for (const animation of ["generic", "running", "searching", "pondering", "map-thinking", "ranking", "map-rendering"]) {
    const html = renderToStaticMarkup(createElement(AppLoadingCard, { title: "경로 <확인>", description: "준비 중", animation, compact: true }));
    assert.match(html, /경로 &lt;확인&gt;/);
    assert.match(html, /data-animated="true"/);
    assert.equal((html.match(/<svg/g) ?? []).length, 1);
    assert.doesNotMatch(html, /potato|🥔|감자/i);
  }
});

test("빈 화면에는 정지 아이콘을 쓰고 제공하지 않은 설명·상태 문구를 추가하지 않는다", () => {
  const html = renderToStaticMarkup(createElement(AppLoadingCard, { title: "아직 담은 장소가 없어요", animation: "empty", layout: "stacked" }));
  assert.match(html, /data-animated="false"/);
  assert.equal((html.match(/<p\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /aria-busy="true"/);
});

test("전역 오버레이는 기존 배경 가림·화면 조작 차단 설정을 유지한다", t => {
  const snapshot = store.getInitialState();
  const previous = { ...snapshot };
  t.after(() => Object.assign(snapshot, previous));
  Object.assign(snapshot, { isOpen: true, title: "화면 준비 중", blocking: true, dimmed: true });
  let html = renderToStaticMarkup(createElement(AppLoadingOverlay));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /pointer-events-auto touch-none/);
  assert.match(html, /bg-slate-900\/5/);
  Object.assign(snapshot, { blocking: false, dimmed: false });
  html = renderToStaticMarkup(createElement(AppLoadingOverlay));
  assert.match(html, /pointer-events-none/);
  assert.doesNotMatch(html, /bg-slate-900\/5/);
  snapshot.isOpen = false;
  assert.equal(renderToStaticMarkup(createElement(AppLoadingOverlay)), "");
});

test("로딩을 다시 열 때 이전 작업의 하단 문구가 남지 않으며 캐릭터 문구를 표시하지 않는다", t => {
  const previous = store.getState();
  t.after(() => store.setState(previous));
  store.getState().showLoading({ title: "첫 작업", footerText: "처리 중" });
  store.getState().hideLoading();
  store.getState().showLoading({ title: "다음 작업" });
  assert.equal(store.getState().footerText, "");
  assert.equal(store.getState().animation, "generic");
  for (const language of ["ko", "en"]) {
    assert.doesNotMatch(JSON.stringify(getUiText(language)), /potato|🥔|감자/i);
  }
});
