import { postNativeMessage } from "./runtime";
import type { NativeAuthSessionEndReason } from "./types";

export function updateNativeAuthSession({
  expiresAt,
  reason,
  token,
}: {
  expiresAt: number | null;
  reason?: NativeAuthSessionEndReason;
  token: string | null;
}) {
  return postNativeMessage({
    type: "routeone:native-auth-token",
    token,
    expiresAt,
    reason,
  });
}
