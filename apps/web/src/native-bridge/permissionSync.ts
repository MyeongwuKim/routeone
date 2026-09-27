import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { subscribeNativeAppActive } from "./events";
import { isNativeRuntime, isNativeTestAccountMode } from "./runtime";

/**
 * 앱 루트에서 권한 Store 변경과 앱 활성화·브라우저 focus·visibility 이벤트를 구독하고 즉시 한 번 동기화한다.
 * 위치 권한이 사라지면 저장 좌표를 무효화하고, 정확도 설정만 바뀌면 좌표 캐시를 비운다.
 * 위치 권한이 있거나 테스트 계정일 때만 좌표를 다시 조회한다.
 * 반환 함수는 예약된 늦은 결과를 무시하게 만들고 Store·DOM·네이티브 이벤트 구독을 모두 해제한다.
 */
export function startNativePermissionSync() {
  let isActive = true;
  let latestSyncId = 0;
  const unsubscribeInfo = useNativeAppInfoStore.subscribe((state, previous) => {
    if (
      !isNativeRuntime() ||
      isNativeTestAccountMode() ||
      state.appInfoState === previous.appInfoState
    ) {
      return;
    }

    const info = state.appInfoState.info;
    if (info?.locationPermissionStatus !== "granted") {
      const positionState = useCurrentPositionStore.getState();
      // 아직 결정하지 않은 권한은 사용자가 시작한 첫 요청에서 허용할 수 있다.
      if (
        info?.locationPermissionStatus !== "undetermined" ||
        positionState.position
      ) {
        positionState.invalidatePosition();
      }
    } else if (
      previous.appInfoState.info?.locationPermissionStatus === "granted" &&
      previous.appInfoState.info.locationAccuracy !== info.locationAccuracy
    ) {
      useCurrentPositionStore.getState().clearPosition();
    }
  });

  const refresh = async ({
    forcePermissionRefresh = false,
    forcePositionRefresh = true,
  } = {}) => {
    const syncId = ++latestSyncId;
    try {
      const info = await useNativeAppInfoStore.getState().refresh({
        forceRefresh: forcePermissionRefresh,
      });
      if (!isActive || syncId !== latestSyncId || !isNativeRuntime()) {
        return;
      }
      if (
        info.locationPermissionStatus === "granted" ||
        isNativeTestAccountMode()
      ) {
        await useCurrentPositionStore
          .getState()
          .requestCurrentPosition({ forceRefresh: forcePositionRefresh });
      }
    } catch {
      // 권한 오류는 공유 상태에, GPS 오류는 현재 위치 상태에 반영된다.
    }
  };
  const handleVisible = () => {
    if (document.visibilityState === "visible") {
      void refresh();
    }
  };
  const unsubscribeActive = subscribeNativeAppActive(() => {
    void refresh({ forcePermissionRefresh: true });
  });
  window.addEventListener("focus", handleVisible);
  document.addEventListener("visibilitychange", handleVisible);
  void refresh({ forcePositionRefresh: false });

  return () => {
    isActive = false;
    latestSyncId += 1;
    unsubscribeInfo();
    unsubscribeActive();
    window.removeEventListener("focus", handleVisible);
    document.removeEventListener("visibilitychange", handleVisible);
  };
}
