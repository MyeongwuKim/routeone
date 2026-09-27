/**
 * 홈 화면의 장소 검색을 두 단계로 나눈다.
 * useHomeSearch는 팝업과 검색 조건을 제어하고, useHomeSearchResults는 조회된 관광지를
 * 해당 조건에 맞게 정렬한 뒤 팝업에 표시할 범위까지 계산한다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CurrentLocation } from "@/lib/gangwonBoundaryUtils";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";
import { useUiText } from "@/lib/uiText";
import {
  PLACE_SEARCH_FILTERS,
  SEARCH_RESULTS_PAGE_SIZE,
} from "@/pages/HomePage.constants";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { buildHomeSearchResults } from "./homeSearchResults";
import type { HomeAttractionQueryData } from "./useHomeAttractionData";

type UseHomeSearchOptions = {
  /** true이면 장소 종류 필터에 축제를 포함하고, false이면 축제 필터를 제외한다. */
  hasFestivalSource: boolean;
  /** 더 보기 개수를 서비스 지역별로 구분할 때 사용하는 현재 서비스 지역 ID */
  serviceAreaId: string;
};

type OpenHomeSearchOptions = {
  /** 지정하면 팝업을 열기 전에 현재 장소 종류 필터를 이 값으로 교체한다. */
  filter?: SearchFilter;
  /** 지정하면 팝업을 열기 전에 검색 입력값을 이 문자열로 교체한다. 빈 문자열도 반영한다. */
  keyword?: string;
};

/**
 * 홈 화면에서 전체 화면 장소 검색 팝업을 열고 닫는 동작과 검색 조건을 제공한다.
 *
 * 검색어·필터·조건별 표시 개수는 useHomeExploreStore에서 읽고 변경하며,
 * 팝업 표시 여부와 검색 input ref만 훅 내부에서 관리한다. 팝업을 닫으면 검색어,
 * 필터, 더 보기 상태를 Store의 초기 검색 상태로 되돌린다.
 * 팝업이 열린 동안에는 문서 스크롤을 막고 input에 포커스를 옮기며 Escape 키로 닫을 수 있다.
 */
export function useHomeSearch({
  hasFestivalSource,
  serviceAreaId,
}: UseHomeSearchOptions) {
  const text = useUiText();
  const selectedSigunguCode = useHomeExploreStore(
    (state) => state.selectedSigunguCode
  );
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
  /** 팝업이 열린 다음 프레임에 포커스를 옮길 검색 input 요소를 보관한다. */
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  /** 저장된 더 보기 개수가 현재 서비스 지역·시·군·구·필터·검색어에 속하는지 판별하는 키다. */
  const searchResultScope = `${serviceAreaId}:${selectedSigunguCode}:${searchFilter}:${searchKeyword}`;
  /** 현재 조건에 저장된 개수가 없으면 첫 페이지 크기만 노출한다. */
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

  /**
   * 전달된 filter와 keyword만 검색 상태에 반영한 뒤 팝업을 연다.
   * 생략한 값은 기존 검색 상태를 유지한다.
   */
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

  /** 팝업을 닫고 검색어, 필터, 조건별 더 보기 개수를 초기화한다. */
  const closeSearchPopup = useCallback(() => {
    setIsSearchPopupOpen(false);
    resetSearch();
  }, [resetSearch]);

  /** 현재 검색 조건의 표시 개수를 한 페이지 크기만큼 늘린다. */
  const loadMore = useCallback(() => {
    loadMoreSearchResults(searchResultScope, SEARCH_RESULTS_PAGE_SIZE);
  }, [loadMoreSearchResults, searchResultScope]);

  /**
   * 팝업이 열리면 body 스크롤을 잠그고 다음 프레임에 검색 input으로 포커스를 옮긴다.
   * 닫히거나 훅이 정리되면 예약한 프레임을 취소하고 기존 overflow 값을 복원한다.
   */
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

  /** 팝업이 열린 동안 Escape 입력을 닫기 동작에 연결하고, 닫힐 때 리스너를 해제한다. */
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
      closeSearchPopup,
      loadMore,
      openSearchPopup,
      setSearchFilter,
      setSearchKeyword,
    },
    /** true이면 HomePage가 전체 화면 검색 팝업을 렌더링한다. */
    isSearchPopupOpen,
    /** 축제 데이터 제공 여부를 반영하고 현재 UI 언어의 label을 붙인 장소 종류 필터 목록 */
    placeSearchFilters,
    /** 검색 결과와 지도 마커에 적용할 현재 장소 종류 필터 */
    searchFilter,
    searchInputRef,
    /** 팝업 input에 표시하고 장소명·주소 검색에 사용하는 Store의 검색어 */
    searchKeyword,
    /** 현재 조건에서 visibleSearchResults로 잘라낼 최대 항목 수 */
    visibleSearchResultCount,
  };
}

type UseHomeSearchResultsOptions = {
  /** 검색 대상 관광지 목록과 장소 종류 판정에 필요한 대분류 코드 조회표 */
  attractionData: HomeAttractionQueryData | undefined;
  /** 값이 있으면 각 관광지까지 거리와 거리순 정렬 기준을 계산하는 현재 좌표 */
  currentLocation: CurrentLocation | null;
  /** 전체 결과에서 포함할 장소 종류를 결정하는 필터 */
  searchFilter: SearchFilter;
  /** 앞뒤 공백을 제거한 뒤 장소명·주소·종류명 일치 여부와 우선순위 판정에 사용하는 문자열 */
  searchKeyword: string;
  /** 관광지 ID를 키로 갖는 혼잡도 순위 조회표. 현재 위치가 없을 때 정렬에 사용한다. */
  topRankByAttractionId: Map<string, number>;
  /** 관광지 ID를 키로 갖는 트렌드 표시 이름 조회표. 값이 없으면 관광지명을 사용한다. */
  trendNameByAttractionId: Map<string, string>;
  /** 정렬된 전체 결과의 앞부분에서 팝업에 노출할 최대 항목 수 */
  visibleSearchResultCount: number;
};

/**
 * 홈 관광지 조회 결과를 검색어와 장소 종류로 필터링한다. 검색 일치도를 먼저 비교하고,
 * 현재 위치가 있으면 거리순으로, 없으면 혼잡도 순위와 이름순으로 정렬한다.
 * 정렬한 전체 결과와 현재 더 보기 범위에 해당하는 표시 목록을 반환하며,
 * attractionData가 아직 없으면 두 목록 모두 빈 배열이 된다.
 */
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
    /** 현재 검색 조건을 통과해 표시 우선순위대로 정렬된 전체 결과 */
    searchResults,
    /** searchResults의 처음부터 visibleSearchResultCount개까지 자른 팝업 렌더링 목록 */
    visibleSearchResults,
  };
}
