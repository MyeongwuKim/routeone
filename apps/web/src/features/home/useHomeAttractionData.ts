import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  GANGWON_SIGNGU_ADMIN_CODES,
  GANGWON_TATS_AREA_CODE,
} from "@/data/gangwonRegions";
import {
  buildBoundaryMapBySigunguCode,
  type GangwonBoundaryCollection,
} from "@/lib/gangwonBoundaryUtils";
import {
  getTouristNameMatchScore,
  shouldHideAttraction,
  type AttractionLoadingStage,
} from "@/lib/gangwonAttractionMap";
import { CAFE_LCLS_CODE, isTouristPlace } from "@/lib/placeCategory";
import {
  cacheTourCategoryLocalizationMap,
  localizeTourPlaces,
  readCachedTourCategoryLocalizationMap,
} from "@/lib/placeLocalization";
import { useUiText } from "@/lib/uiText";
import {
  buildLatestConcentrationMap,
  fetchGangwonAttractions,
  fetchGangwonFestivals,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";
import { useAppLanguageStore } from "@/stores/appLanguageStore";

const ENGLISH_DISPLAY_DATA_TIMEOUT_MS = 5_000;

export type HomeAttractionQueryData = {
  allAttractions: GangwonAttraction[];
  sourceAttractions: GangwonAttraction[];
  topAttractions: Array<{
    attraction: GangwonAttraction;
    touristTrendName: string;
  }>;
  lclsNameByCode: Record<string, string>;
  isLocalized: boolean;
};

function withTimeoutFallback<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
) {
  let timeoutId: number | undefined;

  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timeoutId = window.setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  });
}

function mergeAttractionDisplayData(
  sourceAttractions: GangwonAttraction[],
  displayAttractions: GangwonAttraction[]
) {
  const displayAttractionById = new Map(
    displayAttractions.map((attraction) => [attraction.id, attraction])
  );

  return sourceAttractions.map((sourceAttraction) => {
    const displayAttraction = displayAttractionById.get(sourceAttraction.id);

    if (!displayAttraction) {
      return sourceAttraction;
    }

    return {
      ...sourceAttraction,
      title: displayAttraction.title || sourceAttraction.title,
      address: displayAttraction.address || sourceAttraction.address,
      firstImage: sourceAttraction.firstImage || displayAttraction.firstImage,
      secondImage:
        sourceAttraction.secondImage || displayAttraction.secondImage,
    };
  });
}

export function useHomeAttractionData(selectedSigunguCode: string) {
  const text = useUiText();
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const [attractionLoadingStage, setAttractionLoadingStage] =
    useState<AttractionLoadingStage>("idle");
  const isUpdatingPlaceLabelsRef = useRef(false);

  const loadLclsNameByCode = useCallback(async () => {
    try {
      const codeNameMap = await fetchLclsSystemNameMap(
        TOUR_API_SERVICE_KEY,
        appLanguage
      );
      void cacheTourCategoryLocalizationMap(codeNameMap, appLanguage);
      return codeNameMap;
    } catch (error) {
      const cachedCodeNameMap =
        await readCachedTourCategoryLocalizationMap(appLanguage);

      if (Object.keys(cachedCodeNameMap).length > 0) {
        return cachedCodeNameMap;
      }

      throw error;
    }
  }, [appLanguage]);

  const attractionQueryKey = useMemo(
    () =>
      [
        "gangwon-attractions",
        "source-first-v2",
        selectedSigunguCode,
        appLanguage,
      ] as const,
    [appLanguage, selectedSigunguCode]
  );

  const boundaryQuery = useQuery({
    queryKey: ["gangwon-boundary"],
    queryFn: async () => {
      const response = await fetch("/gangwon-sigungu-boundary.json");
      if (!response.ok) {
        throw new Error("Failed to load boundary data.");
      }
      const data = (await response.json()) as GangwonBoundaryCollection;
      return buildBoundaryMapBySigunguCode(data);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const attractionsQuery = useQuery<HomeAttractionQueryData>({
    queryKey: attractionQueryKey,
    enabled: Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      setAttractionLoadingStage("fetching-places");
      const signguCode = GANGWON_SIGNGU_ADMIN_CODES[selectedSigunguCode];
      const [lclsNameByCode, attractions, festivals, concentrationPoints] =
        await Promise.all([
          loadLclsNameByCode(),
          fetchGangwonAttractions(
            TOUR_API_SERVICE_KEY,
            {
              sigunguCode: selectedSigunguCode || undefined,
              contentTypeIds: ["12", "39"],
            },
            "ko"
          ),
          fetchGangwonFestivals(
            TOUR_API_SERVICE_KEY,
            {
              sigunguCode: selectedSigunguCode || undefined,
              lookAheadDays: 90,
            },
            "ko"
          ).catch(() => [] as GangwonAttraction[]),
          fetchTouristConcentrationPoints(TOUR_API_SERVICE_KEY, {
            areaCode: GANGWON_TATS_AREA_CODE,
            signguCode,
            numOfRows: 2000,
          }),
        ]);

      const resolvedLclsNameByCode = {
        ...lclsNameByCode,
        [CAFE_LCLS_CODE]:
          lclsNameByCode[CAFE_LCLS_CODE] ||
          (appLanguage === "en" ? "Cafe" : "카페"),
      };
      void cacheTourCategoryLocalizationMap(
        resolvedLclsNameByCode,
        appLanguage
      );
      setAttractionLoadingStage("ranking");

      const attractionsWithFestivals = [...attractions, ...festivals];
      const dedupedAttractions = attractionsWithFestivals.filter(
        (attraction, index, array) => {
          const key = `${attraction.title.trim().toLowerCase()}|${attraction.address
            .trim()
            .toLowerCase()}`;
          return (
            array.findIndex((candidate) => {
              const candidateKey = `${candidate.title
                .trim()
                .toLowerCase()}|${candidate.address.trim().toLowerCase()}`;
              return candidateKey === key;
            }) === index
          );
        }
      );
      const filteredAttractions = dedupedAttractions.filter(
        (attraction) =>
          !shouldHideAttraction(attraction, resolvedLclsNameByCode)
      );
      const rankableTouristAttractions = filteredAttractions.filter(
        (attraction) => isTouristPlace(attraction)
      );
      const latestConcentrationByName =
        buildLatestConcentrationMap(concentrationPoints);
      const latestConcentrationPoints = [
        ...latestConcentrationByName.values(),
      ].sort((a, b) => b.concentrationRate - a.concentrationRate);

      const usedAttractionIds = new Set<string>();
      const topAttractions: HomeAttractionQueryData["topAttractions"] = [];

      latestConcentrationPoints.forEach((point) => {
        if (topAttractions.length >= 10) {
          return;
        }

        const bestMatch = rankableTouristAttractions
          .filter((attraction) => !usedAttractionIds.has(attraction.id))
          .map((attraction) => ({
            attraction,
            score: getTouristNameMatchScore(
              attraction.title,
              point.touristName
            ),
          }))
          .filter((candidate) => candidate.score > 0)
          .sort((a, b) => b.score - a.score)[0];

        if (!bestMatch) {
          return;
        }

        usedAttractionIds.add(bestMatch.attraction.id);
        topAttractions.push({
          attraction: bestMatch.attraction,
          touristTrendName: point.touristName,
        });
      });

      const englishDisplayAttractions =
        appLanguage === "en"
          ? await withTimeoutFallback(
              Promise.all([
                fetchGangwonAttractions(
                  TOUR_API_SERVICE_KEY,
                  {
                    sigunguCode: selectedSigunguCode || undefined,
                    contentTypeIds: ["12", "39"],
                  },
                  "en"
                ).catch(() => [] as GangwonAttraction[]),
                fetchGangwonFestivals(
                  TOUR_API_SERVICE_KEY,
                  {
                    sigunguCode: selectedSigunguCode || undefined,
                    lookAheadDays: 90,
                  },
                  "en"
                ).catch(() => [] as GangwonAttraction[]),
              ]).then(([englishAttractions, englishFestivals]) => [
                ...englishAttractions,
                ...englishFestivals,
              ]),
              ENGLISH_DISPLAY_DATA_TIMEOUT_MS,
              [] as GangwonAttraction[]
            )
          : [];
      const displayAttractions =
        englishDisplayAttractions.length > 0
          ? mergeAttractionDisplayData(
              filteredAttractions,
              englishDisplayAttractions
            )
          : filteredAttractions;
      const displayAttractionByKey = new Map(
        displayAttractions.map((attraction) => [
          `${attraction.id}-${attraction.contentTypeId}`,
          attraction,
        ])
      );

      return {
        allAttractions: displayAttractions,
        sourceAttractions: filteredAttractions,
        topAttractions: topAttractions.map((item) => ({
          ...item,
          attraction:
            displayAttractionByKey.get(
              `${item.attraction.id}-${item.attraction.contentTypeId}`
            ) ?? item.attraction,
        })),
        lclsNameByCode: resolvedLclsNameByCode,
        isLocalized: appLanguage !== "en",
      };
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  useEffect(() => {
    const attractionData = attractionsQuery.data;

    if (
      appLanguage !== "en" ||
      !attractionData ||
      attractionData.isLocalized ||
      attractionData.allAttractions.length === 0 ||
      attractionsQuery.isFetching
    ) {
      return;
    }

    let isCancelled = false;
    const sourceAttractions =
      attractionData.sourceAttractions ?? attractionData.allAttractions;

    void localizeTourPlaces(sourceAttractions, appLanguage)
      .then((localizedAttractions) => {
        if (isCancelled) {
          return;
        }

        const sourceAttractionByKey = new Map(
          sourceAttractions.map((attraction) => [
            `${attraction.id}-${attraction.contentTypeId}`,
            attraction,
          ])
        );
        const hasLocalizedText = localizedAttractions.some((attraction) => {
          const sourceAttraction = sourceAttractionByKey.get(
            `${attraction.id}-${attraction.contentTypeId}`
          );

          return (
            sourceAttraction &&
            (attraction.title !== sourceAttraction.title ||
              attraction.address !== sourceAttraction.address)
          );
        });

        if (!hasLocalizedText) {
          return;
        }

        const localizedAttractionByKey = new Map(
          localizedAttractions.map((attraction) => [
            `${attraction.id}-${attraction.contentTypeId}`,
            attraction,
          ])
        );

        isUpdatingPlaceLabelsRef.current = true;
        queryClient.setQueryData<HomeAttractionQueryData>(
          attractionQueryKey,
          (currentData) => {
            if (!currentData || currentData.isLocalized) {
              isUpdatingPlaceLabelsRef.current = false;
              return currentData;
            }

            const currentAttractionByKey = new Map(
              currentData.allAttractions.map((attraction) => [
                `${attraction.id}-${attraction.contentTypeId}`,
                attraction,
              ])
            );
            const nextAttractions = localizedAttractions.map((attraction) => {
              const currentAttraction = currentAttractionByKey.get(
                `${attraction.id}-${attraction.contentTypeId}`
              );

              if (!currentAttraction) {
                return attraction;
              }

              return {
                ...attraction,
                firstImage:
                  currentAttraction.firstImage || attraction.firstImage,
                secondImage:
                  currentAttraction.secondImage || attraction.secondImage,
              };
            });

            return {
              ...currentData,
              allAttractions: nextAttractions,
              sourceAttractions,
              topAttractions: currentData.topAttractions.map((item) => ({
                ...item,
                attraction:
                  localizedAttractionByKey.get(
                    `${item.attraction.id}-${item.attraction.contentTypeId}`
                  ) ?? item.attraction,
              })),
              isLocalized: true,
            };
          }
        );
      })
      .catch((error) => {
        console.warn("홈 장소 영문 현지화에 실패해 원문을 유지합니다.", error);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    appLanguage,
    attractionQueryKey,
    attractionsQuery.data,
    attractionsQuery.isFetching,
    queryClient,
  ]);

  const festivalsQuery = useQuery({
    queryKey: ["gangwon-festivals", "90-days", appLanguage],
    enabled: Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      const festivals = await fetchGangwonFestivals(
        TOUR_API_SERVICE_KEY,
        { lookAheadDays: 90 },
        "ko"
      ).catch(() => [] as GangwonAttraction[]);
      return localizeTourPlaces(festivals, appLanguage);
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const festivalCountBySigunguCode = useMemo(() => {
    const countByCode = new Map<string, number>();

    (festivalsQuery.data ?? []).forEach((festival) => {
      if (!festival.tourApiSigunguCode) {
        return;
      }

      countByCode.set(
        festival.tourApiSigunguCode,
        (countByCode.get(festival.tourApiSigunguCode) ?? 0) + 1
      );
    });

    return countByCode;
  }, [festivalsQuery.data]);

  const topRankByAttractionId = useMemo(() => {
    const rankById = new Map<string, number>();
    (attractionsQuery.data?.topAttractions ?? []).forEach((item, index) => {
      rankById.set(item.attraction.id, index + 1);
    });
    return rankById;
  }, [attractionsQuery.data]);

  const trendNameByAttractionId = useMemo(() => {
    const nameById = new Map<string, string>();
    (attractionsQuery.data?.topAttractions ?? []).forEach((item) => {
      nameById.set(item.attraction.id, item.touristTrendName);
    });
    return nameById;
  }, [attractionsQuery.data]);

  return {
    attractionData: attractionsQuery.data,
    attractionError: !TOUR_API_SERVICE_KEY
      ? text.home.missingTourKey
      : attractionsQuery.error instanceof Error
        ? attractionsQuery.error.message
        : null,
    attractionLoadingStage: attractionsQuery.isError
      ? "idle"
      : attractionLoadingStage,
    boundaryBySigunguCode: boundaryQuery.data ?? {},
    festivalCountBySigunguCode,
    isAttractionLoading: attractionsQuery.isFetching,
    isAttractionFetching: attractionsQuery.isFetching,
    isBoundaryDataReady: boundaryQuery.isSuccess || boundaryQuery.isError,
    isUpdatingPlaceLabelsRef,
    setAttractionLoadingStage,
    topRankByAttractionId,
    trendNameByAttractionId,
  };
}
