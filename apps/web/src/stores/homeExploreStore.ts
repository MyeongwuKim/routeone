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
  regionScrollLeft: number | null;
  resolveInitialRegion: (sigunguCode: string) => void;
  resetForArea: (defaultSigunguCode: string) => void;
  selectRegion: (sigunguCode: string) => void;
  setRegionScrollLeft: (scrollLeft: number) => void;
  setSearchKeyword: (keyword: string) => void;
  setSearchFilter: (filter: SearchFilter) => void;
  resetSearch: () => void;
  loadMoreSearchResults: (scope: string, pageSize: number) => void;
};

export const useHomeExploreStore = create<HomeExploreState>((set) => ({
  selectedSigunguCode: DEFAULT_GANGWON_REGION.sigunguCode,
  isInitialRegionResolved: false,
  searchKeyword: "",
  searchFilter: "all",
  visibleSearchState: null,
  regionScrollLeft: null,
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
      regionScrollLeft: null,
    }),
  selectRegion: (sigunguCode) =>
    set({
      selectedSigunguCode: sigunguCode,
      isInitialRegionResolved: true,
    }),
  setRegionScrollLeft: (regionScrollLeft) =>
    set({
      regionScrollLeft,
    }),
  setSearchKeyword: (searchKeyword) =>
    set({
      searchKeyword,
    }),
  setSearchFilter: (searchFilter) =>
    set({
      searchFilter,
    }),
  resetSearch: () =>
    set({
      searchKeyword: "",
      searchFilter: "all",
      visibleSearchState: null,
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
