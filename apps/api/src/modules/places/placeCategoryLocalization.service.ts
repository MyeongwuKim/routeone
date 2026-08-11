import type { PrismaClient } from "@prisma/client";
import {
  DATABASE_CONCURRENCY,
  mapWithConcurrency,
  MAX_CATEGORY_LOCALIZATION_BATCH_SIZE,
  normalizeLocale,
} from "./placeLocalization.shared.js";
import type { TourCategoryLocalizationInput } from "./placeLocalization.types.js";
import {
  getTourCategoryEnglishLabelOverride,
  TOUR_CATEGORY_ENGLISH_LABEL_BY_CODE,
} from "./tourCategoryEnglishOverrides.js";

export async function getTourCategoryLocalizations(
  prisma: PrismaClient,
  locale: string
) {
  const normalizedLocale = normalizeLocale(locale);
  if (!normalizedLocale) {
    return [];
  }

  const rows = await prisma.tourCategoryLocalization.findMany({
    where: {
      provider: "TOUR_API",
      locale:
        normalizedLocale === "en"
          ? {
              in: ["en", "ko"],
            }
          : normalizedLocale,
    },
    orderBy: {
      code: "asc",
    },
  });

  if (normalizedLocale === "en") {
    const englishRowsByCode = new Map(
      rows
        .filter((row) => row.locale === "en")
        .map((row) => [row.code, row])
    );
    const koreanRowsByCode = new Map(
      rows
        .filter((row) => row.locale === "ko")
        .map((row) => [row.code, row])
    );
    const availableCodes = new Set(englishRowsByCode.keys());

    Object.keys(TOUR_CATEGORY_ENGLISH_LABEL_BY_CODE).forEach((code) => {
      if (koreanRowsByCode.has(code)) {
        availableCodes.add(code);
      }
    });

    return [...availableCodes]
      .sort((left, right) => left.localeCompare(right))
      .map((code) => {
        const englishRow = englishRowsByCode.get(code);
        const koreanRow = koreanRowsByCode.get(code);
        const label =
          getTourCategoryEnglishLabelOverride(code) ?? englishRow?.label;

        if (!label) {
          return null;
        }

        return {
          code,
          locale: "en",
          label,
          sourceLabel:
            englishRow?.sourceLabel ?? koreanRow?.label ?? "",
          cached: Boolean(englishRow),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }

  return rows.map((row) => ({
    code: row.code,
    locale: row.locale,
    label: row.label,
    sourceLabel: row.sourceLabel ?? "",
    cached: true,
  }));
}

export async function cacheTourCategoryLocalizations(
  prisma: PrismaClient,
  rawInputs: TourCategoryLocalizationInput[]
) {
  const inputByKey = new Map<string, TourCategoryLocalizationInput>();
  rawInputs.forEach((input) => {
    const code = input.code.trim();
    const locale = normalizeLocale(input.locale);
    const rawLabel = input.label.trim();
    const englishLabel =
      locale === "en"
        ? getTourCategoryEnglishLabelOverride(code)
        : undefined;
    const label = englishLabel ?? rawLabel;

    if (!code || !locale || !label) {
      return;
    }

    inputByKey.set(`${locale}:${code}`, {
      code,
      locale,
      label,
      sourceLabel:
        input.sourceLabel?.trim() ||
        (englishLabel && englishLabel !== rawLabel ? rawLabel : null),
    });
  });

  const inputs = [...inputByKey.values()];
  if (inputs.length > MAX_CATEGORY_LOCALIZATION_BATCH_SIZE) {
    throw new Error(
      `한 번에 최대 ${MAX_CATEGORY_LOCALIZATION_BATCH_SIZE}개 분류 라벨을 처리할 수 있습니다.`
    );
  }

  if (inputs.length === 0) {
    return [];
  }

  const storedRows = await mapWithConcurrency(
    inputs,
    DATABASE_CONCURRENCY,
    (input) =>
      prisma.tourCategoryLocalization.upsert({
        where: {
          provider_code_locale: {
            provider: "TOUR_API",
            code: input.code,
            locale: input.locale,
          },
        },
        create: {
          provider: "TOUR_API",
          code: input.code,
          locale: input.locale,
          label: input.label,
          sourceLabel: input.sourceLabel || null,
        },
        update: {
          label: input.label,
          sourceLabel: input.sourceLabel || null,
        },
      })
  );

  return storedRows.map((row) => ({
    code: row.code,
    locale: row.locale,
    label: row.label,
    sourceLabel: row.sourceLabel ?? "",
    cached: false,
  }));
}
