import { useEffect } from "react";
import { nativeBridge } from "@/native-bridge";

/**
 * 라우터가 이 컴포넌트를 연결하면 즉시 준비 신호를 보내고, 두 프레임 뒤와 250ms·1초 뒤에 반복한다.
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
