import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveNativeVersionSeries,
  resolveWebBundleVersion
} from "./resolve-web-bundle-version.mjs";

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

test("requires iOS and Android to share a major/minor for one channel", () => {
  assert.throws(
    () =>
      resolveNativeVersionSeries(
        {
          prod: {
            ios: "1.1.0",
            android: "1.0.9"
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
