import { create } from "zustand";

type UiThemeMode = "light" | "dark";

type UiThemeState = {
  mode: UiThemeMode;
  setThemeMode: (mode: UiThemeMode) => void;
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
      // Keep the visible theme even when storage is unavailable.
    }

    set({ mode });
  },
  toggleDarkMode: () => {
    get().setThemeMode(get().mode === "dark" ? "light" : "dark");
  },
}));

export function initializeUiTheme() {
  applyThemeMode(useUiThemeStore.getState().mode);
}
