import type { AppLanguage } from "@/stores/appLanguageStore";

const copy = {
  ko: {
    brand: "마실",
    title: "어디로 떠나볼까요?", description: "한국관광공사 추천 코스를 둘러보세요.",
    regionTitle: "어디로 갈까요?", area: "시·도", region: "시·군·구 (선택)", allRegions: "전체 시·군·구",
    selectedDistrictCount: (count: number) => `${count}곳 선택`,
    map: "지도에서 직접 찾기", backHome: "홈으로",
    mapEntryTitle: "지도에서 장소 찾기", mapEntryDescription: "가볼 곳을 찾아요.",
    results: "추천 코스", resultDescription: "코스의 소개와 방문지를 살펴보세요.", backToTop: "맨 위로",
    courseCount: (count: number, hasMore: boolean) => `${hasMore ? "확인된 " : ""}코스 ${count.toLocaleString("ko-KR")}개`,
    moreCourses: "코스 더 보기",
    moreLoading: "불러오는 중…", moreRetry: "다시 시도", moreError: "다음 코스를 불러오지 못했어요.",
    loading: "여행 코스를 불러오고 있어요", error: "코스를 불러오지 못했어요", retry: "다시 불러오기",
    errorDescription: "다시 시도하거나 지도를 열어 주세요.",
    empty: "이 지역에 확인된 코스가 없어요", emptyDescription: "지역을 바꾸거나 지도를 열어 주세요.",
    courseOpen: "코스 보기", courseOverview: "코스 소개", courseItinerary: "방문 순서", placeDetails: "장소 상세 보기",
    courseStopCount: (count: number) => `방문지 ${count}곳`,
    placeUnavailable: "장소 정보 안내",
    placeUnavailableDescription: "추천 코스에 포함된 방문지예요. 이 장소의 상세 정보나 지도 위치를 확인하지 못했어요.",
    startCourse: "이 코스로 시작",
    stopsLoading: "방문지를 불러오고 있어요", stopsError: "방문지를 불러오지 못했어요",
    stopsEmpty: "이 코스에 등록된 방문지가 없어요.",
    stopsIncomplete: "일정에 담으려면 모든 방문지의 위치 정보가 필요해요.",
    source: "여행 코스 정보 · 한국관광공사", mapRegion: "이 지역 지도 보기",
    courseDistance: "총거리", courseDuration: "소요시간", courseTheme: "테마",
  },
  en: {
    brand: "Masil",
    title: "Where shall we go?", description: "Explore Korea Tourism Organization courses.",
    regionTitle: "Choose a destination", area: "Province / city", region: "Districts (optional)", allRegions: "All districts",
    selectedDistrictCount: (count: number) => `${count} districts selected`,
    map: "Explore the map", backHome: "Home",
    mapEntryTitle: "Find places on the map", mapEntryDescription: "Explore places to visit.",
    results: "Courses for you", resultDescription: "View each course’s introduction and stops.", backToTop: "Back to top",
    courseCount: (count: number, hasMore: boolean) => `${count.toLocaleString("en-US")} ${count === 1 ? "course" : "courses"}${hasMore ? " verified" : ""}`,
    moreCourses: "Show more courses",
    moreLoading: "Loading…", moreRetry: "Try again", moreError: "We couldn’t load the next courses.",
    loading: "Loading travel courses", error: "We couldn’t load the courses", retry: "Try again",
    errorDescription: "Please try again, or find places on the map.",
    empty: "No courses found in this region", emptyDescription: "Choose another region or explore the map.",
    courseOpen: "View course", courseOverview: "About this course", courseItinerary: "Itinerary", placeDetails: "View place details",
    courseStopCount: (count: number) => `${count} ${count === 1 ? "stop" : "stops"}`,
    placeUnavailable: "About missing place information",
    placeUnavailableDescription: "This stop is listed in the recommended course. We couldn’t verify its place details or map location.",
    startCourse: "Start with this course",
    stopsLoading: "Loading course stops", stopsError: "We couldn’t load the stops",
    stopsEmpty: "This course has no listed stops.",
    stopsIncomplete: "Every stop needs a location before you can add this course to your trip.",
    source: "Travel courses · Korea Tourism Organization", mapRegion: "See this area on the map",
    courseDistance: "Total distance", courseDuration: "Duration", courseTheme: "Theme",
  },
};

/** 홈 추천 화면의 문구만 현재 앱 언어로 반환한다. 장소명과 지역명 번역은 기존 표시 체계를 사용한다. */
export function getHomeRecommendationText(language: AppLanguage) {
  return copy[language];
}
export type HomeRecommendationText = ReturnType<typeof getHomeRecommendationText>;
