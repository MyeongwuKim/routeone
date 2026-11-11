
import { postNativeMessage } from "./runtime";

/** 웹 번들 실행 준비가 끝났음을 네이티브에 알리고, 브리지가 메시지를 받았는지 반환한다. */
export function postWebBundleReady() {
  return postNativeMessage({
    type: "routeone:web-bundle-ready",
  });
}

/** 앱 화면을 그리기 전 영어팩 준비 진행률을 네이티브 시작 화면에 전달한다. */
export function postStartupLanguageProgress(progress: number | null) {
  return postNativeMessage({
    type: "routeone:startup-language-progress",
    progress,
  });
}

/** 언어 준비가 끝나면 네이티브가 화면 준비 신호를 다시 기다리도록 알린다. */
export function postStartupLanguageComplete() {
  return postNativeMessage({ type: "routeone:startup-language-complete" });
}

/** 렌더링 경계에서 받은 오류를 문자열로 정규화해 발생 위치와 함께 네이티브에 전달하고 전송 여부를 반환한다. */
export function reportWebRuntimeError(source: string, error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown render error";

  return postNativeMessage({
    type: "routeone:web-runtime-error",
    source,
    message,
  });
}
