import { create } from "zustand";
import type { MapSheetPlace } from "@/types/place";

export type MapSheetMode =
  | "bottom-sheet"
  | "full-popup"
  | "directions-popup";

export type MapSheetDirectionOrigin = {
  coordinates: {
    lat: number;
    lng: number;
  };
  label: string;
  isCurrentLocation: boolean;
};

export type MapSheetContextAction = {
  label: string;
  onSelect: (place: MapSheetPlace) => void;
};

type MapSheetState = {
  isOpen: boolean;
  sheetMode: MapSheetMode;
  sheetResetVersion: number;
  directionOrigin: MapSheetDirectionOrigin | null;
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
  contextAction: MapSheetContextAction | null;
  selectedPlace: MapSheetPlace | null;
  openSheet: (
    place: MapSheetPlace,
    options?: {
      directionOrigin?: MapSheetDirectionOrigin;
      fallbackDirectionOrigin?: MapSheetDirectionOrigin;
      contextAction?: MapSheetContextAction;
      mode?: MapSheetMode;
    }
  ) => void;
  updateSelectedPlace: (place: MapSheetPlace) => void;
  setSheetMode: (mode: MapSheetMode) => void;
  closeSheet: () => void;
  resetSheet: () => void;
};

const getClosedSheetState = (sheetResetVersion: number) => ({
  isOpen: false,
  sheetMode: "bottom-sheet" as const,
  directionOrigin: null,
  fallbackDirectionOrigin: null,
  contextAction: null,
  selectedPlace: null,
  sheetResetVersion: sheetResetVersion + 1,
});

export const useMapSheetStore = create<MapSheetState>((set) => ({
  isOpen: false,
  sheetMode: "bottom-sheet",
  sheetResetVersion: 0,
  directionOrigin: null,
  fallbackDirectionOrigin: null,
  contextAction: null,
  selectedPlace: null,
  openSheet: (place, options) =>
    set({
      isOpen: true,
      sheetMode: options?.mode ?? "bottom-sheet",
      directionOrigin: options?.directionOrigin ?? null,
      fallbackDirectionOrigin: options?.fallbackDirectionOrigin ?? null,
      contextAction: options?.contextAction ?? null,
      selectedPlace: place,
    }),
  updateSelectedPlace: (place) =>
    set((state) =>
      state.selectedPlace?.id === place.id
        ? {
            selectedPlace: place,
          }
        : state
    ),
  setSheetMode: (mode) =>
    set({
      sheetMode: mode,
    }),
  closeSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
  resetSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
}));
