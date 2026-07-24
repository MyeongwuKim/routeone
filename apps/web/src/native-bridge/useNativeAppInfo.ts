import { useEffect, useState } from "react";
import { getNativeAppInfo } from "./appInfo";
import { subscribeNativeAppActive } from "./events";
import { isNativeRuntime } from "./runtime";
import type { NativeAppInfo } from "./types";

export type NativeAppInfoState =
  | {
      status: "loading";
      info: null;
    }
  | {
      status: "success";
      info: NativeAppInfo;
    }
  | {
      status: "error";
      info: null;
    };

const PERMISSION_LOOKUP_TIMEOUT_MS = 3_000;

export function useNativeAppInfo() {
  const [appInfoState, setAppInfoState] = useState<NativeAppInfoState>({
    status: "loading",
    info: null,
  });
  const [permissionLookupTimedOut, setPermissionLookupTimedOut] =
    useState(false);
  const nativeRuntime = isNativeRuntime();

  useEffect(() => {
    let isMounted = true;
    let permissionTimeoutId: number | null = null;
    let latestRequestId = 0;

    const clearPermissionTimeout = () => {
      if (permissionTimeoutId !== null) {
        window.clearTimeout(permissionTimeoutId);
        permissionTimeoutId = null;
      }
    };

    const loadAppInfo = () => {
      const requestId = ++latestRequestId;

      if (nativeRuntime) {
        clearPermissionTimeout();
        setPermissionLookupTimedOut(false);
        permissionTimeoutId = window.setTimeout(() => {
          if (isMounted && requestId === latestRequestId) {
            setPermissionLookupTimedOut(true);
          }
        }, PERMISSION_LOOKUP_TIMEOUT_MS);
      }

      void getNativeAppInfo()
        .then((info) => {
          if (!isMounted || requestId !== latestRequestId) {
            return;
          }

          setAppInfoState({
            status: "success",
            info,
          });

          const hasAllPermissionStatuses = [
            info.locationPermissionStatus,
            info.notificationPermissionStatus,
            info.cameraPermissionStatus,
          ].every((status) => status !== null && status !== undefined);

          if (hasAllPermissionStatuses) {
            clearPermissionTimeout();
          }
        })
        .catch(() => {
          if (!isMounted || requestId !== latestRequestId) {
            return;
          }

          clearPermissionTimeout();
          setPermissionLookupTimedOut(true);
          setAppInfoState({
            status: "error",
            info: null,
          });
        });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadAppInfo();
      }
    };

    loadAppInfo();
    window.addEventListener("focus", loadAppInfo);
    const unsubscribeAppActive = subscribeNativeAppActive(loadAppInfo);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearPermissionTimeout();
      window.removeEventListener("focus", loadAppInfo);
      unsubscribeAppActive();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [nativeRuntime]);

  const appInfo = appInfoState.info;

  return {
    appInfoState,
    isNativeRuntime: nativeRuntime,
    isPermissionLookupPending:
      nativeRuntime &&
      appInfoState.status !== "error" &&
      !permissionLookupTimedOut,
    isNativeBridgePending:
      nativeRuntime &&
      appInfoState.status === "success" &&
      appInfo !== null &&
      appInfo.platform === "native" &&
      !appInfo.appVersion,
  };
}
