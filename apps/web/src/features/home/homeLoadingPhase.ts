/** 홈 화면을 가리는 로딩 UI가 현재 안내해야 할 작업 단계를 정의하고 우선순위를 판정한다. */
export type HomeAttractionLoadingPhase =
  | "idle"
  | "fetching-places"
  | "ranking";

export type HomeLoadingPhase =
  | "location"
  | "places"
  | "ranking"
  | "markers";

type ResolveHomeLoadingPhaseOptions = {
  /** 관광지 조회 훅이 보고한 API 조회 또는 순위 계산 단계 */
  attractionLoadingPhase: HomeAttractionLoadingPhase;
  /** API 키와 지도 준비 상태가 관광지 로딩 UI를 표시할 수 있는 조건인지 여부 */
  canShowAttractionLoading: boolean;
  /** 이전 조회를 포함해 화면에서 사용할 관광지 데이터가 이미 있는지 여부 */
  hasAttractionData: boolean;
  /** 관광지 Query가 초기 조회 또는 갱신 요청을 수행 중인지 여부 */
  isAttractionFetching: boolean;
  /** 현재 위치와 경계 데이터를 이용한 최초 지역 판정을 기다리는지 여부 */
  isInitialRegionLoading: boolean;
  /** 선택 지역의 관광지 마커를 프레임 단위로 생성 중인지 여부 */
  isRenderingMarkers: boolean;
  /** 검색 팝업이 지도를 덮고 있어 홈 로딩 UI를 숨겨야 하는지 여부 */
  isSearchPopupOpen: boolean;
};

/**
 * 검색 팝업이 열려 있으면 로딩 UI를 숨기고, 위치 판정 → 장소 조회 → 순위 계산 →
 * 마커 렌더링 순으로 먼저 진행 중인 단계를 반환한다. 표시할 단계가 없으면 null을 반환한다.
 */
export function resolveHomeLoadingPhase({
  attractionLoadingPhase,
  canShowAttractionLoading,
  hasAttractionData,
  isAttractionFetching,
  isInitialRegionLoading,
  isRenderingMarkers,
  isSearchPopupOpen,
}: ResolveHomeLoadingPhaseOptions): HomeLoadingPhase | null {
  if (isSearchPopupOpen) {
    return null;
  }

  if (isInitialRegionLoading) {
    return "location";
  }

  if (!canShowAttractionLoading) {
    return null;
  }

  if (
    attractionLoadingPhase === "fetching-places" ||
    (attractionLoadingPhase === "idle" &&
      isAttractionFetching &&
      !hasAttractionData)
  ) {
    return "places";
  }

  if (attractionLoadingPhase === "ranking" || isAttractionFetching) {
    return "ranking";
  }

  return isRenderingMarkers ? "markers" : null;
}
