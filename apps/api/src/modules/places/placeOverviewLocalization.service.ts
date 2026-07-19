import type { PrismaClient } from "@prisma/client";
import { translatePlaceOverview } from "./placeLocalization.openai.js";
import { createOverviewSourceHash } from "./placeLocalization.shared.js";
import type {
  TourPlaceOverviewCacheInput,
  TourPlaceOverviewLocalizationInput,
} from "./placeLocalization.types.js";

const refreshingOverviewLocalizationKeys = new Set<string>();

async function storeTourPlaceOverviewLocalization(
  prisma: PrismaClient,
  input: TourPlaceOverviewCacheInput
) {
  const translation = await translatePlaceOverview(input);

  return prisma.placeOverviewLocalization.upsert({
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
      sourceOverview: input.overview,
      sourceOperatingHours: input.operatingHours || null,
      sourceRestDate: input.restDate || null,
      sourceInfoCenter: input.infoCenter || null,
      sourceHash: input.sourceHash,
      overview: translation.translatedOverview,
      operatingHours: translation.translatedOperatingHours || null,
      restDate: translation.translatedRestDate || null,
      infoCenter: translation.translatedInfoCenter || null,
      overviewSource: "OPENAI",
    },
    update: {
      sourceOverview: input.overview,
      sourceOperatingHours: input.operatingHours || null,
      sourceRestDate: input.restDate || null,
      sourceInfoCenter: input.infoCenter || null,
      sourceHash: input.sourceHash,
      overview: translation.translatedOverview,
      operatingHours: translation.translatedOperatingHours || null,
      restDate: translation.translatedRestDate || null,
      infoCenter: translation.translatedInfoCenter || null,
      overviewSource: "OPENAI",
    },
  });
}

function refreshTourPlaceOverviewInBackground(
  prisma: PrismaClient,
  input: TourPlaceOverviewCacheInput
) {
  const key = `${input.contentId}:${input.sourceHash}`;
  if (refreshingOverviewLocalizationKeys.has(key)) {
    return;
  }

  refreshingOverviewLocalizationKeys.add(key);
  void storeTourPlaceOverviewLocalization(prisma, input)
    .catch((error) => {
      console.warn("장소 설명 영문 현지화 캐시 갱신에 실패했습니다.", error);
    })
    .finally(() => {
      refreshingOverviewLocalizationKeys.delete(key);
    });
}

export async function localizeTourPlaceOverview(
  prisma: PrismaClient,
  rawInput: TourPlaceOverviewLocalizationInput
) {
  const contentId = rawInput.contentId.trim();
  const overview = rawInput.overview.trim();
  const operatingHours = rawInput.operatingHours?.trim() || "";
  const restDate = rawInput.restDate?.trim() || "";
  const infoCenter = rawInput.infoCenter?.trim() || "";

  if (!contentId) {
    throw new Error("장소 ID가 비어있습니다.");
  }
  if (!overview && !operatingHours && !restDate && !infoCenter) {
    return {
      contentId,
      overview: "",
      operatingHours: "",
      restDate: "",
      infoCenter: "",
      overviewSource: "SOURCE" as const,
      cached: true,
    };
  }

  const sourceHash = createOverviewSourceHash({
    overview,
    operatingHours,
    restDate,
    infoCenter,
  });
  const cacheInput: TourPlaceOverviewCacheInput = {
    contentId,
    overview,
    operatingHours,
    restDate,
    infoCenter,
    sourceHash,
  };
  const cached = await prisma.placeOverviewLocalization.findUnique({
    where: {
      provider_externalId_locale: {
        provider: "TOUR_API",
        externalId: contentId,
        locale: "en",
      },
    },
  });

  if (cached) {
    if (cached.sourceHash !== sourceHash) {
      const isMissingRequestedDetail =
        (overview && !cached.overview) ||
        (operatingHours && !cached.operatingHours) ||
        (restDate && !cached.restDate) ||
        (infoCenter && !cached.infoCenter);

      if (isMissingRequestedDetail) {
        const stored = await storeTourPlaceOverviewLocalization(
          prisma,
          cacheInput
        );

        return {
          contentId,
          overview: stored.overview,
          operatingHours: stored.operatingHours ?? "",
          restDate: stored.restDate ?? "",
          infoCenter: stored.infoCenter ?? "",
          overviewSource: stored.overviewSource,
          cached: false,
        };
      }

      refreshTourPlaceOverviewInBackground(prisma, cacheInput);
    }

    return {
      contentId,
      overview: cached.overview,
      operatingHours: cached.operatingHours ?? "",
      restDate: cached.restDate ?? "",
      infoCenter: cached.infoCenter ?? "",
      overviewSource: cached.overviewSource,
      cached: true,
    };
  }

  const stored = await storeTourPlaceOverviewLocalization(prisma, cacheInput);

  return {
    contentId,
    overview: stored.overview,
    operatingHours: stored.operatingHours ?? "",
    restDate: stored.restDate ?? "",
    infoCenter: stored.infoCenter ?? "",
    overviewSource: stored.overviewSource,
    cached: false,
  };
}
