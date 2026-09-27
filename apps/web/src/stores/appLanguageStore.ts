/**
 * 용도:
 * 웹 화면 전체가 사용할 언어(`ko` 또는 `en`)를 공유한다.
 * 메뉴 문구 선택, 장소 정보 번역, 알림 언어처럼 여러 기능이 같은 언어를 참조한다.
 *
 * 동작 방식:
 * WebView localStorage에서 초기 언어를 읽고 변경값을 다시 저장한다.
 * 네이티브 앱에서도 같은 언어를 유지하도록 브리지 메시지를 함께 전송한다.
 */
import { create } from "zustand";
import { updateNativeAppLanguage } from "@/native-bridge/language";

export type AppLanguage = "ko" | "en";

type AppLanguageState = {
  /** UI 문구와 장소 번역 요청에 적용할 현재 언어. 저장값이 없거나 유효하지 않으면 ko */
  language: AppLanguage;
  /** 문서 lang, localStorage, 네이티브 언어와 Store 값을 전달한 언어로 맞춘다. */
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
      // 저장소 접근이 불가능해도 이번 실행에서 선택한 언어는 Store에 유지한다.
    }

    updateNativeAppLanguage(language);
    set({ language });
  },
}));
