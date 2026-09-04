import assert from "node:assert/strict";
import test from "node:test";
import { resolveApiSentryEnvironment } from "../src/monitoring/sentry.ts";

test("API Sentry 환경은 로컬 실행을 local로 구분한다", () => {
  assert.equal(resolveApiSentryEnvironment({}), "local");
  assert.equal(
    resolveApiSentryEnvironment({ NODE_ENV: "development" }),
    "local"
  );
});

test("운영 서버는 NODE_ENV를 기준으로 prod를 적용한다", () => {
  assert.equal(
    resolveApiSentryEnvironment({ NODE_ENV: "production" }),
    "prod"
  );
});

test("명시한 API 환경은 NODE_ENV보다 우선한다", () => {
  assert.equal(
    resolveApiSentryEnvironment({
      NODE_ENV: "production",
      ROUTEONE_ENV: "dev",
    }),
    "dev"
  );
  assert.equal(
    resolveApiSentryEnvironment({
      NODE_ENV: "production",
      SENTRY_ENVIRONMENT: "local",
    }),
    "local"
  );
});
