/**
 * 호출 위치: 앱 루트 → 앱 시작 및 설정에서 복귀
 *
 * 용도:
 * 권한 변경을 전역 상태에 반영하고 사용할 수 없게 된 현재 위치를 비운다.
 *
 * 동작 방식:
 * 네이티브 복귀, 포커스, 화면 표시 이벤트에서 권한을 먼저 읽는다.
 * 위치 사용이 허용된 경우에만 좌표를 다시 조회하며 구독은 한 곳에서 관리한다.
 */
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import { useNativeAppInfoStore } from "@/stores/nativeAppInfoStore";
import { subscribeNativeAppActive } from "./events";
import { isNativeRuntime, isNativeTestAccountMode } from "./runtime";

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
