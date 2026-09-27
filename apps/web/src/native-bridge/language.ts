
import { postNativeMessage } from "./runtime";
import type { AppLanguage } from "@/stores/appLanguageStore";

/** 웹에서 선택한 ko/en 언어를 네이티브 앱에 전달하고 WebView 메시지 전송 여부를 반환한다. */
export function updateNativeAppLanguage(language: AppLanguage) {
  return postNativeMessage({
    type: "routeone:native-app-language",
    language,
  });
}
