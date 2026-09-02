const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const source = readFileSync(
  path.join(__dirname, "../src/auth/testFeatureAccess.ts"),
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

const moduleExports = {};
vm.runInNewContext(result.outputText, { exports: moduleExports });

test("개발 앱은 모든 계정에서 테스트 기능을 허용한다", () => {
  assert.equal(moduleExports.isNativeTestFeatureEnabled("USER", "dev"), true);
  assert.equal(moduleExports.isNativeTestFeatureEnabled("REVIEWER", "dev"), true);
  assert.equal(moduleExports.isNativeTestFeatureEnabled("OWNER", "dev"), true);
  assert.equal(moduleExports.isNativeTestFeatureEnabled(null, "dev"), true);
});

test("운영 앱은 OWNER 마스터 계정에만 테스트 기능을 허용한다", () => {
  assert.equal(moduleExports.isNativeTestFeatureEnabled("OWNER", "prod"), true);
  assert.equal(moduleExports.isNativeTestFeatureEnabled("REVIEWER", "prod"), false);
  assert.equal(moduleExports.isNativeTestFeatureEnabled("USER", "prod"), false);
  assert.equal(moduleExports.isNativeTestFeatureEnabled(null, "prod"), false);
});
