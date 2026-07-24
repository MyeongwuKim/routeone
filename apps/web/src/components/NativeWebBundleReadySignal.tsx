import { useEffect } from "react";
import { nativeBridge } from "@/native-bridge";

export default function NativeWebBundleReadySignal() {
  useEffect(() => {
    let isCancelled = false;
    let firstFrameId: number | null = null;
    let secondFrameId: number | null = null;
    let timeoutId: number | null = null;
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
      timeoutId = window.setTimeout(postReadySignal, 0);
    }

    return () => {
      isCancelled = true;

      if (firstFrameId !== null) {
        window.cancelAnimationFrame(firstFrameId);
      }

      if (secondFrameId !== null) {
        window.cancelAnimationFrame(secondFrameId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}
