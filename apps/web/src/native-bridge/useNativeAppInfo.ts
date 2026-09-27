import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { isNativeRuntime } from "./runtime";

export type { NativeAppInfoState } from "@/stores/nativeAppInfoStore";

/**
 * 전역 앱 정보 Store를 화면용 상태로 조합한다. 권한 조회 대기는 최초 로딩과 강제 갱신을 모두 포함하고,
 * 브리지 대기는 네이티브 플랫폼 응답은 왔지만 앱 버전이 아직 채워지지 않은 경우만 의미한다.
 * 이 Hook은 조회를 시작하거나 앱 복귀를 구독하지 않으며 갱신 연결은 앱 루트의 permissionSync가 담당한다.
 */
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
