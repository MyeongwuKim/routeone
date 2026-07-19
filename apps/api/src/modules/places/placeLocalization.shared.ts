import { createHash } from "node:crypto";
import type {
  TourPlaceLocalizationInput,
  TourPlaceOverviewCacheInput,
} from "./placeLocalization.types.js";

export const MAX_LOCALIZATION_BATCH_SIZE = 600;
export const MAX_CATEGORY_LOCALIZATION_BATCH_SIZE = 2000;
export const OPENAI_BATCH_SIZE = 40;
export const OPENAI_CONCURRENCY = 2;
export const ADDRESS_CONCURRENCY = 10;
export const DATABASE_CONCURRENCY = 10;
export const OPENAI_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv(
  "OPENAI_TRANSLATION_TIMEOUT_MS",
  20_000
);
export const JUSO_REQUEST_TIMEOUT_MS = getPositiveIntegerEnv(
  "JUSO_ADDRESS_TIMEOUT_MS",
  4_000
);

const LOCALIZATION_VERSION = "2026-07-13-v2";
const OVERVIEW_LOCALIZATION_VERSION = "2026-07-13-v3";
const TITLE_LOCALIZATION_OVERRIDES: Record<string, string> = {
  도직해변: "Dojik Beach",
};
const SUSPICIOUS_LOCALIZATION_PATTERN =
  /\b(?:noname|no\s*name|visit\s+to|catch\s+nonamei)\b/iu;

export function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function getPositiveIntegerEnv(name: string, fallback: number) {
  const parsedValue = Number(process.env[name]);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.floor(parsedValue)
    : fallback;
}

export async function fetchJsonWithTimeout<TResponse>(
  input: Parameters<typeof fetch>[0],
  init: Parameters<typeof fetch>[1],
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(input, {
      ...(init ?? {}),
      signal: controller.signal,
    });
    const data = (await response.json()) as TResponse;

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<TResult>
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export function cleanAddressKeyword(address: string) {
  return address
    .replace(/\s*\([^)]*\)\s*$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeAddressForMatch(address: string) {
  return cleanAddressKeyword(address).replace(/[\s,]/gu, "");
}

export function createSourceHash(input: TourPlaceLocalizationInput) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: LOCALIZATION_VERSION,
        title: input.title.trim(),
        address: input.address?.trim() || "",
        contentTypeId: input.contentTypeId || "",
      })
    )
    .digest("hex");
}

export function createOverviewSourceHash(
  input: Omit<TourPlaceOverviewCacheInput, "contentId" | "sourceHash">
) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: OVERVIEW_LOCALIZATION_VERSION,
        overview: input.overview,
        operatingHours: input.operatingHours,
        restDate: input.restDate,
        infoCenter: input.infoCenter,
      })
    )
    .digest("hex");
}

export function resolveLocalizedTitle(
  input: TourPlaceLocalizationInput,
  translatedTitle?: string
) {
  const overrideTitle = TITLE_LOCALIZATION_OVERRIDES[input.title.trim()];

  if (overrideTitle) {
    return {
      title: overrideTitle,
      source: "OVERRIDE" as const,
    };
  }

  const normalizedTranslatedTitle = translatedTitle?.trim();

  if (
    !normalizedTranslatedTitle ||
    containsSuspiciousLocalization(normalizedTranslatedTitle)
  ) {
    return {
      title: input.title,
      source: "SOURCE" as const,
    };
  }

  return {
    title: normalizedTranslatedTitle,
    source: "OPENAI" as const,
  };
}

export function containsSuspiciousLocalization(value: string) {
  return SUSPICIOUS_LOCALIZATION_PATTERN.test(value);
}

export function normalizeLocale(locale: string) {
  return locale.trim().toLowerCase();
}
