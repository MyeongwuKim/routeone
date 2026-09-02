import { getNativeBridgeApi } from "./runtime";

type NativeTestPositionOptions = {
  position: { lat: number; lng: number } | null;
  language?: "ko" | "en";
};

export function getNativeCurrentPosition(options?: {
  useRealPosition?: boolean;
  forceRefresh?: boolean;
}) {
  const getCurrentPosition = getNativeBridgeApi()?.getCurrentPosition;

  return getCurrentPosition ? getCurrentPosition(options) : null;
}

export function setNativeTestPosition({
  position,
  language,
}: NativeTestPositionOptions) {
  const setTestPosition =
    getNativeBridgeApi()?.setRouteArrivalTestLocation;

  return setTestPosition
    ? setTestPosition({ place: null, position, language })
    : null;
}
