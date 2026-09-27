/**
 * 장소 상세 길찾기 출발지를 명시 출발지, 전역 현재 위치, 테스트 위치, 지역 기준 위치 순으로 결정한다.
 * 현재 위치로 표시된 directionOrigin의 복사 좌표는 재사용하지 않으며 입력 Store나 장소 객체는 변경하지 않는다.
 */
import { GANGWON_CENTER } from "@/data/gangwonRegions";
import { SERVICE_AREAS } from "@/data/serviceAreas";
import type { UiText } from "@/lib/uiText";
import type { MapSheetDirectionOrigin } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";

type Options = {

  directionOrigin: MapSheetDirectionOrigin | null;
  /** 명시 출발지와 저장된 현재 위치가 없을 때 사용할 지역 기준 출발지 */
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
  /** 테스트 계정 위치를 만들 때 좌표 기준으로 사용할 상세 장소 */
  selectedPlace: MapSheetPlace | null;

  storedCurrentPosition: { lat: number; lng: number } | null;

  useTestPosition: boolean;

  text: UiText;
};

export function resolvePlaceDirectionOrigin({
  directionOrigin,
  fallbackDirectionOrigin,
  selectedPlace,
  storedCurrentPosition,
  useTestPosition,
  text,
}: Options) {
  const fallbackDirectionArea = selectedPlace
    ? Object.values(SERVICE_AREAS).find(
        (area) => area.tatsAreaCode === selectedPlace.areaCode
      )
    : null;
  const fallbackDirectionRegion = selectedPlace
    ? fallbackDirectionArea?.regions.find(
        (region) =>
          region.sigunguCode === selectedPlace.signguCode ||
          region.adminCode === selectedPlace.signguCode
      ) ??
      fallbackDirectionArea?.regions.find((region) =>
        selectedPlace.address.includes(region.label)
      )
    : null;
  const fallbackDirectionLabel = fallbackDirectionRegion
    ? text.placeSheet.referenceLocation(
        text.labels.regions[fallbackDirectionRegion.label] ??
          fallbackDirectionRegion.label
      )
    : fallbackDirectionArea
      ? text.placeSheet.referenceLocation(
          text.labels.regions[fallbackDirectionArea.label] ??
            fallbackDirectionArea.label
        )
      : text.placeSheet.gangwonReferenceLocation;
  const explicitDirectionOrigin =
    directionOrigin && (!directionOrigin.isCurrentLocation || useTestPosition)
      ? directionOrigin
      : null;
  const resolvedDirectionOrigin =
    explicitDirectionOrigin ??
    (storedCurrentPosition
      ? {
          coordinates: storedCurrentPosition,
          label: text.placeSheet.currentLocation,
          isCurrentLocation: true,
        }
      : {
          coordinates:
            fallbackDirectionOrigin?.coordinates ??
            fallbackDirectionRegion?.center ??
            fallbackDirectionArea?.center ??
            GANGWON_CENTER,
          label: fallbackDirectionOrigin?.label ?? fallbackDirectionLabel,
          isCurrentLocation: false,
        });
  return { resolvedDirectionOrigin, explicitDirectionOrigin };
}
