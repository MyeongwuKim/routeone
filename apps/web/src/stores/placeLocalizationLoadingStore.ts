/**
 * 용도:
 * 장소 이름과 설명을 번역 중인 요청 개수를 전역에서 공유한다.
 * 여러 화면에서 번역 요청이 동시에 발생해도 공통 번역 진행 표시를 정확히 유지할 때 사용한다.
 *
 * 동작 방식:
 * 요청 시작 시 activeRequestCount를 올리고 완료 시 내린다.
 * 하나 이상의 요청이 남아 있는 동안 PlaceLocalizationStatus가 로딩 상태를 표시한다.
 */
import { create } from "zustand";

type PlaceLocalizationLoadingState = {
  /** 아직 finish가 호출되지 않은 장소 번역 요청 수. 1 이상이면 번역 진행 표시 대상이다. */
  activeRequestCount: number;
};

export const usePlaceLocalizationLoadingStore =
  create<PlaceLocalizationLoadingState>(() => ({
    activeRequestCount: 0,
  }));

/** 번역 요청을 시작할 때 activeRequestCount를 하나 늘린다. 완료 경로에서 finish와 짝지어 호출해야 한다. */
export function beginPlaceLocalizationRequest() {
  usePlaceLocalizationLoadingStore.setState((state) => ({
    activeRequestCount: state.activeRequestCount + 1,
  }));
}

/** 번역 요청 완료 시 activeRequestCount를 하나 줄이며 중복 호출되어도 0 아래로 내려가지 않는다. */
export function finishPlaceLocalizationRequest() {
  usePlaceLocalizationLoadingStore.setState((state) => ({
    activeRequestCount: Math.max(0, state.activeRequestCount - 1),
  }));
}
