/** 설정에서 정한 기본 권역·시군구를 저장하고 앱 재실행 시 복원한다. 일시적인 지도 탐색은 homeExploreStore에 맡긴다. */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import {
  DEFAULT_SERVICE_AREA,
  getServiceArea,
  isServiceAreaId,
  type ServiceAreaId,
} from "@/data/serviceAreas";

type ServiceAreaState = {
  /** 설정에 저장한 기본 시·도. 처음에는 강원을 사용한다. */
  selectedAreaId: ServiceAreaId;
  /** 기본 권역에 속하는 관광공사 시군구 코드. null이면 최초 진입 시 현재 위치로 결정한다. */
  selectedRegionCode: string | null;
  /** 권역과 시군구를 함께 변경한다. 다른 권역의 코드는 저장하지 않는다. */
  setSelectedRegion: (areaId: ServiceAreaId, regionCode: string) => void;
};

type PersistedServiceAreaState = Pick<ServiceAreaState, "selectedAreaId" | "selectedRegionCode">;

/** 실행 환경과 관계없이 사용자가 선택한 권역을 적용한다. */
export function getEffectiveServiceAreaId(selectedAreaId: ServiceAreaId) {
  return selectedAreaId;
}

export const useServiceAreaStore = create<ServiceAreaState>()(
  persist(
    (set) => ({
      selectedAreaId: DEFAULT_SERVICE_AREA.id,
      selectedRegionCode: null,
      setSelectedRegion: (selectedAreaId, selectedRegionCode) => {
        if (getServiceArea(selectedAreaId).regions.some((region) => region.sigunguCode === selectedRegionCode)) {
          set({ selectedAreaId, selectedRegionCode });
        }
      },
    }),
    {
      // 기존 개발용 선택값도 이어서 복원한다.
      name: "routeone-dev-service-area",
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state): PersistedServiceAreaState => ({
        selectedAreaId: state.selectedAreaId,
        selectedRegionCode: state.selectedRegionCode,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<PersistedServiceAreaState> | null;
        const selectedAreaId = isServiceAreaId(persisted?.selectedAreaId)
          ? persisted.selectedAreaId
          : currentState.selectedAreaId;
        const savedRegionCode = persisted?.selectedRegionCode;
        const selectedRegionCode = typeof savedRegionCode === "string" &&
          getServiceArea(selectedAreaId).regions.some((region) => region.sigunguCode === savedRegionCode)
          ? savedRegionCode
          : null;
        return { ...currentState, selectedAreaId, selectedRegionCode };
      },
    }
  )
);

/** 내 정보·지역 설정·알림 지역 선택의 초기값에 사용할 저장된 기본 권역을 반환한다. */
export function useDefaultServiceArea() {
  const selectedAreaId = useServiceAreaStore((state) => state.selectedAreaId);
  return getServiceArea(getEffectiveServiceAreaId(selectedAreaId));
}

/** 홈과 공유 루트에서는 일시적인 탐색 권역을 우선하고, 아직 탐색하지 않았으면 기본 권역을 사용한다. */
export function useEffectiveServiceArea() {
  const defaultArea = useDefaultServiceArea();
  const exploreAreaId = useHomeExploreStore((state) => state.exploreAreaId);
  return exploreAreaId ? getServiceArea(exploreAreaId) : defaultArea;
}
