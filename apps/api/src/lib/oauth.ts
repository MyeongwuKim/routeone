import {
  createPublicKey,
  verify as verifySignature,
  type JsonWebKey,
} from "node:crypto";
import type { OAuthProvider } from "@prisma/client";

type JwtHeader = {
  alg?: string;
  kid?: string;
};

type JwtClaims = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
};

type JwksPayload = {
  keys?: Array<JsonWebKey & { kid?: string; alg?: string }>;
};

export type NativeOAuthLoginInput = {
  provider: OAuthProvider;
  identityToken: string;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

export type VerifiedOAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
};

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const JWKS_CACHE_TTL_MS = 1000 * 60 * 60;
const DEFAULT_APPLE_CLIENT_ID = "com.routeone.app";

const jwksCache = new Map<
  string,
  {
    expiresAt: number;
    payload: JwksPayload;
  }
>();

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;

  return Buffer.from(`${normalized}${"=".repeat(paddingLength)}`, "base64");
}

function decodeJwtPart<T>(value: string) {
  return JSON.parse(decodeBase64Url(value).toString("utf8")) as T;
}

function parseJwt(token: string) {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("OAuth 토큰 형식이 올바르지 않습니다.");
  }

  return {
    header: decodeJwtPart<JwtHeader>(encodedHeader),
    payload: decodeJwtPart<JwtClaims>(encodedPayload),
    signature: decodeBase64Url(encodedSignature),
    signingInput: `${encodedHeader}.${encodedPayload}`,
  };
}

async function fetchJwks(jwksUrl: string) {
  const cached = jwksCache.get(jwksUrl);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const response = await fetch(jwksUrl);

  if (!response.ok) {
    throw new Error("OAuth 공개 키를 불러오지 못했습니다.");
  }

  const payload = (await response.json()) as JwksPayload;

  jwksCache.set(jwksUrl, {
    expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    payload,
  });

  return payload;
}

async function assertJwtSignature({
  header,
  signature,
  signingInput,
  jwksUrl,
}: {
  header: JwtHeader;
  signature: Buffer;
  signingInput: string;
  jwksUrl: string;
}) {
  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("지원하지 않는 OAuth 토큰 서명입니다.");
  }

  const jwks = await fetchJwks(jwksUrl);
  const jwk = jwks.keys?.find((candidate) => candidate.kid === header.kid);

  if (!jwk) {
    jwksCache.delete(jwksUrl);
    throw new Error("OAuth 공개 키를 찾지 못했습니다.");
  }

  const publicKey = createPublicKey({
    key: jwk,
    format: "jwk",
  });
  const isValid = verifySignature(
    "RSA-SHA256",
    Buffer.from(signingInput),
    publicKey,
    signature
  );

  if (!isValid) {
    throw new Error("OAuth 토큰 서명이 올바르지 않습니다.");
  }
}

function readStringClaim(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBooleanClaim(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return typeof value === "string" && value.toLowerCase() === "true";
}

function getAudienceValues(value: unknown) {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  return [];
}

function getCsvEnvValues(...names: string[]) {
  return names.flatMap((name) =>
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function getGoogleClientIds() {
  return Array.from(
    new Set(
      getCsvEnvValues(
        "GOOGLE_CLIENT_IDS",
        "GOOGLE_IOS_CLIENT_ID",
        "GOOGLE_ANDROID_CLIENT_ID",
        "GOOGLE_WEB_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"
      )
    )
  );
}

function getAppleClientIds() {
  return Array.from(
    new Set([
      ...getCsvEnvValues(
        "APPLE_CLIENT_IDS",
        "APPLE_BUNDLE_ID",
        "APPLE_SERVICE_ID",
        "EXPO_PUBLIC_APPLE_CLIENT_ID"
      ),
      DEFAULT_APPLE_CLIENT_ID,
    ])
  );
}

function assertAudience({
  audiences,
  allowedAudiences,
  providerLabel,
}: {
  audiences: string[];
  allowedAudiences: string[];
  providerLabel: string;
}) {
  if (!allowedAudiences.length) {
    throw new Error(`${providerLabel} 클라이언트 ID가 설정되지 않았습니다.`);
  }

  if (!audiences.some((audience) => allowedAudiences.includes(audience))) {
    throw new Error(`${providerLabel} 토큰 대상이 올바르지 않습니다.`);
  }
}

function assertCommonClaims({
  payload,
  allowedIssuers,
  allowedAudiences,
  providerLabel,
}: {
  payload: JwtClaims;
  allowedIssuers: string[];
  allowedAudiences: string[];
  providerLabel: string;
}) {
  const issuer = readStringClaim(payload.iss);
  const expiresAt = typeof payload.exp === "number" ? payload.exp : 0;
  const subject = readStringClaim(payload.sub);

  if (!issuer || !allowedIssuers.includes(issuer)) {
    throw new Error(`${providerLabel} 토큰 발급자가 올바르지 않습니다.`);
  }

  assertAudience({
    audiences: getAudienceValues(payload.aud),
    allowedAudiences,
    providerLabel,
  });

  if (!expiresAt || expiresAt * 1000 <= Date.now()) {
    throw new Error(`${providerLabel} 토큰이 만료되었습니다.`);
  }

  if (!subject) {
    throw new Error(`${providerLabel} 사용자 식별자를 확인하지 못했습니다.`);
  }

  return subject;
}

function getDisplayName(input: NativeOAuthLoginInput, payload: JwtClaims) {
  return (
    readStringClaim(input.displayName) ??
    readStringClaim(payload.name) ??
    readStringClaim(input.email) ??
    readStringClaim(payload.email)
  );
}

async function verifyGoogleIdentityToken(input: NativeOAuthLoginInput) {
  const parsedToken = parseJwt(input.identityToken);

  await assertJwtSignature({
    ...parsedToken,
    jwksUrl: GOOGLE_JWKS_URL,
  });

  const providerAccountId = assertCommonClaims({
    payload: parsedToken.payload,
    allowedIssuers: ["https://accounts.google.com", "accounts.google.com"],
    allowedAudiences: getGoogleClientIds(),
    providerLabel: "Google",
  });
  const tokenEmail = readStringClaim(parsedToken.payload.email);

  return {
    provider: "GOOGLE" as const,
    providerAccountId,
    email: tokenEmail ?? readStringClaim(input.email),
    emailVerified: readBooleanClaim(parsedToken.payload.email_verified),
    displayName: getDisplayName(input, parsedToken.payload),
    avatarUrl:
      readStringClaim(input.avatarUrl) ?? readStringClaim(parsedToken.payload.picture),
  };
}

async function verifyAppleIdentityToken(input: NativeOAuthLoginInput) {
  const parsedToken = parseJwt(input.identityToken);

  await assertJwtSignature({
    ...parsedToken,
    jwksUrl: APPLE_JWKS_URL,
  });

  const providerAccountId = assertCommonClaims({
    payload: parsedToken.payload,
    allowedIssuers: ["https://appleid.apple.com"],
    allowedAudiences: getAppleClientIds(),
    providerLabel: "Apple",
  });
  const tokenEmail = readStringClaim(parsedToken.payload.email);

  return {
    provider: "APPLE" as const,
    providerAccountId,
    email: tokenEmail ?? readStringClaim(input.email),
    emailVerified: readBooleanClaim(parsedToken.payload.email_verified),
    displayName: getDisplayName(input, parsedToken.payload),
    avatarUrl: readStringClaim(input.avatarUrl),
  };
}

export async function verifyNativeOAuthIdentity(
  input: NativeOAuthLoginInput
): Promise<VerifiedOAuthIdentity> {
  if (!input.identityToken.trim()) {
    throw new Error("OAuth 토큰이 비어있습니다.");
  }

  if (input.provider === "GOOGLE") {
    return verifyGoogleIdentityToken(input);
  }

  if (input.provider === "APPLE") {
    return verifyAppleIdentityToken(input);
  }

  throw new Error("지원하지 않는 OAuth 제공자입니다.");
}
