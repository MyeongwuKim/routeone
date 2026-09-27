
import { postNativeMessage } from "./runtime";

/** 웹 번들 실행 준비가 끝났음을 네이티브에 알리고, 브리지가 메시지를 받았는지 반환한다. */
export function postWebBundleReady() {
  return postNativeMessage({
    type: "routeone:web-bundle-ready",
  });
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
