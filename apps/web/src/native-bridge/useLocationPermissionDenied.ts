/**
 * 용도:
 * 지도 화면들이 전역 위치 권한의 거부 상태를 같은 기준으로 구독한다.
 *
 * 동작 방식:
 * 실제 네이티브 권한이 거부된 경우에만 안내를 표시한다.
 * 조회 중·조회 실패를 권한 거부로 오인하지 않고 허용된 테스트 모드는 유지한다.
 */
import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { isNativeRuntime, isNativeTestAccountMode } from "./runtime";

export function useLocationPermissionDenied() {
  const permissionStatus = useNativeAppInfoStore(
    (state) => state.appInfoState.info?.locationPermissionStatus
  );

  return (
    isNativeRuntime() &&
    !isNativeTestAccountMode() &&
    permissionStatus === "denied"
  );
}
