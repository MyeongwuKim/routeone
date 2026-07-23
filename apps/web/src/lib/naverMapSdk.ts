const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

let sdkLoadPromise: Promise<void> | null = null;
let sdkLoadLanguage: NaverMapSdkLanguage | null = null;
let loadedLanguage: NaverMapSdkLanguage | null = null;
let sdkLoadToken = 0;

export type NaverMapSdkLanguage = "ko" | "en" | "zh" | "ja";

function createNaverSdkUrl(keyId: string, language: NaverMapSdkLanguage) {
  const url = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
  url.searchParams.set("ncpKeyId", keyId);
  url.searchParams.set("submodules", "geocoder,gl");
  url.searchParams.set("language", language);

  return url.toString();
}

function readHttpOrigin(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.origin;
    }
  } catch {
    return null;
  }

  return null;
}

export function getNaverMapAuthOrigin() {
  return (
    readHttpOrigin(window.location.href) ??
    readHttpOrigin(window.RouteOneRuntimeConfig?.webBundlePublicOrigin) ??
    readHttpOrigin(document.baseURI) ??
    "unknown"
  );
}

function resetNaverMapSdk() {
  const existing = document.getElementById(NAVER_MAP_SCRIPT_ID);

  existing?.parentNode?.removeChild(existing);
  window.naver = undefined;
  sdkLoadPromise = null;
  sdkLoadLanguage = null;
  loadedLanguage = null;
  sdkLoadToken += 1;
}

export function loadNaverMapSdk(
  keyId: string,
  language: NaverMapSdkLanguage = "ko"
) {
  if (!keyId) {
    return Promise.reject(new Error("Naver Maps key id is missing."));
  }

  if (window.naver?.maps && loadedLanguage === language) {
    return Promise.resolve();
  }

  if (sdkLoadPromise && sdkLoadLanguage === language) {
    return sdkLoadPromise;
  }

  if (sdkLoadPromise || window.naver?.maps) {
    resetNaverMapSdk();
  }

  sdkLoadLanguage = language;
  const loadToken = sdkLoadToken + 1;
  sdkLoadToken = loadToken;
  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(NAVER_MAP_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existing) {
      if (window.naver?.maps && loadedLanguage === language) {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load Naver Maps SDK.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.src = createNaverSdkUrl(keyId, language);

    script.onload = () => {
      if (loadToken !== sdkLoadToken) {
        reject(new Error("Naver Maps SDK load was superseded."));
        return;
      }

      loadedLanguage = language;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Naver Maps SDK."));

    document.head.appendChild(script);
  }).catch((error) => {
    if (sdkLoadLanguage === language) {
      sdkLoadPromise = null;
      sdkLoadLanguage = null;
    }
    throw error;
  });

  return sdkLoadPromise;
}
