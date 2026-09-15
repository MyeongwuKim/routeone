/**
 * 용도:
 * 계정 기능에서 로그인을 요청하고 현재 작업 위치를 유지한다.
 *
 * 동작 방식:
 * 네이티브에서는 로그인 화면을 요청하고, 일반 웹에서는 현재 경로를 저장한 뒤 로그인 페이지로 이동한다.
 */
import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { nativeBridge } from "@/native-bridge";

export function useLoginRequest() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (source?: string) => {
      if (nativeBridge.auth.requestLogin(source)) {
        return;
      }

      navigate("/login", {
        state: {
          returnTo: `${location.pathname}${location.search}`,
        },
      });
    },
    [location.pathname, location.search, navigate]
  );
}
