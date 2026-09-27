import { useEffect } from "react";
import type { HomeLoadingPhase } from "./homeLoadingPhase";
import { useUiText } from "@/lib/uiText";
import { useUiLoadingStore } from "@/stores/uiLoadingStore";

/**
 * HomePage에서 판정한 현재 로딩 단계를 전역 로딩 Store의 제목·설명·애니메이션으로 변환한다.
 * 위치 판정, 장소 조회, 순위 계산, 마커 렌더링 중 하나의 안내만 표시하며,
 * 표시할 단계가 없거나 검색 팝업 등의 조건으로 loadingPhase가 null이 되면 오버레이를 닫는다.
 * 이 Hook은 작업 진행 여부를 직접 계산하지 않고 resolveHomeLoadingPhase가 반환한 단계만 화면 상태에 반영한다.
 *
 * @param loadingPhase 현재 안내할 홈 로딩 단계. null이면 전역 로딩 오버레이를 숨긴다.
 */
export function useHomeLoadingOverlay(
  loadingPhase: HomeLoadingPhase | null
) {
  const text = useUiText();
  const showLoading = useUiLoadingStore((state) => state.showLoading);
  const hideLoading = useUiLoadingStore((state) => state.hideLoading);

  /**
   * loadingPhase가 바뀔 때 동일한 전역 오버레이의 내용을 현재 단계에 맞게 교체한다.
   * 위치와 장소 조회는 지도 탐색 애니메이션, 순위 계산은 순위 애니메이션,
   * 마커 렌더링은 지도 렌더링 애니메이션을 사용한다. null이면 진행 중인 홈 안내를 닫는다.
   */
  useEffect(() => {
    if (loadingPhase === "location") {
      showLoading({
        title: text.home.loadingLocationTitle,
        description: text.home.loadingLocationDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (loadingPhase === "places") {
      showLoading({
        title: text.home.loadingPlacesTitle,
        description: text.home.loadingPlacesDescription,
        footerText: text.home.loadingFooter,
        animation: "map-thinking",
      });
      return;
    }

    if (loadingPhase === "ranking") {
      showLoading({
        title: text.home.loadingRankingTitle,
        description: text.home.loadingRankingDescription,
        footerText: text.home.loadingFooter,
        animation: "ranking",
      });
      return;
    }

    if (loadingPhase === "markers") {
      showLoading({
        title: text.home.loadingMarkersTitle,
        description: text.home.loadingMarkersDescription,
        footerText: text.home.loadingFooter,
        animation: "map-rendering",
      });
      return;
    }

    hideLoading();
  }, [hideLoading, loadingPhase, showLoading, text]);

  /** HomePage가 해제될 때 홈 로딩 단계가 남아 다른 화면을 가리지 않도록 전역 오버레이를 닫는다. */
  useEffect(() => () => hideLoading(), [hideLoading]);
}
