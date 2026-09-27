/**
 * 용도:
 * 지도 준비, 경로 계산 등 화면을 가리는 공통 로딩 오버레이의 표시 내용을 공유한다.
 * 서로 다른 기능이 하나의 PotatoLoadingOverlay에 제목·설명·애니메이션을 전달할 때 사용한다.
 *
 * 동작 방식:
 * showLoading으로 오버레이를 열고 진행 단계가 바뀌면 updateLoading으로 내용만 갱신한다.
 * 작업 완료나 화면 이탈 시 hideLoading으로 닫되 기본 표시 설정은 다음 요청에 재사용한다.
 */
import { create } from "zustand";

export type AppLoadingAnimation =
  | "map-thinking"
  | "ranking"
  | "map-rendering"
  | "running"
  | "searching"
  | "pondering"
  | "empty"
  | "generic";

export type AppLoadingPayload = {
  /** 로딩 카드에 필수로 표시할 제목 */
  title: string;
  /** 제목 아래에 표시할 설명. 생략하면 빈 문자열 */
  description?: string;
  /** 카드 하단에 표시할 상태 문구. 생략하면 공통 감자 분석 문구 */
  footerText?: string;
  /** 작업 종류에 맞춰 재생할 애니메이션. 생략하면 generic */
  animation?: AppLoadingAnimation;
  /** 배경을 어둡게 가릴지 여부. 생략하면 true */
  dimmed?: boolean;
};

type UiLoadingState = {
  /** 전역 로딩 오버레이의 표시 여부 */
  isOpen: boolean;
  /** 로딩 카드의 주 안내 문구 */
  title: string;
  /** 제목 아래에 표시할 선택 안내 문구. 생략 시 빈 문자열 */
  description: string;
  /** 카드 하단 상태 문구. 생략 시 공통 감자 분석 문구 */
  footerText: string;
  /** 로딩 카드에서 재생할 상황별 감자 애니메이션 */
  animation: AppLoadingAnimation;
  /** true이면 오버레이 뒤 화면을 어둡게 가린다. */
  dimmed: boolean;
  /** 생략 필드에 기본값을 적용하고 전역 로딩 오버레이를 연다. */
  showLoading: (payload: AppLoadingPayload) => void;
  /** 열림 상태를 바꾸지 않고 전달한 표시 필드만 현재 값에 덮어쓴다. */
  updateLoading: (payload: Partial<AppLoadingPayload>) => void;
  /** 표시 내용은 유지한 채 오버레이만 닫는다. */
  hideLoading: () => void;
};

const DEFAULT_LOADING_STATE = {
  title: "",
  description: "",
  footerText: "감자 분석 모드 진행 중",
  animation: "generic" as AppLoadingAnimation,
  dimmed: true,
};

export const useUiLoadingStore = create<UiLoadingState>((set) => ({
  isOpen: false,
  ...DEFAULT_LOADING_STATE,
  showLoading: (payload) =>
    set({
      isOpen: true,
      title: payload.title,
      description: payload.description ?? "",
      footerText: payload.footerText ?? DEFAULT_LOADING_STATE.footerText,
      animation: payload.animation ?? DEFAULT_LOADING_STATE.animation,
      dimmed: payload.dimmed ?? DEFAULT_LOADING_STATE.dimmed,
    }),
  updateLoading: (payload) =>
    set((state) => ({
      ...state,
      title: payload.title ?? state.title,
      description: payload.description ?? state.description,
      footerText: payload.footerText ?? state.footerText,
      animation: payload.animation ?? state.animation,
      dimmed: payload.dimmed ?? state.dimmed,
    })),
  hideLoading: () =>
    set({
      isOpen: false,
    }),
}));
