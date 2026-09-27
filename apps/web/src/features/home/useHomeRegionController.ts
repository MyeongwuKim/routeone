import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ServiceArea } from "@/data/serviceAreas";
import type { GeoMultiPolygon } from "@/lib/gangwonBoundaryUtils";
import type { RouteOnePosition } from "@/lib/currentPosition";
import { useUiText } from "@/lib/uiText";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { isTestServiceAreaEnabled } from "@/stores/serviceAreaStore";
import { useUiToastStore } from "@/stores/uiToastStore";
import {
  isUsableHomeRegionPosition,
  resolveHomeRegionFromPosition,
} from "./homeCurrentRegion";

type UseHomeRegionControllerOptions = {
  /** 시군구 코드를 키로 갖는 경계 도형. 현재 좌표가 속한 서비스 지역을 판정할 때 사용한다. */
  boundaryBySigunguCode: Record<string, GeoMultiPolygon>;
  /** 위치 Store에서 읽은 현재 좌표. 최초 지역을 정하거나 현재 위치 재조회 전의 저장값으로 사용한다. */
  currentLocation: RouteOnePosition | null;
  /** 전달한 좌표로 지도 중심과 줌을 이동하도록 지도 Hook에 요청한다. */
  focusLocation: (position: RouteOnePosition) => void;
  /** 모든 서비스 지역의 경계 도형을 현재 위치 판정에 사용할 수 있는 상태인지 나타낸다. */
  isBoundaryDataReady: boolean;
  /** 위치 Store가 최초 현재 위치를 조회하고 있는지 나타낸다. */
  isCurrentLocationLookupPending: boolean;
  /** 지도 생성 실패 메시지. 오류가 있으면 최초 지역 로딩 화면을 계속 표시하지 않는다. */
  mapError: string | null;
  /** 지도 runtime이 좌표 이동 명령을 받을 수 있도록 준비됐는지 나타낸다. */
  mapReady: boolean;
  /** 저장 좌표를 반환하거나 forceRefresh가 true이면 위치 Store에 새 좌표 조회를 요청한다. */
  refreshCurrentLocation: (options?: {
    forceRefresh?: boolean;
  }) => Promise<RouteOnePosition | null>;
  /** 홈 탐색 Store에 저장된 현재 선택 시군구 코드. */
  selectedSigunguCode: string;
  /** 홈에서 탐색할 지역 목록, 기본 지역과 지도 중심 정보를 포함하는 현재 서비스 권역. */
  serviceArea: ServiceArea;
};

/**
 * 홈 지도에서 사용할 최초 지역과 현재 선택 지역의 표시값을 결정하고,
 * 현재 위치 버튼을 눌렀을 때 좌표가 속한 지역 선택과 지도 중심 이동을 순서대로 연결한다.
 *
 * 지역 선택 상태와 최초 지역 확정 상태는 홈 탐색 Store에 맡기며, 이 Hook은 별도로 복사해 저장하지 않는다.
 * 지도 생성과 실제 좌표 이동도 직접 처리하지 않고 useHomeMap에서 받은 focusLocation에 위임한다.
 */
export function useHomeRegionController({
  boundaryBySigunguCode,
  currentLocation,
  focusLocation,
  isBoundaryDataReady,
  isCurrentLocationLookupPending,
  mapError,
  mapReady,
  refreshCurrentLocation,
  selectedSigunguCode,
  serviceArea,
}: UseHomeRegionControllerOptions) {
  const text = useUiText();
  const showToast = useUiToastStore((state) => state.showToast);
  const isInitialRegionResolved = useHomeExploreStore(
    (state) => state.isInitialRegionResolved
  );
  const resolveInitialRegion = useHomeExploreStore(
    (state) => state.resolveInitialRegion
  );
  const selectRegion = useHomeExploreStore((state) => state.selectRegion);
  const developmentFixedRegion = isTestServiceAreaEnabled()
    ? serviceArea.developmentFixedRegion
    : undefined;
  /**
   * 현재 위치 버튼으로 새로 얻은 좌표 중 지도 이동을 기다리는 값이다.
   * 해당 좌표의 지역이 selectedSigunguCode에 반영되고 지도가 준비된 뒤 이동하며, 이동 요청 후 null로 초기화한다.
   * 화면 표시에 사용하는 값이 아니므로 재렌더링을 발생시키지 않는 ref에 보관한다.
   */
  const pendingCurrentLocationFocusRef =
    useRef<RouteOnePosition | null>(null);

  /**
   * 홈 진입 시 최초 지역이 아직 확정되지 않았으면 한 번 결정한다.
   * 개발 고정 지역이 있으면 즉시 사용하고, 없으면 위치 조회와 경계 데이터 준비를 기다린 뒤
   * 현재 좌표가 속한 지역 또는 가장 가까운 지역을 선택한다. 사용할 좌표가 없으면 서비스 권역의 기본 지역을 사용한다.
   */
  useEffect(() => {
    if (
      (!developmentFixedRegion &&
        (isCurrentLocationLookupPending || !isBoundaryDataReady)) ||
      isInitialRegionResolved
    ) {
      return;
    }

    const initialRegion =
      developmentFixedRegion ??
      (currentLocation
        ? resolveHomeRegionFromPosition(
            currentLocation,
            serviceArea,
            boundaryBySigunguCode
          ) ?? serviceArea.defaultRegion
        : serviceArea.defaultRegion);

    resolveInitialRegion(initialRegion.sigunguCode);
  }, [
    boundaryBySigunguCode,
    currentLocation,
    developmentFixedRegion,
    isBoundaryDataReady,
    isCurrentLocationLookupPending,
    isInitialRegionResolved,
    resolveInitialRegion,
    serviceArea,
  ]);

  const orderedRegions = useMemo(
    () =>
      [...serviceArea.regions].sort((left, right) =>
        left.label.localeCompare(right.label, "ko-KR")
      ),
    [serviceArea.regions]
  );
  /** 선택 코드와 일치하는 지역. 코드가 현재 서비스 권역에 없으면 기본 지역을 사용한다. */
  const selectedRegion =
    serviceArea.regions.find(
      (region) => region.sigunguCode === selectedSigunguCode
    ) ?? serviceArea.defaultRegion;
  /** 현재 언어의 지역명 번역값. 번역값이 없으면 서비스 지역에 정의된 원래 이름을 사용한다. */
  const selectedRegionLabel =
    text.labels.regions[selectedRegion.label] ?? selectedRegion.label;

  /**
   * 현재 위치 버튼을 누를 때 저장값을 재사용하지 않고 위치를 새로 조회한다.
   * 유효한 좌표를 얻으면 좌표가 포함된 지역 또는 가장 가까운 서비스 지역을 선택하고,
   * 선택 지역이 Store에 반영된 뒤 지도를 이동할 수 있도록 좌표를 pendingCurrentLocationFocus에 보관한다.
   * 조회 실패, 범위를 벗어난 좌표 또는 지역 판정 실패 시 안내 토스트만 표시하고 선택 지역과 지도는 변경하지 않는다.
   */
  const focusCurrentLocation = useCallback(() => {
    const focus = async () => {
      const nextLocation = await refreshCurrentLocation({
        forceRefresh: true,
      });
      if (!nextLocation || !isUsableHomeRegionPosition(nextLocation)) {
        showToast(text.home.currentLocationUnavailable);
        return;
      }

      const nextRegion = resolveHomeRegionFromPosition(
        nextLocation,
        serviceArea,
        boundaryBySigunguCode
      );
      if (!nextRegion) {
        showToast(text.home.currentLocationUnavailable);
        return;
      }

      pendingCurrentLocationFocusRef.current = nextLocation;
      selectRegion(nextRegion.sigunguCode);
    };

    void focus();
  }, [
    boundaryBySigunguCode,
    refreshCurrentLocation,
    selectRegion,
    serviceArea,
    showToast,
    text,
  ]);

  /**
   * 현재 위치로 계산한 지역 선택이 반영되고 지도 runtime도 준비되면 보관한 좌표로 지도를 이동한다.
   * 선택 지역이 아직 다르면 다음 상태 변경을 기다리며, 이동을 요청한 좌표는 다시 실행되지 않도록 비운다.
   */
  useEffect(() => {
    const pendingCurrentLocationFocus =
      pendingCurrentLocationFocusRef.current;
    if (!mapReady || !pendingCurrentLocationFocus) {
      return;
    }

    const focusedRegion = resolveHomeRegionFromPosition(
      pendingCurrentLocationFocus,
      serviceArea,
      boundaryBySigunguCode
    );
    if (focusedRegion?.sigunguCode !== selectedSigunguCode) {
      return;
    }

    focusLocation(pendingCurrentLocationFocus);
    pendingCurrentLocationFocusRef.current = null;
  }, [
    boundaryBySigunguCode,
    focusLocation,
    mapReady,
    selectedSigunguCode,
    serviceArea,
  ]);

  return {
    focusCurrentLocation,
    /** 지역 선택 메뉴에 표시할 서비스 지역 목록. 원본 배열을 변경하지 않고 한국어 이름순으로 정렬한다. */
    orderedRegions,
    selectedRegion,
    selectedRegionLabel,
    /** 개발 고정 지역이 없고 최초 지역이 미확정이며 지도 오류도 없을 때 초기 지역 로딩 단계로 처리한다. */
    shouldShowInitialRegionLoader:
      !developmentFixedRegion && !isInitialRegionResolved && !mapError,
    /** 최초 지역이 확정된 뒤 지역·검색·저장 장소 조작 UI와 DAY 추가 배너를 표시한다. */
    shouldShowInteractiveMapUi: isInitialRegionResolved,
    /** 최초 지역이 확정되기 전 지도 조작 영역 대신 뼈대 화면을 표시한다. */
    shouldShowMapSetupSkeleton: !isInitialRegionResolved,
  };
}
