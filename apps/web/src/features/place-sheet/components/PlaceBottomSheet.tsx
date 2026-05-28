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
  IoStatsChart,
  IoNavigate,
} from "react-icons/io5";
import { usePlaceSheetLayout } from "../hooks/usePlaceSheetLayout";
import { fetchDrivingRouteFromCurrentLocation } from "../../../lib/naverDirectionsApi";
import {
  fetchTourPlaceDetail,
  fetchTouristConcentrationPoints,
  toWeeklyAndMonthlySeries,
  type TouristConcentrationPoint,
} from "../../../lib/visitKoreaTourApi";
import { useMapSheetStore } from "../../../stores/mapSheetStore";
import { useUiToastStore } from "../../../stores/uiToastStore";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
const NAVER_MAP_SCHEME_APP_NAME = "routeone.web";
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
      label: "🥇 TOP 1",
      className: "border-amber-300 bg-amber-50 text-amber-700",
    };
  }
  if (rank === 2) {
    return {
      label: "🥈 TOP 2",
      className: "border-slate-300 bg-slate-50 text-slate-700",
    };
  }
  if (rank === 3) {
    return {
      label: "🥉 TOP 3",
      className: "border-orange-300 bg-orange-50 text-orange-700",
    };
  }
  return {
    label: `TOP ${rank}`,
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

function PlaceBottomSheet() {
  const {
    isOpen,
    sheetMode,
    sheetResetVersion,
    selectedPlace,
    savedPlaceIds,
    resetSheet,
    toggleSavedPlace,
  } = useMapSheetStore();
  const showToast = useUiToastStore((state) => state.showToast);
  const [trendTab, setTrendTab] = useState<TrendTabType>("monthly");

  const previewMapRef = useRef<HTMLDivElement | null>(null);
  const previewMapInstanceRef = useRef<any>(null);
  const previewMapContainerRef = useRef<HTMLDivElement | null>(null);
  const previewOverlaysRef = useRef<any[]>([]);

  const currentLocation: CurrentLocation = GANGNEUNG_CENTER_LOCATION;

  const hasTourApiServiceKey = Boolean(TOUR_API_SERVICE_KEY);
  const isFullPopupMode = sheetMode === "full-popup";

  const selectedPlaceKey = selectedPlace
    ? `${selectedPlace.contentId}-${selectedPlace.contentTypeId}`
    : null;
  const isCurrentPlaceSaved = selectedPlace ? savedPlaceIds.includes(selectedPlace.id) : false;

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
    queryKey: ["place-route", selectedPlaceKey, currentLocation.lat, currentLocation.lng],
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

  const detailOverview = detailQuery.data?.overview ?? "";
  const detailImages = detailQuery.data?.images ?? [];
  const isSelectedPlaceDetailReady =
    !hasTourApiServiceKey ||
    (Boolean(selectedPlaceKey) && (detailQuery.isSuccess || detailQuery.isError));
  const activeImageList = useMemo(
    () => [...new Set(detailImages.filter(Boolean))],
    [detailImages]
  );
  const routeDurationText = routeQuery.data
    ? formatDurationMinutes(routeQuery.data.durationMs)
    : null;
  const routeDistanceText = routeQuery.data ? formatDistance(routeQuery.data.distanceM) : null;
  const routePathPoints = routeQuery.data?.path ?? [];
  const isRouteLoading = routeQuery.isFetching;
  const routeError =
    routeQuery.error instanceof Error ? routeQuery.error.message : null;
  const concentrationTrendError =
    concentrationTrendQuery.error instanceof Error
      ? concentrationTrendQuery.error.message
      : null;
  const concentrationSeries = useMemo(
    () => toWeeklyAndMonthlySeries(concentrationTrendQuery.data ?? []),
    [concentrationTrendQuery.data]
  );
  const activeTrendPoints =
    trendTab === "weekly" ? concentrationSeries.weekly : concentrationSeries.monthly;
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

  const clearPreviewOverlays = () => {
    previewOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    previewOverlaysRef.current = [];
  };

  const openNaverDirections = (origin: CurrentLocation, destination: CurrentLocation) => {
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
    const destinationLatLng = new naverMaps.LatLng(selectedPlace.lat, selectedPlace.lng);
    bounds.extend(destinationLatLng);

    const destinationMarker = new naverMaps.Marker({
      map: previewMap,
      position: destinationLatLng,
      title: selectedPlace.title,
    });
    previewOverlaysRef.current.push(destinationMarker);

    if (currentLocation) {
      const originLatLng = new naverMaps.LatLng(currentLocation.lat, currentLocation.lng);
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
  }, [currentLocation, isOpen, routePathPoints, selectedPlace, shouldShowExpandedSection]);

  useEffect(() => {
    return () => {
      clearPreviewOverlays();
      previewMapInstanceRef.current = null;
      previewMapContainerRef.current = null;
    };
  }, []);

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
            ? "fixed inset-0 z-[1900] w-full bg-white"
            : `fixed bottom-0 z-[1900] w-full bg-white ${
                isSheetExpanded
                  ? "inset-x-0 rounded-none border-0 shadow-none"
                  : "inset-x-0 mx-auto max-w-md rounded-t-3xl border border-brand-200 shadow-[0_-10px_32px_rgba(15,23,42,0.25)]"
              } ${isDraggingSheet ? "transition-none" : "transition-[top] duration-300"}`
        }
        style={isFullPopupMode ? undefined : { top: `${sheetTop}px` }}
      >
        <div className="flex h-full flex-col">
          <div
            role="button"
            tabIndex={0}
            className={`${isFullPopupMode ? "" : "touch-none"} ${
              isSheetExpanded || isFullPopupMode ? "rounded-none" : "rounded-t-3xl"
            }`}
            style={{ minHeight: `${SHEET_HEADER_HEIGHT_PX}px` }}
            onPointerDown={isFullPopupMode ? undefined : handleSheetPointerDown}
            onPointerMove={isFullPopupMode ? undefined : handleSheetPointerMove}
            onPointerUp={isFullPopupMode ? undefined : handleSheetPointerUp}
            onPointerCancel={isFullPopupMode ? undefined : handleSheetPointerUp}
          >
            <div
              className={`flex items-center px-4 ${
                isSheetExpanded || isFullPopupMode ? "h-full justify-start" : "h-full justify-center"
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
            className={`min-h-0 flex-1 ${
              isSheetExpanded || isFullPopupMode
                ? "scrollbar-hide overflow-y-auto"
                : "overflow-hidden"
            }`}
          >
            <div className="px-5 pt-4" style={{ minHeight: `${SHEET_HEADLINE_MIN_HEIGHT_PX}px` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-trip text-[30px] leading-[1.15] text-slate-900">
                    {selectedPlace.title}
                  </p>
                  {topRankBadge ? (
                    <p
                      className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${topRankBadge.className}`}
                    >
                      {topRankBadge.label}
                    </p>
                  ) : null}
                  <p className="mt-3 text-sm font-semibold text-brand-700">
                    {selectedPlace.icon} {selectedPlace.contentTypeLabel}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{selectedPlace.categoryName}</p>
                </div>
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
                  className="mt-1 shrink-0 rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                >
                  {isCurrentPlaceSaved ? <IoBagAdd /> : <IoBagAddOutline />}
                </button>
              </div>

              <p className="mt-4 text-sm leading-6 text-slate-600">{selectedPlace.address}</p>

              <div className="mt-5">
                <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                  {!isSelectedPlaceDetailReady ? (
                    <div className="flex h-44 w-full min-w-full flex-col items-center justify-center rounded-2xl border border-brand-200 bg-brand-50">
                      <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                      <p className="mt-2 text-sm font-semibold text-brand-700">이미지 불러오는 중</p>
                    </div>
                  ) : activeImageList.length > 0 ? (
                    activeImageList.map((imageUrl, index) => (
                      <img
                        key={`${imageUrl}-${index}`}
                        src={imageUrl}
                        alt={`${selectedPlace.title} 이미지 ${index + 1}`}
                        className="h-44 w-40 shrink-0 snap-start rounded-2xl border border-brand-100 bg-brand-50 object-cover"
                      />
                    ))
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50 text-sm text-slate-500">
                      등록된 이미지가 없습니다
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
                    <p className="font-trip text-sm text-brand-700">PLACE OVERVIEW</p>
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      상세 정보
                    </span>
                  </div>
                  {!isSelectedPlaceDetailReady ? (
                    <div className="flex min-h-24 items-center justify-center rounded-2xl border border-brand-100 bg-white/75">
                      <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
                      <p className="ml-3 text-sm font-semibold text-brand-700">장소 정보를 불러오는 중</p>
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
                    <p className="font-trip text-sm text-brand-700">방문자 추이</p>
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
                        <p className="ml-3 text-sm font-semibold">방문자 추이 불러오는 중</p>
                      </div>
                    ) : activeTrendPoints.length > 0 ? (
                      <div className="h-44 w-full">
                        <Line data={trendChartData} options={trendChartOptions} />
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
                    이동통신 기반 방문자 집계 데이터를 바탕으로 산출한 관광지 집중률 예측 추이입니다.
                  </p>
                </section>

                {shouldShowExpandedSection ? (
                  <section className="rounded-3xl border border-brand-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-trip text-sm text-brand-700">PLACE DIRECTIONS</p>
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
                          <span className="ml-2 font-semibold">내 위치(강릉 중심) 기준 경로 계산 중</span>
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
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default PlaceBottomSheet;
