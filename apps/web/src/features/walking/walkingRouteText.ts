import type { AppLanguage } from "@/stores/appLanguageStore";
import type { WalkingErrorCode } from "./walkingTypes";

const walkingText = {
  ko: {
    title: "도보 길찾기", driving: "자동차", walking: "도보",
    coverage: "강릉 시내·경포·안목 일대에서 먼저 이용할 수 있어요.",
    start: "출발지", chooseStart: "출발지 선택", changeOrigin: "출발지 변경",
    selectedOnMap: "지도에서 선택한 위치", backToDetails: "장소 정보로",
    openNaver: "네이버 지도에서 열기",
    estimate: "일반 길은 시속 4km, 계단은 시속 2km로 계산한 예상 시간이에요. 신호 대기·경사·현재 통행 상황은 반영하지 않아요.",
    routeBasis: "보행로 기준", source: "도보 데이터: © OpenStreetMap contributors · ODbL",
    accessNotice: (meters: number) => `지도에서 고른 지점과 보행로 사이 약 ${meters}m는 연결 확인이 필요해 거리·시간에서 제외했어요.`,
    dataDate: (date: string) => `보행로 데이터 ${date} 기준`,
    fromCurrentLocation: (duration: string) => `현재 위치에서 도보 ${duration}`,
    fromReferenceLocation: (label: string, duration: string) => `${label} 기준 참고 경로 · 도보 ${duration}`,
    fromSelectedLocation: (label: string, duration: string) => `${label} 출발 · 도보 ${duration}`,
    drivingFromSelectedLocation: (label: string, duration: string) => `${label} 출발 · 차로 ${duration}`,
    errors: {
      INVALID_INPUT: "출발지와 도착지를 다시 선택해 주세요.",
      OUTSIDE_COVERAGE: "아직 이 지역의 보행로 데이터가 없어요. 강릉 시내·경포·안목 안에서 두 지점을 골라 주세요.",
      NO_NEARBY_PATH: "선택한 지점에서 가까운 보행로를 찾지 못했어요. 건물 안이나 물 위 대신 길에 가까운 지점을 골라 주세요.",
      NO_ROUTE: "두 지점을 잇는 보행로를 찾지 못했어요. 연결되지 않은 길을 직선으로 이어 표시하지 않아요.",
      DATA_UNAVAILABLE: "보행로 데이터를 불러오지 못했어요. 잠시 후 다시 계산해 주세요.",
      SEARCH_LIMIT: "경로가 너무 복잡해 계산을 마치지 못했어요. 가까운 지점으로 다시 선택해 주세요.",
    } satisfies Record<WalkingErrorCode, string>,
  },
  en: {
    title: "Walking directions", driving: "Driving", walking: "Walking",
    coverage: "Available first in central Gangneung, Gyeongpo and Anmok.",
    start: "Start", chooseStart: "Choose start", changeOrigin: "Change start",
    selectedOnMap: "Selected on the map", backToDetails: "Place details",
    openNaver: "Open in Naver Maps",
    estimate: "Estimated at 4 km/h on regular paths and 2 km/h on steps. Signals, slopes and current access conditions are not included.",
    routeBasis: "Mapped paths only", source: "Walking data: © OpenStreetMap contributors · ODbL",
    accessNotice: (meters: number) => `About ${meters}m between your points and the mapped paths needs checking and is excluded from the distance and time.`,
    dataDate: (date: string) => `Walking data as of ${date}`,
    fromCurrentLocation: (duration: string) => `Walk ${duration} from your location`,
    fromReferenceLocation: (label: string, duration: string) => `Estimated walk from ${label}: ${duration}`,
    fromSelectedLocation: (label: string, duration: string) => `Walk ${duration} from ${label}`,
    drivingFromSelectedLocation: (label: string, duration: string) => `Drive ${duration} from ${label}`,
    errors: {
      INVALID_INPUT: "Choose a valid start and destination.",
      OUTSIDE_COVERAGE: "Walking data is not available here yet. Choose both points within central Gangneung, Gyeongpo or Anmok.",
      NO_NEARBY_PATH: "No mapped walking path nearby. Choose a point closer to a path, outside buildings or water.",
      NO_ROUTE: "No connected walking route was found. Missing paths are not replaced with straight lines.",
      DATA_UNAVAILABLE: "Could not load walking data. Try again shortly.",
      SEARCH_LIMIT: "This route is too complex. Try points closer together.",
    } satisfies Record<WalkingErrorCode, string>,
  },
};

/** 도보 표시와 데이터·경로 오류 안내를 앱의 한국어/영어 설정에 맞춘다. */
export function getWalkingRouteText(language: AppLanguage) {
  return walkingText[language];
}

/** 짧은 도보 거리는 m, 1km부터는 소수점 한 자리 km로 표시한다. */
export function formatWalkingDistance(distanceM: number) {
  return distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`;
}
