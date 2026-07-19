import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { placeLocalizationApi } from "@/api/placeLocalizationApi";
import { routeApi } from "@/api/routeApi";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import { isTouristPlace } from "@/lib/placeCategory";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import {
  MIN_PLACE_STAY_SUMMARY_VISIT_COUNT,
  mapSheetPlaceToPlaceSnapshotInput,
  resolvePlaceStaySummaryForDisplay,
} from "@/lib/routePlaceSnapshot";
import type { UiText } from "@/lib/uiText";
import {
  fetchNearbyTouristPlaces,
  fetchTourPlaceDetail,
  fetchTouristConcentrationPoints,
  type NearbyTouristPlace,
} from "@/lib/visitKoreaTourApi";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetPlace } from "@/types/place";
import {
  dedupePlaceImageUrls,
  formatDistance,
  formatDurationMinutes,
  formatStayMinutes,
  getNearbyPlaceCategoryLabel,
  getOfficialEnglishDetailValue,
  isExcludedNearbyPlace,
  localizeTourDetailValue,
  preloadImageUrls,
  type PlaceSheetCoordinates,
} from "../placeSheetModel";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

type UsePlaceSheetDataParams = {
  appLanguage: AppLanguage;
  currentLocation: PlaceSheetCoordinates;
  isOpen: boolean;
  selectedPlace: MapSheetPlace | null;
  text: UiText;
  updateSelectedPlace: (place: MapSheetPlace) => void;
};

export function usePlaceSheetData({
  appLanguage,
  currentLocation,
  isOpen,
  selectedPlace,
  text,
  updateSelectedPlace,
}: UsePlaceSheetDataParams) {
  const hasTourApiServiceKey = Boolean(TOUR_API_SERVICE_KEY);
  const selectedPlaceKey = selectedPlace
    ? `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`
    : null;

  useEffect(() => {
    if (!isOpen || appLanguage !== "en" || !selectedPlace) {
      return;
    }

    if (!/[가-힣]/u.test(`${selectedPlace.title} ${selectedPlace.address}`)) {
      return;
    }

    let isCancelled = false;

    void placeLocalizationApi
      .localizeTourPlaces([
        {
          contentId: selectedPlace.contentId,
          contentTypeId: selectedPlace.contentTypeId,
          title: selectedPlace.title,
          address: selectedPlace.address,
        },
      ])
      .then((response) => {
        if (isCancelled) {
          return;
        }

        const localizedPlace = response.localizeTourPlaces[0];
        if (!localizedPlace) {
          return;
        }

        if (
          localizedPlace.title === selectedPlace.title &&
          localizedPlace.address === selectedPlace.address
        ) {
          return;
        }

        updateSelectedPlace({
          ...selectedPlace,
          title: localizedPlace.title || selectedPlace.title,
          address: localizedPlace.address || selectedPlace.address,
        });
      })
      .catch((error) => {
        console.warn(text.placeSheet.localizationFallbackWarn, error);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    appLanguage,
    isOpen,
    selectedPlace,
    text.placeSheet.localizationFallbackWarn,
    updateSelectedPlace,
  ]);

  const detailQuery = useQuery({
    queryKey: ["place-detail", "localized-detail-v3", selectedPlaceKey, appLanguage],
    enabled: isOpen && Boolean(selectedPlace) && hasTourApiServiceKey,
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }
      const [detail, officialEnglishDetail] = await Promise.all([
        fetchTourPlaceDetail(
          TOUR_API_SERVICE_KEY,
          selectedPlace.contentId,
          selectedPlace.contentTypeId,
          "ko"
        ),
        appLanguage === "en"
          ? fetchTourPlaceDetail(
              TOUR_API_SERVICE_KEY,
              selectedPlace.contentId,
              selectedPlace.contentTypeId,
              "en"
            ).catch(() => null)
          : Promise.resolve(null),
      ]);
      const officialOverview = getOfficialEnglishDetailValue(
        officialEnglishDetail?.overview
      );
      const officialOperatingHours = getOfficialEnglishDetailValue(
        officialEnglishDetail?.operatingHours
      );
      const officialRestDate = getOfficialEnglishDetailValue(
        officialEnglishDetail?.restDate
      );
      const officialInfoCenter = getOfficialEnglishDetailValue(
        officialEnglishDetail?.infoCenter
      );
      let overview = officialOverview || detail.overview;
      let operatingHours = officialOperatingHours || detail.operatingHours;
      let restDate = officialRestDate || detail.restDate;
      let infoCenter = officialInfoCenter || detail.infoCenter;
      const shouldLocalizeMissingDetail =
        appLanguage === "en" &&
        ((detail.overview && !officialOverview) ||
          (detail.operatingHours && !officialOperatingHours) ||
          (detail.restDate && !officialRestDate) ||
          (detail.infoCenter && !officialInfoCenter));

      if (shouldLocalizeMissingDetail) {
        try {
          const localized = await placeLocalizationApi.localizeTourPlaceOverview({
            contentId: selectedPlace.contentId,
            overview: detail.overview,
            operatingHours: detail.operatingHours,
            restDate: detail.restDate,
            infoCenter: detail.infoCenter,
          });
          const localizedDetail = localized.localizeTourPlaceOverview;
          overview = officialOverview || localizedDetail.overview || detail.overview;
          operatingHours =
            officialOperatingHours ||
            localizedDetail.operatingHours ||
            detail.operatingHours;
          restDate =
            officialRestDate || localizedDetail.restDate || detail.restDate;
          infoCenter =
            officialInfoCenter ||
            localizedDetail.infoCenter ||
            detail.infoCenter;
        } catch (error) {
          console.warn(text.placeSheet.localizationFallbackWarn, error);
        }
      }
      const loadedImages = await preloadImageUrls(detail.images);
      return {
        overview,
        images: loadedImages,
        operatingHours,
        restDate,
        infoCenter,
      };
    },
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });

  const routeQuery = useQuery({
    queryKey: [
      "place-route",
      selectedPlaceKey,
      currentLocation.lat,
      currentLocation.lng,
      appLanguage,
    ],
    enabled: isOpen && Boolean(selectedPlace),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }
      return fetchDrivingRouteFromCurrentLocation({
        startLat: currentLocation.lat,
        startLng: currentLocation.lng,
        goalLat: selectedPlace.lat,
        goalLng: selectedPlace.lng,
        language: appLanguage,
      });
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const placeStaySummaryQuery = useQuery({
    queryKey: ["place-stay-summary", selectedPlaceKey],
    enabled: isOpen && Boolean(selectedPlace),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }

      const result = await routeApi.placeStaySummary(
        mapSheetPlaceToPlaceSnapshotInput(selectedPlace)
      );
      return result.placeStaySummary;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });

  const placePhotosQuery = useQuery({
    queryKey: ["place-photos", selectedPlaceKey],
    enabled: isOpen && Boolean(selectedPlace),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }

      const result = await routeApi.placePhotos(
        mapSheetPlaceToPlaceSnapshotInput(selectedPlace),
        12
      );
      return result.placePhotos;
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const concentrationTrendQuery = useQuery({
    queryKey: [
      "place-concentration-trend",
      selectedPlace?.signguCode ?? "",
      selectedPlace?.touristTrendName ?? selectedPlace?.title ?? "",
    ],
    enabled:
      isOpen &&
      Boolean(selectedPlace) &&
      (selectedPlace ? isTouristPlace(selectedPlace) : false) &&
      hasTourApiServiceKey &&
      Boolean(selectedPlace?.areaCode) &&
      Boolean(selectedPlace?.signguCode),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }

      return fetchTouristConcentrationPoints(TOUR_API_SERVICE_KEY, {
        areaCode: selectedPlace.areaCode,
        signguCode: selectedPlace.signguCode,
        touristName: selectedPlace.touristTrendName || selectedPlace.title,
        numOfRows: 40,
      });
    },
    retry: (failureCount, error) => {
      const message = error instanceof Error ? error.message : "";
      if (/403|401/.test(message)) {
        return failureCount < 2;
      }
      return failureCount < 1;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 4000),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
  });

  const nearbyTouristQuery = useQuery({
    queryKey: [
      "nearby-tourist",
      selectedPlace?.contentId ?? "",
      selectedPlace?.lat ?? 0,
      selectedPlace?.lng ?? 0,
      appLanguage,
    ],
    enabled:
      isOpen &&
      Boolean(selectedPlace) &&
      hasTourApiServiceKey &&
      Number.isFinite(selectedPlace?.lat) &&
      Number.isFinite(selectedPlace?.lng),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error(text.placeSheet.selectedPlaceMissing);
      }

      const nearbyPlaces = await fetchNearbyTouristPlaces(
        TOUR_API_SERVICE_KEY,
        {
          lat: selectedPlace.lat,
          lng: selectedPlace.lng,
          radiusM: 6000,
          numOfRows: 12,
          contentTypeIds: ["12", "39"],
          excludeContentId: selectedPlace.contentId,
        },
        "ko"
      );
      return localizeTourPlaces(nearbyPlaces, appLanguage);
    },
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60,
  });

  const detailOverview = detailQuery.data?.overview ?? "";
  const detailImages = useMemo(
    () => detailQuery.data?.images ?? [],
    [detailQuery.data]
  );
  const detailOperatingHours = localizeTourDetailValue(
    detailQuery.data?.operatingHours ?? "",
    text
  );
  const detailRestDate = localizeTourDetailValue(
    detailQuery.data?.restDate ?? "",
    text
  );
  const detailInfoCenter = localizeTourDetailValue(
    detailQuery.data?.infoCenter ?? "",
    text
  );
  const detailHoursBadgeValue = detailOperatingHours || detailRestDate;
  const isSelectedPlaceDetailReady =
    !hasTourApiServiceKey ||
    (Boolean(selectedPlaceKey) && (detailQuery.isSuccess || detailQuery.isError));
  const activeImageList = useMemo(
    () =>
      dedupePlaceImageUrls([...(selectedPlace?.images ?? []), ...detailImages]),
    [detailImages, selectedPlace?.images]
  );
  const userPlacePhotos = useMemo(
    () => placePhotosQuery.data ?? [],
    [placePhotosQuery.data]
  );
  const userPlacePhotoViewerUrls = useMemo(
    () => userPlacePhotos.map((photo) => photo.imageUrl),
    [userPlacePhotos]
  );
  const routeDurationText = routeQuery.data
    ? formatDurationMinutes(routeQuery.data.durationMs, text)
    : null;
  const routeDistanceText = routeQuery.data
    ? formatDistance(routeQuery.data.distanceM)
    : null;
  const routePathPoints = useMemo(
    () => routeQuery.data?.path ?? [],
    [routeQuery.data]
  );
  const displayPlaceStaySummary = selectedPlace
    ? resolvePlaceStaySummaryForDisplay(selectedPlace, placeStaySummaryQuery.data)
    : null;
  const averageStayLabel = formatStayMinutes(
    displayPlaceStaySummary?.averageActualStayMinutes,
    text
  );
  const placeStaySummaryVisitCount = displayPlaceStaySummary?.visitCount ?? 0;
  const placeStaySummaryLabel = placeStaySummaryQuery.isFetching
    ? text.placeSheet.stayChecking
    : placeStaySummaryVisitCount === 0
      ? text.placeSheet.stayEmpty
      : placeStaySummaryVisitCount < MIN_PLACE_STAY_SUMMARY_VISIT_COUNT
        ? text.placeSheet.staySamplePending(
            MIN_PLACE_STAY_SUMMARY_VISIT_COUNT
          )
        : averageStayLabel
          ? text.placeSheet.stayAverage(
              averageStayLabel,
              placeStaySummaryVisitCount
            )
          : text.placeSheet.stayEmpty;
  const selectedPlaceTitle = selectedPlace?.title.trim().toLowerCase() ?? "";
  const nearbyTouristPlaces = useMemo(
    () =>
      (nearbyTouristQuery.data ?? [])
        .filter(
          (item): item is NearbyTouristPlace =>
            item.title.trim().toLowerCase() !== selectedPlaceTitle
        )
        .filter((item) => getNearbyPlaceCategoryLabel(item) !== "장소")
        .filter((item) => !isExcludedNearbyPlace(item.title))
        .slice(0, 6),
    [nearbyTouristQuery.data, selectedPlaceTitle]
  );

  return {
    activeImageList,
    concentrationTrendError:
      concentrationTrendQuery.error instanceof Error
        ? concentrationTrendQuery.error.message
        : null,
    concentrationTrendPoints: concentrationTrendQuery.data ?? [],
    detailHoursBadgeValue,
    detailInfoCenter,
    detailOperatingHours,
    detailOverview,
    detailRestDate,
    isConcentrationTrendLoading: concentrationTrendQuery.isFetching,
    isNearbyTouristLoading: nearbyTouristQuery.isFetching,
    isPlacePhotosLoading: placePhotosQuery.isFetching,
    isRouteLoading: routeQuery.isFetching,
    isSelectedPlaceDetailReady,
    isTouristAttraction: selectedPlace ? isTouristPlace(selectedPlace) : false,
    nearbyTouristError:
      nearbyTouristQuery.error instanceof Error
        ? nearbyTouristQuery.error.message
        : null,
    nearbyTouristPlaces,
    placeStaySummaryLabel,
    routeDistanceText,
    routeDurationText,
    routeError:
      routeQuery.error instanceof Error ? routeQuery.error.message : null,
    routePathPoints,
    selectedPlaceKey,
    userPlacePhotos,
    userPlacePhotoViewerUrls,
  };
}

export type PlaceSheetData = ReturnType<typeof usePlaceSheetData>;
