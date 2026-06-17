import { create } from "zustand";
import type { MapSheetPlace } from "@/types/place";

export type MapSheetMode = "bottom-sheet" | "full-popup";

type MapSheetState = {
  isOpen: boolean;
  sheetMode: MapSheetMode;
  sheetResetVersion: number;
  selectedPlace: MapSheetPlace | null;
  openSheet: (
    place: MapSheetPlace,
    options?: {
      mode?: MapSheetMode;
    }
  ) => void;
  setSheetMode: (mode: MapSheetMode) => void;
  closeSheet: () => void;
  resetSheet: () => void;
};

const getClosedSheetState = (sheetResetVersion: number) => ({
  isOpen: false,
  sheetMode: "bottom-sheet" as const,
  selectedPlace: null,
  sheetResetVersion: sheetResetVersion + 1,
});

export const useMapSheetStore = create<MapSheetState>((set) => ({
  isOpen: false,
  sheetMode: "bottom-sheet",
  sheetResetVersion: 0,
  selectedPlace: null,
  openSheet: (place, options) =>
    set({
      isOpen: true,
      sheetMode: options?.mode ?? "bottom-sheet",
      selectedPlace: place,
    }),
  setSheetMode: (mode) =>
    set({
      sheetMode: mode,
    }),
  closeSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
  resetSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
}));
