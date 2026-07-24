import { postNativeMessage } from "./runtime";

export function postWebBundleReady() {
  return postNativeMessage({
    type: "routeone:web-bundle-ready",
  });
}

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
