import { useEffect } from "react";

export default function NativeWebBundleReadySignal() {
  useEffect(() => {
    const nativeWebView = (
      window as Window & {
        ReactNativeWebView?: { postMessage(message: string): void };
      }
    ).ReactNativeWebView;

    nativeWebView?.postMessage(
      JSON.stringify({ type: "routeone:web-bundle-ready" })
    );
  }, []);

  return null;
}
