/**
 * 용도:
 * 장소 상세의 출발지를 전역 현재 위치에 맞추고 위치 조회 상태를 제공한다.
 *
 * 동작 방식:
 * 현재 위치는 열 때 복사된 좌표 대신 공유 저장소를 구독한다.
 * 좌표가 사라지면 지역 기준 위치로 전환하고, 명시한 출발지와 테스트 위치는 유지한다.
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
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
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
