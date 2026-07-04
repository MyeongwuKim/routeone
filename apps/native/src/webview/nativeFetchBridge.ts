import type { MutableRefObject } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
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

type NativeBridgeReadyMessage = {
  type: "routeone:native-bridge-ready";
  graphqlEndpoint?: string;
};

type NativeLocationRequest = {
  type: "routeone:native-location-current";
  id: string;
};

type NativePhotoRequest = {
  type: "routeone:native-visit-photo";
  id: string;
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

type NativeFetchSuccessResponse = Extract<NativeFetchResponse, { ok: true }>;

type NativeLocationResponse =
  | {
      ok: true;
      lat: number;
      lng: number;
      accuracyMeters: number | null;
      timestamp: number;
    }
  | {
      ok: false;
      error: string;
    };

type NativePhotoResponse =
  | {
      ok: true;
      uri: string | null;
      width: number | null;
      height: number | null;
    }
  | {
      ok: false;
      error: string;
    };

type NativeFetchTarget = {
  url: string;
  headers: Record<string, string>;
  cacheTtlMs?: number;
};

type NativeFetchCacheEntry = NativeFetchSuccessResponse & {
  savedAt: number;
  expiresAt: number;
};

const WEBVIEW_BASE_URL = "https://routeone.native";
const TOUR_API_ORIGIN = "https://apis.data.go.kr";
const NAVER_DIRECTIONS_ORIGIN = "https://maps.apigw.ntruss.com";
const DEFAULT_GRAPHQL_ENDPOINT = "http://127.0.0.1:4000/graphql";
const HOUR_MS = 1000 * 60 * 60;
const DAY_MS = HOUR_MS * 24;
const TOUR_API_CACHE_STORAGE_PREFIX = "routeone:native-fetch-cache:v1:";

const nativeFetchMemoryCache = new Map<string, NativeFetchCacheEntry>();
const nativeFetchInFlightRequests = new Map<
  string,
  Promise<NativeFetchSuccessResponse>
>();

const NAVER_MAP_KEY_ID =
  process.env.EXPO_PUBLIC_NCP_MAPS_KEY_ID ??
  process.env.EXPO_PUBLIC_NAVER_MAP_API_KEY_ID ??
  "";
const NAVER_MAP_KEY =
  process.env.EXPO_PUBLIC_NCP_MAPS_KEY ??
  process.env.EXPO_PUBLIC_NAVER_MAP_API_KEY ??
  "";
const NATIVE_FETCH_TIMEOUT_MS = 30_000;

function resolveNativeGraphqlEndpoint() {
  const endpoint =
    process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!endpoint || endpoint.includes("<") || endpoint.includes(">")) {
    return DEFAULT_GRAPHQL_ENDPOINT;
  }

  return endpoint;
}

const NATIVE_GRAPHQL_ENDPOINT = resolveNativeGraphqlEndpoint();

export const ROUTEONE_WEBVIEW_BRIDGE_SCRIPT = `
(function installRouteOneNativeFetchBridge() {
  if (window.__ROUTEONE_NATIVE_FETCH_BRIDGE_INSTALLED__) {
    return true;
  }

  window.__ROUTEONE_NATIVE_FETCH_BRIDGE_INSTALLED__ = true;
  window.RouteOneRuntimeConfig = Object.assign({}, window.RouteOneRuntimeConfig, ${JSON.stringify(
    {
      graphqlEndpoint: "/graphql"
    }
  )});

  var didPostBridgeReady = false;

  function postBridgeReady() {
    if (didPostBridgeReady || !window.ReactNativeWebView) {
      return;
    }

    didPostBridgeReady = true;
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: "routeone:native-bridge-ready",
        graphqlEndpoint: window.RouteOneRuntimeConfig.graphqlEndpoint
      })
    );
  }

  function lockViewportZoom() {
    var viewport = document.querySelector("meta[name='viewport']");

    if (!viewport) {
      viewport = document.createElement("meta");
      viewport.setAttribute("name", "viewport");

      if (document.head) {
        document.head.appendChild(viewport);
      }
    }

    viewport.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    if (document.documentElement) {
      document.documentElement.style.touchAction = "manipulation";
    }

    if (document.body) {
      document.body.style.touchAction = "manipulation";
    }
  }

  var lastTouchEndAt = 0;

  lockViewportZoom();

  document.addEventListener("DOMContentLoaded", lockViewportZoom, { once: true });
  document.addEventListener(
    "dblclick",
    function preventDoubleClickZoom(event) {
      event.preventDefault();
    },
    { capture: true, passive: false }
  );
  document.addEventListener(
    "gesturestart",
    function preventGestureZoom(event) {
      event.preventDefault();
    },
    { capture: true, passive: false }
  );
  document.addEventListener(
    "touchend",
    function preventDoubleTapZoom(event) {
      var now = Date.now();

      if (now - lastTouchEndAt <= 320) {
        event.preventDefault();
      }

      lastTouchEndAt = now;
    },
    { capture: true, passive: false }
  );
  postBridgeReady();
  window.setTimeout(postBridgeReady, 250);

  var originalFetch = window.fetch.bind(window);
  var pendingRequests = Object.create(null);
  var pendingLocationRequests = Object.create(null);
  var pendingPhotoRequests = Object.create(null);
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

  function getMethod(input, init) {
    if (init && init.method) {
      return init.method;
    }

    if (input && typeof input.method === "string") {
      return input.method;
    }

    return "GET";
  }

  function getBody(init) {
    if (init && typeof init.body === "string") {
      return init.body;
    }

    return undefined;
  }

  function shouldUseNativeFetch(inputUrl) {
    try {
      var url = new URL(inputUrl, window.location.href);
      return (
        url.pathname === "/graphql" ||
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

  window.__ROUTEONE_NATIVE_LOCATION_RESPONSE__ = function handleNativeLocationResponse(id, payload) {
    var handlers = pendingLocationRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingLocationRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native location failed"));
      return;
    }

    handlers.resolve({
      lat: payload.lat,
      lng: payload.lng,
      accuracyMeters: payload.accuracyMeters,
      timestamp: payload.timestamp
    });
  };

  window.__ROUTEONE_NATIVE_PHOTO_RESPONSE__ = function handleNativePhotoResponse(id, payload) {
    var handlers = pendingPhotoRequests[id];

    if (!handlers) {
      return;
    }

    delete pendingPhotoRequests[id];

    if (!payload || !payload.ok) {
      handlers.reject(new Error((payload && payload.error) || "Native photo failed"));
      return;
    }

    handlers.resolve({
      uri: payload.uri,
      width: payload.width,
      height: payload.height
    });
  };

  window.RouteOneNative = Object.assign({}, window.RouteOneNative, {
    getCurrentPosition: function getCurrentPosition() {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-location-" + Date.now() + "-" + requestSeq++;

      return new Promise(function routeOneNativeLocation(resolve, reject) {
        pendingLocationRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-location-current",
            id: requestId
          })
        );
      });
    },
    takeVisitPhoto: function takeVisitPhoto() {
      if (!window.ReactNativeWebView) {
        return Promise.reject(new Error("Native bridge is not available"));
      }

      var requestId = "native-photo-" + Date.now() + "-" + requestSeq++;

      return new Promise(function routeOneNativePhoto(resolve, reject) {
        pendingPhotoRequests[requestId] = { resolve: resolve, reject: reject };

        window.ReactNativeWebView.postMessage(
          JSON.stringify({
            type: "routeone:native-visit-photo",
            id: requestId
          })
        );
      });
    }
  });

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
            method: getMethod(input, requestInit),
            headers: normalizeHeaders(requestInit.headers),
            body: getBody(requestInit)
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

function isNativeBridgeReadyMessage(
  value: unknown
): value is NativeBridgeReadyMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeMessage = value as Partial<NativeBridgeReadyMessage>;

  return maybeMessage.type === "routeone:native-bridge-ready";
}

function isNativeLocationRequest(
  value: unknown
): value is NativeLocationRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativeLocationRequest>;

  return (
    maybeRequest.type === "routeone:native-location-current" &&
    typeof maybeRequest.id === "string"
  );
}

function isNativePhotoRequest(value: unknown): value is NativePhotoRequest {
  if (!value || typeof value !== "object") {
    return false;
  }

  const maybeRequest = value as Partial<NativePhotoRequest>;

  return (
    maybeRequest.type === "routeone:native-visit-photo" &&
    typeof maybeRequest.id === "string"
  );
}

function getTourApiCacheTtlMs(pathname: string) {
  if (pathname.endsWith("/lclsSystmCode2")) {
    return DAY_MS * 30;
  }

  if (pathname.endsWith("/tatsCnctrRatedList")) {
    return HOUR_MS * 6;
  }

  if (pathname.endsWith("/searchFestival2")) {
    return HOUR_MS * 12;
  }

  if (
    pathname.endsWith("/detailCommon2") ||
    pathname.endsWith("/detailIntro2") ||
    pathname.endsWith("/detailImage2")
  ) {
    return DAY_MS * 7;
  }

  if (
    pathname.endsWith("/areaBasedList2") ||
    pathname.endsWith("/locationBasedList2") ||
    pathname.endsWith("/searchKeyword1")
  ) {
    return DAY_MS;
  }

  return HOUR_MS * 12;
}

function resolveNativeFetchTarget(urlValue: string): NativeFetchTarget | null {
  const url = new URL(urlValue, WEBVIEW_BASE_URL);

  if (url.pathname === "/graphql") {
    return {
      url: NATIVE_GRAPHQL_ENDPOINT,
      headers: {}
    };
  }

  if (url.pathname.startsWith("/tour-api/")) {
    const targetPathname = url.pathname.replace(/^\/tour-api/, "");

    return {
      url: `${TOUR_API_ORIGIN}${targetPathname}${url.search}`,
      headers: {},
      cacheTtlMs: getTourApiCacheTtlMs(targetPathname)
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

function buildNativeFetchCacheKey(url: string) {
  let hash = 5381;

  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 33) ^ url.charCodeAt(index);
  }

  return `${TOUR_API_CACHE_STORAGE_PREFIX}${(hash >>> 0).toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isValidNativeFetchCacheEntry(
  value: unknown
): value is NativeFetchCacheEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.ok === true &&
    typeof value.status === "number" &&
    typeof value.statusText === "string" &&
    isRecord(value.headers) &&
    typeof value.body === "string" &&
    typeof value.url === "string" &&
    typeof value.savedAt === "number" &&
    typeof value.expiresAt === "number"
  );
}

async function readNativeFetchCache(cacheKey: string) {
  const memoryEntry = nativeFetchMemoryCache.get(cacheKey);

  if (memoryEntry) {
    return memoryEntry;
  }

  const rawEntry = await AsyncStorage.getItem(cacheKey);

  if (!rawEntry) {
    return null;
  }

  try {
    const parsedEntry: unknown = JSON.parse(rawEntry);

    if (!isValidNativeFetchCacheEntry(parsedEntry)) {
      void AsyncStorage.removeItem(cacheKey);
      return null;
    }

    nativeFetchMemoryCache.set(cacheKey, parsedEntry);
    return parsedEntry;
  } catch {
    void AsyncStorage.removeItem(cacheKey);
    return null;
  }
}

async function writeNativeFetchCache(
  cacheKey: string,
  response: NativeFetchSuccessResponse,
  ttlMs: number
) {
  const savedAt = Date.now();
  const entry: NativeFetchCacheEntry = {
    ...response,
    savedAt,
    expiresAt: savedAt + ttlMs
  };

  nativeFetchMemoryCache.set(cacheKey, entry);

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
  } catch {
    nativeFetchMemoryCache.delete(cacheKey);
  }
}

function withNativeCacheHeader(
  response: NativeFetchSuccessResponse,
  cacheState: "hit" | "stale"
): NativeFetchSuccessResponse {
  const { status, statusText, headers, body, url } = response;

  return {
    ok: true,
    status,
    statusText,
    headers: {
      ...headers,
      "x-routeone-native-cache": cacheState
    },
    body,
    url
  };
}

function isCacheableNativeFetchRequest(
  message: NativeFetchRequest,
  target: NativeFetchTarget
) {
  return (
    Boolean(target.cacheTtlMs) &&
    (message.init?.method ?? "GET").toUpperCase() === "GET" &&
    !message.init?.body
  );
}

function shouldStoreNativeFetchResponse(response: NativeFetchSuccessResponse) {
  if (response.status < 200 || response.status >= 300) {
    return false;
  }

  const hasTourApiResultCode = /"resultCode"\s*:/.test(response.body);

  if (!hasTourApiResultCode) {
    return true;
  }

  return /"resultCode"\s*:\s*"0000"/.test(response.body);
}

async function fetchNativeTarget(
  message: NativeFetchRequest,
  target: NativeFetchTarget
): Promise<NativeFetchSuccessResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, NATIVE_FETCH_TIMEOUT_MS);
  const headers = {
    ...(message.init?.headers ?? {}),
    ...target.headers
  };

  try {
    const response = await fetch(target.url, {
      method: message.init?.method ?? "GET",
      headers,
      body: message.init?.body,
      signal: controller.signal
    });
    const responseHeaders: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      ok: true,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: await response.text(),
      url: response.url
    };
  } finally {
    clearTimeout(timeoutId);
  }
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

function postNativeLocationResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativeLocationResponse
) {
  webViewRef.current?.injectJavaScript(
    `window.__ROUTEONE_NATIVE_LOCATION_RESPONSE__(${JSON.stringify(
      id
    )}, ${JSON.stringify(payload)}); true;`
  );
}

function postNativePhotoResponse(
  webViewRef: WebViewRef,
  id: string,
  payload: NativePhotoResponse
) {
  webViewRef.current?.injectJavaScript(
    `window.__ROUTEONE_NATIVE_PHOTO_RESPONSE__(${JSON.stringify(
      id
    )}, ${JSON.stringify(payload)}); true;`
  );
}

async function getNativeCurrentPosition(): Promise<NativeLocationResponse> {
  const permission = await Location.getForegroundPermissionsAsync();
  const nextPermission =
    permission.status === "granted"
      ? permission
      : await Location.requestForegroundPermissionsAsync();

  if (nextPermission.status !== "granted") {
    throw new Error("위치 권한을 허용해야 장소 인증을 할 수 있어요.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Highest
  });

  return {
    ok: true,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracyMeters: position.coords.accuracy,
    timestamp: position.timestamp
  };
}

async function takeNativeVisitPhoto(): Promise<NativePhotoResponse> {
  const permission = await ImagePicker.getCameraPermissionsAsync();
  const nextPermission =
    permission.status === "granted"
      ? permission
      : await ImagePicker.requestCameraPermissionsAsync();

  if (nextPermission.status !== "granted") {
    throw new Error("카메라 권한을 허용해야 사진 인증을 할 수 있어요.");
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.72,
    exif: false
  });

  if (result.canceled) {
    throw new Error("사진 인증을 취소했어요.");
  }

  const asset = result.assets[0];

  return {
    ok: true,
    uri: asset?.uri ?? null,
    width: asset?.width ?? null,
    height: asset?.height ?? null
  };
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

  if (isNativeBridgeReadyMessage(message)) {
    console.log(
      `[routeone-native-bridge] ready graphql=${message.graphqlEndpoint ?? "/graphql"} target=${NATIVE_GRAPHQL_ENDPOINT}`
    );
    return;
  }

  if (isNativeLocationRequest(message)) {
    try {
      postNativeLocationResponse(
        webViewRef,
        message.id,
        await getNativeCurrentPosition()
      );
    } catch (error) {
      postNativeLocationResponse(webViewRef, message.id, {
        ok: false,
        error:
          error instanceof Error ? error.message : "Native location failed"
      });
    }

    return;
  }

  if (isNativePhotoRequest(message)) {
    try {
      postNativePhotoResponse(
        webViewRef,
        message.id,
        await takeNativeVisitPhoto()
      );
    } catch (error) {
      postNativePhotoResponse(webViewRef, message.id, {
        ok: false,
        error: error instanceof Error ? error.message : "Native photo failed"
      });
    }

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

    console.log(
      `[routeone-native-fetch] ${message.init?.method ?? "GET"} ${message.url} -> ${target.url}`
    );

    const shouldUseCache = isCacheableNativeFetchRequest(message, target);
    const cacheKey = shouldUseCache
      ? buildNativeFetchCacheKey(target.url)
      : null;
    const cachedResponse = cacheKey
      ? await readNativeFetchCache(cacheKey)
      : null;

    if (cachedResponse && cachedResponse.expiresAt > Date.now()) {
      postNativeFetchResponse(
        webViewRef,
        message.id,
        withNativeCacheHeader(cachedResponse, "hit")
      );
      return;
    }

    if (cacheKey && target.cacheTtlMs) {
      const inFlightRequest =
        nativeFetchInFlightRequests.get(cacheKey) ??
        fetchNativeTarget(message, target).then(async (response) => {
          if (shouldStoreNativeFetchResponse(response)) {
            await writeNativeFetchCache(cacheKey, response, target.cacheTtlMs!);
          }

          return response;
        });

      nativeFetchInFlightRequests.set(cacheKey, inFlightRequest);

      try {
        const response = await inFlightRequest;
        console.log(
          `[routeone-native-fetch] ${response.status} ${target.url}`
        );
        postNativeFetchResponse(webViewRef, message.id, response);
      } finally {
        nativeFetchInFlightRequests.delete(cacheKey);
      }

      return;
    }

    const response = await fetchNativeTarget(message, target);
    console.log(`[routeone-native-fetch] ${response.status} ${target.url}`);
    postNativeFetchResponse(webViewRef, message.id, response);
  } catch (error) {
    console.warn(
      `[routeone-native-fetch] failed ${message.url}`,
      error instanceof Error ? error.message : error
    );

    try {
      const target = resolveNativeFetchTarget(message.url);
      const cacheKey =
        target && isCacheableNativeFetchRequest(message, target)
          ? buildNativeFetchCacheKey(target.url)
          : null;
      const cachedResponse = cacheKey
        ? await readNativeFetchCache(cacheKey)
        : null;

      if (cachedResponse) {
        postNativeFetchResponse(
          webViewRef,
          message.id,
          withNativeCacheHeader(cachedResponse, "stale")
        );
        return;
      }
    } catch {
      // Ignore cache fallback errors and report the original network failure.
    }

    postNativeFetchResponse(webViewRef, message.id, {
      ok: false,
      error: error instanceof Error ? error.message : "Native fetch failed"
    });
  }
}
