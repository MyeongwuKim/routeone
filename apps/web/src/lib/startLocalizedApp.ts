/** 저장한 표시 언어가 준비된 뒤에만 앱 화면과 네이티브 준비 신호를 시작한다. */
import { postStartupLanguageComplete, postStartupLanguageProgress } from "@/native-bridge/lifecycle";
import { readPreferredAppLanguage, useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiToastStore } from "@/stores/uiToastStore";

export async function startLocalizedApp(renderApp: () => void) {
  if (readPreferredAppLanguage() === "en") {
    postStartupLanguageProgress(null);
    const applied = await useAppLanguageStore.getState().setLanguage("en", postStartupLanguageProgress);
    if (!applied) {
      useUiToastStore.getState().showToast("영어를 불러오지 못했어요. 한국어로 시작해요.", 4_000);
    }
    postStartupLanguageComplete();
  }

  renderApp();
}
