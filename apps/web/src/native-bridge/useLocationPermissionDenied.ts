import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { isNativeRuntime, isNativeTestAccountMode } from "./runtime";

/**
 * 전역 앱 정보에서 위치 권한을 구독하고 네이티브 일반 계정의 확인된 값이 denied일 때만 true를 반환한다.
 * 웹·테스트 계정·로딩·조회 오류·undetermined 상태는 권한 거부로 취급하지 않는다.
 */
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
