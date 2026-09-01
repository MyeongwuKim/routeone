export type HomeMapInstance = {
  fitBounds: (bounds: unknown) => void;
  getZoom: () => number;
  panTo?: (position: unknown, options?: { duration: number }) => void;
  setCenter: (position: unknown) => void;
  setOptions?: (
    optionsOrKey: Record<string, unknown> | string,
    value?: unknown
  ) => void;
  setZoom: (zoom: number) => void;
};

export type HomeMapOverlay = {
  setMap: (map: null) => void;
};

export type HomeNaverMaps = NonNullable<Window["naver"]>["maps"];

export type HomeMapBounds = {
  extend: (position: unknown) => void;
};

export type HomeMapRuntime = {
  map: HomeMapInstance;
  naverMaps: HomeNaverMaps;
  sessionKey: string;
};
