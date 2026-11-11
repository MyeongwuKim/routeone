/** 로컬 시뮬레이터는 내장 영어팩을 쓰고, 배포 앱은 저장본 또는 R2 팩을 검증해 WebView에 넘긴다. */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CryptoDigestAlgorithm, digestStringAsync } from "expo-crypto";
import { fetch } from "expo/fetch";
import { WEB_BUNDLE_UPDATE_CONFIG } from "@/config/webBundleUpdateConfig";
import {
  WEB_BUNDLE_BASE_URL,
  WEB_BUNDLE_ENGLISH_PACK_HASH,
  WEB_BUNDLE_LOCAL_ENGLISH_PACK_SOURCE,
} from "@/generated/webBundle";

export type NativeEnglishLanguagePack = { hash: string; source: string };
const CACHE_KEY = `masil:native-english-pack:${WEB_BUNDLE_ENGLISH_PACK_HASH}`;
const MAX_PACK_BYTES = 512 * 1024;
export const usesLocalEnglishLanguagePack = WEB_BUNDLE_LOCAL_ENGLISH_PACK_SOURCE !== null;

export function getNativeLanguagePackBaseUrl() {
  const publicBaseUrl = WEB_BUNDLE_UPDATE_CONFIG.publicBaseUrl || WEB_BUNDLE_BASE_URL;
  const base = publicBaseUrl.replace(/\/+$/, "");
  const manifestUrl = WEB_BUNDLE_UPDATE_CONFIG.manifestUrl;
  return base === "https://routeone.native" && manifestUrl?.endsWith("/latest/manifest.json")
    ? manifestUrl.slice(0, -"/latest/manifest.json".length)
    : base;
}

async function verifySource(source: string) {
  return (await digestStringAsync(CryptoDigestAlgorithm.SHA256, source)) === WEB_BUNDLE_ENGLISH_PACK_HASH;
}

export async function readNativeEnglishLanguagePack(): Promise<NativeEnglishLanguagePack | null> {
  if (WEB_BUNDLE_LOCAL_ENGLISH_PACK_SOURCE !== null) {
    return { hash: WEB_BUNDLE_ENGLISH_PACK_HASH, source: WEB_BUNDLE_LOCAL_ENGLISH_PACK_SOURCE };
  }
  const source = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  return source && await verifySource(source)
    ? { hash: WEB_BUNDLE_ENGLISH_PACK_HASH, source }
    : null;
}

/** 다운로드 중 전체 길이가 확인되면 받은 바이트 비율을 온보딩에 전달한다. */
export async function loadNativeEnglishLanguagePack(onProgress: (progress: number | null) => void) {
  const cached = await readNativeEnglishLanguagePack();
  if (cached) return cached;

  const base = getNativeLanguagePackBaseUrl();
  if (!base || base === "https://routeone.native") throw new Error("English language pack server is not configured");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${base}/language-packs/en-${WEB_BUNDLE_ENGLISH_PACK_HASH}.mjs`, { signal: controller.signal });
    if (!response.ok) throw new Error(`English language pack HTTP ${response.status}`);

    const total = Number(response.headers.get("content-length"));
    const decoder = new TextDecoder();
    const reader = response.body?.getReader();
    if (!reader) throw new Error("English language pack response is empty");
    let source = "";
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (received > MAX_PACK_BYTES) {
        controller.abort();
        throw new Error("English language pack is too large");
      }
      source += decoder.decode(value, { stream: true });
      onProgress(total > 0 ? Math.min(received / total, 1) : null);
    }
    source += decoder.decode();
    if (!(await verifySource(source))) throw new Error("English language pack verification failed");

    await AsyncStorage.setItem(CACHE_KEY, source);
    return { hash: WEB_BUNDLE_ENGLISH_PACK_HASH, source };
  } finally {
    clearTimeout(timer);
  }
}
