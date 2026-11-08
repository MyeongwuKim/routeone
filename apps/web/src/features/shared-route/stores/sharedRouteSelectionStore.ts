import { createStore, type StateCreator } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import { isServiceAreaId, type ServiceAreaId } from "@/data/serviceAreas";
import type { AppLanguage } from "@/stores/appLanguageStore";
import { EMPTY_SHARED_ROUTE_FILTERS, type SharedRouteFilters } from "../sharedRouteFilters";

type SharedRouteSelection = {
  areaId: ServiceAreaId | null;
  applied: { language: AppLanguage; filters: SharedRouteFilters } | null;
  selectArea: (areaId: ServiceAreaId | null) => void;
  updateFilters: (
    areaId: ServiceAreaId | null,
    language: AppLanguage,
    update: (filters: SharedRouteFilters) => SharedRouteFilters
  ) => void;
};

type PersistedSharedRouteArea = Pick<SharedRouteSelection, "areaId">;

const createSelectionState: StateCreator<SharedRouteSelection> = (set) => ({
  areaId: null,
  applied: null,
  selectArea: (areaId) => set({ areaId, applied: null }),
  updateFilters: (areaId, language, update) => set(({ applied }) => ({
    areaId,
    applied: {
      language,
      filters: update(applied?.language === language ? applied.filters : EMPTY_SHARED_ROUTE_FILTERS),
    },
  })),
});

/** 좋아요 목록에서 화면이 열려 있는 동안 사용할 지역과 적용 필터를 만든다. */
export function createSharedRouteSelectionStore() {
  return createStore(createSelectionState);
}

/** 공개 피드의 시·도는 앱 재실행 때 복원하고, 적용 필터는 앱 세션 동안 유지한다. */
export const sharedRouteFeedSelectionStore = createStore<SharedRouteSelection>()(
  persist(createSelectionState, {
    name: "routeone-shared-route-area",
    storage: createJSONStorage(() => window.localStorage),
    partialize: ({ areaId }): PersistedSharedRouteArea => ({ areaId }),
    merge: (savedState, currentState) => {
      const areaId = (savedState as Partial<PersistedSharedRouteArea> | null)?.areaId;
      return isServiceAreaId(areaId) ? { ...currentState, areaId } : currentState;
    },
  })
);
