const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = readFileSync(
  path.join(__dirname, "../src/App.tsx"),
  "utf8"
);
const bootSource = readFileSync(
  path.join(__dirname, "../src/boot/useNativeBoot.ts"),
  "utf8"
);
const nativeBridgeSource = readFileSync(
  path.join(__dirname, "../src/webview/bridge/index.ts"),
  "utf8"
);
const webAuthBridgeSource = readFileSync(
  path.join(__dirname, "../../web/src/native-bridge/auth.ts"),
  "utf8"
);

test("인증 세션이 없어도 온보딩 후 WebView로 진입한다", () => {
  assert.doesNotMatch(bootSource, /\| "login"/);
  assert.match(
    bootSource,
    /if \(hasCompletedOnboarding === "true"\)[\s\S]*setBootStep\("webview"\)/
  );
  assert.match(
    bootSource,
    /setIsAuthSessionExpired\(session\.reason === "expired"\);\s*setBootStep\("webview"\)/
  );
});

test("웹의 로그인 요청은 네이티브 로그인 모달로 연결된다", () => {
  assert.match(webAuthBridgeSource, /routeone:native-login-request/);
  assert.match(nativeBridgeSource, /handlers\.onLoginRequest\?\.\(\)/);
  assert.match(appSource, /onLoginRequest=\{\(\) =>/);
  assert.match(appSource, /<Modal[\s\S]*visible=\{isNativeLoginVisible\}/);
});

test("로그인 화면은 화면 버튼과 기기 뒤로가기로 닫힌다", () => {
  assert.match(appSource, /BackHandler\.addEventListener/);
  assert.match(appSource, /onRequestClose=\{\(\) => setIsNativeLoginVisible\(false\)\}/);
  assert.match(appSource, /onBack=\{\(\) => setIsNativeLoginVisible\(false\)\}/);
});
