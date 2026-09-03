/**
 * 용도:
 * 개발 앱 또는 운영 마스터 계정이 지역 필터를 선택하면 해당 지역 중심을
 * 앱 내부의 현재 위치로 적용하는 훅이다.
 *
 * 동작 방식:
 * 허용된 계정이 지역을 선택하면 홈 길찾기 기준 좌표를 먼저 바꾸고,
 * 네이티브 테스트 위치 등록이 확인되면 공유 현재 위치에도 반영한다.
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
  const [activePosition, setActivePosition] = useState<
    ServiceRegion["center"] | null
  >(null);
  const latestRequestIdRef = useRef(0);
  const isEnabled = nativeBridge.runtime.isTestAccountMode();

  const applyRegionPosition = useCallback(
    async (region: ServiceRegion) => {
      if (!nativeBridge.runtime.isTestAccountMode()) {
        return false;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      setActivePosition(region.center);
      const request = nativeBridge.location.setTestPosition({
        position: region.center,
        language: appLanguage,
      });

      if (!request) {
        if (latestRequestIdRef.current === requestId) {
          setActivePosition(null);
        }
        return false;
      }

      let result: Awaited<typeof request>;

      try {
        result = await request;
      } catch (error) {
        if (latestRequestIdRef.current === requestId) {
          setActivePosition(null);
        }
        throw error;
      }

      if (
        latestRequestIdRef.current !== requestId ||
        result.lat === null ||
        result.lng === null
      ) {
        if (latestRequestIdRef.current === requestId) {
          setActivePosition(null);
        }
        return false;
      }

      setActivePosition({ lat: result.lat, lng: result.lng });
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
    if (
      !nativeBridge.runtime.isTestAccountMode() ||
      (!isActive && !activePosition)
    ) {
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
    setActivePosition(null);
    setIsActive(false);
    return true;
  }, [activePosition, appLanguage, isActive]);

  return {
    activePosition,
    applyRegionPosition,
    clearRegionPosition,
    isActive,
    isEnabled,
  };
}
