import {
  clearStoredNativeAuthToken,
  NATIVE_AUTH_SESSION_DURATION_MS,
  storeNativeAuthToken,
} from "../../auth/nativeAuthStorage";
import type { NativeAuthTokenMessage } from "./types";

export async function handleNativeAuthTokenMessage(
  message: NativeAuthTokenMessage
) {
  const token = message.token?.trim();

  if (token) {
    const expiresAt =
      typeof message.expiresAt === "number" &&
      Number.isFinite(message.expiresAt) &&
      message.expiresAt > Date.now()
        ? message.expiresAt
        : Date.now() + NATIVE_AUTH_SESSION_DURATION_MS;

    await storeNativeAuthToken(token, expiresAt);

    return {
      token,
      expiresAt,
      reason: null
    } as const;
  }

  await clearStoredNativeAuthToken();

  return {
    token: null,
    expiresAt: null,
    reason: message.reason ?? "logout"
  } as const;
}
