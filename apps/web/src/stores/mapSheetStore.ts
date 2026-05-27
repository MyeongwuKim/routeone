import { create } from "zustand";

export type MapSheetMode = "bottom-sheet" | "full-popup";

export type MapSheetPlace = {
  id: string;
  contentId: string;
  contentTypeId: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeLabel: string;
  categoryName: string;
  icon: string;
  images: string[];
};

type MapSheetState = {
  isOpen: boolean;
  sheetMode: MapSheetMode;
  selectedPlace: MapSheetPlace | null;
  savedPlaceIds: string[];
  openSheet: (
    place: MapSheetPlace,
    options?: {
      mode?: MapSheetMode;
    }
  ) => void;
  setSheetMode: (mode: MapSheetMode) => void;
  closeSheet: () => void;
  toggleSavedPlace: (placeId: string) => void;
};

export const useMapSheetStore = create<MapSheetState>((set) => ({
  isOpen: false,
  sheetMode: "bottom-sheet",
  selectedPlace: null,
  savedPlaceIds: [],
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
    set({
      isOpen: false,
      selectedPlace: null,
    }),
  toggleSavedPlace: (placeId) =>
    set((state) => {
      const exists = state.savedPlaceIds.includes(placeId);
      return {
        savedPlaceIds: exists
          ? state.savedPlaceIds.filter((id) => id !== placeId)
          : [...state.savedPlaceIds, placeId],
      };
    }),
}));
