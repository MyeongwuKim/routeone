import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../../../infra/cloud-run/deploy-image-cleanup.sh", import.meta.url));

function runDeploy(t, overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "routeone-image-deploy-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const log = join(directory, "calls.jsonl");
  writeFileSync(log, "");
  writeFileSync(join(directory, "gcloud"), `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_CALL_LOG, JSON.stringify(args) + '\\n');
if (args[0] === 'projects' && args[1] === 'describe') console.log('123456789');
if (args.includes('describe') && (args.includes('jobs') || args.includes('service-accounts'))) {
  process.exit(process.env.TEST_EXISTING === 'true' ? 0 : 1);
}
`, { mode: 0o755 });
  const result = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      PATH: `${directory}:${process.env.PATH}`,
      PROJECT_ID: "test-project", API_IMAGE: "test-registry/api:test",
      IMAGE_CLEANUP_ENVIRONMENT: "prod", DATABASE_SECRET: "prod-db",
      CF_ACCOUNT_SECRET: "cf-account", CF_TOKEN_SECRET: "cf-token",
      TEST_CALL_LOG: log, ...overrides,
    },
  });
  const calls = readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
  return { ...result, calls };
}

test("배포 스크립트는 새벽 4시 점검 Job과 인증된 Scheduler를 만들고 즉시 실행하지 않는다", (t) => {
  const result = runDeploy(t);
  assert.equal(result.status, 0, result.stderr);
  const job = result.calls.find((args) => args.slice(0, 3).join(" ") === "run jobs create");
  assert.ok(job.includes("routeone-image-cleanup-prod"));
  assert.ok(job.includes("--args=dist/jobs/cleanupOrphanImages.js"));
  assert.ok(job.some((arg) => arg.startsWith("--set-env-vars=") && arg.includes("IMAGE_CLEANUP_DRY_RUN=true")));
  assert.ok(job.some((arg) => arg.startsWith("--set-secrets=") && arg.includes("CF_TOKEN=cf-token:latest")));
  const scheduler = result.calls.find((args) => args.slice(0, 3).join(" ") === "scheduler jobs create");
  assert.ok(scheduler.includes("--schedule=0 4 * * *"));
  assert.ok(scheduler.includes("--time-zone=Asia/Seoul"));
  assert.ok(scheduler.includes("--oauth-service-account-email=routeone-image-cron-prod@test-project.iam.gserviceaccount.com"));
  assert.equal(result.calls.some((args) => args.includes("execute")), false);
});

test("기존 Job은 중복 생성하지 않고 삭제 모드·실행 경로를 갱신한다", (t) => {
  const result = runDeploy(t, {
    TEST_EXISTING: "true", DRY_RUN: "false", IMAGE_CLEANUP_ENVIRONMENT: "dev",
    GRACE_HOURS: "48", CLEANUP_ENTRYPOINT: "apps/api/dist/jobs/cleanupOrphanImages.js",
  });
  assert.equal(result.status, 0, result.stderr);
  const job = result.calls.find((args) => args.slice(0, 3).join(" ") === "run jobs update");
  assert.ok(job.includes("routeone-image-cleanup-dev"));
  assert.ok(job.includes("--args=apps/api/dist/jobs/cleanupOrphanImages.js"));
  assert.ok(job.some((arg) => arg.includes("IMAGE_CLEANUP_DRY_RUN=false") && arg.includes("IMAGE_CLEANUP_GRACE_HOURS=48")));
  assert.ok(result.calls.some((args) => args.slice(0, 3).join(" ") === "scheduler jobs update"));
  assert.equal(result.calls.some((args) => args.includes("create")), false);
});

test("잘못된 환경이나 유예 시간은 클라우드 호출 전에 차단한다", (t) => {
  for (const overrides of [{ IMAGE_CLEANUP_ENVIRONMENT: "all" }, { GRACE_HOURS: "1" }, { DRY_RUN: "yes" }, { CF_TOKEN_SECRET: "" }]) {
    const result = runDeploy(t, overrides);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.calls, []);
  }
});
