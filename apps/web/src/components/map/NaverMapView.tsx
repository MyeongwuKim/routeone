import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { enableNaverMapPointerInteractions } from "@/lib/naverMapInteractions";
import { loadNaverMapSdk } from "@/lib/naverMapSdk";
import {
  applyNaverMapTheme,
  getNaverMapThemeOptions,
} from "@/lib/naverMapTheme";
import { useUiText } from "@/lib/uiText";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useUiThemeStore } from "@/stores/uiThemeStore";

export type NaverMapPoint = {
  lat: number;
  lng: number;
};

export type NaverMapInstance = {
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  panTo?: (position: unknown) => void;
  setCenter?: (position: unknown) => void;
  fitBounds?: (bounds: unknown, options?: unknown) => void;
};

export type NaverMarkerInstance = {
  setPosition?: (position: unknown) => void;
  setMap: (map: null) => void;
};

export type NaverMapReadyContext = {
  map: NaverMapInstance;
  naverMaps: NonNullable<Window["naver"]>["maps"];
  center: unknown;
  container: HTMLDivElement;
};

type NaverMapControls = {
  zoom: boolean;
  scale: boolean;
  mapData: boolean;
  logo: boolean;
};

type NaverMapInteractions = {
  draggable: boolean;
  pinchZoom: boolean;
  scrollWheel: boolean;
};

type NaverMapViewProps = {
  center: NaverMapPoint;
  zoom?: number;
  minZoom?: number;
  className?: string;
  mapClassName?: string;
  loadingLabel?: string;
  controls?: Partial<NaverMapControls>;
  interactions?: Partial<NaverMapInteractions>;
  mapOptions?: Record<string, unknown>;
  resetKey?: string | number;
  children?: ReactNode;
  onReady?: (context: NaverMapReadyContext) => void | (() => void);
};

const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;

const DEFAULT_CONTROLS: NaverMapControls = {
  zoom: false,
  scale: false,
  mapData: false,
  logo: false,
};

const DEFAULT_INTERACTIONS: NaverMapInteractions = {
  draggable: true,
  pinchZoom: true,
  scrollWheel: true,
};

function getControlOptions(controls?: Partial<NaverMapControls>) {
  const nextControls = {
    ...DEFAULT_CONTROLS,
    ...controls,
  };

  return {
    zoomControl: nextControls.zoom,
    scaleControl: nextControls.scale,
    mapDataControl: nextControls.mapData,
    logoControl: nextControls.logo,
  };
}

function getInteractionOptions(interactions?: Partial<NaverMapInteractions>) {
  return {
    ...DEFAULT_INTERACTIONS,
    ...interactions,
  };
}

function NaverMapView({
  center,
  zoom = 12,
  minZoom = 7,
  className = "relative bg-brand-50",
  mapClassName = "naver-map-root h-full w-full",
  loadingLabel,
  controls,
  interactions,
  mapOptions,
  resetKey,
  children,
  onReady,
}: NaverMapViewProps) {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const text = useUiText();
  const isDarkMode = useUiThemeStore((state) => state.mode === "dark");
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const readyHandlerRef = useRef(onReady);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [canInitializeMap, setCanInitializeMap] = useState(false);
  const [mapContainerSize, setMapContainerSize] = useState({
    width: 0,
    height: 0,
  });
  const controlOptions = useMemo(() => getControlOptions(controls), [controls]);
  const interactionOptions = useMemo(
    () => getInteractionOptions(interactions),
    [interactions]
  );

  useEffect(() => {
    readyHandlerRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setCanInitializeMap(true);
    }, 180);

    return () => {
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    const node = mapNodeRef.current;

    if (!node) {
      return;
    }

    let frameId = 0;
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setMapContainerSize({
        width: rect.width,
        height: rect.height,
      });
    };
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateSize);
    });

    frameId = window.requestAnimationFrame(updateSize);
    observer.observe(node);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const mapNode = mapNodeRef.current;

    if (!mapNode) {
      return;
    }

    if (
      !canInitializeMap ||
      mapContainerSize.width < 40 ||
      mapContainerSize.height < 40
    ) {
      return;
    }

    let cancelled = false;
    let readyCleanup: void | (() => void);
    const resetFrameId = window.requestAnimationFrame(() => {
      if (!cancelled) {
        setMapError(null);
        setIsMapReady(false);
      }
    });

    mapInstanceRef.current = null;
    mapNode.innerHTML = "";

    async function setupMap(container: HTMLDivElement) {
      try {
        await loadNaverMapSdk(NCP_KEY_ID, appLanguage);

        if (cancelled || !window.naver?.maps) {
          return;
        }

        const naverMaps = window.naver.maps;
        const mapCenter = new naverMaps.LatLng(center.lat, center.lng);
        const map = new naverMaps.Map(container, {
          center: mapCenter,
          zoom,
          minZoom,
          mapTypeId: naverMaps.MapTypeId.NORMAL,
          ...controlOptions,
          ...interactionOptions,
          ...getNaverMapThemeOptions(isDarkMode),
          ...mapOptions,
        });

        mapInstanceRef.current = map;
        applyNaverMapTheme(map, isDarkMode);
        enableNaverMapPointerInteractions(map);
        readyCleanup = readyHandlerRef.current?.({
          map,
          naverMaps,
          center: mapCenter,
          container,
        });

        requestAnimationFrame(() => {
          if (!cancelled) {
            naverMaps.Event.trigger(map, "resize");
            setIsMapReady(true);
          }
        });
      } catch (error) {
        if (!cancelled) {
          setMapError(
            error instanceof Error
              ? error.message
              : "지도를 불러오지 못했어요."
          );
        }
      }
    }

    void setupMap(mapNode);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(resetFrameId);
      readyCleanup?.();
      mapInstanceRef.current = null;
      mapNode.innerHTML = "";
    };
  }, [
    appLanguage,
    canInitializeMap,
    center.lat,
    center.lng,
    controlOptions,
    interactionOptions,
    isDarkMode,
    mapContainerSize.height,
    mapContainerSize.width,
    mapOptions,
    minZoom,
    resetKey,
    zoom,
  ]);

  useEffect(() => {
    applyNaverMapTheme(mapInstanceRef.current, isDarkMode);
  }, [isDarkMode]);

  return (
    <div className={className}>
      <div ref={mapNodeRef} className={mapClassName} />

      {mapError ? (
        <div className="absolute inset-x-4 top-4 rounded-2xl border border-rose-100 bg-white px-4 py-3 text-sm font-bold text-rose-600 shadow-sm">
          {mapError}
        </div>
      ) : null}

      {!mapError && !isMapReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-50">
          <div className="flex items-center gap-2 rounded-2xl border border-brand-100 bg-white px-4 py-3 text-xs font-bold text-brand-700 shadow-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
            {loadingLabel ?? text.dayRoute.mapPreparing}
          </div>
        </div>
      ) : null}

      {children}
    </div>
  );
}

export default NaverMapView;
