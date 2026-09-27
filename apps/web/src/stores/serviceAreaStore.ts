/**
 * 용도:
 * 개발·검수 환경에서 홈 지도와 관광지 조회에 적용할 서비스 지역을 공유한다.
 * 지역 선택 화면, 홈 데이터 조회, 지도 중심과 지역 목록이 같은 지역 설정을 사용할 때 참조한다.
 *
 * 동작 방식:
 * 선택한 지역 ID를 localStorage에 저장하고 유효한 값만 복원한다.
 * 일반 운영 환경에서는 저장된 선택과 무관하게 기본 서비스 지역을 반환한다.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_SERVICE_AREA,
  getServiceArea,
  isServiceAreaId,
  type ServiceAreaId,
} from "@/data/serviceAreas";

type ServiceAreaState = {
  /** 개발·검수 환경에서 선택한 서비스 지역 ID. 운영 환경의 실제 적용값과는 구분된다. */
  selectedAreaId: ServiceAreaId;
  /** 선택 지역을 교체하고 localStorage 영속 저장 대상에 반영한다. */
  setSelectedAreaId: (areaId: ServiceAreaId) => void;
};

type PersistedServiceAreaState = Pick<ServiceAreaState, "selectedAreaId">;

/** Vite 개발 모드 또는 네이티브 개발 번들에서만 서비스 지역 선택 기능을 활성화한다. */
export function isDevelopmentServiceAreaEnabled() {
  if (import.meta.env.DEV) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const runtimeVariant =
    window.RouteOneRuntimeConfig?.nativeAppVariant?.trim().toLowerCase() ||
    window.RouteOneRuntimeConfig?.webBundleChannel?.trim().toLowerCase();

  return runtimeVariant === "dev";
}

/** 개발용 지역 선택 가능 여부를 서비스 지역 화면에서 사용하는 이름으로 반환한다. */
export function isTestServiceAreaEnabled() {
  return isDevelopmentServiceAreaEnabled();
}

/** 지역 선택 기능이 비활성화된 운영 환경에서는 저장값 대신 기본 서비스 지역 ID를 반환한다. */
export function getEffectiveServiceAreaId(selectedAreaId: ServiceAreaId) {
  return isTestServiceAreaEnabled()
    ? selectedAreaId
    : DEFAULT_SERVICE_AREA.id;
}

export const useServiceAreaStore = create<ServiceAreaState>()(
  persist(
    (set) => ({
      selectedAreaId: DEFAULT_SERVICE_AREA.id,
      setSelectedAreaId: (selectedAreaId) => set({ selectedAreaId }),
    }),
    {
      name: "routeone-dev-service-area",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): PersistedServiceAreaState => ({
        selectedAreaId: state.selectedAreaId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedServiceAreaState>;

        return {
          ...currentState,
          selectedAreaId: isServiceAreaId(persisted.selectedAreaId)
            ? persisted.selectedAreaId
            : currentState.selectedAreaId,
        };
      },
    }
  )
);

/** Store의 선택값과 실행 환경을 반영해 홈 화면이 실제 사용할 서비스 지역 설정을 반환한다. */
export function useEffectiveServiceArea() {
  const selectedAreaId = useServiceAreaStore(
    (state) => state.selectedAreaId
  );

  return getServiceArea(getEffectiveServiceAreaId(selectedAreaId));
}
