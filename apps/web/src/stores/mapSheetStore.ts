import { create } from "zustand";

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
  selectedPlace: MapSheetPlace | null;
  savedPlaceIds: string[];
  openSheet: (place: MapSheetPlace) => void;
  closeSheet: () => void;
  toggleSavedPlace: (placeId: string) => void;
};

export const useMapSheetStore = create<MapSheetState>((set) => ({
  isOpen: false,
  selectedPlace: null,
  savedPlaceIds: [],
  openSheet: (place) =>
    set({
      isOpen: true,
      selectedPlace: place,
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
