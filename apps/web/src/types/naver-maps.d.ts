type NaverMapInstance = {
  fitBounds: (bounds: unknown, options?: unknown) => void;
  getZoom?: () => number;
  panTo?: (position: unknown, options?: unknown) => void;
  panToBounds?: (bounds: unknown) => void;
  setCenter?: (position: unknown) => void;
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  setZoom?: (zoom: number) => void;
};

type NaverMapOverlay = {
  getPosition?: () => unknown;
  setMap: (map: null) => void;
  setPosition?: (position: unknown) => void;
};

type NaverMapBounds = {
  extend: (position: unknown) => void;
  getCenter?: () => unknown;
};

type NaverMapsApi = {
  Event: {
    addListener: <TArgs extends unknown[]>(
      target: unknown,
      eventName: string,
      listener: (...args: TArgs) => void
    ) => unknown;
    once: <TArgs extends unknown[]>(
      target: unknown,
      eventName: string,
      listener: (...args: TArgs) => void
    ) => unknown;
    removeListener: (listener: unknown) => void;
    trigger: (target: unknown, eventName: string) => void;
  };
  LatLng: new (lat: number, lng: number) => object;
  LatLngBounds: new (
    southWest?: unknown,
    northEast?: unknown
  ) => NaverMapBounds;
  Map: new (
    container: HTMLElement,
    options: Record<string, unknown>
  ) => NaverMapInstance;
  MapTypeId: {
    NORMAL: unknown;
  };
  jsContentLoaded?: boolean;
  Marker: new (options: Record<string, unknown>) => NaverMapOverlay;
  onJSContentLoaded?: () => void;
  Point: new (x: number, y: number) => object;
  Polygon: new (options: Record<string, unknown>) => NaverMapOverlay;
  Polyline: new (options: Record<string, unknown>) => NaverMapOverlay;
  TransCoord?: {
    fromNaverToLatLng?: (point: object) => unknown;
    fromTM128ToLatLng?: (point: object) => unknown;
    fromUTMKToLatLng?: (point: object) => unknown;
  };
};

declare global {
  interface Window {
    navermap_authFailure?: () => void;
    naver?: {
      maps: NaverMapsApi;
    };
  }
}

export {};
