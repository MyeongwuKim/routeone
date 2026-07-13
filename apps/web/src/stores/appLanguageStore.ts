import { create } from "zustand";

export type AppLanguage = "ko" | "en";

type AppLanguageState = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";

function readInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") {
    return "ko";
  }

  try {
    return window.localStorage.getItem(APP_LANGUAGE_STORAGE_KEY) === "en"
      ? "en"
      : "ko";
  } catch {
    return "ko";
  }
}

const initialLanguage = readInitialLanguage();

if (typeof document !== "undefined") {
  document.documentElement.lang = initialLanguage;
}

export const useAppLanguageStore = create<AppLanguageState>((set) => ({
  language: initialLanguage,
  setLanguage: (language) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }

    try {
      window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Keep the selected language in memory when storage is unavailable.
    }

    set({ language });
  },
}));
