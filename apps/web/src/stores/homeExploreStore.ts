/**
 * 용도:
 * 홈 지도에서 선택한 지역과 검색어·필터·결과 표시 개수·지역 목록 스크롤 위치를 공유한다.
 * 지도, 상단 컨트롤, 검색 팝업이 같은 탐색 조건으로 동작하도록 유지할 때 사용한다.
 *
 * 동작 방식:
 * 최초 현재 위치가 결정되면 지역을 한 번 확정하고 사용자의 지역 선택을 이후 상태에 반영한다.
 * 서비스 지역이나 검색 조건이 바뀌면 관련 검색 상태를 초기화하고 더 보기 개수를 조건별로 관리한다.
 */
import { create } from "zustand";
import { DEFAULT_GANGWON_REGION } from "@/data/gangwonRegions";
import type { SearchFilter } from "@/lib/gangwonAttractionMap";

type VisibleSearchState = {
  /** 서비스 지역·시·군·구·필터·검색어를 결합한 검색 조건 키 */
  scope: string;
  /** 해당 검색 조건에서 팝업이 노출할 결과 개수 */
  count: number;
};

type HomeExploreState = {
  /** 홈 지도에서 경계와 관광지를 표시할 현재 시·군·구 코드 */
  selectedSigunguCode: string;
  /** 현재 위치 또는 기본 지역을 이용한 최초 지역 선택이 끝났는지 여부 */
  isInitialRegionResolved: boolean;
  /** 장소명·주소·종류명 검색에 사용하는 입력 문자열 */
  searchKeyword: string;
  /** 검색 결과와 지도 마커에 적용하는 장소 종류 필터 */
  searchFilter: SearchFilter;
  /** 마지막으로 더 보기를 실행한 검색 조건과 해당 조건의 표시 개수 */
  visibleSearchState: VisibleSearchState | null;
  /** 홈의 가로 지역 목록을 다시 열 때 복원할 스크롤 위치 */
  regionScrollLeft: number | null;
  /** 최초 지역 판정 전일 때만 시·군·구를 적용하고 판정을 완료 처리한다. */
  resolveInitialRegion: (sigunguCode: string) => void;
  /** 서비스 지역 변경 시 기본 시·군·구를 적용하고 홈 탐색 상태를 초기화한다. */
  resetForArea: (defaultSigunguCode: string) => void;
  /** 사용자가 고른 시·군·구를 적용하고 최초 지역 판정을 완료 처리한다. */
  selectRegion: (sigunguCode: string) => void;
  /** 가로 지역 목록에서 마지막으로 확인한 스크롤 위치를 저장한다. */
  setRegionScrollLeft: (scrollLeft: number) => void;
  /** 장소명·주소·종류명 검색에 사용할 문자열을 교체한다. */
  setSearchKeyword: (keyword: string) => void;
  /** 검색 결과와 지도 마커에 적용할 장소 종류를 교체한다. */
  setSearchFilter: (filter: SearchFilter) => void;
  /** 검색어·필터·조건별 표시 개수를 초기 검색 상태로 되돌린다. */
  resetSearch: () => void;
  /** scope가 같은 검색 결과의 표시 수를 늘리고, 새 scope이면 두 페이지 분량으로 시작한다. */
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
  /**
   * 같은 검색 조건이면 표시 개수를 pageSize만큼 늘린다.
   * 조건이 달라졌다면 첫 페이지 다음 분량까지 보이도록 pageSize의 두 배로 시작한다.
   */
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
