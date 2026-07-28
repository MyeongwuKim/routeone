import { useEffect } from "react";
import { nativeBridge } from "@/native-bridge";

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
