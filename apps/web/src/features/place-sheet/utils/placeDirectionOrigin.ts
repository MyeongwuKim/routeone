/**
 * 용도:
 * 장소 상세에서 사용할 출발지를 현재 좌표, 지정 출발지, 지역 기준으로 결정한다.
 *
 * 동작 방식:
 * 실제 현재 위치는 공유 좌표만 사용하고 오래된 현재 위치 사본은 무시한다.
 * 사용할 좌표가 없으면 전달받은 기준 위치나 장소가 속한 지역 중심을 반환한다.
 */
import { GANGWON_CENTER } from "@/data/gangwonRegions";
import { SERVICE_AREAS } from "@/data/serviceAreas";
import type { UiText } from "@/lib/uiText";
import type { MapSheetDirectionOrigin } from "@/stores/mapSheetStore";
import type { MapSheetPlace } from "@/types/place";

type Options = {
  directionOrigin: MapSheetDirectionOrigin | null;
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
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
