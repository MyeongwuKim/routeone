import assert from "node:assert/strict";
import test from "node:test";
import webBundleRuntime from "../config/web-bundle-runtime.json" with { type: "json" };
import {
  parseNumericVersion,
  resolveNativeVersionSeries,
  resolveWebBundleVersion
} from "./resolve-web-bundle-version.mjs";

const productionMinimum = parseNumericVersion(webBundleRuntime.prod.minimumNativeVersion);

test("starts a channel without a manifest at the native major/minor baseline", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 0 },
      latestVersion: null
    }),
    "1.0.0"
  );
});

test("increments only the current channel manifest patch", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 0 },
      latestVersion: "1.0.43"
    }),
    "1.0.44"
  );
});

test("resets the web patch when the native major/minor changes", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 1 },
      latestVersion: "1.0.43"
    }),
    "1.1.0"
  );
});

test("rejects a native version series older than the published web series", () => {
  assert.throws(
    () =>
      resolveWebBundleVersion({
        nativeSeries: { major: 1, minor: 0 },
        latestVersion: "1.1.0"
      }),
    /older than/
  );
});

test("운영 발행은 최소 지원 버전을 충족하는 플랫폼만 대상으로 한다", () => {
  const { major, minor, value } = productionMinimum;
  assert.deepEqual(
    resolveNativeVersionSeries(
      { prod: { ios: value, android: "0.0.0" } },
      "prod"
    ),
    { major, minor }
  );
  assert.throws(
    () => resolveNativeVersionSeries({ prod: { ios: "0.0.0", android: "0.0.0" } }, "prod"),
    /No production native app meets/
  );
});

test("운영 발행 대상인 iOS와 Android는 버전 계열을 맞춘다", () => {
  const { major, minor, value } = productionMinimum;
  assert.throws(
    () =>
      resolveNativeVersionSeries(
        {
          prod: {
            ios: value,
            android: `${major}.${minor + 1}.0`
          }
        },
        "prod"
      ),
    /must share the same major\/minor/
  );
});

test("allows a newer manual version only within the native series", () => {
  assert.equal(
    resolveWebBundleVersion({
      nativeSeries: { major: 1, minor: 1 },
      latestVersion: "1.1.2",
      requestedVersion: "1.1.7"
    }),
    "1.1.7"
  );

  assert.throws(
    () =>
      resolveWebBundleVersion({
        nativeSeries: { major: 1, minor: 1 },
        latestVersion: "1.1.2",
        requestedVersion: "1.0.8"
      }),
    /must match native version series/
  );
});
