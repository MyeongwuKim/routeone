const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(file, requireModule = () => { throw new Error("Unexpected import"); }) {
  const compiled = ts.transpileModule(readFileSync(path.join(__dirname, file), "utf8"), {
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal(compiled.diagnostics.length, 0);
  const exports = {};
  vm.runInNewContext(compiled.outputText, { exports, require: requireModule });
  return exports;
}

const constants = loadModule("../src/constants/nativeWebView.ts");
const { createAuthSessionPreparingScript } = loadModule("../src/webview/authPreparingOverlayScript.ts", specifier => {
  assert.equal(specifier, "@/constants/nativeWebView");
  return constants;
});

function createHarness({ dark = false, bodyReady = true } = {}) {
  class Element {
    constructor(tag) { this.tag = tag; this.style = {}; this.attributes = {}; this.children = []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    appendChild(child) { this.children.push(child); child.parent = this; }
    remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const head = new Element("head");
  const body = new Element("body");
  const listeners = [];
  const all = node => [node, ...node.children.flatMap(all)];
  const document = {
    head, body: bodyReady ? body : null,
    createElement: tag => new Element(tag),
    getElementById: id => [head, ...(document.body ? [body] : [])].flatMap(all).find(node => node.id === id),
    addEventListener: (event, callback) => { assert.equal(event, "DOMContentLoaded"); listeners.push(callback); },
  };
  const window = { matchMedia: () => ({ matches: dark }) };
  return {
    document,
    run: (isPreparing, language = "ko") => vm.runInNewContext(createAuthSessionPreparingScript(isPreparing, language), { window, document }),
    ready: () => { document.body = body; listeners.forEach(callback => callback()); },
  };
}

test("로그인 대기 아이콘은 중복 생성되지 않으며 완료하면 화면 차단과 스타일을 제거한다", () => {
  const harness = createHarness();
  harness.run(true);
  harness.run(true);
  assert.equal(harness.document.body.children.length, 1);
  const overlay = harness.document.getElementById("routeone-auth-preparing-overlay");
  assert.equal(overlay.attributes.role, "status");
  assert.equal(overlay.style.pointerEvents, "auto");
  const icon = overlay.children[0].children[0];
  assert.match(icon.innerHTML, /<svg/);
  assert.match(icon.innerHTML, /duru-auth-needle/);
  assert.doesNotMatch(icon.innerHTML, /potato|🥔|감자/i);
  const styles = harness.document.getElementById("routeone-auth-preparing-style").textContent;
  assert.match(styles, /prefers-reduced-motion:reduce/);
  harness.run(false);
  assert.equal(harness.document.body.children.length, 0);
  assert.equal(harness.document.head.children.length, 0);
});

test("어두운 화면에서도 영어 로그인 안내를 유지한다", () => {
  const harness = createHarness({ dark: true });
  harness.run(true, "en");
  const card = harness.document.body.children[0].children[0];
  assert.equal(card.style.background, "#071f1d");
  assert.equal(card.children[1].textContent, constants.WEB_VIEW_TEXT.en.authPreparingTitle);
  assert.equal(card.children[2].textContent, constants.WEB_VIEW_TEXT.en.authPreparingDescription);
});

test("문서 준비 전에 로그인이 끝나면 지연된 로딩 안내가 화면을 다시 가리지 않는다", () => {
  const harness = createHarness({ bodyReady: false });
  harness.run(true);
  harness.run(false);
  harness.ready();
  assert.equal(harness.document.body.children.length, 0);
  assert.equal(harness.document.head.children.length, 0);
});
