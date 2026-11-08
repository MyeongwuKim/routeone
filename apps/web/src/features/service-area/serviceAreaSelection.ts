import { notificationApi } from "@/api/notificationApi";
import { getServiceArea, type ServiceAreaId } from "@/data/serviceAreas";
import { getAuthToken } from "@/lib/authToken";
import { useHomeExploreStore } from "@/stores/homeExploreStore";
import { useMapSheetStore } from "@/stores/mapSheetStore";
import { useServiceAreaStore } from "@/stores/serviceAreaStore";

type RegionSelection = { areaId: ServiceAreaId; regionCode?: string };

function getSelection({ areaId, regionCode }: RegionSelection) {
  const area = getServiceArea(areaId);
  const region = regionCode === undefined ? area.defaultRegion
    : area.regions.find(candidate => candidate.sigunguCode === regionCode);
  if (!region) throw new Error("지원하지 않는 지역입니다.");
  return { area, region };
}

/** 지도·홈 필터·공유 루트의 탐색 지역만 바꾼다. 기본 지역과 축제 알림 설정은 저장하지 않는다. */
export function selectExploreRegion(areaId: ServiceAreaId, regionCode?: string) {
  const { area, region } = getSelection({ areaId, regionCode });
  useHomeExploreStore.getState().exploreRegion(area.id, region.sigunguCode);
  useMapSheetStore.getState().resetSheet();
}

/** 기본 지역 저장 요청을 순서대로 처리해 늦게 끝난 이전 요청이 마지막 선택을 덮어쓰지 않게 한다. */
let defaultRegionSaveQueue: Promise<void> = Promise.resolve();

/**
 * 설정에서 고른 기본 지역을 저장하고 켜진 축제 알림을 해당 시군구에 맞춘다.
 * 로그인 상태에서는 서버 반영에 성공한 뒤 기본 지역을 저장하며, 실패하면 기존 기본 지역을 유지한다.
 * 저장 도중 다른 지역을 둘러보기 시작했으면 기본 지역만 저장하고 새 탐색 위치는 유지한다.
 */
export function saveDefaultServiceRegion(input: RegionSelection) {
  const selection = getSelection(input);
  const authToken = getAuthToken();
  const request = defaultRegionSaveQueue.then(async () => {
    if (getAuthToken() !== authToken) throw new Error("로그인 상태가 변경됐습니다.");
    const { area, region } = selection;
    const previousDefault = useServiceAreaStore.getState();
    const previousExplore = useHomeExploreStore.getState();
    const hasDefaultChanged = previousDefault.selectedAreaId !== area.id ||
      previousDefault.selectedRegionCode !== region.sigunguCode;
    const result = hasDefaultChanged && authToken
      ? await notificationApi.syncFestivalRegionWithServiceArea(region.adminCode, authToken)
      : null;
    if (getAuthToken() !== authToken) throw new Error("로그인 상태가 변경됐습니다.");

    useServiceAreaStore.getState().setSelectedRegion(area.id, region.sigunguCode);
    const latestExplore = useHomeExploreStore.getState();
    if (latestExplore.regionSelectionVersion === previousExplore.regionSelectionVersion) {
      selectExploreRegion(area.id, region.sigunguCode);
    }
    return { ...selection, authToken, notificationSettings: result?.syncFestivalRegionWithServiceArea ?? null };
  });
  // 실패한 저장이 다음 지역 선택까지 막지 않도록 대기열은 성공·실패 모두에서 정리한다.
  defaultRegionSaveQueue = request.then(() => undefined, () => undefined);
  return request;
}
