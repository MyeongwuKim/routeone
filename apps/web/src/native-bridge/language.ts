import { postNativeMessage } from "./runtime";
import type { AppLanguage } from "@/stores/appLanguageStore";

export function updateNativeAppLanguage(language: AppLanguage) {
  return postNativeMessage({
    type: "routeone:native-app-language",
    language,
  });
}
