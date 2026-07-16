import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { routeApi } from "@/api/routeApi";
import { placeLocalizationApi } from "@/api/placeLocalizationApi";
import { DEFAULT_GANGWON_REGION } from "@/data/gangwonRegions";
import {
  IoBagAdd,
  IoBagAddOutline,
  IoCarSportOutline,
  IoClose,
  IoInformationCircleOutline,
  IoNavigate,
  IoCallOutline,
  IoCalendarClearOutline,
  IoTimeOutline,
} from "react-icons/io5";
import { usePlaceSheetLayout } from "../hooks/usePlaceSheetLayout";
import PlaceTrendChart from "./PlaceTrendChart";
import { fetchDrivingRouteFromCurrentLocation } from "@/lib/naverDirectionsApi";
import {
  MIN_PLACE_STAY_SUMMARY_VISIT_COUNT,
  mapSheetPlaceToPlaceSnapshotInput,
  resolvePlaceStaySummaryForDisplay,
} from "@/lib/routePlaceSnapshot";
import {
  fetchNearbyTouristPlaces,
  fetchTourPlaceDetail,
  fetchTouristConcentrationPoints,
  type NearbyTouristPlace,
} from "@/lib/visitKoreaTourApi";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
  getReadablePlaceCategoryName,
  isTouristPlace,
} from "@/lib/placeCategory";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import {
  localizePlaceCategoryLabel,
  useUiText,
  type UiText,
} from "@/lib/uiText";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MapSheetPlace } from "@/types/place";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const NAVER_MAP_SCHEME_APP_NAME = "routeone.web";

const SHEET_HEADER_HEIGHT_PX = 64;
const SHEET_HEADLINE_MIN_HEIGHT_PX = 108;

type CurrentLocation = {
  lat: number;
  lng: number;
};

type ImageViewerTarget = {
  imageUrls: string[];
  index: number;
  title: string;
};

type PreviewMapInstance = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
};

type PreviewMapOverlay = {
  setMap: (map: null) => void;
};

function getTopRankBadgeStyle(rank: number, text: UiText) {
  if (rank === 1) {
    return {
      label: `🥇 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200",
    };
  }
  if (rank === 2) {
    return {
      label: `🥈 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/70 dark:bg-slate-300/10 dark:text-slate-100",
    };
  }
  if (rank === 3) {
    return {
      label: `🥉 ${text.placeSheet.rankBadge(rank)}`,
      className:
        "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-400/60 dark:bg-orange-400/15 dark:text-orange-200",
    };
  }
  return {
    label: text.placeSheet.rankBadge(rank),
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/60 dark:bg-rose-400/15 dark:text-rose-200",
  };
}

function formatDurationMinutes(durationMs: number, text: UiText) {
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  return text.placeSheet.durationMinutes(minutes);
}

function formatStayMinutes(minutes: number | null | undefined, text: UiText) {
  if (!minutes) {
    return null;
  }

  if (minutes < 60) {
    return text.placeSheet.durationMinutes(minutes);
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;

  return restMinutes > 0
    ? text.placeSheet.durationHoursMinutes(hours, restMinutes)
    : text.placeSheet.durationHours(hours);
}

function formatDistance(distanceM: number) {
  return `${(Math.max(1, distanceM) / 1000).toFixed(1)}km`;
}

function preloadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      resolve(false);
    }, 4_000);

    const finish = (loaded: boolean) => {
      window.clearTimeout(timeoutId);
      resolve(loaded);
    };

    image.onerror = () => finish(false);
    image.onload = () => finish(true);
    image.src = url;
  });
}

async function preloadImageUrls(urls: string[]) {
  const results = await Promise.all(
    urls.map(async (url) => ({
      url,
      loaded: await preloadImage(url),
    }))
  );

  return results.filter((result) => result.loaded).map((result) => result.url);
}

function getPlaceImageDedupeKey(rawUrl: string) {
  const normalizePath = (path: string) =>
    path
      .split("?")[0]
      .split("#")[0]
      .replace(/_image[23]_(\d+)(?=\.[^./]+$)/i, "_image_$1");

  try {
    const url = new URL(rawUrl);
    return `${url.hostname}${normalizePath(url.pathname)}`;
  } catch {
    return normalizePath(rawUrl);
  }
}

function dedupePlaceImageUrls(urls: string[]) {
  const uniqueUrls = new Map<string, string>();

  urls.forEach((url) => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return;
    }

    const key = getPlaceImageDedupeKey(trimmedUrl);

    if (!uniqueUrls.has(key)) {
      uniqueUrls.set(key, trimmedUrl);
    }
  });

  return [...uniqueUrls.values()];
}

function PlacePhotoThumbnail({
  thumbnailUrl,
  imageUrl,
  alt,
}: {
  thumbnailUrl?: string | null;
  imageUrl: string;
  alt: string;
}) {
  const [useOriginalImage, setUseOriginalImage] = useState(!thumbnailUrl);
  const source = useOriginalImage || !thumbnailUrl ? imageUrl : thumbnailUrl;

  return (
    <img
      src={source}
      alt={alt}
      className="h-full w-full object-cover transition duration-200 group-active:scale-95"
      loading="lazy"
      onError={() => {
        if (!useOriginalImage && thumbnailUrl !== imageUrl) {
          setUseOriginalImage(true);
        }
      }}
    />
  );
}

function buildGoogleImageSearchUrl(keyword: string, text: UiText) {
  const query = text.placeSheet.googleImageQuery(keyword);
  const params = new URLSearchParams({
    tbm: "isch",
    q: query,
  });
  return `https://www.google.com/search?${params.toString()}`;
}

function localizeTourDetailValue(value: string, text: UiText) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  const translations = Object.entries(
    text.placeSheet.detailValueTranslations
  ).sort(([sourceA], [sourceB]) => sourceB.length - sourceA.length);
  const exactValue = text.placeSheet.detailValueTranslations[trimmedValue];

  if (exactValue) {
    return exactValue;
  }

  const compactValue = trimmedValue.replace(/\s+/g, "");
  const compactMatch = translations.find(
    ([source]) => source.replace(/\s+/g, "") === compactValue
  );

  if (compactMatch) {
    return compactMatch[1];
  }

  return translations.reduce(
    (result, [source, target]) => result.replaceAll(source, target),
    trimmedValue
  );
}

function getOfficialEnglishDetailValue(value: string | undefined) {
  const trimmedValue = value?.trim() ?? "";
  return trimmedValue && !/[가-힣]/u.test(trimmedValue) ? trimmedValue : "";
}

const EXCLUDED_NEARBY_PLACE_PATTERN =
  /(버스정류장|정류장|매표소|주차장|화장실|터미널|관리사무소|안내소|입구|출구|승강장|휴게소|매점)/;

function formatNearbyDistance(distanceM: number | null) {
  if (distanceM == null || !Number.isFinite(distanceM)) {
    return null;
  }

  if (distanceM >= 1000) {
    return `${(distanceM / 1000).toFixed(1)}km`;
  }

  return `${Math.round(distanceM)}m`;
}

function PlaceInfoRow({
  label,
  value,
  icon = "time",
}: {
  label: string;
  value: string;
  icon?: "time" | "calendar" | "call";
}) {
  if (!value) {
    return null;
  }

  return (
    <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3 text-xs dark:border-brand-400/25 dark:bg-slate-950/35">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-base text-brand-600 shadow-sm dark:bg-brand-400/15 dark:text-brand-200">
        {icon === "call" ? (
          <IoCallOutline />
        ) : icon === "calendar" ? (
          <IoCalendarClearOutline />
        ) : (
          <IoTimeOutline />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-brand-700 dark:text-brand-200">{label}</p>
        <p className="mt-1 line-clamp-2 leading-5 text-slate-600 dark:text-slate-300">
          {value}
        </p>
      </div>
    </div>
  );
}

function SkeletonBar({
  className,
  rounded = "rounded-full",
}: {
  className: string;
  rounded?: string;
}) {
  return (
    <span
      className={`skeleton-shimmer block bg-slate-200 dark:bg-slate-700 ${rounded} ${className}`}
    />
  );
}

function ImageStripSkeleton() {
  return (
    <>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-44 w-40 shrink-0 snap-start rounded-2xl border border-brand-100 bg-white p-3 dark:border-brand-400/25 dark:bg-slate-900"
        >
          <SkeletonBar className="h-full w-full" rounded="rounded-xl" />
        </div>
      ))}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/45 px-3 py-4 dark:border-brand-400/25 dark:bg-slate-950/45">
      <div className="space-y-3">
        <SkeletonBar className="h-4 w-full" />
        <SkeletonBar className="h-4 w-[92%]" />
        <SkeletonBar className="h-4 w-[86%]" />
        <SkeletonBar className="h-4 w-[94%]" />
        <SkeletonBar className="h-4 w-[62%]" />
      </div>
    </div>
  );
}

function RouteInfoSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <SkeletonBar className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar className="h-3 w-3/4" />
        <SkeletonBar className="h-3 w-1/2" />
      </div>
    </div>
  );
}

function NearbyPlacesSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-white px-3 py-3 dark:border-brand-400/25 dark:bg-slate-950/40"
        >
          <SkeletonBar className="h-16 w-16 shrink-0" rounded="rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBar className="h-4 w-2/3" />
            <SkeletonBar className="h-3 w-1/3" />
            <SkeletonBar className="h-3 w-5/6" />
          </div>
          <SkeletonBar className="h-4 w-10 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CompactHoursBadge({ value }: { value: string }) {
  if (!value) {
    return null;
  }

  return (
    <span className="inline-flex max-w-[10rem] items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25">
      <IoTimeOutline className="shrink-0 text-sm" />
      <span className="truncate">{value}</span>
    </span>
  );
}

function getNearbyPlaceCategoryLabel(place: NearbyTouristPlace) {
  return getPlaceCategoryLabel(place);
}

function getNearbyPlaceCategoryIcon(place: NearbyTouristPlace) {
  const categoryLabel = getNearbyPlaceCategoryLabel(place);
  return getPlaceCategoryIcon(categoryLabel);
}

type NearbyMapSheetPlaceInput = {
  place: NearbyTouristPlace;
  areaCode: string;
  signguCode: string;
};

function createMapSheetPlaceFromNearbyPlace({
  place,
  areaCode,
  signguCode,
}: NearbyMapSheetPlaceInput): MapSheetPlace {
  const categoryLabel = getNearbyPlaceCategoryLabel(place);
  const categoryIcon = getNearbyPlaceCategoryIcon(place);
  const categoryName = getReadablePlaceCategoryName(
    [place.lclsSystm3, place.lclsSystm2, place.lclsSystm1],
    categoryLabel
  );

  return {
    id: `${place.id}-${place.contentTypeId}`,
    contentId: place.id,
    contentTypeId: place.contentTypeId,
    areaCode,
    signguCode,
    touristTrendName: place.title,
    topRank: null,
    title: place.title,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    contentTypeLabel: categoryLabel,
    categoryName,
    icon: categoryIcon,
    images: dedupePlaceImageUrls([place.firstImage, place.secondImage]),
  };
}

function PlaceBottomSheet() {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const {
    isOpen,
    sheetMode,
    sheetResetVersion,
    selectedPlace,
    openSheet,
    updateSelectedPlace,
    resetSheet,
  } = useMapSheetStore();
  const { savedPlaceIds, toggleSavedPlace } = usePlaceCartStore();
  const showToast = useUiToastStore((state) => state.showToast);
  const [isTopRankInfoOpen, setIsTopRankInfoOpen] = useState(false);
  const [imageViewerTarget, setImageViewerTarget] =
    useState<ImageViewerTarget | null>(null);
  const [isPreviewMapSdkReady, setIsPreviewMapSdkReady] = useState(false);
  const [previewMapError, setPreviewMapError] = useState<string | null>(null);
  const imageSwipeStartXRef = useRef<number | null>(null);

  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const previewMapInstanceRef = useRef<PreviewMapInstance | null>(null);
  const previewMapContainerRef = useRef<HTMLDivElement | null>(null);
  const previewOverlaysRef = useRef<PreviewMapOverlay[]>([]);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const currentLocation: CurrentLocation = DEFAULT_GANGWON_REGION.center;

  const hasTourApiServiceKey = Boolean(TOUR_API_SERVICE_KEY);
  const isFullPopupMode = sheetMode === "full-popup";

  const selectedPlaceKey = selectedPlace
    ? `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`
    : null;
  const isCurrentPlaceSaved = selectedPlace
    ? savedPlaceIds.includes(selectedPlace.id)
    : false;

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

  const {
    isSheetExpanded,
    isDraggingSheet,
    sheetTop,
    showOverviewPanel,
    handleSheetPointerDown,
    handleSheetPointerMove,
    handleSheetPointerUp,
  } = usePlaceSheetLayout({
    isSheetOpen: isOpen && !isFullPopupMode,
    onRequestClose: resetSheet,
    resetVersion: sheetResetVersion,
  });

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

      const nearbyPlaces = await fetchNearbyTouristPlaces(TOUR_API_SERVICE_KEY, {
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        radiusM: 6000,
        numOfRows: 12,
        contentTypeIds: ["12", "39"],
        excludeContentId: selectedPlace.contentId,
      }, "ko");
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
    (Boolean(selectedPlaceKey) &&
      (detailQuery.isSuccess || detailQuery.isError));
  const activeImageList = useMemo(
    () => dedupePlaceImageUrls([...(selectedPlace?.images ?? []), ...detailImages]),
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
  const isRouteLoading = routeQuery.isFetching;
  const routeError =
    routeQuery.error instanceof Error ? routeQuery.error.message : null;
  const concentrationTrendError =
    concentrationTrendQuery.error instanceof Error
      ? concentrationTrendQuery.error.message
      : null;
  const nearbyTouristError =
    nearbyTouristQuery.error instanceof Error
      ? nearbyTouristQuery.error.message
      : null;
  const shouldShowOverviewPanel = isFullPopupMode || showOverviewPanel;
  const shouldShowExpandedSection = isFullPopupMode || isSheetExpanded;
  const isTouristAttraction = selectedPlace ? isTouristPlace(selectedPlace) : false;
  const selectedTopRank = selectedPlace?.topRank ?? null;
  const topRankBadge = selectedTopRank
    ? getTopRankBadgeStyle(selectedTopRank, text)
    : null;
  const topRankButtonLabel = selectedTopRank
    ? text.placeSheet.predictionTop(selectedTopRank)
    : "";
  const selectedPlaceContentTypeLabel = localizePlaceCategoryLabel(
    selectedPlace?.contentTypeLabel,
    text
  );
  const selectedPlaceCategoryName = localizePlaceCategoryLabel(
    selectedPlace?.categoryName,
    text
  );
  const shouldShowCategoryName =
    Boolean(selectedPlace?.categoryName?.trim()) &&
    selectedPlaceCategoryName !== selectedPlaceContentTypeLabel;
  const selectedPlaceTitle = selectedPlace?.title.trim().toLowerCase() ?? "";
  const nearbyTouristPlaces = useMemo(
    () =>
      (nearbyTouristQuery.data ?? [])
        .filter(
          (item): item is NearbyTouristPlace =>
            item.title.trim().toLowerCase() !== selectedPlaceTitle
        )
        .filter((item) => getNearbyPlaceCategoryLabel(item) !== "장소")
        .filter((item) => !EXCLUDED_NEARBY_PLACE_PATTERN.test(item.title))
        .slice(0, 6),
    [
      nearbyTouristQuery.data,
      selectedPlaceTitle,
    ]
  );

  const clearPreviewOverlays = () => {
    previewOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    previewOverlaysRef.current = [];
  };

  const openNaverDirections = (
    origin: CurrentLocation,
    destination: CurrentLocation
  ) => {
    const params = new URLSearchParams({
      slat: `${origin.lat}`,
      slng: `${origin.lng}`,
      sname: text.placeSheet.currentLocation,
      dlat: `${destination.lat}`,
      dlng: `${destination.lng}`,
      dname: selectedPlace?.title ?? text.placeSheet.destination,
      appname: NAVER_MAP_SCHEME_APP_NAME,
    });
    window.location.href = `nmap://route/car?${params.toString()}`;
  };

  const handleOpenDirections = () => {
    if (!selectedPlace) {
      return;
    }

    openNaverDirections(currentLocation, {
      lat: selectedPlace.lat,
      lng: selectedPlace.lng,
    });
  };

  const handleOpenGoogleImageSearch = () => {
    if (!selectedPlace) {
      return;
    }

    const targetKeyword = `${selectedPlace.title} ${selectedPlace.address}`;
    window.open(
      buildGoogleImageSearchUrl(targetKeyword, text),
      "_blank",
      "noopener,noreferrer"
    );
  };
  const openImageViewer = (
    imageUrls: string[],
    index: number,
    title: string
  ) => {
    if (imageUrls.length === 0) {
      return;
    }

    setImageViewerTarget({
      imageUrls,
      index,
      title,
    });
  };
  const closeImageViewer = () => setImageViewerTarget(null);
  const showPreviousImage = () => {
    setImageViewerTarget((target) => {
      if (!target || target.imageUrls.length === 0) {
        return target;
      }

      return {
        ...target,
        index:
          (target.index - 1 + target.imageUrls.length) %
          target.imageUrls.length,
      };
    });
  };
  const showNextImage = () => {
    setImageViewerTarget((target) => {
      if (!target || target.imageUrls.length === 0) {
        return target;
      }

      return {
        ...target,
        index: (target.index + 1) % target.imageUrls.length,
      };
    });
  };
  const handleImageViewerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    imageSwipeStartXRef.current = event.clientX;
  };
  const handleImageViewerPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const startX = imageSwipeStartXRef.current;
    imageSwipeStartXRef.current = null;

    if (startX == null) {
      return;
    }

    const deltaX = event.clientX - startX;
    const swipeThreshold = 48;

    if (Math.abs(deltaX) < swipeThreshold) {
      return;
    }

    if (deltaX < 0) {
      showNextImage();
    } else {
      showPreviousImage();
    }
  };

  const handleSelectNearbyPlace = (place: NearbyTouristPlace) => {
    if (!selectedPlace) {
      return;
    }

    openSheet(
      createMapSheetPlaceFromNearbyPlace({
        place,
        areaCode: selectedPlace.areaCode,
        signguCode: selectedPlace.signguCode,
      }),
      { mode: sheetMode }
    );

    requestAnimationFrame(() => {
      contentScrollRef.current?.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    });
  };

  useEffect(() => {
    contentScrollRef.current?.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }, [selectedPlaceKey]);

  useEffect(() => {
    let isActive = true;
    const resetPreviewMapState = () => {
      if (!isActive) {
        return;
      }

      setIsPreviewMapSdkReady(false);
      setPreviewMapError(null);
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      if (previewMapContainerRef.current) {
        previewMapContainerRef.current.innerHTML = "";
      }
      previewMapContainerRef.current = null;
    };

    queueMicrotask(resetPreviewMapState);

    if (!isOpen || !selectedPlace || !shouldShowExpandedSection) {
      return () => {
        isActive = false;
      };
    }

    loadNaverMapSdk(NCP_KEY_ID, appLanguage)
      .then(() => {
        if (isActive) {
          setIsPreviewMapSdkReady(true);
        }
      })
      .catch(() => {
        if (isActive) {
          setPreviewMapError(text.placeSheet.mapLoadError);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    appLanguage,
    isOpen,
    selectedPlace,
    selectedPlaceKey,
    shouldShowExpandedSection,
    text.placeSheet.mapLoadError,
  ]);

  useEffect(() => {
    if (!isOpen || !selectedPlace) {
      return;
    }

    const naverMaps = window.naver?.maps;
    const container = previewMapRef.current;

    if (
      !shouldShowExpandedSection ||
      !isPreviewMapSdkReady ||
      !container ||
      !naverMaps
    ) {
      return;
    }

    let previewMap = previewMapInstanceRef.current;
    const shouldRecreatePreviewMap =
      !previewMap || previewMapContainerRef.current !== container;

    if (shouldRecreatePreviewMap) {
      previewMap = new naverMaps.Map(container, {
        center: new naverMaps.LatLng(selectedPlace.lat, selectedPlace.lng),
        zoom: 11,
        minZoom: 9,
        mapTypeId: naverMaps.MapTypeId.NORMAL,
        ...getNaverMapThemeOptions(isDarkMode),
        draggable: false,
        pinchZoom: false,
        scrollWheel: false,
        keyboardShortcuts: false,
        disableDoubleTapZoom: true,
        disableDoubleClickZoom: true,
        zoomControl: false,
        mapDataControl: false,
        scaleControl: false,
        logoControl: false,
      });
      previewMapInstanceRef.current = previewMap;
      previewMapContainerRef.current = container;
    } else {
      naverMaps.Event.trigger(previewMap, "resize");
    }

    if (!previewMap) {
      return;
    }

    applyNaverMapTheme(previewMap, isDarkMode);

    clearPreviewOverlays();

    const bounds = new naverMaps.LatLngBounds();
    const destinationLatLng = new naverMaps.LatLng(
      selectedPlace.lat,
      selectedPlace.lng
    );
    bounds.extend(destinationLatLng);

    const destinationMarker = new naverMaps.Marker({
      map: previewMap,
      position: destinationLatLng,
      title: selectedPlace.title,
    });
    previewOverlaysRef.current.push(destinationMarker);

    if (currentLocation) {
      const originLatLng = new naverMaps.LatLng(
        currentLocation.lat,
        currentLocation.lng
      );
      bounds.extend(originLatLng);

      const originMarker = new naverMaps.Marker({
        map: previewMap,
        position: originLatLng,
        title: text.placeSheet.currentLocation,
      });
      previewOverlaysRef.current.push(originMarker);
    }

    if (routePathPoints.length > 0) {
      const path = routePathPoints.map((point) => {
        const latLng = new naverMaps.LatLng(point.lat, point.lng);
        bounds.extend(latLng);
        return latLng;
      });

      const routeLine = new naverMaps.Polyline({
        map: previewMap,
        path,
        strokeColor: "#2563eb",
        strokeWeight: 5,
        strokeOpacity: 0.86,
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
      previewOverlaysRef.current.push(routeLine);
    }

    try {
      naverMaps.Event.trigger(previewMap, "resize");
      previewMap.fitBounds(bounds, {
        top: 24,
        right: 24,
        bottom: 40,
        left: 24,
      });
    } catch {
      previewMap.fitBounds(bounds);
    }

    requestAnimationFrame(() => {
      naverMaps.Event.trigger(previewMap, "resize");
    });
  }, [
    currentLocation,
    isDarkMode,
    isOpen,
    isPreviewMapSdkReady,
    routePathPoints,
    selectedPlace,
    shouldShowExpandedSection,
    text.placeSheet.currentLocation,
  ]);

  useEffect(() => {
    return () => {
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      previewMapContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsTopRankInfoOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isOpen, selectedPlaceKey]);

  if (!isOpen || !selectedPlace) {
    return null;
  }

  const shouldOffsetSheetHeader = isSheetExpanded || isFullPopupMode;
  const sheetHeaderStyle = {
    minHeight: shouldOffsetSheetHeader
      ? `calc(${SHEET_HEADER_HEIGHT_PX}px + env(safe-area-inset-top))`
      : `${SHEET_HEADER_HEIGHT_PX}px`,
    paddingTop: shouldOffsetSheetHeader
      ? "env(safe-area-inset-top)"
      : undefined,
  };

  return (
    <>
      <button
        type="button"
        onClick={resetSheet}
        aria-label={text.placeSheet.bottomSheetCloseAria}
        className="fixed inset-0 z-[1800] bg-slate-900/25"
      />

      <section
        className={
          isFullPopupMode
            ? "fixed inset-0 z-[3000] w-full bg-white"
            : `fixed bottom-0 z-[1900] w-full bg-white ${
                isSheetExpanded
                  ? "inset-x-0 rounded-none border-0 shadow-none"
                  : "inset-x-0 mx-auto max-w-md rounded-t-3xl border border-brand-200 shadow-[0_-10px_32px_rgba(15,23,42,0.25)]"
              } ${
                isDraggingSheet
                  ? "transition-none"
                  : "transition-[top] duration-300"
              }`
        }
        style={isFullPopupMode ? undefined : { top: `${sheetTop}px` }}
      >
        <div className="flex h-full flex-col">
          <div
            role="button"
            tabIndex={0}
            className={`${isFullPopupMode ? "" : "touch-none"} ${
              isSheetExpanded || isFullPopupMode
                ? "rounded-none"
                : "rounded-t-3xl"
            }`}
            style={sheetHeaderStyle}
            onPointerDown={isFullPopupMode ? undefined : handleSheetPointerDown}
            onPointerMove={isFullPopupMode ? undefined : handleSheetPointerMove}
            onPointerUp={isFullPopupMode ? undefined : handleSheetPointerUp}
            onPointerCancel={isFullPopupMode ? undefined : handleSheetPointerUp}
          >
            <div
              className={`flex items-center px-4 ${
                isSheetExpanded || isFullPopupMode
                  ? "h-full justify-end"
                  : "h-full justify-center"
              }`}
            >
              {isSheetExpanded || isFullPopupMode ? (
                <button
                  type="button"
                  aria-label={text.placeSheet.sheetCloseAria}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resetSheet}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-brand-200 bg-brand-50 text-xl text-brand-700 shadow-sm transition hover:bg-brand-100 dark:border-brand-400/30 dark:bg-[#0f3431] dark:text-brand-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.22)] dark:hover:bg-[#13423e]"
                >
                  <IoClose />
                </button>
              ) : (
                <div className="flex cursor-grab justify-center active:cursor-grabbing">
                  <div className="h-1.5 w-12 rounded-full bg-brand-200" />
                </div>
              )}
            </div>
          </div>

          <div
            ref={contentScrollRef}
            className={`min-h-0 flex-1 ${
              isSheetExpanded || isFullPopupMode
                ? "scrollbar-hide overflow-y-auto"
                : "overflow-hidden"
            }`}
          >
            <div
              className="px-5 pt-4"
              style={{ minHeight: `${SHEET_HEADLINE_MIN_HEIGHT_PX}px` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-trip text-[30px] leading-[1.15] text-slate-900">
                    {selectedPlace.title}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-brand-700">
                      {selectedPlace.icon} {selectedPlaceContentTypeLabel}
                    </p>
                    {isSelectedPlaceDetailReady ? (
                      <CompactHoursBadge value={detailHoursBadgeValue} />
                    ) : (
                      <SkeletonBar className="h-7 w-28" />
                    )}
                  </div>
                  {shouldShowCategoryName ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPlaceCategoryName}
                    </p>
                  ) : null}
                </div>
                <div className="mt-1 flex shrink-0 items-center gap-2">
                  {topRankBadge ? (
                    <button
                      type="button"
                      onClick={() => setIsTopRankInfoOpen(true)}
                      className={`inline-flex h-10 items-center gap-1 rounded-full border px-3 text-xs font-bold ${topRankBadge.className}`}
                    >
                      {topRankButtonLabel}
                      <IoInformationCircleOutline className="text-sm" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label={text.placeSheet.addToRouteAria}
                    onClick={() => {
                      if (selectedPlace) {
                        const willAddToCart = !isCurrentPlaceSaved;
                        toggleSavedPlace(selectedPlace, activeImageList[0] ?? "");
                        if (willAddToCart) {
                          showToast(text.placeSheet.addToCartToast);
                        }
                      }
                    }}
                    className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                  >
                    {isCurrentPlaceSaved ? <IoBagAdd /> : <IoBagAddOutline />}
                  </button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selectedPlace.address}
              </p>

              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50/70 px-3 py-3 text-xs dark:border-brand-400/25 dark:bg-slate-950/35">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-base text-brand-600 shadow-sm dark:bg-brand-400/15 dark:text-brand-200">
                  <IoTimeOutline />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-brand-700 dark:text-brand-200">
                    {text.placeSheet.userAverageStay}
                  </p>
                  <p className="mt-1 line-clamp-2 leading-5 text-slate-600 dark:text-slate-300">
                    {placeStaySummaryLabel}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                  {!isSelectedPlaceDetailReady ? (
                    <ImageStripSkeleton />
                  ) : activeImageList.length > 0 ? (
                    <>
                      {activeImageList.map((imageUrl, index) => (
                        <img
                          key={`${imageUrl}-${index}`}
                          src={imageUrl}
                          alt={text.placeSheet.placeImageAlt(
                            selectedPlace.title,
                            index + 1
                          )}
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            openImageViewer(
                              activeImageList,
                              index,
                              selectedPlace.title
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              openImageViewer(
                                activeImageList,
                                index,
                                selectedPlace.title
                              );
                            }
                          }}
                          className="h-44 w-40 shrink-0 snap-start cursor-zoom-in rounded-2xl border border-brand-100 bg-brand-50 object-cover"
                        />
                      ))}
                      <div className="flex h-44 w-40 shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 text-center text-sm text-slate-500">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm">
                          {selectedPlace.icon}
                        </div>
                        <p className="mt-3 text-xs font-semibold text-slate-600">
                          {text.placeSheet.searchMore}
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenGoogleImageSearch}
                          className="pointer-events-auto mt-3 rounded-full border border-brand-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-700"
                        >
                          {text.placeSheet.viewOnGoogle}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-52 w-full min-w-full shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-brand-50 px-5 text-center text-sm text-slate-500">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                        {selectedPlace.icon}
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700">
                        {text.placeSheet.imageMissingTitle}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {text.placeSheet.imageMissingDescription}
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenGoogleImageSearch}
                        className="pointer-events-auto mt-4 rounded-full border border-brand-300 bg-white px-4 py-2 text-xs font-semibold text-brand-700"
                      >
                        {text.placeSheet.viewOnGoogle}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {text.placeSheet.userPhotosTitle}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-300">
                      {text.placeSheet.userPhotosDescription}
                    </p>
                  </div>
                  {userPlacePhotos.length > 0 ? (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-black text-brand-700 ring-1 ring-brand-100 dark:bg-brand-400/15 dark:text-brand-100 dark:ring-brand-400/25">
                      {userPlacePhotos.length}
                    </span>
                  ) : null}
                </div>
                <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                  {placePhotosQuery.isFetching ? (
                    <ImageStripSkeleton />
                  ) : userPlacePhotos.length > 0 ? (
                    userPlacePhotos.map((photo, index) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() =>
                          openImageViewer(
                            userPlacePhotoViewerUrls,
                            index,
                            text.placeSheet.userPhotoViewerTitle(
                              selectedPlace.title
                            )
                          )
                        }
                        className="group relative h-44 w-40 shrink-0 snap-start overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 text-left shadow-sm"
                      >
                        <PlacePhotoThumbnail
                          thumbnailUrl={photo.thumbnailUrl}
                          imageUrl={photo.imageUrl}
                          alt={text.placeSheet.userPhotoAlt(
                            selectedPlace.title,
                            index + 1
                          )}
                        />
                        <span className="absolute bottom-2 left-2 rounded-full bg-slate-950/60 px-2 py-1 text-[10px] font-black text-white backdrop-blur">
                          {text.placeSheet.visitPhoto}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="flex h-32 w-full min-w-full shrink-0 snap-start flex-col items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50/70 px-4 text-center dark:border-brand-400/25 dark:bg-slate-950/35">
                      <div className="flex size-10 items-center justify-center rounded-full bg-white text-lg shadow-sm dark:bg-brand-400/15">
                        {selectedPlace.icon}
                      </div>
                      <p className="mt-3 text-sm font-black text-slate-700 dark:text-slate-100">
                        {text.placeSheet.noUserPhotosTitle}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        {text.placeSheet.noUserPhotosDescription}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              className={`px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-all duration-200 ${
                shouldShowOverviewPanel
                  ? "min-h-0 opacity-100"
                  : "pointer-events-none h-0 overflow-hidden opacity-0"
              }`}
            >
              <div className="space-y-4">
                <div className="rounded-3xl border border-brand-200/80 bg-white px-4 py-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-trip text-sm text-brand-700">
                      PLACE OVERVIEW
                    </p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
                      {text.placeSheet.detailTitle}
                    </span>
                  </div>
                  {!isSelectedPlaceDetailReady ? (
                    <OverviewSkeleton />
                  ) : detailOverview ? (
                    <p className="whitespace-pre-line rounded-2xl border border-brand-100 bg-brand-50/45 px-3 py-3 text-sm leading-7 text-slate-700 dark:border-brand-400/25 dark:bg-slate-950/45 dark:text-slate-200">
                      {detailOverview}
                    </p>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-200 bg-white/75 px-3 py-4 text-center text-sm text-slate-500 dark:border-brand-400/30 dark:bg-slate-950/35 dark:text-slate-300">
                      {text.placeSheet.noOverview}
                    </div>
                  )}
                  {detailOperatingHours || detailRestDate || detailInfoCenter ? (
                    <div className="mt-3 grid gap-2">
                      <PlaceInfoRow
                        label={text.placeSheet.operatingHours}
                        value={detailOperatingHours}
                        icon="time"
                      />
                      <PlaceInfoRow
                        label={text.placeSheet.closedDays}
                        value={detailRestDate}
                        icon="calendar"
                      />
                      <PlaceInfoRow
                        label={text.placeSheet.contact}
                        value={detailInfoCenter}
                        icon="call"
                      />
                    </div>
                  ) : null}
                </div>

                <PlaceTrendChart
                  points={concentrationTrendQuery.data ?? []}
                  isLoading={concentrationTrendQuery.isFetching}
                  errorMessage={concentrationTrendError}
                  isTouristAttraction={isTouristAttraction}
                />

                {shouldShowExpandedSection ? (
                  <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-trip text-sm text-brand-700">
                        PLACE DIRECTIONS
                      </p>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-brand-100 bg-brand-50">
                      <div
                        ref={previewMapRef}
                        className="pointer-events-none h-48 w-full touch-none select-none"
                      />
                      {!isPreviewMapSdkReady && !previewMapError ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 px-6 backdrop-blur-[1px] dark:bg-slate-950/45">
                          <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white/90 px-4 py-3 text-xs font-bold text-brand-700 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/80 dark:text-brand-100">
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
                            {text.placeSheet.mapPreparing}
                          </div>
                        </div>
                      ) : previewMapError ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/75 px-6 text-center backdrop-blur-[1px] dark:bg-slate-950/45">
                          <p className="rounded-2xl border border-rose-100 bg-white/90 px-4 py-3 text-xs font-bold text-rose-600 shadow-sm dark:border-rose-400/30 dark:bg-slate-950/80 dark:text-rose-200">
                            {previewMapError}
                          </p>
                        </div>
                      ) : isRouteLoading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/55 px-6 backdrop-blur-[1px] dark:bg-slate-950/35">
                          <div className="w-full max-w-[220px] space-y-3 rounded-2xl border border-brand-100 bg-white/85 p-4 shadow-sm dark:border-brand-400/25 dark:bg-slate-950/80">
                            <SkeletonBar className="h-3 w-2/3" />
                            <SkeletonBar className="h-3 w-full" />
                            <SkeletonBar className="h-3 w-1/2" />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">
                        {text.placeSheet.address}
                      </p>
                      <p className="mt-1">{selectedPlace.address}</p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-brand-100 bg-white px-3 py-3">
                      {isRouteLoading ? (
                        <RouteInfoSkeleton />
                      ) : routeDurationText && routeDistanceText ? (
                        <div className="flex items-center gap-2 text-sm">
                          <IoCarSportOutline className="text-brand-600" />
                          <p className="font-semibold text-slate-900">
                            {text.placeSheet.routeFromCurrentLocation(
                              routeDurationText
                            )}
                          </p>
                          <span className="text-slate-400">·</span>
                          <p className="text-slate-600">{routeDistanceText}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          {routeError ?? text.placeSheet.routeLoadError}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenDirections}
                      className="mt-3 flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
                    >
                      <IoNavigate className="mr-2 text-base" />
                      {text.placeSheet.directions}
                    </button>
                  </section>
                ) : null}

                <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-trip text-sm text-brand-700">
                      {text.placeSheet.nearbyTitle}
                    </p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
                      {text.placeSheet.nearbyBadge}
                    </span>
                  </div>

                  {nearbyTouristQuery.isFetching ? (
                    <NearbyPlacesSkeleton />
                  ) : nearbyTouristPlaces.length > 0 ? (
                    <div className="space-y-2">
                      {nearbyTouristPlaces.map((place) => {
                        const thumbnailUrl = place.firstImage || place.secondImage;
                        const distanceLabel = formatNearbyDistance(place.distanceM);
                        const categoryLabel = localizePlaceCategoryLabel(
                          getNearbyPlaceCategoryLabel(place),
                          text
                        );
                        const categoryIcon = getNearbyPlaceCategoryIcon(place);

                        return (
                          <PlaceResultCard
                            key={`${place.id}-${place.contentTypeId}`}
                            title={place.title}
                            address={place.address}
                            categoryLabel={categoryLabel}
                            thumbnailUrl={thumbnailUrl}
                            fallbackIcon={categoryIcon}
                            distanceLabel={distanceLabel}
                            surface="tinted"
                            onClick={() => handleSelectNearbyPlace(place)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500 dark:border-brand-400/30 dark:bg-slate-950/35 dark:text-slate-300">
                      {nearbyTouristError ?? text.placeSheet.nearbyEmpty}
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    {text.placeSheet.nearbyFootnote}
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isTopRankInfoOpen && topRankBadge ? (
        <div className="fixed inset-0 z-[2600] flex items-end justify-center bg-slate-900/35 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            aria-label={text.placeSheet.topRankInfoCloseAria}
            onClick={() => setIsTopRankInfoOpen(false)}
            className="absolute inset-0"
          />
          <section className="relative w-full max-w-md rounded-3xl border border-brand-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-trip text-sm text-brand-700">
                  {text.placeSheet.topRankInfoTitle}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {topRankBadge.label}
                </p>
              </div>
              <button
                type="button"
                aria-label={text.placeSheet.topRankInfoCloseAria}
                onClick={() => setIsTopRankInfoOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-600"
              >
                <IoClose />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {text.placeSheet.topRankInfoDescription}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              {text.placeSheet.topRankInfoNote}
            </p>
          </section>
        </div>
      ) : null}

      {imageViewerTarget &&
      imageViewerTarget.imageUrls[imageViewerTarget.index] ? (
        <section className="fixed inset-0 z-[3600] flex items-center justify-center bg-white/35 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <button
            type="button"
            aria-label={text.placeSheet.imageViewerCloseAria}
            onClick={closeImageViewer}
            className="absolute inset-0 cursor-zoom-out"
          />

          <div
            className="relative z-10 flex h-full w-full max-w-3xl touch-pan-y flex-col items-center justify-center"
            onPointerDown={handleImageViewerPointerDown}
            onPointerUp={handleImageViewerPointerUp}
            onPointerCancel={() => {
              imageSwipeStartXRef.current = null;
            }}
          >
            <div className="w-full overflow-hidden rounded-3xl">
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(-${imageViewerTarget.index * 100}%)`,
                }}
              >
                {imageViewerTarget.imageUrls.map((imageUrl, index) => (
                  <div
                    key={`${imageUrl}-viewer-${index}`}
                    className="flex min-w-full items-center justify-center"
                  >
                    <img
                      src={imageUrl}
                      alt={`${imageViewerTarget.title} ${index + 1}`}
                      draggable={false}
                      className="max-h-[78dvh] max-w-full select-none rounded-3xl object-contain shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-full bg-slate-900/45 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur">
              {imageViewerTarget.index + 1} / {imageViewerTarget.imageUrls.length}
            </div>
          </div>

          <button
            type="button"
            aria-label={text.placeSheet.previousImageAria}
            onClick={showPreviousImage}
            className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={text.placeSheet.nextImageAria}
            onClick={showNextImage}
            className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
          >
            ›
          </button>
          <button
            type="button"
            aria-label={text.placeSheet.imageViewerCloseAria}
            onClick={closeImageViewer}
            className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex size-10 items-center justify-center rounded-full bg-white/65 text-xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
          >
            <IoClose />
          </button>
        </section>
      ) : null}
    </>
  );
}

export default PlaceBottomSheet;
