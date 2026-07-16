import { placeLocalizationApi } from "@/api/placeLocalizationApi";
import type { AppLanguage } from "@/stores/appLanguageStore";

type LocalizableTourPlace = {
  id: string;
  contentTypeId: string;
  title: string;
  address: string;
};

type LocalizablePlaceIdentity = {
  provider?: string | null;
  externalId?: string | null;
  contentId?: string | null;
  title: string;
  address?: string | null;
};

type LocalizeTourPlacesOptions = {
  retryUncached?: boolean;
  retryAttempts?: number;
  retryDelayMs?: number;
};

const LOCALIZATION_REQUEST_BATCH_SIZE = 200;
const CATEGORY_CACHE_BATCH_SIZE = 500;

export function getPlaceLocalizationId(place: LocalizablePlaceIdentity) {
  const contentId = place.contentId?.trim();

  if (contentId) {
    return contentId;
  }

  const title = place.title.trim();
  const address = place.address?.trim() ?? "";
  const externalId = place.externalId?.trim();

  if (!title) {
    return null;
  }

  return [
    "route-place",
    place.provider?.trim() || "UNKNOWN",
    externalId || `${title}|${address}`,
  ].join(":");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export async function localizeTourPlaces<T extends LocalizableTourPlace>(
  places: T[],
  language: AppLanguage,
  options: LocalizeTourPlacesOptions = {}
) {
  if (language !== "en" || places.length === 0) {
    return places;
  }

  const uniqueById = new Map<string, T>();
  places.forEach((place) => {
    if (!uniqueById.has(place.id)) {
      uniqueById.set(place.id, place);
    }
  });

  try {
    const uniquePlaces = [...uniqueById.values()];
    const requestLocalizations = async () =>
      Promise.all(
        chunk(uniquePlaces, LOCALIZATION_REQUEST_BATCH_SIZE).map(
        (batch) =>
          placeLocalizationApi.localizeTourPlaces(
            batch.map((place) => ({
              contentId: place.id,
              contentTypeId: place.contentTypeId,
              title: place.title,
              address: place.address,
            }))
          )
        )
      );
    let responses = await requestLocalizations();
    const retryAttempts = options.retryAttempts ?? 2;
    const retryDelayMs = options.retryDelayMs ?? 1200;

    for (let attempt = 0; options.retryUncached && attempt < retryAttempts; attempt += 1) {
      const hasUncachedLocalization = responses
        .flatMap((response) => response.localizeTourPlaces)
        .some((localization) => !localization.cached);

      if (!hasUncachedLocalization) {
        break;
      }

      await delay(retryDelayMs);
      responses = await requestLocalizations();
    }

    const localizedById = new Map(
      responses
        .flatMap((response) => response.localizeTourPlaces)
        .map((localization) => [localization.contentId, localization])
    );

    return places.map((place) => {
      const localized = localizedById.get(place.id);
      return localized
        ? {
            ...place,
            title: localized.title,
            address: localized.address,
          }
        : place;
    });
  } catch (error) {
    console.warn("장소 영문 현지화에 실패해 한국어 원문을 사용합니다.", error);
    return places;
  }
}

export async function cacheTourCategoryLocalizationMap(
  codeNameMap: Record<string, string>,
  language: AppLanguage
) {
  const inputs = Object.entries(codeNameMap)
    .map(([code, label]) => ({
      code: code.trim(),
      locale: language,
      label: label.trim(),
    }))
    .filter((input) => input.code && input.label);

  if (inputs.length === 0) {
    return;
  }

  try {
    await Promise.all(
      chunk(inputs, CATEGORY_CACHE_BATCH_SIZE).map((batch) =>
        placeLocalizationApi.cacheTourCategoryLocalizations(batch)
      )
    );
  } catch (error) {
    console.warn("관광 분류 라벨 캐시 저장에 실패했습니다.", error);
  }
}

export async function readCachedTourCategoryLocalizationMap(
  language: AppLanguage
) {
  try {
    const response = await placeLocalizationApi.tourCategoryLocalizations(
      language
    );
    return Object.fromEntries(
      response.tourCategoryLocalizations.map((item) => [
        item.code,
        item.label,
      ])
    );
  } catch (error) {
    console.warn("관광 분류 라벨 캐시를 불러오지 못했습니다.", error);
    return {};
  }
}
