import AsyncStorage from "@react-native-async-storage/async-storage";
import { postNativeFetchResponse } from "./responses";
import type {
  NativeFetchRequest,
  NativeFetchSuccessResponse,
  WebViewRef,
} from "./types";

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
const NATIVE_FETCH_TIMEOUT_MS = 30_000;

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

function resolveNativeGraphqlEndpoint() {
  const endpoint =
    process.env.EXPO_PUBLIC_GRAPHQL_ENDPOINT?.trim() ||
    process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!endpoint || endpoint.includes("<") || endpoint.includes(">")) {
    return DEFAULT_GRAPHQL_ENDPOINT;
  }

  return endpoint;
}

export const NATIVE_GRAPHQL_ENDPOINT = resolveNativeGraphqlEndpoint();

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

export async function handleNativeFetchRequest(
  message: NativeFetchRequest,
  webViewRef: WebViewRef
) {
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
