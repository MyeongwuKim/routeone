import {
  clearStoredNativeAuthToken,
  storeNativeAuthToken,
} from "../../auth/nativeAuthStorage";
import type { NativeAuthTokenMessage } from "./types";

export async function handleNativeAuthTokenMessage(
  message: NativeAuthTokenMessage
) {
  const token = message.token?.trim();

  if (token) {
    await storeNativeAuthToken(token);
    return;
  }

  await clearStoredNativeAuthToken();
}
