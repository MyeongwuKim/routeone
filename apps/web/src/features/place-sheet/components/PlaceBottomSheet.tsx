import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IoArrowBack,
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
  fetchNearbyTouristPlaces,
  fetchTourPlaceDetail,
  fetchTouristConcentrationPoints,
  type NearbyTouristPlace,
} from "@/lib/visitKoreaTourApi";
import {
  getPlaceCategoryIcon,
  getPlaceCategoryLabel,
  getReadablePlaceCategoryName,
  isReadableCategoryName,
  isTouristPlace,
} from "@/lib/placeCategory";
import PlaceResultCard from "@/components/place/PlaceResultCard";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { usePlaceCartStore } from "@/stores/placeCartStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import type { MapSheetPlace } from "@/types/place";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
const NAVER_MAP_SCHEME_APP_NAME = "routeone.web";
const GANGNEUNG_CENTER_LOCATION = {
  lat: 37.7519,
  lng: 128.8761,
};

const SHEET_HEADER_HEIGHT_PX = 64;
const SHEET_HEADLINE_MIN_HEIGHT_PX = 108;

type CurrentLocation = {
  lat: number;
  lng: number;
};

function getTopRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return {
      label: "🥇 집중률 1위",
      className:
        "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200",
    };
  }
  if (rank === 2) {
    return {
      label: "🥈 집중률 2위",
      className:
        "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/70 dark:bg-slate-300/10 dark:text-slate-100",
    };
  }
  if (rank === 3) {
    return {
      label: "🥉 집중률 3위",
      className:
        "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-400/60 dark:bg-orange-400/15 dark:text-orange-200",
    };
  }
  return {
    label: `집중률 ${rank}위`,
    className:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/60 dark:bg-rose-400/15 dark:text-rose-200",
  };
}

function formatDurationMinutes(durationMs: number) {
  const minutes = Math.max(1, Math.round(durationMs / 60000));
  return `${minutes}분`;
}

function formatDistance(distanceM: number) {
  return `${(Math.max(1, distanceM) / 1000).toFixed(1)}km`;
}

function preloadImage(url: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
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

function buildGoogleImageSearchUrl(keyword: string) {
  const query = `${keyword} 사진`;
  const params = new URLSearchParams({
    tbm: "isch",
    q: query,
  });
  return `https://www.google.com/search?${params.toString()}`;
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
    images: [place.firstImage].filter(Boolean),
  };
}

function PlaceBottomSheet() {
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const {
    isOpen,
    sheetMode,
    sheetResetVersion,
    selectedPlace,
    openSheet,
    resetSheet,
  } = useMapSheetStore();
  const { savedPlaceIds, toggleSavedPlace } = usePlaceCartStore();
  const showToast = useUiToastStore((state) => state.showToast);
  const [isTopRankInfoOpen, setIsTopRankInfoOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);
  const imageSwipeStartXRef = useRef<number | null>(null);

  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const previewMapInstanceRef = useRef<any>(null);
  const previewMapContainerRef = useRef<HTMLDivElement | null>(null);
  const previewOverlaysRef = useRef<any[]>([]);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);

  const currentLocation: CurrentLocation = GANGNEUNG_CENTER_LOCATION;

  const hasTourApiServiceKey = Boolean(TOUR_API_SERVICE_KEY);
  const isFullPopupMode = sheetMode === "full-popup";

  const selectedPlaceKey = selectedPlace
    ? `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`
    : null;
  const isCurrentPlaceSaved = selectedPlace
    ? savedPlaceIds.includes(selectedPlace.id)
    : false;

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
    queryKey: ["place-detail", selectedPlaceKey],
    enabled: isOpen && Boolean(selectedPlace) && hasTourApiServiceKey,
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error("선택된 장소가 없습니다.");
      }
      const detail = await fetchTourPlaceDetail(
        TOUR_API_SERVICE_KEY,
        selectedPlace.contentId,
        selectedPlace.contentTypeId
      );
      const loadedImages = await preloadImageUrls(detail.images);
      return {
        overview: detail.overview,
        images: loadedImages,
        operatingHours: detail.operatingHours,
        restDate: detail.restDate,
        infoCenter: detail.infoCenter,
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
    ],
    enabled: isOpen && Boolean(selectedPlace),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error("선택된 장소가 없습니다.");
      }
      return fetchDrivingRouteFromCurrentLocation({
        startLat: currentLocation.lat,
        startLng: currentLocation.lng,
        goalLat: selectedPlace.lat,
        goalLng: selectedPlace.lng,
      });
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
        throw new Error("선택된 장소가 없습니다.");
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
    ],
    enabled:
      isOpen &&
      Boolean(selectedPlace) &&
      hasTourApiServiceKey &&
      Number.isFinite(selectedPlace?.lat) &&
      Number.isFinite(selectedPlace?.lng),
    queryFn: async () => {
      if (!selectedPlace) {
        throw new Error("선택된 장소가 없습니다.");
      }

      return fetchNearbyTouristPlaces(TOUR_API_SERVICE_KEY, {
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        radiusM: 6000,
        numOfRows: 12,
        contentTypeIds: ["12", "39"],
        excludeContentId: selectedPlace.contentId,
      });
    },
    staleTime: 1000 * 60 * 20,
    gcTime: 1000 * 60 * 60,
  });

  const detailOverview = detailQuery.data?.overview ?? "";
  const detailImages = detailQuery.data?.images ?? [];
  const detailOperatingHours = detailQuery.data?.operatingHours ?? "";
  const detailRestDate = detailQuery.data?.restDate ?? "";
  const detailInfoCenter = detailQuery.data?.infoCenter ?? "";
  const isSelectedPlaceDetailReady =
    !hasTourApiServiceKey ||
    (Boolean(selectedPlaceKey) &&
      (detailQuery.isSuccess || detailQuery.isError));
  const activeImageList = useMemo(
    () => [
      ...new Set(
        [...(selectedPlace?.images ?? []), ...detailImages].filter(Boolean)
      ),
    ],
    [detailImages, selectedPlace?.images]
  );
  const routeDurationText = routeQuery.data
    ? formatDurationMinutes(routeQuery.data.durationMs)
    : null;
  const routeDistanceText = routeQuery.data
    ? formatDistance(routeQuery.data.distanceM)
    : null;
  const routePathPoints = routeQuery.data?.path ?? [];
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
  const topRankBadge = selectedPlace?.topRank
    ? getTopRankBadgeStyle(selectedPlace.topRank)
    : null;
  const shouldShowCategoryName =
    isReadableCategoryName(selectedPlace?.categoryName) &&
    selectedPlace?.categoryName !== selectedPlace?.contentTypeLabel;
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
      sname: "현재 위치",
      dlat: `${destination.lat}`,
      dlng: `${destination.lng}`,
      dname: selectedPlace?.title ?? "목적지",
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
      buildGoogleImageSearchUrl(targetKeyword),
      "_blank",
      "noopener,noreferrer"
    );
  };
  const closeImageViewer = () => setActiveImageIndex(null);
  const showPreviousImage = () => {
    setActiveImageIndex((index) => {
      if (index == null || activeImageList.length === 0) {
        return index;
      }

      return (index - 1 + activeImageList.length) % activeImageList.length;
    });
  };
  const showNextImage = () => {
    setActiveImageIndex((index) => {
      if (index == null || activeImageList.length === 0) {
        return index;
      }

      return (index + 1) % activeImageList.length;
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
    if (!isOpen || !selectedPlace) {
      return;
    }

    const naverMaps = window.naver?.maps;
    const container = previewMapRef.current;

    if (!shouldShowExpandedSection || !container || !naverMaps) {
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
        title: "현재 위치",
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
    routePathPoints,
    selectedPlace,
    shouldShowExpandedSection,
  ]);

  useEffect(() => {
    return () => {
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      previewMapContainerRef.current = null;
    };
  }, []);

  useEffect(() => {
    setIsTopRankInfoOpen(false);
  }, [isOpen, selectedPlaceKey]);

  if (!isOpen || !selectedPlace) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={resetSheet}
        aria-label="바텀시트 닫기"
        className="fixed inset-0 z-[1800] bg-slate-900/25"
      />

      <section
        className={
          isFullPopupMode
            ? "fixed inset-0 z-[2400] w-full bg-white"
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
            style={{ minHeight: `${SHEET_HEADER_HEIGHT_PX}px` }}
            onPointerDown={isFullPopupMode ? undefined : handleSheetPointerDown}
            onPointerMove={isFullPopupMode ? undefined : handleSheetPointerMove}
            onPointerUp={isFullPopupMode ? undefined : handleSheetPointerUp}
            onPointerCancel={isFullPopupMode ? undefined : handleSheetPointerUp}
          >
            <div
              className={`flex items-center px-4 ${
                isSheetExpanded || isFullPopupMode
                  ? "h-full justify-start"
                  : "h-full justify-center"
              }`}
            >
              {isSheetExpanded || isFullPopupMode ? (
                <button
                  type="button"
                  aria-label="시트 닫기"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={resetSheet}
                  className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                >
                  <IoArrowBack />
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
                      {selectedPlace.icon} {selectedPlace.contentTypeLabel}
                    </p>
                    {isSelectedPlaceDetailReady ? (
                      <CompactHoursBadge value={detailOperatingHours} />
                    ) : (
                      <SkeletonBar className="h-7 w-28" />
                    )}
                  </div>
                  {shouldShowCategoryName ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {selectedPlace.categoryName}
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
                      TOP {selectedPlace.topRank}
                      <IoInformationCircleOutline className="text-sm" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    aria-label="내 루트 담기"
                    onClick={() => {
                      if (selectedPlace) {
                        const willAddToCart = !isCurrentPlaceSaved;
                        toggleSavedPlace(selectedPlace, activeImageList[0] ?? "");
                        if (willAddToCart) {
                          showToast("여행지 카트에 담았습니다");
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
                          alt={`${selectedPlace.title} 이미지 ${index + 1}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setActiveImageIndex(index)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              setActiveImageIndex(index);
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
                          더 찾아보기
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenGoogleImageSearch}
                          className="pointer-events-auto mt-3 rounded-full border border-brand-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-brand-700"
                        >
                          구글에서 보기
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-52 w-full min-w-full shrink-0 snap-start flex-col items-center justify-center rounded-3xl border border-dashed border-brand-200 bg-brand-50 px-5 text-center text-sm text-slate-500">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-2xl shadow-sm">
                        {selectedPlace.icon}
                      </div>
                      <p className="mt-4 text-sm font-semibold text-slate-700">
                        이미지 없음
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        등록된 대표 이미지가 아직 없습니다.
                      </p>
                      <button
                        type="button"
                        onClick={handleOpenGoogleImageSearch}
                        className="pointer-events-auto mt-4 rounded-full border border-brand-300 bg-white px-4 py-2 text-xs font-semibold text-brand-700"
                      >
                        구글에서 보기
                      </button>
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
                      상세 정보
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
                      관광공사 오픈 API에서 제공하는 상세 설명이 아직 없습니다.
                    </div>
                  )}
                  {detailRestDate || detailInfoCenter ? (
                    <div className="mt-3 grid gap-2">
                      <PlaceInfoRow
                        label="휴무일"
                        value={detailRestDate}
                        icon="calendar"
                      />
                      <PlaceInfoRow
                        label="문의"
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
                      {isRouteLoading ? (
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
                      <p className="font-semibold text-slate-900">주소</p>
                      <p className="mt-1">{selectedPlace.address}</p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-brand-100 bg-white px-3 py-3">
                      {isRouteLoading ? (
                        <RouteInfoSkeleton />
                      ) : routeDurationText && routeDistanceText ? (
                        <div className="flex items-center gap-2 text-sm">
                          <IoCarSportOutline className="text-brand-600" />
                          <p className="font-semibold text-slate-900">
                            내 위치(강릉 중심) 기준 차로 {routeDurationText}
                          </p>
                          <span className="text-slate-400">·</span>
                          <p className="text-slate-600">{routeDistanceText}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          {routeError ?? "길찾기 정보를 가져오지 못했습니다."}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenDirections}
                      className="mt-3 flex w-full items-center justify-center rounded-2xl bg-brand-600 px-4 py-3 text-sm font-bold text-white shadow-sm"
                    >
                      <IoNavigate className="mr-2 text-base" />
                      길찾기
                    </button>
                  </section>
                ) : null}

                <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm dark:border-brand-400/30 dark:bg-slate-900/70">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-trip text-sm text-brand-700">이런 곳도 좋아요</p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-400/15 dark:text-brand-200">
                      주변 추천
                    </span>
                  </div>

                  {nearbyTouristQuery.isFetching ? (
                    <NearbyPlacesSkeleton />
                  ) : nearbyTouristPlaces.length > 0 ? (
                    <div className="space-y-2">
                      {nearbyTouristPlaces.map((place) => {
                        const thumbnailUrl = place.firstImage || place.secondImage;
                        const distanceLabel = formatNearbyDistance(place.distanceM);
                        const categoryLabel = getNearbyPlaceCategoryLabel(place);
                        const categoryIcon = getNearbyPlaceCategoryIcon(place);

                        return (
                          <PlaceResultCard
                            key={`${place.id}-${place.contentTypeId}`}
                            title={place.title}
                            address={place.address}
                            categoryLabel={categoryLabel ?? "장소"}
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
                      {nearbyTouristError ?? "주변 추천 데이터가 아직 없습니다."}
                    </div>
                  )}
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    locationBasedList2 기준 반경 6km 내 관광지, 음식점, 카페 추천 데이터입니다.
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
            aria-label="집중률 안내 닫기"
            onClick={() => setIsTopRankInfoOpen(false)}
            className="absolute inset-0"
          />
          <section className="relative w-full max-w-md rounded-3xl border border-brand-200 bg-white px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-trip text-sm text-brand-700">TOP RANK</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {topRankBadge.label}
                </p>
              </div>
              <button
                type="button"
                aria-label="집중률 안내 닫기"
                onClick={() => setIsTopRankInfoOpen(false)}
                className="rounded-full border border-slate-200 bg-white p-2 text-slate-600"
              >
                <IoClose />
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              한국관광공사 방문자 집중률 예측 데이터를 기준으로 같은 지역의
              관광지 중 상대적으로 관심도가 높은 장소를 표시한 순위입니다.
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              실제 혼잡도나 실시간 방문자 수와는 다를 수 있어요.
            </p>
          </section>
        </div>
      ) : null}

      {activeImageIndex != null && activeImageList[activeImageIndex] ? (
        <section className="fixed inset-0 z-[2700] flex items-center justify-center bg-white/35 px-4 py-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl">
          <button
            type="button"
            aria-label="이미지 보기 닫기"
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
                  transform: `translateX(-${activeImageIndex * 100}%)`,
                }}
              >
                {activeImageList.map((imageUrl, index) => (
                  <div
                    key={`${imageUrl}-viewer-${index}`}
                    className="flex min-w-full items-center justify-center"
                  >
                    <img
                      src={imageUrl}
                      alt={`${selectedPlace.title} 이미지 ${index + 1}`}
                      draggable={false}
                      className="max-h-[78dvh] max-w-full select-none rounded-3xl object-contain shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-full bg-slate-900/45 px-3 py-1 text-xs font-bold text-white shadow-sm backdrop-blur">
              {activeImageIndex + 1} / {activeImageList.length}
            </div>
          </div>

          <button
            type="button"
            aria-label="이전 이미지"
            onClick={showPreviousImage}
            className="absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 이미지"
            onClick={showNextImage}
            className="absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/65 text-2xl text-slate-700 shadow-sm backdrop-blur transition hover:bg-white/80"
          >
            ›
          </button>
          <button
            type="button"
            aria-label="이미지 보기 닫기"
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
