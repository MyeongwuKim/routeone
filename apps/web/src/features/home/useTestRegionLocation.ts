/**
 * 용도:
 * 개발 앱 또는 운영 마스터 계정이 지역 필터를 선택하면 해당 지역 중심을
 * 앱 내부의 현재 위치로 적용하는 훅이다.
 *
 * 동작 방식:
 * 네이티브가 전달한 테스트 기능 허용 여부를 확인한 뒤 테스트 좌표를 저장하고,
 * 홈에서 공유하는 현재 위치 상태를 같은 좌표로 즉시 갱신한다.
 */
import { useCallback, useRef, useState } from "react";
import type { ServiceRegion } from "@/data/serviceAreas";
import { nativeBridge } from "@/native-bridge";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";

export function useTestRegionLocation() {
  const appLanguage = useAppLanguageStore((state) => state.language);
  const applyCurrentPosition = useCurrentPositionStore(
    (state) => state.applyPosition
  );
  const [isActive, setIsActive] = useState(false);
  const latestRequestIdRef = useRef(0);
  const isEnabled = nativeBridge.runtime.isTestAccountMode();

  const applyRegionPosition = useCallback(
    async (region: ServiceRegion) => {
      if (!nativeBridge.runtime.isTestAccountMode()) {
        return false;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      const request = nativeBridge.location.setTestPosition({
        position: region.center,
        language: appLanguage,
      });

      if (!request) {
        return false;
      }

      const result = await request;

      if (
        latestRequestIdRef.current !== requestId ||
        result.lat === null ||
        result.lng === null
      ) {
        return false;
      }

      applyCurrentPosition({
        lat: result.lat,
        lng: result.lng,
        accuracyMeters: 1,
        timestamp: Date.now(),
      });
      setIsActive(true);
      return true;
    },
    [appLanguage, applyCurrentPosition]
  );

  const clearRegionPosition = useCallback(async () => {
    if (!nativeBridge.runtime.isTestAccountMode() || !isActive) {
      return false;
    }

    latestRequestIdRef.current += 1;
    const request = nativeBridge.location.setTestPosition({
      position: null,
      language: appLanguage,
    });

    if (!request) {
      return false;
    }

    await request;
    setIsActive(false);
    return true;
  }, [appLanguage, isActive]);

  return {
    applyRegionPosition,
    clearRegionPosition,
    isActive,
    isEnabled,
  };
}
