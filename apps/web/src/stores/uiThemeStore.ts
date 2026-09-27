/**
 * 용도:
 * 웹 앱 전체에서 사용할 밝은 테마와 어두운 테마 상태를 공유한다.
 * 설정 화면의 선택과 모든 Tailwind dark 스타일이 같은 테마를 사용하도록 유지한다.
 *
 * 동작 방식:
 * localStorage의 선택값을 우선하고 없으면 시스템 색상 설정으로 초기 모드를 정한다.
 * 변경 시 HTML 루트의 dark 클래스와 data-theme을 갱신하고 선택값을 저장한다.
 */
import { create } from "zustand";

type UiThemeMode = "light" | "dark";

type UiThemeState = {
  /** HTML 루트와 Tailwind dark 스타일에 적용할 현재 light/dark 모드 */
  mode: UiThemeMode;
  /** DOM 테마 속성, localStorage와 Store 값을 전달한 모드로 맞춘다. */
  setThemeMode: (mode: UiThemeMode) => void;
  /** 현재 모드를 반대로 전환하며 setThemeMode의 DOM·저장 처리를 재사용한다. */
  toggleDarkMode: () => void;
};

const THEME_STORAGE_KEY = "routeone-theme-mode";

function applyThemeMode(mode: UiThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.dataset.theme = mode;
}

function readInitialThemeMode(): UiThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const savedMode = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedMode === "light" || savedMode === "dark") {
      return savedMode;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

const initialThemeMode = readInitialThemeMode();

applyThemeMode(initialThemeMode);

export const useUiThemeStore = create<UiThemeState>((set, get) => ({
  mode: initialThemeMode,
  setThemeMode: (mode) => {
    applyThemeMode(mode);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // 저장소 접근이 불가능해도 DOM과 Store에는 선택한 테마를 유지한다.
    }

    set({ mode });
  },
  toggleDarkMode: () => {
    get().setThemeMode(get().mode === "dark" ? "light" : "dark");
  },
}));

/** 앱 마운트 전에 Store의 현재 테마를 HTML 루트에 다시 적용해 초기 화면 깜빡임을 줄인다. */
export function initializeUiTheme() {
  applyThemeMode(useUiThemeStore.getState().mode);
}
