/** 네이티브 컨테이너에 웹 번들 렌더링 준비 신호를 전달하는 비표시 컴포넌트다. */
import { useEffect } from "react";
import { nativeBridge } from "@/native-bridge";

/**
 * 연결 직후, 두 번의 렌더링 프레임 뒤, 250ms·1초 뒤에 준비 신호를 반복 전송한다.
 * 네이티브가 준비 상태를 다시 요청하는 이벤트에도 응답하며, 정리 시 예약 작업과 리스너를 해제한다.
 */
export default function NativeWebBundleReadySignal() {
  useEffect(() => {
    let isCancelled = false;
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;
    const retryTimeoutIds: number[] = [];
    const postReadySignal = () => {
      if (isCancelled) {
        return;
      }

      nativeBridge.lifecycle.postWebBundleReady();
    };

    postReadySignal();

    if (typeof window.requestAnimationFrame === "function") {
      firstFrameId = window.requestAnimationFrame(() => {
        secondFrameId = window.requestAnimationFrame(postReadySignal);
      });
    } else {
      retryTimeoutIds.push(window.setTimeout(postReadySignal, 0));
    }

    retryTimeoutIds.push(
      window.setTimeout(postReadySignal, 250),
      window.setTimeout(postReadySignal, 1_000),
    );
    window.addEventListener(
      "routeone:native-request-web-bundle-ready",
      postReadySignal,
    );

    return () => {
      isCancelled = true;
      window.removeEventListener(
        "routeone:native-request-web-bundle-ready",
        postReadySignal,
      );

      if (firstFrameId !== null) {
        window.cancelAnimationFrame(firstFrameId);
      }

      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }

      retryTimeoutIds.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  return null;
}
