import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createVerificationPlan } from "./related-tests.mjs";

function fixture(t, sources) {
  const root = mkdtempSync(join(tmpdir(), "masil-related-tests-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [path, source] of Object.entries(sources)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  return (changedPaths, options = {}) => createVerificationPlan({ root, files: Object.keys(sources), changedPaths, ...options });
}

test("웹 SSR → 별칭 → 공통 모듈을 따라가고 무관한 테스트는 제외한다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/start.test.mjs": 'server.ssrLoadModule("/src/start.ts")',
    "apps/web/src/start.ts": 'import { load } from "@/pack"',
    "apps/web/src/pack.ts": 'import "./cycle"',
    "apps/web/src/cycle.ts": 'import "./pack"',
    "apps/web/tests/other.test.mjs": 'server.ssrLoadModule("/src/other.ts")',
    "apps/web/src/other.ts": "export const value = 1",
  })(["apps/web/src/pack.ts"]);
  assert.deepEqual(plan.groups.web, ["apps/web/tests/start.test.mjs"]);
  assert.deepEqual(plan.workspaces, ["apps/web"]);
  assert.deepEqual(plan.uncoveredPaths, []);
});

test("API의 .js import를 실제 .ts 구현과 연결한다", (t) => {
  const plan = fixture(t, {
    "apps/api/tests/routes.test.mjs": 'import "../src/service.ts"',
    "apps/api/src/service.ts": 'export * from "./policy.js"',
    "apps/api/src/policy.ts": "export const value = 1",
  })(["apps/api/src/policy.ts"]);
  assert.deepEqual(plan.groups.api, ["apps/api/tests/routes.test.mjs"]);
});

test("다른 종류의 따옴표가 문자열 안에 있어도 다음 경로를 놓치지 않는다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/text.test.mjs": `const text = "don't lose this"; server.ssrLoadModule('/src/text.ts');`,
    "apps/web/src/text.ts": "export const value = 1",
  })(["apps/web/src/text.ts"]);
  assert.deepEqual(plan.groups.web, ["apps/web/tests/text.test.mjs"]);
});

test("네이티브의 소스 읽기와 다른 앱의 모듈 참조도 연결한다", (t) => {
  const plan = fixture(t, {
    "apps/native/tests/location.test.cjs": 'loadModule("../../web/src/location.ts"); readFileSync(path.join(__dirname, "../src/App.tsx"))',
    "apps/native/src/App.tsx": "export default null",
    "apps/web/src/location.ts": "export const value = 1",
  })(["apps/web/src/location.ts"]);
  assert.deepEqual(plan.groups.native, ["apps/native/tests/location.test.cjs"]);
  assert.deepEqual(plan.workspaces, ["apps/web", "apps/native"]);
});

test("직접 수정·추가한 테스트와 변경된 helper를 읽는 테스트를 포함한다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/new.test.ts": "",
    "apps/web/tests/first.test.mjs": 'import "./helpers/pack.mjs"',
    "apps/web/tests/helpers/pack.mjs": "export const value = 1",
  })(["apps/web/tests/new.test.ts", "apps/web/tests/helpers/pack.mjs"]);
  assert.deepEqual(plan.groups.web, ["apps/web/tests/first.test.mjs", "apps/web/tests/new.test.ts"]);
});

test("삭제한 소스를 참조하는 테스트는 실행하되 삭제한 테스트는 실행하지 않는다", (t) => {
  const plan = fixture(t, {
    "apps/api/tests/alive.test.mjs": 'import "../src/deleted.js"',
  })(["apps/api/src/deleted.ts", "apps/api/tests/deleted.test.mjs"]);
  assert.deepEqual(plan.groups.api, ["apps/api/tests/alive.test.mjs"]);
});

test("JSON 자산과 확장자 없는 index import도 연결한다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/map.test.mjs": 'readFile(new URL("../public/boundary.json", import.meta.url)); import "../src/map"',
    "apps/web/src/map/index.ts": 'fetch("/boundary.json")',
    "apps/web/public/boundary.json": "{}",
  });
  assert.equal(plan(["apps/web/public/boundary.json"]).groups.web.length, 1);
  assert.equal(plan(["apps/web/src/map/index.ts"]).groups.web.length, 1);
});

test("배포 스크립트의 파일명 리터럴과 앱 밖 infra 참조도 연결한다", (t) => {
  const plan = fixture(t, {
    "scripts/publish.test.mjs": 'join(scriptDirectory, "publish.mjs")',
    "scripts/publish.mjs": "",
    "apps/api/tests/deploy.test.mjs": 'new URL("../../../infra/deploy.sh", import.meta.url)',
    "infra/deploy.sh": "",
  });
  assert.deepEqual(plan(["scripts/publish.mjs"]).groups.scripts, ["scripts/publish.test.mjs"]);
  assert.deepEqual(plan(["infra/deploy.sh"]).groups.api, ["apps/api/tests/deploy.test.mjs"]);
});

test("앱 설정은 그 앱 전체, 루트 의존성 변경과 --all은 전체 테스트로 넓힌다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/a.test.mjs": "",
    "apps/api/tests/b.test.mjs": "",
    "apps/native/tests/c.test.cjs": "",
    "scripts/d.test.mjs": "",
  });
  assert.deepEqual(plan(["apps/web/package.json"]).groups, { web: ["apps/web/tests/a.test.mjs"], api: [], native: [], scripts: [] });
  assert.deepEqual(plan(["pnpm-lock.yaml"]).groups, plan([], { all: true }).groups);
  assert.equal(Object.values(plan(["pnpm-lock.yaml"]).groups).flat().length, 4);
});

test("API 계약 변경은 웹과 API 테스트까지 넓힌다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/a.test.mjs": "",
    "apps/api/tests/b.test.mjs": "",
    "apps/native/tests/c.test.cjs": "",
  })(["apps/api/src/schema.ts"]);
  assert.equal(plan.groups.web.length, 1);
  assert.equal(plan.groups.api.length, 1);
  assert.equal(plan.groups.native.length, 0);
});

test("네이티브 빌드 설정과 웹 codegen 변경은 각각 앱 전체로 넓힌다", (t) => {
  const plan = fixture(t, {
    "apps/web/tests/a.test.mjs": "",
    "apps/native/tests/b.test.cjs": "",
  });
  assert.equal(plan(["apps/native/metro.config.js"]).groups.native.length, 1);
  assert.equal(plan(["apps/web/codegen.ts"]).groups.web.length, 1);
});

test("DB 통합 테스트는 자동 실행 목록에서 분리한다", (t) => {
  const plan = fixture(t, {
    "apps/api/tests/db.integration.test.mjs": "",
    "apps/api/tests/unit.test.mjs": "",
  })(["apps/api/package.json"]);
  assert.deepEqual(plan.groups.api, ["apps/api/tests/unit.test.mjs"]);
  assert.deepEqual(plan.skippedIntegration, ["apps/api/tests/db.integration.test.mjs"]);
});

test("테스트가 없는 구현을 표시하고 문서 수정은 앱 검사를 실행하지 않는다", (t) => {
  const plan = fixture(t, { "apps/web/src/new.ts": "export const value = 1" });
  assert.deepEqual(plan(["apps/web/src/new.ts"]).uncoveredPaths, ["apps/web/src/new.ts"]);
  assert.deepEqual(plan(["apps/web/notes.md"]).workspaces, []);
});

test("훅과 선택기 자체의 수정은 검사 도구 테스트를 실행한다", (t) => {
  const plan = fixture(t, { "scripts/related-tests.test.mjs": "" });
  assert.deepEqual(plan([".githooks/pre-commit"]).groups.scripts, ["scripts/related-tests.test.mjs"]);
});

test("iOS 알림 모듈 수정은 기존 Swift 테스트를 선택한다", (t) => {
  const plan = fixture(t, { "apps/native/tests/routeArrivalNotificationLedger.test.swift": "" })([
    "apps/native/modules/route-arrival-notifications/ios/RouteArrivalNotificationsModule.swift",
  ]);
  assert.equal(plan.swift.test, "apps/native/tests/routeArrivalNotificationLedger.test.swift");
  assert.deepEqual(plan.swift.sources, ["apps/native/modules/route-arrival-notifications/ios/RouteArrivalNotificationLedger.swift"]);
});
