import { getNativeBridgeApi } from "./runtime";

export function getNativeCurrentPosition(options?: {
  useRealPosition?: boolean;
}) {
  const getCurrentPosition = getNativeBridgeApi()?.getCurrentPosition;

  return getCurrentPosition ? getCurrentPosition(options) : null;
}
