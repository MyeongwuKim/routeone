/**
 * 용도:
 * 웹 화면 전체가 사용할 언어(`ko` 또는 `en`)를 공유한다.
 * 메뉴 문구 선택, 장소 정보 번역, 알림 언어처럼 여러 기능이 같은 언어를 참조한다.
 *
 * 동작 방식:
 * 한국어로 시작하고, 영어를 선택하면 팩이 준비된 뒤 화면과 저장값을 변경한다.
 * 적용한 언어는 네이티브 앱에도 전달한다.
 */
import { create } from "zustand";
import { updateNativeAppLanguage } from "@/native-bridge/language";
import { prepareEnglishUiText } from "@/lib/ui-text/englishPack";

export type AppLanguage = "ko" | "en";

export const APP_DISPLAY_NAMES = { ko: "마실", en: "Masil" } as const;

type AppLanguageState = {
  /** UI 문구와 장소 번역 요청에 적용할 현재 언어. 저장값이 없거나 유효하지 않으면 ko */
  language: AppLanguage;
  /** 영어팩 준비 중의 진행률. 전체 길이를 모르면 null이다. */
  languageDownload: { progress: number | null } | null;
  languageDownloadFailed: boolean;
  /** 팩 준비까지 마친 뒤 언어를 적용하고 실제로 변경했는지 반환한다. */
  setLanguage: (
    language: AppLanguage,
    onProgress?: (progress: number | null) => void,
  ) => Promise<boolean>;
};

const APP_LANGUAGE_STORAGE_KEY = "routeone-app-language";

export function readPreferredAppLanguage(): AppLanguage {
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

if (typeof document !== "undefined") {
  document.documentElement.lang = "ko";
  document.title = APP_DISPLAY_NAMES.ko;
}

export const useAppLanguageStore = create<AppLanguageState>((set, get) => ({
  language: "ko",
  languageDownload: null,
  languageDownloadFailed: false,
  setLanguage: async (language, onProgress) => {
    if (get().languageDownload) return false;
    if (get().language === language && readPreferredAppLanguage() === language) return false;

    if (language === "en") {
      set({ languageDownload: { progress: null }, languageDownloadFailed: false });
      try {
        await prepareEnglishUiText((progress) => {
          set({ languageDownload: { progress } });
          onProgress?.(progress);
        });
      } catch {
        set({ languageDownload: null, languageDownloadFailed: true });
        return false;
      }
    }

    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.title = APP_DISPLAY_NAMES[language];
    }

    try {
      window.localStorage.setItem(APP_LANGUAGE_STORAGE_KEY, language);
    } catch {
      // 저장소 접근이 불가능해도 이번 실행에서 선택한 언어는 Store에 유지한다.
    }

    updateNativeAppLanguage(language);
    set({ language, languageDownload: null, languageDownloadFailed: false });
    return true;
  },
}));
