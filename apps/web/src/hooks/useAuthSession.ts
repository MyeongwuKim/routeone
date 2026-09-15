/**
 * 용도:
 * WebView와 웹 화면이 현재 로그인 여부를 같은 시점에 반영하게 한다.
 *
 * 동작 방식:
 * 로컬 세션이나 네이티브 세션이 바뀌면 이벤트를 구독해 인증 상태를 다시 읽는다.
 */
import { useEffect, useState } from "react";
import {
  AUTH_SESSION_CHANGE_EVENT,
  getAuthToken,
} from "@/lib/authToken";

export function useAuthSession() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(getAuthToken())
  );

  useEffect(() => {
    const syncAuthSession = () => {
      setIsAuthenticated(Boolean(getAuthToken()));
    };

    window.addEventListener(AUTH_SESSION_CHANGE_EVENT, syncAuthSession);
    window.addEventListener("storage", syncAuthSession);

    return () => {
      window.removeEventListener(AUTH_SESSION_CHANGE_EVENT, syncAuthSession);
      window.removeEventListener("storage", syncAuthSession);
    };
  }, []);

  return { isAuthenticated };
}
