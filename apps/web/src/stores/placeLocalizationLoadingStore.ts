import { create } from "zustand";

type PlaceLocalizationLoadingState = {
  activeRequestCount: number;
};

export const usePlaceLocalizationLoadingStore =
  create<PlaceLocalizationLoadingState>(() => ({
    activeRequestCount: 0,
  }));

export function beginPlaceLocalizationRequest() {
  usePlaceLocalizationLoadingStore.setState((state) => ({
    activeRequestCount: state.activeRequestCount + 1,
  }));
}

export function finishPlaceLocalizationRequest() {
  usePlaceLocalizationLoadingStore.setState((state) => ({
    activeRequestCount: Math.max(0, state.activeRequestCount - 1),
  }));
}
