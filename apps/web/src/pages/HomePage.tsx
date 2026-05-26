import { useEffect, useMemo, useRef, useState } from "react";
import {
  IoBookmark,
  IoBookmarkOutline,
  IoClose,
  IoLocationSharp,
} from "react-icons/io5";
import { GANGWON_BOUNDARY_POINTS } from "../data/gangwonBoundary";
import { loadNaverMapSdk } from "../lib/naverMapSdk";
import {
  fetchGangwonAttractions,
  fetchLclsSystemNameMap,
  fetchTourPlaceDetail,
  TOUR_CONTENT_TYPE_IDS,
  type GangwonAttraction,
} from "../lib/visitKoreaTourApi";
import { useMapSheetStore } from "../stores/mapSheetStore";

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

const GANGWON_CENTER = {
  lat: 37.8228,
  lng: 128.1555,
};

const GANGWON_BOUNDS = {
  south: 37.02,
  west: 127.1,
  north: 38.62,
  east: 129.38,
};

const GANGWON_REGIONS = [
  { label: "강릉", sigunguCode: "1", center: { lat: 37.7519, lng: 128.8761 } },
  { label: "고성", sigunguCode: "2", center: { lat: 38.3804, lng: 128.4677 } },
  { label: "동해", sigunguCode: "3", center: { lat: 37.5247, lng: 129.1143 } },
  { label: "삼척", sigunguCode: "4", center: { lat: 37.4499, lng: 129.1652 } },
  { label: "속초", sigunguCode: "5", center: { lat: 38.207, lng: 128.5918 } },
  { label: "양구", sigunguCode: "6", center: { lat: 38.1057, lng: 127.99 } },
  { label: "양양", sigunguCode: "7", center: { lat: 38.0754, lng: 128.6191 } },
  { label: "영월", sigunguCode: "8", center: { lat: 37.1836, lng: 128.4617 } },
  { label: "원주", sigunguCode: "9", center: { lat: 37.3422, lng: 127.9202 } },
  { label: "인제", sigunguCode: "10", center: { lat: 38.0697, lng: 128.1704 } },
  { label: "정선", sigunguCode: "11", center: { lat: 37.3807, lng: 128.6611 } },
  { label: "철원", sigunguCode: "12", center: { lat: 38.1466, lng: 127.3134 } },
  { label: "춘천", sigunguCode: "13", center: { lat: 37.8813, lng: 127.7298 } },
  { label: "태백", sigunguCode: "14", center: { lat: 37.1641, lng: 128.9856 } },
  { label: "평창", sigunguCode: "15", center: { lat: 37.3704, lng: 128.3906 } },
  { label: "홍천", sigunguCode: "16", center: { lat: 37.6972, lng: 127.8886 } },
  { label: "화천", sigunguCode: "17", center: { lat: 38.1062, lng: 127.7082 } },
  { label: "횡성", sigunguCode: "18", center: { lat: 37.4918, lng: 127.985 } },
] as const;

type MarkerBadge = {
  label: string;
  icon: string;
  background: string;
  border: string;
  text: string;
};

type SheetSnap = "collapsed" | "expanded";

const CONTENT_TYPE_BADGES: Record<string, MarkerBadge> = {
  "12": {
    label: "관광지",
    icon: "📍",
    background: "#e0f2fe",
    border: "#0284c7",
    text: "#0c4a6e",
  },
  "14": {
    label: "문화시설",
    icon: "🏛",
    background: "#fef3c7",
    border: "#d97706",
    text: "#78350f",
  },
  "15": {
    label: "축제/공연",
    icon: "🎉",
    background: "#fee2e2",
    border: "#dc2626",
    text: "#7f1d1d",
  },
  "28": {
    label: "레포츠",
    icon: "🚴",
    background: "#dcfce7",
    border: "#16a34a",
    text: "#14532d",
  },
  "32": {
    label: "숙박",
    icon: "🛏",
    background: "#f1f5f9",
    border: "#475569",
    text: "#1e293b",
  },
  "38": {
    label: "쇼핑",
    icon: "🛍",
    background: "#ffedd5",
    border: "#ea580c",
    text: "#7c2d12",
  },
  "39": {
    label: "음식점",
    icon: "🍽",
    background: "#fed7aa",
    border: "#f97316",
    text: "#7c2d12",
  },
};

const DEFAULT_BADGE: MarkerBadge = {
  label: "장소",
  icon: "📌",
  background: "#ccfbf1",
  border: "#0d9488",
  text: "#115e59",
};

const CAFE_LCLS_CODE = "FD050100";
const CAFE_BADGE: MarkerBadge = {
  label: "카페",
  icon: "☕",
  background: "#fef3c7",
  border: "#d97706",
  text: "#78350f",
};

const DRAG_SNAP_THRESHOLD_PX = 48;

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resolveMarkerType(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const contentTypeBadge =
    CONTENT_TYPE_BADGES[attraction.contentTypeId] ?? DEFAULT_BADGE;
  const categoryName =
    lclsNameByCode[attraction.lclsSystm3] ||
    lclsNameByCode[attraction.lclsSystm2] ||
    lclsNameByCode[attraction.lclsSystm1] ||
    contentTypeBadge.label;

  const isCafe =
    attraction.contentTypeId === "39" &&
    (attraction.lclsSystm3 === CAFE_LCLS_CODE ||
      /카페|커피|coffee|찻집/i.test(`${categoryName} ${attraction.title}`));

  const badge = isCafe ? CAFE_BADGE : contentTypeBadge;
  const contentTypeLabel = isCafe ? "카페" : contentTypeBadge.label;

  return {
    typeName: categoryName,
    contentTypeLabel,
    badge,
  };
}

function createBadgeMarkerIconHtml(badge: MarkerBadge) {
  return `
    <div style="
      width:34px;
      height:34px;
      border-radius:9999px;
      border:2px solid ${badge.border};
      background:${badge.background};
      color:${badge.text};
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:15px;
      font-weight:700;
      line-height:1;
      box-shadow:0 4px 10px rgba(15,23,42,0.18);
      letter-spacing:-0.02em;
      user-select:none;
    ">${escapeHtml(badge.icon)}</div>
  `;
}

function shouldHideAttraction(
  attraction: GangwonAttraction,
  lclsNameByCode: Record<string, string>
) {
  const categoryText = [
    lclsNameByCode[attraction.lclsSystm1] || "",
    lclsNameByCode[attraction.lclsSystm2] || "",
    lclsNameByCode[attraction.lclsSystm3] || "",
  ].join(" ");
  const targetText = `${attraction.title} ${categoryText}`;

  return /화장실|공중.?화장실|주차장|공영주차장|parking/i.test(targetText);
}

function getSheetTop(viewportHeight: number, snap: SheetSnap) {
  const safeTop = typeof window === "undefined" ? 0 : window.visualViewport?.offsetTop ?? 0;
  const expandedTop = Math.max(safeTop, 0);
  // 처음 오픈 시: 타이틀/메타/이미지까지만 보이는 높이(화면 크기와 무관하게 안정적)
  const collapsedHeight = Math.min(380, Math.max(320, viewportHeight * 0.42));
  const collapsedTop = Math.max(expandedTop + 180, viewportHeight - collapsedHeight);
  return snap === "expanded" ? expandedTop : collapsedTop;
}

function HomePage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const naverMapsRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const markerListenerRefs = useRef<any[]>([]);
  const lclsNameByCodeRef = useRef<Record<string, string>>({});
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    startTop: number;
  }>({ active: false, pointerId: null, startY: 0, startTop: 0 });

  const {
    isOpen: isSheetOpen,
    selectedPlace,
    openSheet,
    closeSheet,
    toggleSavedPlace,
    savedPlaceIds,
  } = useMapSheetStore();

  const [selectedSigunguCode, setSelectedSigunguCode] = useState<string>(
    GANGWON_REGIONS[0].sigunguCode
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [attractionError, setAttractionError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isAttractionLoading, setIsAttractionLoading] = useState(false);
  const [attractionCount, setAttractionCount] = useState(0);
  const [detailOverview, setDetailOverview] = useState("");
  const [detailImages, setDetailImages] = useState<string[]>([]);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [brokenImageUrls, setBrokenImageUrls] = useState<string[]>([]);

  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight
  );
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>("collapsed");
  const [sheetTop, setSheetTop] = useState(() =>
    getSheetTop(typeof window === "undefined" ? 800 : window.innerHeight, "collapsed")
  );
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const sheetTopRef = useRef(sheetTop);

  const selectedRegion = useMemo(
    () =>
      GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
      GANGWON_REGIONS[0],
    [selectedSigunguCode]
  );

  const activeImageList = useMemo(() => {
    const merged = [...detailImages, ...(selectedPlace?.images ?? [])].filter(Boolean);
    const unique = [...new Set(merged)];
    return unique.filter((url) => !brokenImageUrls.includes(url));
  }, [brokenImageUrls, detailImages, selectedPlace?.images]);
  const isCurrentPlaceSaved = selectedPlace
    ? savedPlaceIds.includes(selectedPlace.id)
    : false;
  const collapsedTop = getSheetTop(viewportHeight, "collapsed");
  const showOverviewPanel =
    sheetSnap === "expanded" || sheetTop < collapsedTop - DRAG_SNAP_THRESHOLD_PX * 0.6;

  useEffect(() => {
    const onResize = () => {
      setViewportHeight(window.innerHeight);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    setSheetTop(getSheetTop(viewportHeight, sheetSnap));
  }, [isSheetOpen, sheetSnap, viewportHeight]);

  useEffect(() => {
    sheetTopRef.current = sheetTop;
  }, [sheetTop]);

  useEffect(() => {
    if (!isSheetOpen || !selectedPlace) {
      setDetailImages([]);
      setDetailOverview("");
      setIsDetailLoading(false);
      setBrokenImageUrls([]);
      return;
    }

    let isDisposed = false;

    const loadPlaceDetail = async () => {
      setIsDetailLoading(true);
      setDetailOverview("");
      setDetailImages([]);
      setBrokenImageUrls([]);

      try {
        const detail = await fetchTourPlaceDetail(
          TOUR_API_SERVICE_KEY,
          selectedPlace.contentId,
          selectedPlace.contentTypeId,
          selectedPlace.title
        );

        if (isDisposed) {
          return;
        }

        setDetailOverview(detail.overview);
        setDetailImages(detail.images);
      } catch {
        if (!isDisposed) {
          setDetailOverview("");
          setDetailImages([]);
        }
      } finally {
        if (!isDisposed) {
          setIsDetailLoading(false);
        }
      }
    };

    loadPlaceDetail();

    return () => {
      isDisposed = true;
    };
  }, [isSheetOpen, selectedPlace]);

  const clearMarkers = () => {
    const naverMaps = naverMapsRef.current;

    markerListenerRefs.current.forEach((listener) => {
      if (naverMaps?.Event) {
        naverMaps.Event.removeListener(listener);
      }
    });

    markerRefs.current.forEach((marker) => marker.setMap(null));
    markerRefs.current = [];
    markerListenerRefs.current = [];
  };

  const resetSheetLayout = () => {
    setSheetSnap("collapsed");
    setIsDraggingSheet(false);
    setSheetTop(getSheetTop(viewportHeight, "collapsed"));
  };

  const handleSheetPointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isSheetOpen) {
      return;
    }

    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: sheetTop,
    };

    setIsDraggingSheet(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleSheetPointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    const expandedTop = getSheetTop(viewportHeight, "expanded");
    const collapsedTop = getSheetTop(viewportHeight, "collapsed");
    const nextTop = Math.min(
      collapsedTop,
      Math.max(expandedTop, dragState.startTop + (event.clientY - dragState.startY))
    );

    setSheetTop(nextTop);
    sheetTopRef.current = nextTop;
  };

  const handleSheetPointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    const dragState = dragStateRef.current;

    if (!dragState.active || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = {
      active: false,
      pointerId: null,
      startY: 0,
      startTop: 0,
    };

    setIsDraggingSheet(false);

    const expandedTop = getSheetTop(viewportHeight, "expanded");
    const collapsedTop = getSheetTop(viewportHeight, "collapsed");
    const currentTop = sheetTopRef.current;
    const movedDistance = currentTop - dragState.startTop;
    const movedUpEnough = movedDistance < -DRAG_SNAP_THRESHOLD_PX;
    const movedDownEnough = movedDistance > DRAG_SNAP_THRESHOLD_PX;
    const midpoint = expandedTop + (collapsedTop - expandedTop) / 2;

    let nextSnap: SheetSnap;
    if (movedUpEnough) {
      nextSnap = "expanded";
    } else if (movedDownEnough) {
      nextSnap = "collapsed";
    } else {
      nextSnap = currentTop <= midpoint ? "expanded" : "collapsed";
    }

    setSheetSnap(nextSnap);
    setSheetTop(getSheetTop(viewportHeight, nextSnap));
  };

  useEffect(() => {
    const container = mapRef.current;

    if (!container) {
      return;
    }

    if (!NCP_KEY_ID) {
      setMapError("VITE_NCP_MAPS_KEY_ID가 설정되지 않았습니다.");
      return;
    }

    let isDisposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let handleResize: (() => void) | null = null;

    window.navermap_authFailure = () => {
      setMapError(
        "네이버 지도 인증에 실패했습니다. Web 서비스 URL(localhost/127.0.0.1)을 확인해 주세요."
      );
    };

    const initializeMap = async () => {
      try {
        await loadNaverMapSdk(NCP_KEY_ID);

        if (isDisposed) {
          return;
        }

        const naverMaps = window.naver?.maps;

        if (!naverMaps) {
          setMapError("Naver Maps SDK를 찾을 수 없습니다.");
          return;
        }

        naverMapsRef.current = naverMaps;

        const mapInstance = new naverMaps.Map(container, {
          center: new naverMaps.LatLng(GANGWON_CENTER.lat, GANGWON_CENTER.lng),
          zoom: 10,
          mapTypeId: naverMaps.MapTypeId.NORMAL,
          zoomControl: false,
          mapDataControl: true,
          logoControl: true,
          minZoom: 8,
        });

        mapInstanceRef.current = mapInstance;

        const gangwonBounds = new naverMaps.LatLngBounds(
          new naverMaps.LatLng(GANGWON_BOUNDS.south, GANGWON_BOUNDS.west),
          new naverMaps.LatLng(GANGWON_BOUNDS.north, GANGWON_BOUNDS.east)
        );

        const highlightPath = GANGWON_BOUNDARY_POINTS.map(
          (point) => new naverMaps.LatLng(point.lat, point.lng)
        );

        new naverMaps.Polygon({
          map: mapInstance,
          paths: [highlightPath],
          strokeColor: "#0d9488",
          strokeWeight: 3,
          strokeOpacity: 0.95,
          fillColor: "#14b8a6",
          fillOpacity: 0.12,
        });

        mapInstance.fitBounds(gangwonBounds);
        mapInstance.setZoom(Math.max(10, mapInstance.getZoom()));

        const forceResize = () => {
          if (!mapInstanceRef.current) {
            return;
          }
          naverMaps.Event.trigger(mapInstance, "resize");
        };

        requestAnimationFrame(forceResize);
        setTimeout(forceResize, 120);
        setTimeout(forceResize, 360);

        naverMaps.Event.once(mapInstance, "init", () => {
          setMapReady(true);
        });

        handleResize = forceResize;
        window.addEventListener("resize", handleResize);

        resizeObserver = new ResizeObserver(() => {
          forceResize();
        });
        resizeObserver.observe(container);
      } catch {
        setMapError("지도 로드에 실패했습니다. 키와 도메인 등록을 확인해 주세요.");
      }
    };

    initializeMap();

    return () => {
      isDisposed = true;
      clearMarkers();
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      mapInstanceRef.current = null;
      naverMapsRef.current = null;
      lclsNameByCodeRef.current = {};
      closeSheet();
      window.navermap_authFailure = undefined;
      container.innerHTML = "";
    };
  }, [closeSheet]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;

    if (!mapReady || !mapInstance || !naverMaps) {
      return;
    }

    if (!TOUR_API_SERVICE_KEY) {
      setAttractionError("VITE_VISITKOREA_SERVICE_KEY가 비어있습니다.");
      return;
    }

    let isDisposed = false;
    const currentRegion =
      GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
      GANGWON_REGIONS[0];

    const loadAttractions = async () => {
      setIsAttractionLoading(true);
      setAttractionError(null);
      closeSheet();
      clearMarkers();

      try {
        if (Object.keys(lclsNameByCodeRef.current).length === 0) {
          try {
            lclsNameByCodeRef.current = await fetchLclsSystemNameMap(
              TOUR_API_SERVICE_KEY
            );
          } catch {
            lclsNameByCodeRef.current = {};
          }
        }

        const attractions = await fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
          sigunguCode: selectedSigunguCode || undefined,
          contentTypeIds: [...TOUR_CONTENT_TYPE_IDS],
        });
        const filteredAttractions = attractions.filter(
          (attraction) =>
            !shouldHideAttraction(attraction, lclsNameByCodeRef.current)
        );

        if (isDisposed) {
          return;
        }

        const markerBounds = new naverMaps.LatLngBounds();

        filteredAttractions.forEach((attraction) => {
          const position = new naverMaps.LatLng(attraction.lat, attraction.lng);
          markerBounds.extend(position);

          const markerType = resolveMarkerType(
            attraction,
            lclsNameByCodeRef.current
          );

          const marker = new naverMaps.Marker({
            map: mapInstance,
            position,
            title: attraction.title,
            icon: {
              content: createBadgeMarkerIconHtml(markerType.badge),
              anchor: new naverMaps.Point(17, 17),
            },
          });

          markerRefs.current.push(marker);

          const listener = naverMaps.Event.addListener(marker, "click", () => {
            if (typeof mapInstance.panTo === "function") {
              mapInstance.panTo(position, {
                duration: 500,
              });
            } else {
              mapInstance.setCenter(position);
            }

            resetSheetLayout();
            openSheet({
              id: `${attraction.id}-${attraction.contentTypeId}`,
              contentId: attraction.id,
              contentTypeId: attraction.contentTypeId,
              title: attraction.title,
              address: attraction.address,
              lat: attraction.lat,
              lng: attraction.lng,
              contentTypeLabel: markerType.contentTypeLabel,
              categoryName: markerType.typeName,
              icon: markerType.badge.icon,
              images: [attraction.firstImage, attraction.secondImage].filter(Boolean),
            });
          });

          markerListenerRefs.current.push(listener);
        });

        setAttractionCount(filteredAttractions.length);

        if (filteredAttractions.length > 0) {
          mapInstance.fitBounds(markerBounds);
          mapInstance.setZoom(Math.max(10, mapInstance.getZoom()));
        } else {
          mapInstance.setCenter(
            new naverMaps.LatLng(currentRegion.center.lat, currentRegion.center.lng)
          );
          mapInstance.setZoom(currentRegion.sigunguCode ? 10 : 9);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "관광 명소 데이터를 불러오지 못했습니다.";
        if (!isDisposed) {
          setAttractionError(message);
        }
      } finally {
        if (!isDisposed) {
          setIsAttractionLoading(false);
        }
      }
    };

    loadAttractions();

    return () => {
      isDisposed = true;
    };
  }, [closeSheet, mapReady, openSheet, selectedSigunguCode]);

  return (
    <section className="relative h-full overflow-hidden bg-brand-50">
      <div
        ref={mapRef}
        className="naver-map-root h-full w-full"
        style={{ background: "#dbeafe" }}
      />

      <div className="pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-20 flex items-center justify-between">
        <div className="pointer-events-auto flex h-12 flex-1 items-center rounded-full border border-brand-200 bg-white/95 px-4 shadow-md backdrop-blur">
          <span className="text-base text-brand-500">
            <IoLocationSharp />
          </span>
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder="강원도 명소 검색"
            className="ml-2 w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none"
          />
        </div>
        <div className="ml-2 rounded-full bg-brand-600/95 px-3 py-1.5 text-xs font-semibold text-white shadow">
          {isAttractionLoading ? "불러오는 중" : `${selectedRegion.label} ${attractionCount}개`}
        </div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {GANGWON_REGIONS.map((region) => {
            const isActive = selectedSigunguCode === region.sigunguCode;

            return (
              <button
                key={region.sigunguCode || "all"}
                type="button"
                onClick={() => setSelectedSigunguCode(region.sigunguCode)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                  isActive
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-brand-200 bg-white/95 text-slate-600"
                }`}
              >
                {region.label}
              </button>
            );
          })}
        </div>
      </div>

      {isSheetOpen && selectedPlace ? (
        <>
          <button
            type="button"
            onClick={() => {
              closeSheet();
              resetSheetLayout();
            }}
            aria-label="바텀시트 닫기"
            className="fixed inset-0 z-[1200] bg-slate-900/25"
          />

          <section
            className={`fixed inset-x-0 bottom-0 z-[1300] mx-auto w-full max-w-md rounded-t-3xl border border-brand-200 bg-white shadow-[0_-10px_32px_rgba(15,23,42,0.25)] ${
              isDraggingSheet ? "transition-none" : "transition-[top] duration-300"
            }`}
            style={{ top: `${sheetTop}px` }}
          >
            <div className="flex h-full flex-col">
              <div
                role="button"
                tabIndex={0}
                className="touch-none"
                onPointerDown={handleSheetPointerDown}
                onPointerMove={handleSheetPointerMove}
                onPointerUp={handleSheetPointerUp}
                onPointerCancel={handleSheetPointerUp}
              >
                <div className="flex cursor-grab justify-center pt-2 active:cursor-grabbing">
                  <div className="h-1.5 w-12 rounded-full bg-brand-200" />
                </div>

                <div className="px-5 pt-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-2xl font-bold text-slate-900">{selectedPlace.title}</p>
                      <p className="mt-2 text-sm font-semibold text-brand-700">
                        {selectedPlace.icon} {selectedPlace.contentTypeLabel}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{selectedPlace.categoryName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="내 루트 담기"
                        onClick={() => toggleSavedPlace(selectedPlace.id)}
                        className="rounded-full border border-brand-200 bg-brand-50 p-2 text-brand-700"
                      >
                        {isCurrentPlaceSaved ? <IoBookmark /> : <IoBookmarkOutline />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeSheet();
                          resetSheetLayout();
                        }}
                        className="rounded-full border border-slate-200 bg-white p-2 text-slate-500"
                      >
                        <IoClose />
                      </button>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">{selectedPlace.address}</p>

                  <div className="mt-4">
                    <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
                      {activeImageList.length > 0 ? (
                        activeImageList.map((imageUrl, index) => (
                          <img
                            key={`${imageUrl}-${index}`}
                            src={imageUrl}
                            alt={`${selectedPlace.title} 이미지 ${index + 1}`}
                            onError={() => {
                              setBrokenImageUrls((prev) =>
                                prev.includes(imageUrl) ? prev : [...prev, imageUrl]
                              );
                            }}
                            className="h-44 w-40 shrink-0 snap-start rounded-2xl border border-brand-100 bg-brand-50 object-cover"
                          />
                        ))
                      ) : (
                        <div className="flex h-44 w-full items-center justify-center rounded-2xl border border-dashed border-brand-200 bg-brand-50 text-sm text-slate-500">
                          {isDetailLoading ? "이미지 불러오는 중" : "등록된 이미지가 없습니다"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 transition-all duration-200 ${
                  showOverviewPanel
                    ? "min-h-0 flex-1 opacity-100"
                    : "pointer-events-none h-0 overflow-hidden opacity-0"
                }`}
              >
                <div className="h-full min-h-0 overflow-y-auto rounded-2xl bg-brand-50 px-4 py-3">
                  {isDetailLoading ? (
                    <p className="text-sm text-slate-500">장소 정보를 불러오는 중입니다.</p>
                  ) : detailOverview ? (
                    <p className="whitespace-pre-line text-sm leading-6 text-slate-700">
                      {detailOverview}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500">
                      관광공사 오픈 API에서 제공하는 상세 설명이 아직 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}

      {mapError ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">
          {mapError}
        </div>
      ) : null}

      {attractionError ? (
        <div className="absolute inset-x-3 bottom-3 z-20 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-sm">
          {attractionError}
        </div>
      ) : null}
    </section>
  );
}

export default HomePage;
