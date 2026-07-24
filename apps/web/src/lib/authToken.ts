import { nativeBridge } from "@/native-bridge";

const AUTH_TOKEN_STORAGE_KEY = "routeone.authToken";
const AUTH_SESSION_EXPIRES_AT_STORAGE_KEY =
  "routeone.authSessionExpiresAt";
const AUTH_SESSION_EXPIRED_STORAGE_KEY = "routeone.authSessionExpired";
const AUTH_SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

type AuthSessionEndReason = "logout" | "expired";

function postNativeAuthToken(
  token: string | null,
  expiresAt: number | null,
  reason?: AuthSessionEndReason
) {
  nativeBridge.auth.updateSession({
    token,
    expiresAt,
    reason,
  });
}

function createAuthSessionExpiresAt() {
  return Date.now() + AUTH_SESSION_DURATION_MS;
}

export function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

  if (!token) {
    return null;
  }

  const storedExpiresAt = Number(
    window.localStorage.getItem(AUTH_SESSION_EXPIRES_AT_STORAGE_KEY)
  );
  const expiresAt =
    Number.isFinite(storedExpiresAt) && storedExpiresAt > 0
      ? storedExpiresAt
      : createAuthSessionExpiresAt();

  if (expiresAt <= Date.now()) {
    clearAuthToken("expired");
    return null;
  }

  if (expiresAt !== storedExpiresAt) {
    window.localStorage.setItem(
      AUTH_SESSION_EXPIRES_AT_STORAGE_KEY,
      String(expiresAt)
    );
  }

  return token;
}

export function hasStoredAuthToken() {
  return (
    typeof window !== "undefined" &&
    Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY))
  );
}

export function setAuthToken(token: string) {
  const expiresAt = createAuthSessionExpiresAt();

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.localStorage.setItem(
    AUTH_SESSION_EXPIRES_AT_STORAGE_KEY,
    String(expiresAt)
  );
  window.localStorage.removeItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
  postNativeAuthToken(token, expiresAt);
}

export function clearAuthToken(reason: AuthSessionEndReason = "logout") {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_SESSION_EXPIRES_AT_STORAGE_KEY);

  if (reason === "expired") {
    window.localStorage.setItem(AUTH_SESSION_EXPIRED_STORAGE_KEY, "true");
  } else {
    window.localStorage.removeItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
  }

  postNativeAuthToken(null, null, reason);
}

export function consumeAuthSessionExpired() {
  if (typeof window === "undefined") {
    return false;
  }

  const isExpired =
    window.localStorage.getItem(AUTH_SESSION_EXPIRED_STORAGE_KEY) === "true";

  if (isExpired) {
    window.localStorage.removeItem(AUTH_SESSION_EXPIRED_STORAGE_KEY);
  }

  return isExpired;
}
