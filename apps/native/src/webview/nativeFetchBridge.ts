import type { MutableRefObject } from "react";
import type { WebViewMessageEvent } from "react-native-webview";

type WebViewRef = MutableRefObject<{
  injectJavaScript: (script: string) => void;
} | null>;

type NativeFetchRequest = {
  type: "routeone:native-fetch";
  id: string;
  url: string;
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  };
};

type NativeFetchResponse =
  | {
      ok: true;
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      url: string;
    }
  | {
      ok: false;
      error: string;
    };

const WEBVIEW_BASE_URL = "https://routeone.native";
const TOUR_API_ORIGIN = "https://apis.data.go.kr";
const NAVER_DIRECTIONS_ORIGIN = "https://maps.apigw.ntruss.com";

const NAVER_MAP_KEY_ID =
  process.env.EXPO_PUBLIC_NCP_MAPS_KEY_ID ??
  process.env.EXPO_PUBLIC_NAVER_MAP_API_KEY_ID ??
  "";
const NAVER_MAP_KEY =
  process.env.EXPO_PUBLIC_NCP_MAPS_KEY ??
  process.env.EXPO_PUBLIC_NAVER_MAP_API_KEY ??
  "";

export const ROUTEONE_WEBVIEW_BRIDGE_SCRIPT = `
(function installRouteOneNativeFetchBridge() {
  if (window.__ROUTEONE_NATIVE_FETCH_BRIDGE_INSTALLED__) {
    return true;
  }

  window.__ROUTEONE_NATIVE_FETCH_BRIDGE_INSTALLED__ = true;

  var originalFetch = window.fetch.bind(window);
  var pendingRequests = Object.create(null);
  var requestSeq = 0;

  function getUrl(input) {
    if (typeof input === "string") {
      return input;
    }

    if (input && typeof input.url === "string") {
      return input.url;
    }

    return "";
  }

  function shouldUseNativeFetch(inputUrl) {
    try {
      var url = new URL(inputUrl, window.location.href);
      return (
        url.pathname.indexOf("/tour-api/") === 0 ||
        url.pathname.indexOf("/map-direction/") === 0
      );
    } catch (error) {
      return false;
    }
  }

  function normalizeHeaders(headers) {
    var normalized = {};

    if (!headers) {
      return normalized;
    }

    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      headers.forEach(function eachHeader(value, key) {
        normalized[key] = value;
      });
      return normalized;
    }

    if (Array.isArray(headers)) {
      headers.forEach(function eachHeader(entry) {
        if (entry && entry.length >= 2) {
          normalized[String(entry[0])] = String(entry[1]);
        }
      });
      return normalized;
    }

    Object.keys(headers).forEach(function eachHeader(key) {
      normalized[key] = String(headers[key]);
    });

    return normalized;
  }

  window.__ROUTEONE_NATIVE_FETCH_RESPONSE__ = function handleNativeFetchResponse(id, payload) {
    var handlers = pendingRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new TypeError((payload && payload.error) || "Native fetch failed"));
      return;
    }

    handlers.resolve(
      new Response(payload.body, {
        status: payload.status,
        statusText: payload.statusText,
        headers: payload.headers
      })
    );
  };

  window.fetch = function routeOneFetch(input, init) {
    var inputUrl = getUrl(input);

    if (!inputUrl || !shouldUseNativeFetch(inputUrl) || !window.ReactNativeWebView) {
      return originalFetch(input, init);
    }

    var requestInit = init || {};
    var requestId = "native-fetch-" + Date.now() + "-" + requestSeq++;

    return new Promise(function routeOneNativeFetch(resolve, reject) {
      pendingRequests[requestId] = { resolve: resolve, reject: reject };

      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "routeone:native-fetch",
          id: requestId,
          url: inputUrl,
          init: {
            method: requestInit.method || "GET",
            headers: normalizeHeaders(requestInit.headers),
            body: typeof requestInit.body === "string" ? requestInit.body : undefined
          }
        })
      );
    });
  };

  return true;
})();
`;

function isNativeFetchRequest(value: unknown): value is NativeFetchRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeFetchRequest>;

  return (
    maybeRequest.type === "routeone:native-fetch" &&
    typeof maybeRequest.id === "string" &&
    typeof maybeRequest.url === "string"
  );
}

function resolveNativeFetchTarget(urlValue: string) {
  const url = new URL(urlValue, WEBVIEW_BASE_URL);

  if (url.pathname.startsWith("/tour-api/")) {
    return {
      url: `${TOUR_API_ORIGIN}${url.pathname.replace(/^\/tour-api/, "")}${
        url.search
      }`,
      headers: {}
    };
  }

  if (url.pathname.startsWith("/map-direction/")) {
    return {
      url: `${NAVER_DIRECTIONS_ORIGIN}${url.pathname}${url.search}`,
      headers: {
        "x-ncp-apigw-api-key-id": NAVER_MAP_KEY_ID,
        "x-ncp-apigw-api-key": NAVER_MAP_KEY
      }
    };
  }

  return null;
}

function postNativeFetchResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeFetchResponse
) {
  webViewRef.current?.injectJavaScript(
    `window.__ROUTEONE_NATIVE_FETCH_RESPONSE__(${JSON.stringify(
      id
    )}, ${JSON.stringify(payload)}); true;`
  );
}

export async function handleNativeFetchMessage(
  event: WebViewMessageEvent,
  webViewRef: WebViewRef
) {
  let message: unknown;

  try {
    message = JSON.parse(event.nativeEvent.data);
  } catch {
    return;
  }

  if (!isNativeFetchRequest(message)) {
    return;
  }

  try {
    const target = resolveNativeFetchTarget(message.url);

    if (!target) {
      throw new Error(`Unsupported native fetch url: ${message.url}`);
    }

    const headers = {
      ...(message.init?.headers ?? {}),
      ...target.headers
    };
    const response = await fetch(target.url, {
      method: message.init?.method ?? "GET",
      headers,
      body: message.init?.body
    });
    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    postNativeFetchResponse(webViewRef, message.id, {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: await response.text(),
      url: response.url
    });
  } catch (error) {
    postNativeFetchResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native fetch failed"
    });
  }
}
