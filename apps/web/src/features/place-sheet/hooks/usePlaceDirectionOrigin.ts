/**
 * 장소 상세이 열릴 때 명시 출발지가 없으면 전역 현재 위치를 조회하고 길찾기 출발지를 계산한다.
 * 권한 거부는 별도 상태로 반환하고, 시트 resetVersion마다 위치 조회 완료 여부를 구분해 중복 로딩 표시를 막는다.
 */
import { useEffect, useState } from "react";
import { isNativeTestAccountMode } from "@/native-bridge/runtime";
import { useLocationPermissionDenied } from "@/native-bridge/useLocationPermissionDenied";
import type { UiText } from "@/lib/uiText";
import { useCurrentPositionStore } from "@/stores/currentPositionStore";
import type { MapSheetDirectionOrigin } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";
import { resolvePlaceDirectionOrigin } from "../utils/placeDirectionOrigin";

type Options = {

  isOpen: boolean;

  sheetResetVersion: number;

  directionOrigin: MapSheetDirectionOrigin | null;
  /** 명시한 directionOrigin이 없을 때 사용할 지역 기준 출발지 */
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
  /** 길찾기 도착 좌표와 테스트 위치 판단에 사용하는 현재 상세 장소 */
  selectedPlace: MapSheetPlace | null;

  text: UiText;
};

export function usePlaceDirectionOrigin({
  isOpen,
  sheetResetVersion,
  directionOrigin,
  fallbackDirectionOrigin,
  selectedPlace,
  text,
}: Options) {
  const locationPermissionDenied = useLocationPermissionDenied();
  const storedCurrentPosition = useCurrentPositionStore((state) => state.position);
  const currentPositionStatus = useCurrentPositionStore((state) => state.status);
  const requestCurrentPosition = useCurrentPositionStore(
    (state) => state.requestCurrentPosition
  );
  const [completedLocationLookupVersion, setCompletedLocationLookupVersion] =
    useState<number | null>(null);
  const { resolvedDirectionOrigin, explicitDirectionOrigin } =
    resolvePlaceDirectionOrigin({
      directionOrigin,
      fallbackDirectionOrigin,
      selectedPlace,
      storedCurrentPosition,
      useTestPosition: isNativeTestAccountMode(),
      text,
    });
  const currentLocation = resolvedDirectionOrigin.coordinates;
  const isLocationPermissionDenied =
    locationPermissionDenied && !explicitDirectionOrigin;
  const isCurrentLocationLookupPending =
    isOpen &&
    !isLocationPermissionDenied &&
    !explicitDirectionOrigin &&
    !storedCurrentPosition &&
    (currentPositionStatus === "loading" ||
      completedLocationLookupVersion !== sheetResetVersion);

  useEffect(() => {
    if (
      !isOpen ||
      isLocationPermissionDenied ||
      explicitDirectionOrigin ||
      storedCurrentPosition
    ) {
      return;
    }

    let isActive = true;

    void requestCurrentPosition()
      .catch(() => undefined)
      .finally(() => {
        if (isActive) {
          setCompletedLocationLookupVersion(sheetResetVersion);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    explicitDirectionOrigin,
    isOpen,
    isLocationPermissionDenied,
    requestCurrentPosition,
    sheetResetVersion,
    storedCurrentPosition,
  ]);

  return {
    currentLocation,
    resolvedDirectionOrigin,
    isCurrentLocationLookupPending,
    isLocationPermissionDenied,
  };
}
