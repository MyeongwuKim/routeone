import type { PrismaClient } from "@prisma/client";
import {
  DATABASE_CONCURRENCY,
  mapWithConcurrency,
  MAX_CATEGORY_LOCALIZATION_BATCH_SIZE,
  normalizeLocale,
} from "./placeLocalization.shared.js";
import type { TourCategoryLocalizationInput } from "./placeLocalization.types.js";

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
      locale: normalizedLocale,
    },
    orderBy: {
      code: "asc",
    },
  });

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
    const label = input.label.trim();

    if (!code || !locale || !label) {
      return;
    }

    inputByKey.set(`${locale}:${code}`, {
      code,
      locale,
      label,
      sourceLabel: input.sourceLabel?.trim() || null,
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
