/**
 * 용도:
 * 계정 기능에서 로그인을 요청하고 현재 작업 위치를 유지한다.
 *
 * 동작 방식:
 * 네이티브에서는 로그인 화면을 요청한다. 웹에서는 복귀할 경로와, 필요한 경우 유지할 배경 화면을 함께 전달한다.
 */
import { useCallback } from "react";
import { createPath, useLocation, useNavigate, type Location } from "react-router-dom";
import { nativeBridge } from "@/native-bridge";

type LoginRequestOptions = {
  /** 일정 결과처럼 로그인 화면을 여는 동안 마운트를 유지해야 하는 화면에만 적용한다. */
  preserveCurrentScreen?: boolean;
};

/** 로그인 성공 후 돌아갈 앱 내부 경로와, 그 경로와 일치하는 배경 화면만 읽는다. */
export function getLoginNavigation(state: unknown): {
  returnTo: string;
  backgroundLocation?: Location;
} {
  const { returnTo, backgroundLocation } = (state ?? {}) as {
    returnTo?: unknown;
    backgroundLocation?: Partial<Location>;
  };
  const defaultNavigation = { returnTo: "/home" };

  if (typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//") || returnTo.includes("\\")) {
    return defaultNavigation;
  }

  let validatedReturnTo: string;
  try {
    const appOrigin = "https://app.local";
    const url = new URL(returnTo, appOrigin);
    if (url.origin !== appOrigin || url.pathname.toLowerCase().replace(/\/+$/, "") === "/login") {
      return defaultNavigation;
    }
    validatedReturnTo = createPath(url);
  } catch {
    return defaultNavigation;
  }

  if (
    typeof backgroundLocation?.pathname === "string" &&
    typeof backgroundLocation.search === "string" &&
    typeof backgroundLocation.hash === "string" &&
    typeof backgroundLocation.key === "string" &&
    createPath(backgroundLocation) === validatedReturnTo
  ) {
    return { returnTo: validatedReturnTo, backgroundLocation: backgroundLocation as Location };
  }

  return { returnTo: validatedReturnTo };
}

/**
 * 네이티브 로그인 요청을 먼저 시도한다. 웹에서는 로그인 경로로 이동하며, 화면 유지 옵션이 있으면
 * 로그인 중에도 기존 화면을 배경으로 렌더링할 수 있도록 현재 Location을 전달한다.
 */
export function useLoginRequest() {
  const location = useLocation();
  const navigate = useNavigate();

  return useCallback(
    (source?: string, options?: LoginRequestOptions) => {
      if (nativeBridge.auth.requestLogin(source)) {
        return;
      }

      navigate("/login", {
        state: {
          returnTo: createPath(location),
          backgroundLocation: options?.preserveCurrentScreen ? location : undefined,
        },
      });
    },
    [location, navigate]
  );
}
