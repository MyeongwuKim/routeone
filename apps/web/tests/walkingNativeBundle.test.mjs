import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { build } from "vite";

const webRoot = fileURLToPath(new URL("..", import.meta.url));
const nativeScripts = fileURLToPath(new URL("../../native/scripts/", import.meta.url));
const start = { lat: 37.7637, lng: 128.8995 };
const goal = { lat: 37.7536, lng: 128.9000 };
let fixtureRoot;
let fetchWalkingRoute;
const workers = [];
const originalGlobals = {};

// 실제 빌드한 Worker 코드를 실행하되 브라우저의 이벤트 전달만 Node에서 재현한다.
class BrowserWorker {
  constructor(url) {
    this.terminated = false;
    this.source = fetch(url).then(response => response.text());
    workers.push(this);
  }
  postMessage(message) {
    this.message = message;
    void this.source.then(async source => {
      let onMessage;
      const self = {
        addEventListener: (_, listener) => { onMessage = listener; },
        postMessage: data => {
          if (!this.terminated) this.onmessage?.({ data });
        },
      };
      runInNewContext(source, {
        self, AbortSignal,
        fetch: url => {
          assert.match(String(url), /^data:application\/json/,
            "임베디드 WebView는 가상 호스트에서 보행로 파일을 요청할 수 없다");
          return fetch(url);
        },
      });
      await onMessage({ data: message });
    }).catch(error => { if (!this.terminated) this.onerror?.(error); });
  }
  terminate() { this.terminated = true; }
}

before(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "masil-walking-native-"));
  const dist = path.join(fixtureRoot, "web/dist");
  const scripts = path.join(fixtureRoot, "native/scripts");
  await mkdir(scripts, { recursive: true });
  // 도보 진입점만 빌드해 실제 네이티브 패키징 스크립트에 넣는다.
  await build({
    configFile: false, root: webRoot, base: "./", publicDir: false, logLevel: "silent",
    build: {
      outDir: dist, emptyOutDir: true, minify: false,
      lib: { entry: path.join(webRoot, "src/features/walking/walkingDirections.ts"), formats: ["es"], fileName: () => "walking-entry.js" },
    },
  });
  await mkdir(path.join(dist, "walking-data"), { recursive: true });
  for (const file of ["gangwon-sigungu-boundary.json", "service-region-boundary.json", "masil-icon.png", "walking-data/gangneung.json"]) {
    await copyFile(path.join(webRoot, "public", file), path.join(dist, file));
  }
  for (const file of ["sync-web-build.mjs", "env-file.mjs"]) {
    await copyFile(path.join(nativeScripts, file), path.join(scripts, file));
  }
  await writeFile(path.join(dist, "index.html"), `<html><head>
    <meta name="language-pack" content="/language-packs/en-${"0".repeat(64)}.mjs">
    <script type="module" src="./walking-entry.js"></script></head><body></body></html>`);
  execFileSync(process.execPath, [path.join(scripts, "sync-web-build.mjs"), "--skip-build"], { stdio: "pipe" });
  const generated = await readFile(path.join(fixtureRoot, "native/src/generated/webBundle.ts"), "utf8");
  const html = JSON.parse(generated.match(/export const WEB_BUNDLE_HTML = ("[^\n]+");/)[1]);
  const imports = JSON.parse(html.match(/<script type="importmap" data-routeone-native-modules>([\s\S]*?)<\/script>/)[1]).imports;
  for (const key of ["window", "document", "Worker"]) originalGlobals[key] = Object.getOwnPropertyDescriptor(globalThis, key);
  globalThis.window = { setTimeout, clearTimeout, location: { href: "about:blank" } };
  globalThis.document = { baseURI: "https://routeone.native/#/home" };
  globalThis.Worker = BrowserWorker;
  ({ fetchWalkingRoute } = await import(imports["@routeone/walking-entry.js"]));
});

after(async () => {
  workers.forEach(worker => worker.terminate());
  for (const [key, descriptor] of Object.entries(originalGlobals)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
});

test("data: 모듈로 패키징한 도보 기능이 외부 요청 없이 실제 강릉 경로를 계산한다", async () => {
  const result = await fetchWalkingRoute({ start, goal });
  assert.equal(result.mode, "walking");
  assert.ok(result.distanceM > 500 && result.distanceM < 10_000);
  assert.ok(result.durationMs > 300_000);
  assert.ok(result.path.length > 5);
  assert.match(workers.at(-1).message.packUrl, /^data:application\/json/);
  assert.equal(workers.at(-1).terminated, true);
});

test("지원 밖 좌표는 네이티브 Worker 생성 전에 거부한다", async () => {
  const count = workers.length;
  await assert.rejects(fetchWalkingRoute({ start: { lat: 37.5, lng: 127 }, goal }), { code: "OUTSIDE_COVERAGE" });
  assert.equal(workers.length, count);
});

test("계산 중 취소하면 네이티브 Worker를 종료하고 AbortError를 반환한다", async () => {
  const controller = new AbortController();
  const pending = fetchWalkingRoute({ start, goal, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(workers.at(-1).terminated, true);
});
