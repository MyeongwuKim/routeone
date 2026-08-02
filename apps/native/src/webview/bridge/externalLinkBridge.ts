import { Linking, Platform } from "react-native";
import type { NativeExternalUrlRequest } from "./types";

const WEBVIEW_BASE_ORIGIN = "https://routeone.native";
const LOCAL_WEB_BUNDLE_PATH = "/routeone-web-bundles/releases/";
const NAVER_MAP_SCHEME_PREFIX = "nmap://";
const ROUTEONE_APP_SETTINGS_SCHEME_PREFIX = "routeone-settings:";
const NAVER_MAP_WEB_DIRECTIONS_BASE_URL =
  "https://map.naver.com/p/directions";
const WEB_MERCATOR_EARTH_RADIUS_METERS = 6378137;
const WEB_MERCATOR_MAX_LATITUDE = 85.05112878;

function getCoordinate(params: URLSearchParams, key: string) {
  const value = params.get(key);

  if (!value) {
    return null;
  }

  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function createNaverWebRoutePoint(lat: number, lng: number, name: string) {
  const limitedLat = Math.max(
    -WEB_MERCATOR_MAX_LATITUDE,
    Math.min(WEB_MERCATOR_MAX_LATITUDE, lat)
  );
  const latRadians = (limitedLat * Math.PI) / 180;
  const lngRadians = (lng * Math.PI) / 180;
  const x = WEB_MERCATOR_EARTH_RADIUS_METERS * lngRadians;
  const y =
    WEB_MERCATOR_EARTH_RADIUS_METERS *
    Math.log(Math.tan(Math.PI / 4 + latRadians / 2));

  return `${x},${y},${encodeURIComponent(name)},,ADDRESS_POI`;
}

export function getNaverMapWebDirectionsUrl(urlValue: string) {
  const defaultUrl = `${NAVER_MAP_WEB_DIRECTIONS_BASE_URL}/`;

  try {
    const url = new URL(urlValue);

    if (
      url.protocol !== "nmap:" ||
      url.hostname !== "route" ||
      url.pathname !== "/car"
    ) {
      return defaultUrl;
    }

    const destinationLat = getCoordinate(url.searchParams, "dlat");
    const destinationLng = getCoordinate(url.searchParams, "dlng");

    if (destinationLat === null || destinationLng === null) {
      return defaultUrl;
    }

    const destination = createNaverWebRoutePoint(
      destinationLat,
      destinationLng,
      url.searchParams.get("dname")?.trim() || "도착지"
    );
    const startLat = getCoordinate(url.searchParams, "slat");
    const startLng = getCoordinate(url.searchParams, "slng");
    const start =
      startLat === null || startLng === null
        ? "-"
        : createNaverWebRoutePoint(
            startLat,
            startLng,
            url.searchParams.get("sname")?.trim() || "출발지"
          );

    return `${NAVER_MAP_WEB_DIRECTIONS_BASE_URL}/${start}/${destination}/-/car`;
  } catch {
    return defaultUrl;
  }
}

function isAllowedWebViewOrigin(url: URL, allowedOrigins: readonly string[]) {
  return (
    url.origin === WEBVIEW_BASE_ORIGIN || allowedOrigins.includes(url.origin)
  );
}

export function shouldKeepUrlInWebView(
  urlValue: string,
  allowedOrigins: readonly string[] = []
) {
  if (!urlValue) {
    return true;
  }

  if (
    urlValue === "about:blank" ||
    urlValue.startsWith("data:") ||
    urlValue.startsWith("blob:") ||
    urlValue.startsWith("javascript:")
  ) {
    return true;
  }

  try {
    const url = new URL(urlValue, WEBVIEW_BASE_ORIGIN);

    if (
      url.protocol === "file:" &&
      decodeURIComponent(url.pathname).includes(LOCAL_WEB_BUNDLE_PATH)
    ) {
      return true;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return isAllowedWebViewOrigin(url, allowedOrigins);
  } catch {
    return true;
  }
}

export async function openNativeExternalUrl(
  url: string,
  allowedOrigins: readonly string[] = []
) {
  if (!url || shouldKeepUrlInWebView(url, allowedOrigins)) {
    return;
  }

  if (url.startsWith(ROUTEONE_APP_SETTINGS_SCHEME_PREFIX)) {
    try {
      await Linking.openSettings();
    } catch (error) {
      console.warn(
        "[routeone-native-bridge] failed to open app settings",
        error
      );
    }
    return;
  }

  if (url.startsWith(NAVER_MAP_SCHEME_PREFIX) && Platform.OS === "ios") {
    try {
      const canOpenNaverMap = await Linking.canOpenURL(url);
      await Linking.openURL(
        canOpenNaverMap ? url : getNaverMapWebDirectionsUrl(url)
      );
    } catch (error) {
      console.warn(
        "[routeone-native-bridge] failed to open NAVER Map",
        error
      );
    }
    return;
  }

  try {
    await Linking.openURL(url);
  } catch (error) {
    if (url.startsWith(NAVER_MAP_SCHEME_PREFIX)) {
      try {
        await Linking.openURL(getNaverMapWebDirectionsUrl(url));
        return;
      } catch (fallbackError) {
        console.warn(
          "[routeone-native-bridge] failed to open NAVER Map web directions",
          fallbackError
        );
      }
    }

    console.warn(
      "[routeone-native-bridge] failed to open external url",
      error
    );
  }
}

export async function handleNativeExternalUrlRequest(
  message: NativeExternalUrlRequest
) {
  await openNativeExternalUrl(message.url);
}
