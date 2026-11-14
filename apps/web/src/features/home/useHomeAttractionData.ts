/**
 * 홈 지도에 필요한 지역 경계, 관광지·축제, 혼잡도 순위와 다국어 장소명을 조회하고
 * 모델에 지도·검색 데이터 조합을 맡기고 조회 상태와 번역 결과의 캐시 반영을 관리한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { festivalApi } from "@/api/festivalApi";
import { createFestivalAttraction } from "@/lib/festivalAttraction";
import type { ServiceArea } from "@/data/serviceAreas";
import { useServiceRegionBoundaries } from "@/hooks/useServiceRegionBoundaries";
import { CAFE_LCLS_CODE } from "@/lib/placeCategory";
import {
  cacheTourCategoryLocalizationMap,
  localizeTourPlaces,
  readCachedTourCategoryLocalizationMap,
} from "@/lib/placeLocalization";
import { useUiText } from "@/lib/uiText";
import {
  fetchTourAttractions,
  fetchLclsSystemNameMap,
  fetchTouristConcentrationPoints,
  type GangwonAttraction,
} from "@/lib/visitKoreaTourApi";
import { TOUR_API_SERVICE_KEY } from "@/pages/HomePage.constants";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import {
  applyHomeAttractionLocalization,
  buildHomeAttractionData,
  hasHomeAttractionLocalizedText,
  type HomeAttractionQueryData,
} from "./homeAttractionModel";
import type { HomeAttractionLoadingPhase } from "./homeLoadingPhase";

export type { HomeAttractionQueryData } from "./homeAttractionModel";

type UseHomeAttractionDataOptions = {
  /** false이면 관광지 Query를 실행하지 않는다. 기본값은 true다. */
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
        "festivals",
        serviceArea.tourAreaCode,
        "official-7-days",
        festivalDateWindow.startDateKey,
        festivalDateWindow.endDateKey,
        appLanguage,
      ] as const,
    [appLanguage, festivalDateWindow, serviceArea.tourAreaCode]
  );
  const loadFestivals = useCallback(async () => {
    const result = await festivalApi.list(
      festivalDateWindow.startDateKey,
      festivalDateWindow.endDateKey,
      { areaCode: serviceArea.tourAreaCode }
    );
    const todayYmd = festivalDateWindow.startDateKey.replaceAll("-", "");
    const festivals = result.festivals.map(festival => createFestivalAttraction(festival, todayYmd));

    return localizeTourPlaces(festivals, appLanguage, {
      waitForFresh: true,
    });
  }, [appLanguage, festivalDateWindow, serviceArea.tourAreaCode]);

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
        "source-first-v3",
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

  const {
    boundaryBySigunguCode,
    boundaryByAdminCode,
    isBoundaryDataReady,
    boundaryError,
  } = useServiceRegionBoundaries(serviceArea);

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

      const attractionData = buildHomeAttractionData({
        attractions,
        festivals,
        concentrationPoints,
        lclsNameByCode: resolvedLclsNameByCode,
        sigunguCode: selectedSigunguCode,
        isLocalized: appLanguage !== "en",
      });

      if (attractionLoadingRequestIdRef.current === loadingRequestId) {
        setAttractionLoadingPhase("idle");
      }
      return attractionData;
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

        if (
          !hasHomeAttractionLocalizedText(sourceAttractions, localizedAttractions)
        ) {
          return;
        }

        isUpdatingPlaceLabelsRef.current = true;
        queryClient.setQueryData<HomeAttractionQueryData>(
          attractionQueryKey,
          (currentData) => {
            if (!currentData || currentData.isLocalized) {
              isUpdatingPlaceLabelsRef.current = false;
              return currentData;
            }

            return applyHomeAttractionLocalization(
              currentData,
              sourceAttractions,
              localizedAttractions
            );
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
    boundaryByAdminCode,
    boundaryError,
    festivalCountBySigunguCode,
    festivals: serviceArea.hasFestivalSource
      ? festivalsQuery.data ?? []
      : [],
    isFestivalDataReady:
      !serviceArea.hasFestivalSource || festivalsQuery.isSuccess,
    isAttractionLoading: attractionsQuery.isFetching,
    isAttractionFetching: attractionsQuery.isFetching,
    isBoundaryDataReady,
    isUpdatingPlaceLabelsRef,
    topRankByAttractionId,
    trendNameByAttractionId,
  };
}
