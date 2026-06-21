import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { GraphQLContext } from "../context.js";

type AuthTokenPayload = {
  userId: string;
  exp: number;
};

const TOKEN_PREFIX = "routeone";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;

function getAuthSecret() {
  return (
    process.env.AUTH_TOKEN_SECRET ??
    process.env.AUTH_SECRET ??
    "routeone-local-dev-secret"
  );
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(paddingLength)}`, "base64").toString(
    "utf8"
  );
}

function signPayload(payload: string) {
  return toBase64Url(createHmac("sha256", getAuthSecret()).update(payload).digest());
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function normalizeAccountId(value: string) {
  return value.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");

  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, hash] = passwordHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const candidateHash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString(
    "hex"
  );

  return safeEqual(candidateHash, hash);
}

export function createAuthToken(userId: string) {
  const payload: AuthTokenPayload = {
    userId,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));

  return `${TOKEN_PREFIX}.${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyAuthToken(token: string | null | undefined) {
  if (!token) {
    return null;
  }

  const [prefix, encodedPayload, signature] = token.split(".");

  if (
    prefix !== TOKEN_PREFIX ||
    !encodedPayload ||
    !signature ||
    !safeEqual(signature, signPayload(encodedPayload))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as AuthTokenPayload;

    if (!payload.userId || payload.exp < Date.now()) {
      return null;
    }

    return payload.userId;
  } catch {
    return null;
  }
}

export function readBearerToken(authorization?: string | string[]) {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

export function requireUser(context: GraphQLContext) {
  return context.user;
}
