import { authApi } from "@/api/authApi";
import {
  clearAuthToken,
  getAuthToken,
  hasStoredAuthToken,
  setAuthToken,
} from "@/lib/authToken";

export type AuthSessionRefreshResult =
  | "refreshed"
  | "expired"
  | "failed"
  | "skipped";

export const AUTH_SESSION_REFRESH_INTERVAL_MS = 1000 * 60 * 60 * 6;

const AUTH_SESSION_REFRESH_MIN_INTERVAL_MS = 1000 * 60 * 5;
const AUTH_SESSION_EXPIRED_ERROR_TEXT = "로그인 세션이 만료";

let lastRefreshAttemptAt = 0;
let refreshRequest: Promise<AuthSessionRefreshResult> | null = null;

function isExpiredSessionError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.includes(AUTH_SESSION_EXPIRED_ERROR_TEXT)
  );
}

export function refreshAuthSessionIfNeeded() {
  const hadStoredToken = hasStoredAuthToken();
  const token = getAuthToken();

  if (!token) {
    return Promise.resolve<AuthSessionRefreshResult>(
      hadStoredToken ? "expired" : "skipped"
    );
  }

  if (refreshRequest) {
    return refreshRequest;
  }

  if (
    Date.now() - lastRefreshAttemptAt <
    AUTH_SESSION_REFRESH_MIN_INTERVAL_MS
  ) {
    return Promise.resolve<AuthSessionRefreshResult>("skipped");
  }

  lastRefreshAttemptAt = Date.now();
  refreshRequest = authApi
    .refreshAuthSession()
    .then((payload) => {
      setAuthToken(payload.refreshAuthSession.token);
      return "refreshed" as const;
    })
    .catch((error: unknown) => {
      if (isExpiredSessionError(error)) {
        clearAuthToken("expired");
        return "expired" as const;
      }

      console.warn(
        "[auth-session] refresh failed",
        error instanceof Error ? error.message : error
      );
      return "failed" as const;
    })
    .finally(() => {
      refreshRequest = null;
    });

  return refreshRequest;
}
