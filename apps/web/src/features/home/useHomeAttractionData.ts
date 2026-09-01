import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { festivalApi } from "@/api/festivalApi";
import type { ServiceArea } from "@/data/serviceAreas";
import {
  buildBoundaryMapByRegions,
  type GangwonBoundaryCollection,
} from "@/lib/gangwonBoundaryUtils";
import {
  getTouristNameMatchScore,
  shouldHideAttraction,
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
  fetchTourAttractions,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import type { HomeAttractionLoadingPhase } from "./homeLoadingPhase";

export type HomeAttractionQueryData = {
  allAttractions: GangwonAttraction[];
  sourceAttractions: GangwonAttraction[];
  sigunguCode: string;
  topAttractions: Array<{
    attraction: GangwonAttraction;
    touristTrendName: string;
  }>;
  lclsNameByCode: Record<string, string>;
  isLocalized: boolean;
};

type UseHomeAttractionDataOptions = {
  enabled?: boolean;
};

const FESTIVAL_LOOK_AHEAD_DAYS = 6;

function formatLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getFestivalDateWindow() {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + FESTIVAL_LOOK_AHEAD_DAYS);

  return {
    startDateKey: formatLocalDateKey(startDate),
    endDateKey: formatLocalDateKey(endDate),
  };
}

function getBoundaryAssetUrl(assetPath: string) {
  if (assetPath.startsWith("data:")) {
    return assetPath;
  }

  return new URL(
    assetPath.replace(/^\/+/, ""),
    document.baseURI
  ).toString();
}

export function useHomeAttractionData(
  selectedSigunguCode: string,
  serviceArea: ServiceArea,
  options: UseHomeAttractionDataOptions = {}
) {
  const text = useUiText();
  const queryClient = useQueryClient();
  const appLanguage = useAppLanguageStore((state) => state.language);
  const [attractionLoadingPhase, setAttractionLoadingPhase] =
    useState<HomeAttractionLoadingPhase>("idle");
  const attractionLoadingRequestIdRef = useRef(0);
  const isUpdatingPlaceLabelsRef = useRef(false);
  const isAttractionQueryEnabled = options.enabled ?? true;
  const festivalDateWindow = useMemo(() => getFestivalDateWindow(), []);
  const festivalQueryKey = useMemo(
    () =>
      [
        "gangwon-festivals",
        "official-7-days",
        festivalDateWindow.startDateKey,
        festivalDateWindow.endDateKey,
        appLanguage,
      ] as const,
    [appLanguage, festivalDateWindow]
  );
  const loadFestivals = useCallback(async () => {
    const result = await festivalApi.list(
      festivalDateWindow.startDateKey,
      festivalDateWindow.endDateKey
    );
    const todayYmd = festivalDateWindow.startDateKey.replaceAll("-", "");
    const festivals = result.gangwonFestivals.map((festival) => {
      const eventStartDate = festival.startDate.replaceAll("-", "");
      const eventEndDate = festival.endDate.replaceAll("-", "");

      return {
        id: festival.id,
        title: festival.title,
        address: festival.address || "주소 정보 없음",
        lat: festival.lat,
        lng: festival.lng,
        contentTypeId: "15",
        lclsSystm1: "",
        lclsSystm2: "",
        lclsSystm3: "",
        firstImage: festival.imageUrl,
        secondImage: "",
        eventStartDate,
        eventEndDate,
        isTodayFestival:
          eventStartDate <= todayYmd && eventEndDate >= todayYmd,
        tourApiSigunguCode: festival.regionCode,
      } satisfies GangwonAttraction;
    });

    return localizeTourPlaces(festivals, appLanguage, {
      waitForFresh: true,
    });
  }, [appLanguage, festivalDateWindow]);

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
        "tour-attractions",
        "source-first-v2",
        serviceArea.id,
        selectedSigunguCode,
        festivalDateWindow.startDateKey,
        appLanguage,
      ] as const,
    [
      appLanguage,
      festivalDateWindow.startDateKey,
      selectedSigunguCode,
      serviceArea.id,
    ]
  );

  const boundaryQuery = useQuery({
    queryKey: ["service-area-boundary", serviceArea.id],
    enabled: Boolean(serviceArea.boundaryAssetPath),
    queryFn: async () => {
      if (!serviceArea.boundaryAssetPath) {
        return {};
      }

      const response = await fetch(
        getBoundaryAssetUrl(serviceArea.boundaryAssetPath)
      );
      if (!response.ok) {
        throw new Error("Failed to load boundary data.");
      }
      const data = (await response.json()) as GangwonBoundaryCollection;
      return buildBoundaryMapByRegions(data, serviceArea.regions);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const attractionsQuery = useQuery<HomeAttractionQueryData>({
    queryKey: attractionQueryKey,
    enabled: Boolean(TOUR_API_SERVICE_KEY) && isAttractionQueryEnabled,
    queryFn: async () => {
      const loadingRequestId = attractionLoadingRequestIdRef.current + 1;
      attractionLoadingRequestIdRef.current = loadingRequestId;
      setAttractionLoadingPhase("fetching-places");
      const selectedRegion = serviceArea.regions.find(
        (region) => region.sigunguCode === selectedSigunguCode
      );
      const signguCode = selectedRegion?.adminCode ?? "";
      const [lclsNameByCode, attractions, festivals, concentrationPoints] =
        await Promise.all([
          loadLclsNameByCode(),
          fetchTourAttractions(
            TOUR_API_SERVICE_KEY,
            {
              areaCode: serviceArea.tourAreaCode,
              sigunguCode: selectedSigunguCode || undefined,
              contentTypeIds: ["12", "39"],
            },
            "ko"
          ),
          serviceArea.hasFestivalSource
            ? queryClient
                .fetchQuery({
                  queryKey: festivalQueryKey,
                  queryFn: loadFestivals,
                  staleTime: 1000 * 60 * 60 * 6,
                })
                .then((items) =>
                  selectedSigunguCode
                    ? items.filter(
                        (festival) =>
                          festival.tourApiSigunguCode === selectedSigunguCode
                      )
                    : items
                )
                .catch(() => [] as GangwonAttraction[])
            : Promise.resolve([] as GangwonAttraction[]),
          fetchTouristConcentrationPoints(TOUR_API_SERVICE_KEY, {
            areaCode: serviceArea.tatsAreaCode,
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
      if (attractionLoadingRequestIdRef.current === loadingRequestId) {
        setAttractionLoadingPhase("ranking");
      }

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

      if (attractionLoadingRequestIdRef.current === loadingRequestId) {
        setAttractionLoadingPhase("idle");
      }
      return {
        allAttractions: filteredAttractions,
        sourceAttractions: filteredAttractions,
        sigunguCode: selectedSigunguCode,
        topAttractions,
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

    void localizeTourPlaces(sourceAttractions, appLanguage, {
      waitForFresh: true,
    })
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
    queryKey: festivalQueryKey,
    enabled:
      Boolean(TOUR_API_SERVICE_KEY) && serviceArea.hasFestivalSource,
    queryFn: loadFestivals,
    staleTime: 1000 * 60 * 60 * 6,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const festivalCountBySigunguCode = useMemo(() => {
    const countByCode = new Map<string, number>();

    if (!serviceArea.hasFestivalSource) {
      return countByCode;
    }

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
  }, [festivalsQuery.data, serviceArea.hasFestivalSource]);
  const boundaryBySigunguCode = useMemo(
    () =>
      serviceArea.hasBoundaryAsset ? boundaryQuery.data ?? {} : {},
    [boundaryQuery.data, serviceArea.hasBoundaryAsset]
  );

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
    attractionLoadingPhase: attractionsQuery.isError
      ? "idle"
      : attractionLoadingPhase,
    boundaryBySigunguCode,
    festivalCountBySigunguCode,
    festivals: serviceArea.hasFestivalSource
      ? festivalsQuery.data ?? []
      : [],
    isFestivalDataReady:
      !serviceArea.hasFestivalSource || festivalsQuery.isSuccess,
    isAttractionLoading: attractionsQuery.isFetching,
    isAttractionFetching: attractionsQuery.isFetching,
    isBoundaryDataReady:
      !serviceArea.hasBoundaryAsset ||
      boundaryQuery.isSuccess ||
      boundaryQuery.isError,
    isUpdatingPlaceLabelsRef,
    topRankByAttractionId,
    trendNameByAttractionId,
  };
}
