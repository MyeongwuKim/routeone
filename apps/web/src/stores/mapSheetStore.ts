import { create } from "zustand";

export type MapSheetMode = "bottom-sheet" | "full-popup";

export type MapSheetPlace = {
  id: string;
  contentId: string;
  contentTypeId: string;
  areaCode: string;
  signguCode: string;
  touristTrendName: string;
  topRank: number | null;
  title: string;
  address: string;
  lat: number;
  lng: number;
  contentTypeLabel: string;
  categoryName: string;
  icon: string;
  images: string[];
};

export type SavedPlaceItem = {
  id: string;
  place: MapSheetPlace;
  thumbnailUrl: string;
  savedAt: number;
};

type MapSheetState = {
  isOpen: boolean;
  sheetMode: MapSheetMode;
  sheetResetVersion: number;
  isSavedListOpen: boolean;
  selectedPlace: MapSheetPlace | null;
  savedPlaceIds: string[];
  savedPlaces: SavedPlaceItem[];
  openSheet: (
    place: MapSheetPlace,
    options?: {
      mode?: MapSheetMode;
    }
  ) => void;
  openSavedList: () => void;
  closeSavedList: () => void;
  setSheetMode: (mode: MapSheetMode) => void;
  closeSheet: () => void;
  resetSheet: () => void;
  toggleSavedPlace: (place: MapSheetPlace, thumbnailUrl?: string) => void;
  removeSavedPlace: (placeId: string) => void;
  clearSavedPlaces: () => void;
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
  isSavedListOpen: false,
  selectedPlace: null,
  savedPlaceIds: [],
  savedPlaces: [],
  openSheet: (place, options) =>
    set({
      isOpen: true,
      sheetMode: options?.mode ?? "bottom-sheet",
      selectedPlace: place,
    }),
  openSavedList: () =>
    set({
      isSavedListOpen: true,
    }),
  closeSavedList: () =>
    set({
      isSavedListOpen: false,
    }),
  setSheetMode: (mode) =>
    set({
      sheetMode: mode,
    }),
  closeSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
  resetSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
  toggleSavedPlace: (place, thumbnailUrl = "") =>
    set((state) => {
      const exists = state.savedPlaceIds.includes(place.id);
      return {
        savedPlaceIds: exists
          ? state.savedPlaceIds.filter((id) => id !== place.id)
          : [...state.savedPlaceIds, place.id],
        savedPlaces: exists
          ? state.savedPlaces.filter((item) => item.id !== place.id)
          : [
              {
                id: place.id,
                place,
                thumbnailUrl,
                savedAt: Date.now(),
              },
              ...state.savedPlaces.filter((item) => item.id !== place.id),
            ],
      };
    }),
  removeSavedPlace: (placeId) =>
    set((state) => ({
      savedPlaceIds: state.savedPlaceIds.filter((id) => id !== placeId),
      savedPlaces: state.savedPlaces.filter((item) => item.id !== placeId),
    })),
  clearSavedPlaces: () =>
    set({
      savedPlaceIds: [],
      savedPlaces: [],
    }),
}));
