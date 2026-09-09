import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function loadModule(path, imports = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8")
    .replaceAll("import.meta.env.VITE_APP_VERSION", '"web-test"');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  }, exports);
  return exports;
}

const email = loadModule("../src/features/feedback/utils/feedbackEmail.ts");
const text = {
  emailSubject: "[RouteOne] 불편사항 & 개선 의견",
  emailBody: "지도에서 문제가 생겨요.\r\n주소: A&B #1 + ?\r\n",
  environmentLabel: "앱 환경 정보",
};

test("한글·특수문자·줄바꿈을 보존하고 지정된 받는 주소만 사용한다", () => {
  const url = new URL(email.createFeedbackEmailUrl({ text, appInfo: null }));
  assert.equal(url.protocol, "mailto:");
  assert.equal(url.pathname, "mw1992@naver.com");
  assert.deepEqual([...url.searchParams.keys()], ["subject", "body"]);
  assert.equal(url.searchParams.get("subject"), text.emailSubject);
  assert.equal(url.searchParams.get("body"), text.emailBody);
});

test("확인된 버전만 첨부하고 계정·좌표·권한 정보는 포함하지 않는다", () => {
  const url = new URL(email.createFeedbackEmailUrl({
    text,
    appInfo: {
      platform: "ios", appVersion: "1.2.3", buildNumber: "42", osVersion: "18.0",
      webBundleVersion: "installed-123", capabilities: ["camera"],
      userId: "private-user", lat: 37.555555, locationPermissionStatus: "denied",
    },
    webVersion: "bundled-older",
  }));
  const body = url.searchParams.get("body");
  assert.match(body, /Platform: ios\r\nApp: 1.2.3\r\nBuild: 42\r\nOS: 18.0\r\nWeb: installed-123/);
  assert.doesNotMatch(body, /private-user|37.555555|denied|camera|bundled-older/);
});

test("앱 정보를 읽지 못해도 문의 링크와 웹 버전을 준비한다", () => {
  const url = new URL(email.createFeedbackEmailUrl({ text, appInfo: null, webVersion: "web-123" }));
  assert.match(url.searchParams.get("body"), /Web: web-123/);
  assert.doesNotMatch(url.searchParams.get("body"), /undefined|null|Platform:|OS:/);
});

function createHook(bridge) {
  const slots = [];
  let cursor = 0;
  const { useFeedbackEmail } = loadModule("../src/features/feedback/hooks/useFeedbackEmail.ts", {
    react: {
      useRef(initial) {
        const index = cursor++;
        return slots[index] ??= { current: initial };
      },
      useState(initial) {
        const index = cursor++;
        if (!Object.hasOwn(slots, index)) slots[index] = initial;
        return [slots[index], (value) => { slots[index] = value; }];
      },
    },
    "@/lib/uiText": { useUiText: () => ({ feedback: text }) },
    "@/native-bridge": { useNativeAppInfo: () => ({ appInfoState: { info: null } }) },
    "@/native-bridge/runtime": { getNativeBridgeApi: () => bridge },
    "../utils/feedbackEmail": email,
  });
  return () => { cursor = 0; return useFeedbackEmail(); };
}

test("네이티브에서는 메일 링크를 한 번 넘기고 브라우저 중복 이동을 막는다", () => {
  const opened = [];
  const render = createHook({ openExternalUrl: (url) => { opened.push(url); return true; } });
  let prevented = 0;
  render().handleOpenEmail({ preventDefault: () => prevented++ });
  assert.deepEqual(opened, [render().emailUrl]);
  assert.equal(prevented, 1);
  assert.equal(render().openFailed, false);
});

test("브라우저에서는 일반 메일 링크로 이동하고 브리지 예외는 화면에 남긴다", () => {
  let prevented = 0;
  createHook(undefined)().handleOpenEmail({ preventDefault: () => prevented++ });
  assert.equal(prevented, 0);
  const render = createHook({ openExternalUrl: () => { throw new Error("unavailable"); } });
  render().handleOpenEmail({ preventDefault: () => prevented++ });
  assert.equal(prevented, 1);
  assert.equal(render().openFailed, true);
});

test("실제 복사가 성공했을 때만 성공 안내를 보여주고 실패하면 주소를 선택한다", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete globalThis.navigator;
  });
  const writes = [];
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {
    clipboard: { writeText: async (value) => writes.push(value) },
  } });
  const render = createHook(undefined);
  await render().handleCopyEmail();
  assert.deepEqual(writes, [email.FEEDBACK_EMAIL]);
  assert.equal(render().copyStatus, "copied");
  navigator.clipboard.writeText = async () => { throw new Error("denied"); };
  const calls = [];
  render().emailInputRef.current = { focus: () => calls.push("focus"), select: () => calls.push("select") };
  await render().handleCopyEmail();
  assert.equal(render().copyStatus, "manual");
  assert.deepEqual(calls, ["focus", "select"]);
});

test("기존 네이티브 외부 링크 처리로 메일 작성창을 연다", async () => {
  const calls = [];
  const { openNativeExternalUrl } = loadModule("../../native/src/webview/bridge/externalLinkBridge.ts", {
    "react-native": { Platform: { OS: "ios" }, Linking: { openURL: async (url) => calls.push(url) } },
  });
  const url = email.createFeedbackEmailUrl({ text, appInfo: null });
  await openNativeExternalUrl(url);
  assert.deepEqual(calls, [url]);
});
