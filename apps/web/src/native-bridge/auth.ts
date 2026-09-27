
import { postNativeMessage } from "./runtime";
import type { NativeAuthSessionEndReason } from "./types";

/**
 * 웹 인증 토큰과 만료 시각을 현재 네이티브 인증 세션 ID와 함께 전달한다.
 * token이 null이면 reason으로 로그아웃·만료 원인을 알리며, WebView가 메시지를 받았는지 반환한다.
 */
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
    sessionId:
      window.__ROUTEONE_NATIVE_AUTH_SESSION_ID__ ?? "",
    token,
    expiresAt,
    reason,
  });
}

/** 로그인이 필요한 웹 기능의 source를 네이티브에 전달해 앱 로그인 화면 열기를 요청한다. */
export function requestNativeLogin(source?: string) {
  return postNativeMessage({
    type: "routeone:native-login-request",
    source,
  });
}
