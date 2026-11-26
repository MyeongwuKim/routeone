/**
 * 용도:
 * R2 게시 스크립트에서 실제 업로드 실패와 구버전 정리 실패가 서로 다른
 * 종료 결과를 만드는지 가짜 AWS CLI를 통해 검증한다.
 *
 * 동작 방식:
 * 임시 dist와 실행 파일을 만든 뒤 게시 스크립트를 자식 프로세스로 실행해
 * 재시도 횟수, 명령 순서, 종료 코드와 경고 출력을 확인한다.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import webBundleRuntime from "../config/web-bundle-runtime.json" with { type: "json" };
import { parseNumericVersion } from "./resolve-web-bundle-version.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..");
const publishScriptPath = join(scriptDirectory, "publish-web-bundle-r2.mjs");

const fakeZipSource = `#!/usr/bin/env node
const { writeFileSync } = require("node:fs");
const args = process.argv.slice(2);
const optionIndex = args.indexOf("-qr");
const outputPath = args[optionIndex + 1];

if (!outputPath) {
  console.error("missing zip output path");
  process.exit(1);
}

writeFileSync(outputPath, "fake web bundle");
`;

const fakeAwsSource = `#!/usr/bin/env node
const {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync
} = require("node:fs");

const args = process.argv.slice(2);
const logPath = process.env.FAKE_AWS_LOG_PATH;
const rmCountPath = process.env.FAKE_AWS_RM_COUNT_PATH;

appendFileSync(
  logPath,
  JSON.stringify({
    args,
    maxAttempts: process.env.AWS_MAX_ATTEMPTS,
    retryMode: process.env.AWS_RETRY_MODE,
    manifest: args[0] === "s3" && args[1] === "cp" && args[3]?.endsWith("/latest/manifest.json")
      ? JSON.parse(readFileSync(args[2], "utf8"))
      : undefined
  }) + "\\n"
);

if (args[0] === "s3api" && args[1] === "list-objects-v2") {
  if (process.env.FAKE_AWS_FAIL_LIST === "1") {
    console.error("simulated list failure");
    process.exit(1);
  }

  process.stdout.write(process.env.FAKE_AWS_RELEASES_JSON);
  process.exit(0);
}

if (args[0] === "s3" && args[1] === "cp") {
  if (process.env.FAKE_AWS_FAIL_CP === "1") {
    console.error("simulated upload failure");
    process.exit(1);
  }

  process.exit(0);
}

if (args[0] === "s3" && args[1] === "rm") {
  const previousCount = existsSync(rmCountPath)
    ? Number.parseInt(readFileSync(rmCountPath, "utf8"), 10)
    : 0;
  const nextCount = previousCount + 1;
  const failureCount = Number.parseInt(
    process.env.FAKE_AWS_RM_FAILURES || "0",
    10
  );

  writeFileSync(rmCountPath, String(nextCount));

  if (nextCount <= failureCount) {
    console.error("simulated R2 InternalError");
    process.exit(1);
  }

  process.exit(0);
}

console.error("unexpected aws invocation", args.join(" "));
process.exit(1);
`;

test("retries an old release cleanup and preserves the published release", () => {
  const fixture = createFixture({ rmFailures: 2 });

  try {
    const result = fixture.run();
    const calls = fixture.readCalls();
    const removeCalls = calls.filter(isRemoveCall);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(removeCalls.length, 3);
    assert.match(result.stderr, /attempt 1\/3/);
    assert.match(result.stderr, /attempt 2\/3/);
    assert.match(result.stdout, /Deleted old release releases\/1\.0\.5\//);
    assert.equal(calls.every((call) => call.retryMode === "standard"), true);
    assert.equal(calls.every((call) => call.maxAttempts === "4"), true);
    assertLatestWasActivatedBeforeCleanup(calls);
  } finally {
    fixture.cleanup();
  }
});

test("reports a cleanup warning without failing an activated publish", () => {
  const fixture = createFixture({ rmFailures: 10 });

  try {
    const result = fixture.run();
    const calls = fixture.readCalls();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(calls.filter(isRemoveCall).length, 3);
    assert.match(
      result.stderr,
      /::warning title=R2 release cleanup::Could not delete releases\/1\.0\.5\/ after 3 attempts/
    );
    assert.match(result.stdout, /Published releases\/1\.0\.6\/web-ui\.zip/);
    assert.match(result.stdout, /Updated latest\/manifest\.json/);
    assert.doesNotMatch(result.stdout, /Deleted old release/);
    assertLatestWasActivatedBeforeCleanup(calls);
  } finally {
    fixture.cleanup();
  }
});

test("keeps an upload failure fatal", () => {
  const fixture = createFixture({ failCopy: true });

  try {
    const result = fixture.run();
    const calls = fixture.readCalls();

    assert.equal(result.status, 1);
    assert.match(result.stderr, /simulated upload failure/);
    assert.equal(calls.some(isRemoveCall), false);
    assert.doesNotMatch(result.stdout, /Updated latest\/manifest\.json/);
  } finally {
    fixture.cleanup();
  }
});

test("publishes the English pack outside the release before switching latest", () => {
  const source = "export default {};\n";
  const hash = createHash("sha256").update(source).digest("hex");
  const pack = `language-packs/en-${hash}.mjs`;
  const fixture = createFixture({ languagePack: { pack, source } });

  try {
    const result = fixture.run();
    const calls = fixture.readCalls();
    const packUpload = calls.findIndex(({ args }) => args.includes(`s3://test-bucket/${pack}`));
    const latestUpload = calls.findIndex(({ args }) => args.includes("s3://test-bucket/latest/manifest.json"));
    assert.equal(result.status, 0, result.stderr);
    assert.ok(packUpload >= 0 && packUpload < latestUpload);
    assert.ok(!calls.some(({ args }) => args.includes(`s3://test-bucket/releases/1.0.6/web/${pack}`)));
  } finally {
    fixture.cleanup();
  }
});

test("does not switch latest when the English pack has a mismatched hash", () => {
  const fixture = createFixture({ languagePack: { pack: `language-packs/en-${"0".repeat(64)}.mjs`, source: "export default {};\n" } });

  try {
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /English language pack hash mismatch/);
    assert.doesNotMatch(result.stdout, /Updated latest\/manifest\.json/);
  } finally {
    fixture.cleanup();
  }
});

test("rejects a missing English pack referenced by the web build", () => {
  const fixture = createFixture({ languagePack: { pack: `language-packs/en-${"0".repeat(64)}.mjs` } });

  try {
    const result = fixture.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /English language pack referenced by index.html is missing/);
    assert.deepEqual(fixture.readCalls(), []);
  } finally {
    fixture.cleanup();
  }
});

test("skips cleanup with a warning when releases cannot be listed", () => {
  const fixture = createFixture({ failList: true });

  try {
    const result = fixture.run();
    const calls = fixture.readCalls();

    assert.equal(result.status, 0, result.stderr);
    assert.equal(calls.some(isRemoveCall), false);
    assert.match(
      result.stderr,
      /::warning title=R2 release cleanup::Could not list existing releases/
    );
    assert.match(result.stdout, /Updated latest\/manifest\.json/);
  } finally {
    fixture.cleanup();
  }
});

test("운영은 루트에 발행하고 웹 번들 지원 계열의 릴리스만 정리한다", () => {
  const minimum = parseNumericVersion(webBundleRuntime.prod.minimumNativeVersion);
  const previousVersion = minimum.value;
  const version = `${minimum.major}.${minimum.minor}.${minimum.patch + 1}`;
  const fixture = createFixture({
    channel: "prod",
    version,
    releases: [
      { Key: "releases/1.0.34/manifest.json", LastModified: "2026-09-01T01:00:00Z" },
      { Key: `releases/${version}/manifest.json`, LastModified: "2026-09-03T01:00:00Z" },
      { Key: `releases/${previousVersion}/manifest.json`, LastModified: "2026-09-02T01:00:00Z" },
      { Key: `runtime/v2/releases/${previousVersion}/manifest.json`, LastModified: "2026-09-02T01:00:00Z" },
    ],
  });
  try {
    const result = fixture.run();
    assert.equal(result.status, 0, result.stderr);
    const calls = fixture.readCalls();
    const args = calls.map(call => call.args);
    const latest = calls.find(call => call.args.includes("s3://test-bucket/latest/manifest.json"));
    assert.equal(latest.manifest.minNativeVersion, minimum.value);
    assert.equal(latest.manifest.entryUrl, `https://bundle.example.com/releases/${version}/web/index.html`);
    assert.ok(args.some(call => call.includes("releases/")));
    assert.deepEqual(calls.filter(isRemoveCall).map(call => call.args[2]), [
      `s3://test-bucket/releases/${previousVersion}/`,
    ]);
    assert.ok(!args.some(call => call.some(arg => arg.includes("runtime/v2/"))));
  } finally {
    fixture.cleanup();
  }
});

test("dev는 기존 경로의 매니페스트에 정책 기본값 또는 수동 발행의 최소 앱 버전을 담는다", () => {
  const configuredMinimum = webBundleRuntime.dev.minimumNativeVersion;
  const override = configuredMinimum === "1.0.2" ? "1.1.0" : "1.0.2";
  for (const devMinimum of ["", override]) {
    const fixture = createFixture({ devMinimum });
    try {
      const result = fixture.run();
      assert.equal(result.status, 0, result.stderr);
      const latest = fixture.readCalls().find(({ args }) =>
        args.includes("s3://test-bucket/latest/manifest.json")
      );
      assert.equal(latest.manifest.minNativeVersion, devMinimum || configuredMinimum);
      assert.equal(latest.manifest.channel, "dev");
    } finally {
      fixture.cleanup();
    }
  }
});

test("잘못된 개발 최소 버전과 운영 채널에 입력한 개발 최소 버전은 업로드 전에 거절한다", () => {
  for (const [channel, devMinimum, error] of [
    ["dev", "1.1", /numeric x.y.z/],
    ["prod", "1.1.0", /only supported for dev/],
  ]) {
    const fixture = createFixture({ channel, version: "1.1.2", devMinimum });
    try {
      const result = fixture.run();
      assert.equal(result.status, 1);
      assert.match(result.stderr, error);
      assert.deepEqual(fixture.readCalls(), []);
    } finally {
      fixture.cleanup();
    }
  }
});

function createFixture({ failCopy = false, failList = false, rmFailures = 0, languagePack, channel = "dev", version = "1.0.6", releases, devMinimum = "" }) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "routeone-r2-publish-test-"));
  const binDirectory = join(fixtureRoot, "bin");
  const distDirectory = join(fixtureRoot, "dist");
  const logPath = join(fixtureRoot, "aws-calls.jsonl");
  const rmCountPath = join(fixtureRoot, "rm-count.txt");

  mkdirSync(binDirectory, { recursive: true });
  mkdirSync(distDirectory, { recursive: true });
  const meta = languagePack ? `<meta name="masil-english-pack" content="https://bundle.example.com/${languagePack.pack}">` : "";
  writeFileSync(join(distDirectory, "index.html"), `${meta}<main>RouteOne</main>\n`);
  if (languagePack?.source) {
    const file = join(distDirectory, languagePack.pack);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, languagePack.source);
  }
  writeExecutable(join(binDirectory, "zip"), fakeZipSource);
  writeExecutable(join(binDirectory, "aws"), fakeAwsSource);

  const childEnv = {
    ...process.env,
    PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}`,
    CLOUDFLARE_ACCOUNT_ID: "test-account",
    R2_BUCKET_NAME: "test-bucket",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
    R2_PUBLIC_BASE_URL: "https://bundle.example.com",
    ROUTEONE_WEB_BUNDLE_CHANNEL: channel,
    ROUTEONE_DEV_MIN_NATIVE_VERSION: devMinimum,
    ROUTEONE_WEB_BUNDLE_VERSION: version,
    ROUTEONE_WEB_BUNDLE_RETENTION: "1",
    ROUTEONE_WEB_BUNDLE_PRUNE_RETRY_DELAY_MS: "0",
    ROUTEONE_WEB_DIST_DIR: distDirectory,
    GITHUB_ACTIONS: "true",
    FAKE_AWS_FAIL_CP: failCopy ? "1" : "0",
    FAKE_AWS_FAIL_LIST: failList ? "1" : "0",
    FAKE_AWS_LOG_PATH: logPath,
    FAKE_AWS_RELEASES_JSON: JSON.stringify({
      Contents: releases ?? [
        {
          Key: "releases/1.0.6/manifest.json",
          LastModified: "2026-09-02T01:00:00.000Z"
        },
        {
          Key: "releases/1.0.5/manifest.json",
          LastModified: "2026-09-01T01:00:00.000Z"
        }
      ]
    }),
    FAKE_AWS_RM_COUNT_PATH: rmCountPath,
    FAKE_AWS_RM_FAILURES: String(rmFailures)
  };

  delete childEnv.AWS_MAX_ATTEMPTS;
  delete childEnv.AWS_RETRY_MODE;

  return {
    cleanup() {
      rmSync(fixtureRoot, { force: true, recursive: true });
    },
    readCalls() {
      if (!existsSync(logPath)) {
        return [];
      }

      return readFileSync(logPath, "utf8")
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    },
    run() {
      return spawnSync(process.execPath, [publishScriptPath], {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: childEnv
      });
    }
  };
}

function writeExecutable(filePath, source) {
  writeFileSync(filePath, source);
  chmodSync(filePath, 0o755);
}

function isRemoveCall(call) {
  return call.args[0] === "s3" && call.args[1] === "rm";
}

function assertLatestWasActivatedBeforeCleanup(calls) {
  const latestUploadIndex = calls.findIndex(
    (call) =>
      call.args[0] === "s3" &&
      call.args[1] === "cp" &&
      call.args.includes("s3://test-bucket/latest/manifest.json")
  );
  const firstRemoveIndex = calls.findIndex(isRemoveCall);

  assert.notEqual(latestUploadIndex, -1);
  assert.notEqual(firstRemoveIndex, -1);
  assert.equal(latestUploadIndex < firstRemoveIndex, true);
}
