/**
 * 용도:
 * 전역으로 갱신되는 앱 정보와 권한 조회 상태를 화면에 제공한다.
 * 권한 재조회와 앱 복귀 감지는 앱 루트에서 한 번만 연결한다.
 */
import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { isNativeRuntime } from "./runtime";

export type { NativeAppInfoState } from "@/stores/nativeAppInfoStore";

export function useNativeAppInfo() {
  const appInfoState = useNativeAppInfoStore((state) => state.appInfoState);
  const isRefreshing = useNativeAppInfoStore((state) => state.isRefreshing);
  const nativeRuntime = isNativeRuntime();
  const appInfo = appInfoState.info;

  return {
    appInfoState,
    isNativeRuntime: nativeRuntime,
    isPermissionLookupPending:
      nativeRuntime && (appInfoState.status === "loading" || isRefreshing),
    isNativeBridgePending:
      nativeRuntime &&
      appInfoState.status === "success" &&
      appInfo !== null &&
      appInfo.platform === "native" &&
      !appInfo.appVersion,
  };
}
