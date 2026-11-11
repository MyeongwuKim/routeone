/** 영어 문구를 필요한 시점에 검증하고, 같은 버전은 저장된 팩에서 재사용한다. */
import { PROVINCIAL_REGION_ENGLISH_LABELS } from "@/data/provincialServiceAreas";
import type { UiText } from "../uiText";
import { ENGLISH_CATEGORY_ALIASES } from "./placeCategoryAliases";

const STORAGE_KEY = "masil:english-language-pack";
const PACK_HASH = /\/language-packs\/en-([a-f0-9]{64})\.mjs$/;
const TIMEOUT_MS = 12_000;
const MAX_PACK_BYTES = 512 * 1024;
let loadedText: UiText | null = null;

export function getLoadedEnglishText() {
  return loadedText;
}

/** 웹에 공유되는 지역명과 카테고리 사전을 영어팩의 문구에 합친다. */
export function completeEnglishText(text: UiText): UiText {
  return {
    ...text,
    labels: {
      ...text.labels,
      regions: { ...PROVINCIAL_REGION_ENGLISH_LABELS, ...text.labels.regions },
      placeCategories: ENGLISH_CATEGORY_ALIASES,
    },
  };
}

function readCachedSource(hash: string) {
  const injected = window.RouteOneRuntimeConfig?.englishLanguagePack;
  if (injected?.hash === hash) return injected.source;

  try {
    return window.localStorage.getItem(`${STORAGE_KEY}:${hash}`);
  } catch {
    return null;
  }
}

function storePack(hash: string, source: string) {
  try {
    const key = `${STORAGE_KEY}:${hash}`;
    window.localStorage.setItem(key, source);
    for (const previousKey of Object.keys(window.localStorage)) {
      if (previousKey.startsWith(`${STORAGE_KEY}:`) && previousKey !== key) {
        window.localStorage.removeItem(previousKey);
      }
    }
  } catch {
    // 저장 공간을 사용할 수 없어도 이번 실행에서 받은 팩은 사용할 수 있다.
  }
}

/** 지정된 해시와 일치하는 빌드 산출물만 읽어 영어 문구와 포맷 함수를 준비한다. */
async function importPack(source: string, expectedHash: string) {
  const bytes = new TextEncoder().encode(source);
  if (bytes.length > MAX_PACK_BYTES) throw new Error("English language pack is too large");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== expectedHash) throw new Error("English language pack verification failed");

  const url = URL.createObjectURL(new Blob([bytes], { type: "text/javascript" }));
  try {
    const { default: text } = await import(/* @vite-ignore */ url) as { default: UiText };
    return completeEnglishText(text);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 응답 길이를 알 수 있을 때 실제로 받은 바이트로 진행률을 계산한다. */
async function downloadPack(url: URL, onProgress: (progress: number | null) => void) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error(`English language pack HTTP ${response.status}`);

    const total = Number(response.headers.get("content-length"));
    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const decoder = new TextDecoder();
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
    return source + decoder.decode();
  } finally {
    clearTimeout(timer);
  }
}

export async function prepareEnglishUiText(onProgress: (progress: number | null) => void) {
  if (loadedText) return;

  const path = document.querySelector<HTMLMetaElement>('meta[name="masil-english-pack"]')?.content;
  if (!path) throw new Error("English language pack is missing from this build");
  const base = window.RouteOneRuntimeConfig?.languagePackBaseUrl || window.location.origin;
  const url = new URL(path.startsWith("/") ? path.slice(1) : path, `${base.replace(/\/+$/, "")}/`);
  const hash = url.pathname.match(PACK_HASH)?.[1];
  if (!hash) throw new Error("English language pack version is invalid");

  const cached = readCachedSource(hash);
  if (cached) {
    try {
      loadedText = await importPack(cached, hash);
      storePack(hash, cached);
      return;
    } catch {
      // 손상된 캐시는 새로 받은 파일이 검증되면 교체한다.
    }
  }

  if (window.RouteOneRuntimeConfig?.languagePackLocalOnly) {
    throw new Error("The embedded English language pack could not be loaded");
  }
  const source = await downloadPack(url, onProgress);
  loadedText = await importPack(source, hash);
  storePack(hash, source);
}
