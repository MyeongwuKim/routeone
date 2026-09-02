import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_SERVICE_AREA,
  getServiceArea,
  isServiceAreaId,
  type ServiceAreaId,
} from "@/data/serviceAreas";

type ServiceAreaState = {
  selectedAreaId: ServiceAreaId;
  setSelectedAreaId: (areaId: ServiceAreaId) => void;
};

type PersistedServiceAreaState = Pick<ServiceAreaState, "selectedAreaId">;

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

export function isTestServiceAreaEnabled() {
  return (
    isDevelopmentServiceAreaEnabled() ||
    (typeof window !== "undefined" &&
      window.RouteOneRuntimeConfig?.testAccountMode === true)
  );
}

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

export function useEffectiveServiceArea() {
  const selectedAreaId = useServiceAreaStore(
    (state) => state.selectedAreaId
  );

  return getServiceArea(getEffectiveServiceAreaId(selectedAreaId));
}
