import { create } from "zustand";
import { DEFAULT_GANGWON_REGION } from "@/data/gangwonRegions";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";

type VisibleSearchState = {
  scope: string;
  count: number;
};

type HomeExploreState = {
  selectedSigunguCode: string;
  isInitialRegionResolved: boolean;
  searchKeyword: string;
  searchFilter: SearchFilter;
  visibleSearchState: VisibleSearchState | null;
  resolveInitialRegion: (sigunguCode: string) => void;
  resetForArea: (defaultSigunguCode: string) => void;
  selectRegion: (sigunguCode: string) => void;
  setSearchKeyword: (keyword: string) => void;
  setSearchFilter: (filter: SearchFilter) => void;
  loadMoreSearchResults: (scope: string, pageSize: number) => void;
};

export const useHomeExploreStore = create<HomeExploreState>((set) => ({
  selectedSigunguCode: DEFAULT_GANGWON_REGION.sigunguCode,
  isInitialRegionResolved: false,
  searchKeyword: "",
  searchFilter: "all",
  visibleSearchState: null,
  resolveInitialRegion: (sigunguCode) =>
    set((state) =>
      state.isInitialRegionResolved
        ? state
        : {
            selectedSigunguCode: sigunguCode,
            isInitialRegionResolved: true,
          }
    ),
  resetForArea: (defaultSigunguCode) =>
    set({
      selectedSigunguCode: defaultSigunguCode,
      isInitialRegionResolved: false,
      searchKeyword: "",
      searchFilter: "all",
      visibleSearchState: null,
    }),
  selectRegion: (sigunguCode) =>
    set({
      selectedSigunguCode: sigunguCode,
      isInitialRegionResolved: true,
    }),
  setSearchKeyword: (searchKeyword) =>
    set({
      searchKeyword,
    }),
  setSearchFilter: (searchFilter) =>
    set({
      searchFilter,
    }),
  loadMoreSearchResults: (scope, pageSize) =>
    set((state) => ({
      visibleSearchState: {
        scope,
        count:
          state.visibleSearchState?.scope === scope
            ? state.visibleSearchState.count + pageSize
            : pageSize * 2,
      },
    })),
}));
