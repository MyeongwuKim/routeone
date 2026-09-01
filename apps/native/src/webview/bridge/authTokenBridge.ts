import {
  enqueueNativeAuthSessionOperation,
  isNativeSessionCleanupPending,
  NATIVE_AUTH_SESSION_DURATION_MS,
  readStoredNativeAuthSession,
  storeNativeAuthToken,
} from "@/auth/nativeAuthStorage";
import { clearNativeSessionForAccountChange } from "@/auth/nativeSessionCleanup";
import { setNativeRouteArrivalTestPosition } from "./locationBridge";
import { resetNativeRouteArrivalTestState } from "./routeArrivalNotificationBridge";
import type { NativeAuthTokenMessage } from "./types";

async function updateNativeAuthToken(
  message: NativeAuthTokenMessage
) {
  const token = message.token?.trim();
  const sessionId = message.sessionId.trim();
  const [storedSession, hasPendingSessionCleanup] =
    await Promise.all([
      readStoredNativeAuthSession(),
      isNativeSessionCleanupPending()
    ]);

  if (storedSession.sessionId !== sessionId) {
    throw new Error("Stale native auth session message ignored");
  }

  if (token) {
    if (hasPendingSessionCleanup || !storedSession.token) {
      throw new Error("Inactive native auth session update ignored");
    }

    const expiresAt =
      typeof message.expiresAt === "number" &&
      Number.isFinite(message.expiresAt) &&
      message.expiresAt > Date.now()
        ? message.expiresAt
        : Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;

    await storeNativeAuthToken(
      token,
      expiresAt,
      storedSession.role ?? "USER",
      sessionId
    );

    return {
      token,
      expiresAt,
      sessionId,
      reason: null
    } as const;
  }

  await clearNativeSessionForAccountChange();
  setNativeRouteArrivalTestPosition(null);
  resetNativeRouteArrivalTestState();

  return {
    token: null,
    expiresAt: null,
    sessionId: null,
    reason: message.reason ?? "logout"
  } as const;
}

export function handleNativeAuthTokenMessage(
  message: NativeAuthTokenMessage
) {
  return enqueueNativeAuthSessionOperation(() =>
    updateNativeAuthToken(message)
  );
}
