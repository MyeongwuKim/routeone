import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IoBagHandleOutline, IoLocationSharp } from "react-icons/io5";
import PlaceBottomSheet from "../features/place-sheet/components/PlaceBottomSheet";
import RouteCheckoutModal from "../features/route-checkout/components/RouteCheckoutModal";
import { loadNaverMapSdk } from "../lib/naverMapSdk";
import {
  fetchGangwonAttractions,
  fetchLclsSystemNameMap,
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

type GeoRing = [number, number][];
type GeoPolygon = GeoRing[];
type GeoMultiPolygon = GeoPolygon[];

type GangwonBoundaryFeature = {
  properties?: {
    id?: string;
    title?: string;
  };
  geometry?: {
    type?: string;
    coordinates?: unknown;
  };
};

type GangwonBoundaryCollection = {
  features?: GangwonBoundaryFeature[];
};

type CurrentLocation = {
  lat: number;
  lng: number;
};

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

function toMultiPolygonCoordinates(feature: GangwonBoundaryFeature): GeoMultiPolygon {
  const geometryType = feature.geometry?.type;
  const coordinates = feature.geometry?.coordinates;

  if (!coordinates) {
    return [];
  }

  if (geometryType === "Polygon") {
    return [coordinates as GeoPolygon];
  }

  if (geometryType === "MultiPolygon") {
    return coordinates as GeoMultiPolygon;
  }

  return [];
}

function buildBoundaryMapBySigunguCode(
  collection: GangwonBoundaryCollection
): Record<string, GeoMultiPolygon> {
  const features = collection.features ?? [];
  const mapByCode: Record<string, GeoMultiPolygon> = {};

  GANGWON_REGIONS.forEach((region) => {
    const matchedFeature = features.find((feature) =>
      feature.properties?.title?.startsWith(region.label)
    );

    if (matchedFeature) {
      mapByCode[region.sigunguCode] = toMultiPolygonCoordinates(matchedFeature);
    }
  });

  return mapByCode;
}

function calculateDistanceMeters(
  from: CurrentLocation,
  to: CurrentLocation
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMeters * c;
}

function HomePage() {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const naverMapsRef = useRef<any>(null);
  const boundaryPolygonRefs = useRef<any[]>([]);
  const markerRefs = useRef<any[]>([]);
  const markerListenerRefs = useRef<any[]>([]);

  const {
    openSheet,
    closeSheet,
    resetSheet,
    savedPlaceIds,
    savedPlaces,
    isSavedListOpen,
    openSavedList,
    closeSavedList,
    removeSavedPlace,
    clearSavedPlaces,
  } = useMapSheetStore();

  const [selectedSigunguCode, setSelectedSigunguCode] = useState<string>(
    GANGWON_REGIONS[0].sigunguCode
  );
  const [searchKeyword, setSearchKeyword] = useState("");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);

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

  const attractionsQuery = useQuery({
    queryKey: ["gangwon-attractions", selectedSigunguCode],
    enabled: mapReady && Boolean(TOUR_API_SERVICE_KEY),
    queryFn: async () => {
      const lclsNameByCode = await fetchLclsSystemNameMap(TOUR_API_SERVICE_KEY);
      const attractions = await fetchGangwonAttractions(TOUR_API_SERVICE_KEY, {
        sigunguCode: selectedSigunguCode || undefined,
        contentTypeIds: [...TOUR_CONTENT_TYPE_IDS],
      });
      const filteredAttractions = attractions.filter(
        (attraction) => !shouldHideAttraction(attraction, lclsNameByCode)
      );

      return {
        filteredAttractions,
        lclsNameByCode,
      };
    },
    staleTime: 1000 * 60 * 60 * 12,
    gcTime: 1000 * 60 * 60 * 24,
  });

  const boundaryBySigunguCode = boundaryQuery.data ?? {};
  const isBoundaryDataReady = boundaryQuery.isSuccess || boundaryQuery.isError;
  const isAttractionLoading = attractionsQuery.isFetching;
  const attractionError = !TOUR_API_SERVICE_KEY
    ? "VITE_VISITKOREA_SERVICE_KEY가 비어있습니다."
    : attractionsQuery.error instanceof Error
      ? attractionsQuery.error.message
      : null;
  const orderedRegions = useMemo(() => {
    if (!currentLocation) {
      return GANGWON_REGIONS;
    }

    return [...GANGWON_REGIONS].sort((a, b) => {
      const distanceA = calculateDistanceMeters(currentLocation, a.center);
      const distanceB = calculateDistanceMeters(currentLocation, b.center);
      return distanceA - distanceB;
    });
  }, [currentLocation]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setCurrentLocation(null);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 5,
        timeout: 4000,
      }
    );
  }, []);

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

  const clearBoundaryPolygons = () => {
    boundaryPolygonRefs.current.forEach((polygon) => polygon.setMap(null));
    boundaryPolygonRefs.current = [];
  };

  const drawSelectedRegionBoundary = () => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;

    if (!mapInstance || !naverMaps) {
      return null;
    }

    clearBoundaryPolygons();

    const multiPolygon = boundaryBySigunguCode[selectedSigunguCode];
    if (!multiPolygon || multiPolygon.length === 0) {
      return null;
    }

    const regionBounds = new naverMaps.LatLngBounds();
    const isKoreaLatLng = (lat: number, lng: number) =>
      lat >= 32 && lat <= 40 && lng >= 123 && lng <= 133;
    const readLatLng = (coord: any) => {
      if (!coord) {
        return null;
      }

      const lat =
        typeof coord.lat === "function"
          ? coord.lat()
          : typeof coord.y === "number"
            ? coord.y
            : typeof coord._lat === "number"
              ? coord._lat
              : null;
      const lng =
        typeof coord.lng === "function"
          ? coord.lng()
          : typeof coord.x === "number"
            ? coord.x
            : typeof coord._lng === "number"
              ? coord._lng
              : null;

      if (typeof lat !== "number" || typeof lng !== "number") {
        return null;
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return { lat, lng };
    };

    const toLatLng = ([x, y]: [number, number]) => {
      if (Math.abs(x) <= 180 && Math.abs(y) <= 90) {
        return isKoreaLatLng(y, x) ? new naverMaps.LatLng(y, x) : null;
      }

      const transCoord = naverMaps.TransCoord;
      const convertCandidates = [
        () => transCoord?.fromUTMKToLatLng?.(new naverMaps.Point(x, y)),
        () => transCoord?.fromTM128ToLatLng?.(new naverMaps.Point(x, y)),
        () => transCoord?.fromNaverToLatLng?.(new naverMaps.Point(x, y)),
      ];

      for (const convert of convertCandidates) {
        const coord = convert();
        const parsed = readLatLng(coord);
        if (parsed && isKoreaLatLng(parsed.lat, parsed.lng)) {
          return new naverMaps.LatLng(parsed.lat, parsed.lng);
        }
      }

      return null;
    };

    multiPolygon.forEach((polygon) => {
      const paths = polygon
        .map((ring) =>
          ring
            .map((point) => {
              const latLng = toLatLng(point);
              if (!latLng) {
                return null;
              }
              regionBounds.extend(latLng);
              return latLng;
            })
            .filter((point): point is any => point !== null)
        )
        .filter((ring) => ring.length > 0);

      if (paths.length === 0) {
        return;
      }

      const boundaryPolygon = new naverMaps.Polygon({
        map: mapInstance,
        paths,
        strokeColor: "#0d9488",
        strokeWeight: 3,
        strokeOpacity: 0.95,
        fillColor: "#14b8a6",
        fillOpacity: 0.12,
      });

      boundaryPolygonRefs.current.push(boundaryPolygon);
    });

    if (boundaryPolygonRefs.current.length === 0) {
      return null;
    }

    return regionBounds;
  };

  const moveMapToBounds = (bounds: any, smooth: boolean) => {
    const mapInstance = mapInstanceRef.current;

    if (!mapInstance) {
      return;
    }

    if (!smooth) {
      mapInstance.fitBounds(bounds);
      return;
    }

    if (typeof mapInstance.panToBounds === "function") {
      mapInstance.panToBounds(bounds);
      return;
    }

    const center =
      typeof bounds?.getCenter === "function" ? bounds.getCenter() : null;

    if (center && typeof mapInstance.panTo === "function") {
      mapInstance.panTo(center, { duration: 450 });
      setTimeout(() => {
        if (mapInstanceRef.current === mapInstance) {
          mapInstance.fitBounds(bounds);
        }
      }, 220);
      return;
    }

    mapInstance.fitBounds(bounds);
  };

  const fitMapToSelectedRegion = (options?: { smooth?: boolean; fallbackBounds?: any }) => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const smooth = options?.smooth ?? false;
    const currentRegion =
      GANGWON_REGIONS.find((region) => region.sigunguCode === selectedSigunguCode) ??
      GANGWON_REGIONS[0];

    if (!mapInstance || !naverMaps) {
      return;
    }

    const regionBounds = drawSelectedRegionBoundary();
    if (regionBounds) {
      moveMapToBounds(regionBounds, smooth);
      return;
    }

    if (options?.fallbackBounds) {
      moveMapToBounds(options.fallbackBounds, smooth);
      return;
    }

    const center = new naverMaps.LatLng(currentRegion.center.lat, currentRegion.center.lng);
    if (smooth && typeof mapInstance.panTo === "function") {
      mapInstance.panTo(center, { duration: 450 });
      setTimeout(() => {
        if (mapInstanceRef.current === mapInstance) {
          mapInstance.setZoom(10);
        }
      }, 220);
      return;
    }

    mapInstance.setCenter(
      center
    );
    mapInstance.setZoom(10);
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
      clearBoundaryPolygons();
      if (handleResize) {
        window.removeEventListener("resize", handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      mapInstanceRef.current = null;
      naverMapsRef.current = null;
      closeSheet();
      window.navermap_authFailure = undefined;
      container.innerHTML = "";
    };
  }, [closeSheet]);

  useEffect(() => {
    if (!mapReady || !isBoundaryDataReady) {
      return;
    }

    fitMapToSelectedRegion();
  }, [isBoundaryDataReady, mapReady, selectedSigunguCode]);

  useEffect(() => {
    if (!mapReady) {
      return;
    }

    closeSheet();
    clearMarkers();
  }, [closeSheet, mapReady, selectedSigunguCode]);

  useEffect(() => {
    const mapInstance = mapInstanceRef.current;
    const naverMaps = naverMapsRef.current;
    const attractionData = attractionsQuery.data;

    if (!mapReady || !mapInstance || !naverMaps || !attractionData) {
      return;
    }

    const markerBounds = new naverMaps.LatLngBounds();

    attractionData.filteredAttractions.forEach((attraction) => {
      const position = new naverMaps.LatLng(attraction.lat, attraction.lng);
      markerBounds.extend(position);

      const markerType = resolveMarkerType(attraction, attractionData.lclsNameByCode);

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

        openSheet(
          {
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
            images: [],
          },
          { mode: "bottom-sheet" }
        );
      });

      markerListenerRefs.current.push(listener);
    });

    fitMapToSelectedRegion({
      smooth: true,
      fallbackBounds: attractionData.filteredAttractions.length > 0 ? markerBounds : null,
    });
  }, [attractionsQuery.data, mapReady, openSheet, selectedSigunguCode]);

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
        <button
          type="button"
          aria-label="담은 장소"
          onClick={() => {
            resetSheet();
            openSavedList();
          }}
          className="pointer-events-auto ml-2 inline-flex h-12 items-center gap-2 rounded-full border border-brand-500 bg-brand-600/95 px-3 text-xs font-semibold text-white shadow"
        >
          <IoBagHandleOutline className="text-sm" />
          <span>{isAttractionLoading ? "…" : savedPlaceIds.length}</span>
        </button>
      </div>

      <div className="scrollbar-hide pointer-events-auto absolute inset-x-0 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.4rem)] z-20 overflow-x-auto px-3 pb-1">
        <div className="flex w-max min-w-full gap-2 pr-3">
          {orderedRegions.map((region) => {
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

      <RouteCheckoutModal
        isOpen={isSavedListOpen}
        savedPlaces={savedPlaces}
        onClose={closeSavedList}
        onSelectPlace={(place) => {
          openSheet(place, { mode: "full-popup" });
        }}
        onRemovePlace={removeSavedPlace}
        onClearPlaces={clearSavedPlaces}
      />

      <PlaceBottomSheet />

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
