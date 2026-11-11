import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/** 실제 저장소의 인덱스와 훅 설정을 건드리지 않는 독립 Git 저장소를 만든다. */
function repository(t) {
  const root = mkdtempSync(join(tmpdir(), "masil-hook-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (name.startsWith("GIT_")) delete env[name];
  // 자식 프로세스는 별도 Git 훅 실행이므로 부모 node:test의 재귀 실행 표시는 물려주지 않는다.
  delete env.NODE_TEST_CONTEXT;
  const git = (...args) => execFileSync("git", args, { cwd: root, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  mkdirSync(join(root, "scripts"));
  for (const file of ["pre-commit.mjs", "related-tests.mjs"]) {
    copyFileSync(new URL(file, import.meta.url), join(root, "scripts", file));
  }
  writeFileSync(join(root, "scripts/value.mjs"), "export const value = 1;\n");
  writeFileSync(join(root, "scripts/value.test.mjs"), [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    'import { value } from "./value.mjs";',
    'test("staged value", () => assert.equal(value, 1));',
  ].join("\n"));
  git("init", "-q");
  git("config", "user.name", "Hook Test");
  git("config", "user.email", "hook-test@example.invalid");
  git("add", ".");
  git("-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", "commit", "-qm", "baseline");
  const run = (...args) => spawnSync(process.execPath, ["scripts/pre-commit.mjs", ...args], { cwd: root, env, encoding: "utf8" });
  return { root, git, run };
}

test("선택한 테스트 실패를 Fork에 전달하고 작업 폴더만 고쳐도 스테이징 오류는 남는다", (t) => {
  const { root, git, run } = repository(t);
  const path = join(root, "scripts/value.mjs");
  writeFileSync(path, "export const value = 2;\n");
  git("add", "scripts/value.mjs");
  writeFileSync(path, "export const value = 1;\n");
  const before = git("diff", "--cached");
  const result = run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout, /scripts\/value\.test\.mjs/);
  assert.match(result.stderr, /커밋 중단.*scripts 관련 테스트/);
  assert.equal(git("diff", "--cached"), before);
  assert.equal(readFileSync(path, "utf8"), "export const value = 1;\n");
});

test("새 테스트는 자동 선택되고 실패를 수정해 다시 스테이징하면 통과한다", (t) => {
  const { root, git, run } = repository(t);
  const path = join(root, "scripts/new.test.mjs");
  writeFileSync(path, 'import test from "node:test"; test("new", () => { throw new Error("new regression"); });');
  git("add", "scripts/new.test.mjs");
  assert.equal(run().status, 1);
  writeFileSync(path, 'import test from "node:test"; test("new", () => {});');
  git("add", "scripts/new.test.mjs");
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /\[pre-commit\] 통과/);
});

test("--plan은 선택 내역만 출력하고 실패하는 테스트를 실행하지 않는다", (t) => {
  const { root, git, run } = repository(t);
  writeFileSync(join(root, "scripts/value.mjs"), "export const value = 2;\n");
  git("add", "scripts/value.mjs");
  const result = run("--plan");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /scripts\/value\.test\.mjs/);
  assert.doesNotMatch(result.stdout, /TAP version/);
});

test("테스트 선택 규칙도 작업 폴더가 아닌 스테이징한 버전을 사용한다", (t) => {
  const { root, git, run } = repository(t);
  writeFileSync(join(root, "scripts/value.mjs"), "export const value = 1; // staged\n");
  git("add", "scripts/value.mjs");
  writeFileSync(join(root, "scripts/related-tests.mjs"), 'throw new Error("unstaged selector");');
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /scripts\/value\.test\.mjs/);
});

test("실제 Git 훅의 실패는 커밋 생성을 막고 통과하면 커밋을 허용한다", (t) => {
  const { root, git } = repository(t);
  mkdirSync(join(root, ".githooks"));
  writeFileSync(join(root, ".githooks/pre-commit"), `#!/bin/sh\nexec '${process.execPath}' scripts/pre-commit.mjs\n`, { mode: 0o755 });
  git("config", "core.hooksPath", ".githooks");
  const before = git("rev-parse", "HEAD");
  writeFileSync(join(root, "scripts/value.mjs"), "export const value = 2;\n");
  git("add", "scripts/value.mjs");
  assert.throws(() => git("-c", "commit.gpgSign=false", "commit", "-qm", "blocked"), /커밋 중단/);
  assert.equal(git("rev-parse", "HEAD"), before);
  writeFileSync(join(root, "scripts/value.mjs"), "export const value = 1; // valid change\n");
  git("add", "scripts/value.mjs");
  git("-c", "commit.gpgSign=false", "commit", "-qm", "allowed");
  assert.notEqual(git("rev-parse", "HEAD"), before);
});
