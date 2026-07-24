import { getNativeBridgeApi } from "./runtime";

export function getNativeCurrentPosition() {
  const getCurrentPosition = getNativeBridgeApi()?.getCurrentPosition;

  return getCurrentPosition ? getCurrentPosition() : null;
}
