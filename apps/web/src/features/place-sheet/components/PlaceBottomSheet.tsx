import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  type TooltipItem,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  IoArrowBack,
  IoBagAdd,
  IoBagAddOutline,
  IoCarSportOutline,
  IoClose,
  IoInformationCircleOutline,
  IoStatsChart,
  IoNavigate,
} from "react-icons/io5";
import { usePlaceSheetLayout } from "../hooks/usePlaceSheetLayout";
import { fetchDrivingRouteFromCurrentLocation } from "../../../lib/naverDirectionsApi";
import {
  fetchNearbyTouristPlaces,
  fetchTourPlaceDetail,
  fetchTouristConcentrationPoints,
  toWeeklyAndMonthlySeries,
  type NearbyTouristPlace,
  type TouristConcentrationPoint,
} from "../../../lib/visitKoreaTourApi";
import { PotatoLoadingCard } from "../../../components/feedback/PotatoLoadingOverlay";
import PlaceResultCard from "../../../components/place/PlaceResultCard";
import { useMapSheetStore } from "../../../stores/mapSheetStore";
import { useUiToastStore } from "../../../stores/uiToastStore";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
const NAVER_MAP_SCHEME_APP_NAME = "routeone.web";
const CAFE_LCLS_CODE = "FD050100";
const GANGNEUNG_CENTER_LOCATION = {
  lat: 37.7519,
  lng: 128.8761,
};

const SHEET_HEADER_HEIGHT_PX = 64;
const SHEET_HEADLINE_MIN_HEIGHT_PX = 108;

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

type CurrentLocation = {
  lat: number;
  lng: number;
};

type TrendTabType = "weekly" | "monthly";

function getTopRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return {
      label: "🥇 집중률 1위",
      className: "border-amber-300 bg-amber-50 text-amber-700",
    };
  }
  if (rank === 2) {
    return {
      label: "🥈 집중률 2위",
      className: "border-slate-300 bg-slate-50 text-slate-700",
    };
  }
  if (rank === 3) {
    return {
      label: "🥉 집중률 3위",
      className: "border-orange-300 bg-orange-50 text-orange-700",
    };
  }
  return {
    label: `집중률 ${rank}위`,
    className: "border-rose-200 bg-rose-50 text-rose-700",
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

function formatYmdLabel(ymd: string) {
  if (!/^\d{8}$/.test(ymd)) {
    return ymd;
  }

  const month = ymd.slice(4, 6);
  const day = ymd.slice(6, 8);
  return `${month}.${day}`;
}

function buildTrendChartData(points: TouristConcentrationPoint[]) {
  return {
    labels: points.map((point) => formatYmdLabel(point.baseYmd)),
    datasets: [
      {
        label: "방문자 집중률",
        data: points.map((point) => point.concentrationRate),
        borderColor: "#0d9488",
        backgroundColor: "rgba(13, 148, 136, 0.14)",
        borderWidth: 2.5,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.34,
      },
    ],
  };
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

function isCafeNearbyPlace(place: NearbyTouristPlace) {
  const targetText = `${place.title} ${place.lclsSystm1} ${place.lclsSystm2} ${place.lclsSystm3}`;
  return (
    place.lclsSystm3 === CAFE_LCLS_CODE ||
    /카페|커피|coffee|디저트|찻집/i.test(targetText)
  );
}

function getNearbyPlaceCategoryLabel(place: NearbyTouristPlace) {
  if (place.contentTypeId === "12") {
    return "관광지";
  }

  if (place.contentTypeId === "39") {
    return isCafeNearbyPlace(place) ? "카페" : "음식점";
  }

  return null;
}

function getNearbyPlaceCategoryIcon(place: NearbyTouristPlace) {
  const categoryLabel = getNearbyPlaceCategoryLabel(place);

  if (categoryLabel === "카페") {
    return "☕";
  }

  if (categoryLabel === "음식점") {
    return "🍽";
  }

  return "📍";
}

function PlaceBottomSheet() {
  const {
    isOpen,
    sheetMode,
    sheetResetVersion,
    selectedPlace,
    savedPlaceIds,
    openSheet,
    resetSheet,
    toggleSavedPlace,
  } = useMapSheetStore();
  const showToast = useUiToastStore((state) => state.showToast);
  const [trendTab, setTrendTab] = useState<TrendTabType>("monthly");
  const [isTopRankInfoOpen, setIsTopRankInfoOpen] = useState(false);

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
      selectedPlace?.contentTypeId === "12" &&
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
  const isSelectedPlaceDetailReady =
    !hasTourApiServiceKey ||
    (Boolean(selectedPlaceKey) &&
      (detailQuery.isSuccess || detailQuery.isError));
  const activeImageList = useMemo(
    () => [...new Set(detailImages.filter(Boolean))],
    [detailImages]
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
  const concentrationSeries = useMemo(
    () => toWeeklyAndMonthlySeries(concentrationTrendQuery.data ?? []),
    [concentrationTrendQuery.data]
  );
  const activeTrendPoints =
    trendTab === "weekly"
      ? concentrationSeries.weekly
      : concentrationSeries.monthly;
  const trendChartData = useMemo(
    () => buildTrendChartData(activeTrendPoints),
    [activeTrendPoints]
  );
  const trendChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
          callbacks: {
            label: (context: TooltipItem<"line">) =>
              `집중률 ${(context.parsed.y ?? 0).toFixed(1)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            maxTicksLimit: trendTab === "weekly" ? 7 : 8,
            color: "#475569",
            font: {
              size: 11,
            },
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: {
            color: "#64748b",
            callback: (value: string | number) => `${value}`,
            font: {
              size: 11,
            },
          },
          grid: {
            color: "rgba(148, 163, 184, 0.25)",
          },
        },
      },
      interaction: {
        mode: "nearest" as const,
        intersect: false,
      },
    }),
    [trendTab]
  );
  const shouldShowOverviewPanel = isFullPopupMode || showOverviewPanel;
  const shouldShowExpandedSection = isFullPopupMode || isSheetExpanded;
  const isTouristAttraction = selectedPlace?.contentTypeId === "12";
  const topRankBadge = selectedPlace?.topRank
    ? getTopRankBadgeStyle(selectedPlace.topRank)
    : null;
  const selectedPlaceTitle = selectedPlace?.title.trim().toLowerCase() ?? "";
  const nearbyTouristPlaces = useMemo(
    () =>
      (nearbyTouristQuery.data ?? [])
        .filter(
          (item): item is NearbyTouristPlace =>
            item.title.trim().toLowerCase() !== selectedPlaceTitle
        )
        .filter((item) => getNearbyPlaceCategoryLabel(item) != null)
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

  const handleSelectNearbyPlace = (place: NearbyTouristPlace) => {
    if (!selectedPlace) {
      return;
    }

    const categoryLabel = getNearbyPlaceCategoryLabel(place) ?? "장소";
    const categoryIcon = getNearbyPlaceCategoryIcon(place);
    const categoryName =
      place.lclsSystm3 || place.lclsSystm2 || place.lclsSystm1 || categoryLabel;

    openSheet(
      {
        id: `${place.id}-${place.contentTypeId}`,
        contentId: place.id,
        contentTypeId: place.contentTypeId,
        areaCode: selectedPlace.areaCode,
        signguCode: selectedPlace.signguCode,
        touristTrendName: place.title,
        topRank: null,
        title: place.title,
        address: place.address,
        lat: place.lat,
        lng: place.lng,
        contentTypeLabel: categoryLabel,
        categoryName,
        icon: categoryIcon,
        images: [place.firstImage, place.secondImage].filter(Boolean),
      },
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
                  <p className="mt-3 text-sm font-semibold text-brand-700">
                    {selectedPlace.icon} {selectedPlace.contentTypeLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {selectedPlace.categoryName}
                  </p>
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
                    <div className="flex h-44 w-full min-w-full items-center rounded-2xl border border-brand-200 bg-brand-50 px-3">
                      <PotatoLoadingCard
                        title="이미지를 불러오는 중"
                        description="감자가 데이터에서 이미지를 찾는 중"
                        animation="searching"
                        compact
                        className="border-brand-100 bg-white/90 shadow-none"
                      />
                    </div>
                  ) : activeImageList.length > 0 ? (
                    <>
                      {activeImageList.map((imageUrl, index) => (
                        <img
                          key={`${imageUrl}-${index}`}
                          src={imageUrl}
                          alt={`${selectedPlace.title} 이미지 ${index + 1}`}
                          className="h-44 w-40 shrink-0 snap-start rounded-2xl border border-brand-100 bg-brand-50 object-cover"
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
                <div className="rounded-3xl border border-brand-200/80 bg-gradient-to-b from-white to-brand-50/70 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-trip text-sm text-brand-700">
                      PLACE OVERVIEW
                    </p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      상세 정보
                    </span>
                  </div>
                  {!isSelectedPlaceDetailReady ? (
                    <div className="rounded-2xl border border-brand-100 bg-white/75 p-2">
                      <PotatoLoadingCard
                        title="장소 설명을 불러오는 중"
                        description="감자가 데이터에서 설명을 찾는 중"
                        animation="searching"
                        compact
                        className="border-brand-100 bg-white/95 shadow-none"
                      />
                    </div>
                  ) : detailOverview ? (
                    <p className="whitespace-pre-line rounded-2xl border border-brand-100 bg-white/80 px-3 py-3 text-sm leading-7 text-slate-700">
                      {detailOverview}
                    </p>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-brand-200 bg-white/75 px-3 py-4 text-center text-sm text-slate-500">
                      관광공사 오픈 API에서 제공하는 상세 설명이 아직 없습니다.
                    </div>
                  )}
                </div>

                <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-trip text-sm text-brand-700">
                      방문자 추이
                    </p>
                    <div className="inline-flex rounded-full border border-brand-200 bg-brand-50 p-1">
                      <button
                        type="button"
                        onClick={() => setTrendTab("weekly")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          trendTab === "weekly"
                            ? "bg-brand-600 text-white shadow-sm"
                            : "text-brand-700"
                        }`}
                      >
                        주간
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrendTab("monthly")}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          trendTab === "monthly"
                            ? "bg-brand-600 text-white shadow-sm"
                            : "text-brand-700"
                        }`}
                      >
                        월간
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-brand-100 bg-white px-3 py-3">
                    {concentrationTrendQuery.isFetching ? (
                      <div className="flex min-h-44 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                        <p className="ml-3 text-sm font-semibold">
                          방문자 추이 불러오는 중
                        </p>
                      </div>
                    ) : activeTrendPoints.length > 0 ? (
                      <div className="h-44 w-full">
                        <Line
                          data={trendChartData}
                          options={trendChartOptions}
                        />
                      </div>
                    ) : (
                      <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-brand-200 bg-brand-50/70 px-3 text-center text-sm text-slate-500">
                        <IoStatsChart className="mb-2 text-lg text-brand-500" />
                        <p>
                          {concentrationTrendError ??
                            (isTouristAttraction
                              ? "선택한 관광지의 방문자 추이 데이터가 아직 없습니다."
                              : "방문자 추이 예측은 관광지 데이터에 한해 제공됩니다.")}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    이동통신 기반 방문자 집계 데이터를 바탕으로 산출한 관광지
                    집중률 예측 추이입니다.
                  </p>
                </section>

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
                        <div className="absolute inset-0 flex items-center justify-center bg-white/55">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-2xl border border-brand-100 bg-brand-50/60 px-3 py-3 text-sm text-slate-700">
                      <p className="font-semibold text-slate-900">주소</p>
                      <p className="mt-1">{selectedPlace.address}</p>
                    </div>

                    <div className="mt-3 rounded-2xl border border-brand-100 bg-white px-3 py-3">
                      {isRouteLoading ? (
                        <div className="flex items-center text-sm text-brand-700">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                          <span className="ml-2 font-semibold">
                            내 위치(강릉 중심) 기준 경로 계산 중
                          </span>
                        </div>
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

                <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-trip text-sm text-brand-700">이런 곳도 좋아요</p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      주변 추천
                    </span>
                  </div>

                  {nearbyTouristQuery.isFetching ? (
                    <div className="rounded-2xl border border-brand-100 bg-white/75 p-2">
                      <PotatoLoadingCard
                        title="주변 장소를 찾는 중"
                        description="감자가 근처 관광지를 정리하는 중"
                        animation="searching"
                        compact
                        className="border-brand-100 bg-white/95 shadow-none"
                      />
                    </div>
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
                    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 px-3 py-4 text-center text-sm text-slate-500">
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
    </>
  );
}

export default PlaceBottomSheet;
