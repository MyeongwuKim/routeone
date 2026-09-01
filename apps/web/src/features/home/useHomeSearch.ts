import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CurrentLocation } from "@/lib/gangwonBoundaryUtils";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";
import {
  readRecentPlaceSearches,
  writeRecentPlaceSearches,
} from "@/lib/recentPlaceSearches";
import { useUiText } from "@/lib/uiText";
import {
  PLACE_SEARCH_FILTERS,
  SEARCH_RESULTS_PAGE_SIZE,
} from "@/pages/HomePage.constants";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { buildHomeSearchResults } from "./homeSearchResults";
import type { HomeAttractionQueryData } from "./useHomeAttractionData";

type UseHomeSearchOptions = {
  hasFestivalSource: boolean;
  selectedSigunguCode: string;
  serviceAreaId: string;
};

type OpenHomeSearchOptions = {
  filter?: SearchFilter;
  keyword?: string;
};

export function useHomeSearch({
  hasFestivalSource,
  selectedSigunguCode,
  serviceAreaId,
}: UseHomeSearchOptions) {
  const text = useUiText();
  const searchKeyword = useHomeExploreStore(
    (state) => state.searchKeyword
  );
  const searchFilter = useHomeExploreStore((state) => state.searchFilter);
  const visibleSearchState = useHomeExploreStore(
    (state) => state.visibleSearchState
  );
  const setSearchKeyword = useHomeExploreStore(
    (state) => state.setSearchKeyword
  );
  const setSearchFilter = useHomeExploreStore(
    (state) => state.setSearchFilter
  );
  const resetSearch = useHomeExploreStore((state) => state.resetSearch);
  const loadMoreSearchResults = useHomeExploreStore(
    (state) => state.loadMoreSearchResults
  );
  const [isSearchPopupOpen, setIsSearchPopupOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(
    readRecentPlaceSearches
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchResultScope = `${serviceAreaId}:${selectedSigunguCode}:${searchFilter}:${searchKeyword}`;
  const visibleSearchResultCount =
    visibleSearchState?.scope === searchResultScope
      ? visibleSearchState.count
      : SEARCH_RESULTS_PAGE_SIZE;
  const placeSearchFilters = useMemo(
    () =>
      PLACE_SEARCH_FILTERS.filter(
        (filter) => hasFestivalSource || filter.key !== "festival"
      ).map((filter) => ({
        ...filter,
        label: text.search.filters[filter.key],
      })),
    [hasFestivalSource, text]
  );

  const appendRecentSearch = useCallback((keyword: string) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) {
      return;
    }

    setRecentSearches((previous) =>
      writeRecentPlaceSearches([
        trimmedKeyword,
        ...previous.filter((item) => item !== trimmedKeyword),
      ])
    );
  }, []);

  const removeRecentSearch = useCallback((keyword: string) => {
    setRecentSearches((previous) =>
      writeRecentPlaceSearches(
        previous.filter((item) => item !== keyword)
      )
    );
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches(writeRecentPlaceSearches([]));
  }, []);

  const openSearchPopup = useCallback(
    (options: OpenHomeSearchOptions = {}) => {
      if (options.filter !== undefined) {
        setSearchFilter(options.filter);
      }
      if (options.keyword !== undefined) {
        setSearchKeyword(options.keyword);
      }
      setIsSearchPopupOpen(true);
    },
    [setSearchFilter, setSearchKeyword]
  );

  const closeSearchPopup = useCallback(() => {
    setIsSearchPopupOpen(false);
    resetSearch();
  }, [resetSearch]);

  const loadMore = useCallback(() => {
    loadMoreSearchResults(searchResultScope, SEARCH_RESULTS_PAGE_SIZE);
  }, [loadMoreSearchResults, searchResultScope]);

  useEffect(() => {
    if (!isSearchPopupOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      document.body.style.overflow = previousOverflow;
    };
  }, [isSearchPopupOpen]);

  useEffect(() => {
    if (!isSearchPopupOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSearchPopup();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeSearchPopup, isSearchPopupOpen]);

  return {
    actions: {
      appendRecentSearch,
      clearRecentSearches,
      closeSearchPopup,
      loadMore,
      openSearchPopup,
      removeRecentSearch,
      setSearchFilter,
      setSearchKeyword,
    },
    isSearchPopupOpen,
    placeSearchFilters,
    recentSearches,
    searchFilter,
    searchInputRef,
    searchKeyword,
    visibleSearchResultCount,
  };
}

type UseHomeSearchResultsOptions = {
  attractionData: HomeAttractionQueryData | undefined;
  currentLocation: CurrentLocation | null;
  searchFilter: SearchFilter;
  searchKeyword: string;
  topRankByAttractionId: Map<string, number>;
  trendNameByAttractionId: Map<string, string>;
  visibleSearchResultCount: number;
};

export function useHomeSearchResults({
  attractionData,
  currentLocation,
  searchFilter,
  searchKeyword,
  topRankByAttractionId,
  trendNameByAttractionId,
  visibleSearchResultCount,
}: UseHomeSearchResultsOptions) {
  const searchResults = useMemo(
    () =>
      buildHomeSearchResults({
        attractionData,
        currentLocation,
        searchFilter,
        searchKeyword,
        topRankByAttractionId,
        trendNameByAttractionId,
      }),
    [
      attractionData,
      currentLocation,
      searchFilter,
      searchKeyword,
      topRankByAttractionId,
      trendNameByAttractionId,
    ]
  );
  const visibleSearchResults = useMemo(
    () => searchResults.slice(0, visibleSearchResultCount),
    [searchResults, visibleSearchResultCount]
  );

  return {
    searchResults,
    visibleSearchResults,
  };
}
