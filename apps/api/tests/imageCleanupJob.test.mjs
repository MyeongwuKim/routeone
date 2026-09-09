import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

function runJob(args, dryRun) {
  return spawnSync(process.execPath, ["--import", "tsx", "src/jobs/cleanupOrphanImages.ts", ...args], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
    timeout: 10_000,
    env: {
      ...process.env,
      DOTENV_CONFIG_PATH: fileURLToPath(new URL("./missing-test.env", import.meta.url)),
      DATABASE_URL: "mongodb://127.0.0.1:1/routeone_test",
      CF_ACCOUNT: "test-account",
      CF_TOKEN: "test-token",
      IMAGE_CLEANUP_ENVIRONMENT: "dev",
      IMAGE_CLEANUP_DRY_RUN: dryRun,
      IMAGE_CLEANUP_GRACE_HOURS: "24",
      IMAGE_CLEANUP_MAX_DELETES: "100",
    },
  });
}

test("실행 명령도 최근 사진 포함과 실제 삭제 조합을 외부 조회 전에 거부한다", () => {
  const result = runJob(["--include-recent"], "false");
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr.trim());
  assert.equal(error.event, "orphan-image-cleanup.failed");
  assert.match(error.message, /only allowed in dry-run mode/);
  assert.equal(result.stdout.trim(), "");
});

test("지원하지 않는 명령 옵션을 무시하고 정리 작업을 실행하지 않는다", () => {
  const result = runJob(["--include-recnt"], "true");
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(JSON.parse(result.stderr.trim()).message, /Unknown option/);
  assert.equal(result.stdout.trim(), "");
});
