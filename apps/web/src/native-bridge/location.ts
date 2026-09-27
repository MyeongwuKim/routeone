
import { getNativeBridgeApi } from "./runtime";

type NativeTestPositionOptions = {
  /** 테스트 위치로 적용할 좌표. null이면 설정된 테스트 위치를 해제한다. */
  position: { lat: number; lng: number } | null;
  /** 네이티브 테스트 안내에 사용할 표시 언어 */
  language?: "ko" | "en";
};

/**
 * 네이티브 위치 API에 현재 좌표를 요청한다. forceRefresh는 네이티브 캐시 재사용 여부를,
 * useRealPosition은 테스트 계정에서도 실제 GPS를 사용할지를 전달하며 미지원 환경에서는 null을 반환한다.
 */
export function getNativeCurrentPosition(options?: {
  useRealPosition?: boolean;
  forceRefresh?: boolean;
}) {
  const getCurrentPosition = getNativeBridgeApi()?.getCurrentPosition;

  return getCurrentPosition ? getCurrentPosition(options) : null;
}

/** 테스트 계정의 도착 알림 위치를 설정하거나 position이 null이면 해제한다. 미지원 환경에서는 null을 반환한다. */
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
