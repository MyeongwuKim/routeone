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
  title: string;
  description?: string;
  footerText?: string;
  animation?: AppLoadingAnimation;
  dimmed?: boolean;
};

type UiLoadingState = {
  isOpen: boolean;
  title: string;
  description: string;
  footerText: string;
  animation: AppLoadingAnimation;
  dimmed: boolean;
  showLoading: (payload: AppLoadingPayload) => void;
  updateLoading: (payload: Partial<AppLoadingPayload>) => void;
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
