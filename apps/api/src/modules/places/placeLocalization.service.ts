import type { PrismaClient } from "@prisma/client";
import { fetchOfficialEnglishAddress } from "./placeLocalization.juso.js";
import {
  translateAddresses,
  translateTitles,
} from "./placeLocalization.openai.js";
import {
  ADDRESS_CONCURRENCY,
  createSourceHash,
  DATABASE_CONCURRENCY,
  mapWithConcurrency,
  MAX_LOCALIZATION_BATCH_SIZE,
  resolveLocalizedTitle,
} from "./placeLocalization.shared.js";
import type { TourPlaceLocalizationInput } from "./placeLocalization.types.js";

export type {
  TourCategoryLocalizationInput,
  TourPlaceLocalizationInput,
  TourPlaceOverviewLocalizationInput,
} from "./placeLocalization.types.js";
export {
  cacheTourCategoryLocalizations,
  getTourCategoryLocalizations,
} from "./placeCategoryLocalization.service.js";
export { localizeTourPlaceOverview } from "./placeOverviewLocalization.service.js";

const refreshingPlaceLocalizationKeys = new Set<string>();

async function storeTourPlaceLocalizations(
  prisma: PrismaClient,
  inputs: TourPlaceLocalizationInput[]
) {
  if (inputs.length === 0) return;

  const [titleById, officialAddresses] = await Promise.all([
    translateTitles(inputs),
    mapWithConcurrency(inputs, ADDRESS_CONCURRENCY, (input) =>
      fetchOfficialEnglishAddress(input.address || "")
    ),
  ]);
  const fallbackAddressById = await translateAddresses(
    inputs.filter((_, index) => !officialAddresses[index])
  );

  await mapWithConcurrency(inputs, DATABASE_CONCURRENCY, (input, index) => {
    const translation = titleById.get(input.contentId);
    const officialAddress = officialAddresses[index];
    const fallbackAddress = fallbackAddressById
      .get(input.contentId)
      ?.translatedAddress.trim();
    const localizedAddress =
      officialAddress || fallbackAddress || input.address || null;
    const addressSource = officialAddress
      ? "JUSO"
      : fallbackAddress
        ? "OPENAI"
        : "SOURCE";
    const localizedTitle = resolveLocalizedTitle(
      input,
      translation?.translatedTitle
    );

    return prisma.placeLocalization.upsert({
      where: {
        provider_externalId_locale: {
          provider: "TOUR_API",
          externalId: input.contentId,
          locale: "en",
        },
      },
      create: {
        provider: "TOUR_API",
        externalId: input.contentId,
        locale: "en",
        sourceTitle: input.title,
        sourceAddress: input.address || null,
        sourceHash: createSourceHash(input),
        title: localizedTitle.title,
        address: localizedAddress,
        titleSource: localizedTitle.source,
        addressSource,
      },
      update: {
        sourceTitle: input.title,
        sourceAddress: input.address || null,
        sourceHash: createSourceHash(input),
        title: localizedTitle.title,
        address: localizedAddress,
        titleSource: localizedTitle.source,
        addressSource,
      },
    });
  });
}

function refreshTourPlaceLocalizationsInBackground(
  prisma: PrismaClient,
  inputs: TourPlaceLocalizationInput[]
) {
  const refreshInputs = inputs.filter((input) => {
    const key = `${input.contentId}:${createSourceHash(input)}`;
    if (refreshingPlaceLocalizationKeys.has(key)) return false;
    refreshingPlaceLocalizationKeys.add(key);
    return true;
  });

  if (refreshInputs.length === 0) return;

  void storeTourPlaceLocalizations(prisma, refreshInputs)
    .catch((error) => {
      console.warn("장소 영문 현지화 캐시 갱신에 실패했습니다.", error);
    })
    .finally(() => {
      refreshInputs.forEach((input) => {
        refreshingPlaceLocalizationKeys.delete(
          `${input.contentId}:${createSourceHash(input)}`
        );
      });
    });
}

export async function localizeTourPlaces(
  prisma: PrismaClient,
  rawInputs: TourPlaceLocalizationInput[]
) {
  const inputById = new Map<string, TourPlaceLocalizationInput>();
  rawInputs.forEach((input) => {
    const contentId = input.contentId.trim();
    const title = input.title.trim();
    if (contentId && title && !inputById.has(contentId)) {
      inputById.set(contentId, {
        ...input,
        contentId,
        title,
        address: input.address?.trim() || "",
      });
    }
  });

  const inputs = [...inputById.values()];
  if (inputs.length > MAX_LOCALIZATION_BATCH_SIZE) {
    throw new Error(
      `한 번에 최대 ${MAX_LOCALIZATION_BATCH_SIZE}개 장소를 처리할 수 있습니다.`
    );
  }
  if (inputs.length === 0) return [];

  const cachedRows = await prisma.placeLocalization.findMany({
    where: {
      provider: "TOUR_API",
      locale: "en",
      externalId: { in: inputs.map((input) => input.contentId) },
    },
  });
  const cachedById = new Map(cachedRows.map((row) => [row.externalId, row]));
  const refreshInputs = inputs.filter((input) => {
    const cached = cachedById.get(input.contentId);
    return (
      !cached ||
      cached.sourceHash !== createSourceHash(input) ||
      (cached.addressSource === "SOURCE" && Boolean(input.address))
    );
  });

  refreshTourPlaceLocalizationsInBackground(prisma, refreshInputs);

  return inputs.map((input) => {
    const row = cachedById.get(input.contentId);
    return {
      contentId: input.contentId,
      title: row?.title || input.title,
      address: row?.address || input.address || "",
      titleSource: row?.titleSource || "SOURCE",
      addressSource: row?.addressSource || "SOURCE",
      cached: Boolean(row),
    };
  });
}
