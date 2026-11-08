import type { AppLanguage } from "@/stores/appLanguageStore";

const copy = {
  ko: {
    brand: "두루", eyebrow: "가볍게 고르고, 두루 떠나요",
    title: "어디로 떠나볼까요?", description: "한국관광공사의 지역별 여행 코스를 둘러보세요.",
    regionTitle: "어디로 갈까요?", area: "시·도", region: "시·군·구 (선택)", allRegions: "전체 시·군·구",
    selectedDistrictCount: (count: number) => `${count}곳 선택`,
    map: "지도에서 직접 찾기", backHome: "홈으로",
    mapEntryTitle: "지도에서 장소 찾기", mapEntryDescription: "가볼 곳을 찾아봐요.",
    results: "추천 코스", resultDescription: "마음에 드는 코스를 펼쳐 장소를 살펴보세요.", editConditions: "조건 바꾸기",
    courseCount: (count: number) => `코스 ${count.toLocaleString("ko-KR")}개`,
    moreCourses: (count: number) => `코스 ${count}개 더 보기`,
    moreLoading: "다음 코스를 불러오고 있어요", moreError: "다음 코스를 불러오지 못했어요.",
    loading: "여행 코스를 불러오고 있어요", error: "코스를 불러오지 못했어요", retry: "다시 불러오기",
    errorDescription: "잠시 후 다시 시도하거나 지도에서 장소를 찾아보세요.",
    empty: "이 지역으로 확인된 여행 코스가 없어요", emptyDescription: "조회 범위를 바꾸거나 지도에서 직접 장소를 찾아보세요.",
    courseOpen: "코스 보기", courseClose: "코스 접기", placeDetails: "장소 상세 보기",
    startCourse: "이 코스로 시작",
    stopsLoading: "방문지를 불러오고 있어요", stopsError: "방문지를 불러오지 못했어요",
    stopsEmpty: "이 코스에 등록된 방문지가 없어요.",
    stopsIncomplete: "일정에 담으려면 모든 방문지의 위치 정보가 필요해요.",
    source: "여행 코스 정보 · 한국관광공사", mapRegion: "이 지역 지도 보기",
  },
  en: {
    brand: "Duru", eyebrow: "A little planning. A new discovery.",
    title: "Where shall we go?", description: "Choose a region and explore courses from the Korea Tourism Organization.",
    regionTitle: "Choose a destination", area: "Province / city", region: "Districts (optional)", allRegions: "All districts",
    selectedDistrictCount: (count: number) => `${count} districts selected`,
    map: "Explore the map", backHome: "Home",
    mapEntryTitle: "Find places on the map", mapEntryDescription: "Explore places to visit.",
    results: "Courses for you", resultDescription: "Open a course to explore its stops.", editConditions: "Change choices",
    courseCount: (count: number) => `${count.toLocaleString("en-US")} ${count === 1 ? "course" : "courses"}`,
    moreCourses: (count: number) => `Show ${count} more ${count === 1 ? "course" : "courses"}`,
    moreLoading: "Loading more courses", moreError: "We couldn’t load the next courses.",
    loading: "Loading travel courses", error: "We couldn’t load the courses", retry: "Try again",
    errorDescription: "Please try again, or find places on the map.",
    empty: "No travel courses match this region", emptyDescription: "Change your search area or find individual places on the map.",
    courseOpen: "View course", courseClose: "Close course", placeDetails: "View place details",
    startCourse: "Start with this course",
    stopsLoading: "Loading course stops", stopsError: "We couldn’t load the stops",
    stopsEmpty: "This course has no listed stops.",
    stopsIncomplete: "Every stop needs a location before you can add this course to your trip.",
    source: "Travel courses · Korea Tourism Organization", mapRegion: "See this area on the map",
  },
};

/** 홈 추천 화면의 문구만 현재 앱 언어로 반환한다. 장소명과 지역명 번역은 기존 표시 체계를 사용한다. */
export function getHomeRecommendationText(language: AppLanguage) {
  return copy[language];
}
export type HomeRecommendationText = ReturnType<typeof getHomeRecommendationText>;
