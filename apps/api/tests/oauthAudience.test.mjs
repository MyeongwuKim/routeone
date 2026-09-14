import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { verifyNativeOAuthIdentity } from "../src/lib/oauth.ts";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const publicJwk = publicKey.export({ format: "jwk" });

function createAppleIdentityToken(audience) {
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", kid: "test-apple-key" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: "https://appleid.apple.com",
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 60,
      sub: "test-apple-user",
      email: "review@example.com",
      email_verified: "true",
    }),
  ).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    privateKey,
  ).toString("base64url");

  return `${signingInput}.${signature}`;
}

test("테스트와 운영 iOS 앱의 Apple 로그인 토큰을 모두 허용한다", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(url, "https://appleid.apple.com/auth/keys");
    return new Response(
      JSON.stringify({
        keys: [{ ...publicJwk, kid: "test-apple-key", alg: "RS256" }],
      }),
      { status: 200 },
    );
  };

  try {
    for (const audience of [
      "com.routeone.app.dev",
      "com.myeongwukim.routeone",
    ]) {
      const identity = await verifyNativeOAuthIdentity({
        provider: "APPLE",
        identityToken: createAppleIdentityToken(audience),
      });

      assert.equal(identity.providerAccountId, "test-apple-user");
      assert.equal(identity.email, "review@example.com");
    }

    await assert.rejects(
      verifyNativeOAuthIdentity({
        provider: "APPLE",
        identityToken: createAppleIdentityToken("com.other.app"),
      }),
      /Apple 토큰 대상이 올바르지 않습니다/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
