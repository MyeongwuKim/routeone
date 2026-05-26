const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

let sdkLoadPromise: Promise<void> | null = null;

function createNaverSdkUrl(keyId: string) {
  const url = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
  url.searchParams.set("ncpKeyId", keyId);

  return url.toString();
}

export function loadNaverMapSdk(keyId: string) {
  if (!keyId) {
    return Promise.reject(new Error("Naver Maps key id is missing."));
  }

  if (window.naver?.maps) {
    return Promise.resolve();
  }

  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(NAVER_MAP_SCRIPT_ID) as
      | HTMLScriptElement
      | null;

    if (existing) {
      if (window.naver?.maps) {
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
    script.src = createNaverSdkUrl(keyId);

    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Naver Maps SDK."));

    document.head.appendChild(script);
  }).catch((error) => {
    sdkLoadPromise = null;
    throw error;
  });

  return sdkLoadPromise;
}
