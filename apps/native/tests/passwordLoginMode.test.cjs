const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function loadPasswordLoginModeModule() {
  const source = readFileSync(
    path.join(__dirname, "../src/auth/passwordLoginMode.ts"),
    "utf8"
  );
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });

  assert.equal(result.diagnostics.length, 0);

  const exports = {};
  vm.runInNewContext(result.outputText, { exports });
  return exports;
}

const { getPasswordLoginMode } = loadPasswordLoginModeModule();

test("prod 앱은 비밀번호 로그인 입력을 숨긴다", () => {
  assert.equal(getPasswordLoginMode("prod"), "hidden");
});

test("dev와 로컬 앱은 테스트 계정 입력을 유지한다", () => {
  assert.equal(getPasswordLoginMode("dev"), "test");
});
