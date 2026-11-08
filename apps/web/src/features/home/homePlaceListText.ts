import type { AppLanguage } from "@/stores/appLanguageStore";

const copy = {
  ko: {
    list: "장소 목록",
    title: (region: string) => `${region} 장소`,
    count: (count: number) => `${count}곳`,
    collapse: "목록 접기",
    expand: "목록 펼치기",
    add: "담기",
    added: "담음",
    toggle: (title: string) => `${title} 담기`,
    details: (title: string) => `${title} 상세 정보`,
    selected: (count: number) => `${count}곳 담음`,
    checkout: "코스 만들기",
    loading: "장소를 불러오고 있어요",
    empty: "표시할 장소가 없어요",
    emptyDescription: "위에서 다른 지역이나 장소 종류를 골라보세요.",
    error: "장소를 불러오지 못했어요",
  },
  en: {
    list: "Place list",
    title: (region: string) => `Places in ${region}`,
    count: (count: number) => `${count} places`,
    collapse: "Hide list",
    expand: "Show list",
    add: "Add",
    added: "Added",
    toggle: (title: string) => `Add ${title}`,
    details: (title: string) => `View ${title} details`,
    selected: (count: number) => `${count} selected`,
    checkout: "Plan a route",
    loading: "Loading places",
    empty: "No places to show",
    emptyDescription: "Choose another area or category above.",
    error: "Could not load places",
  },
};

/** 지도 아래 목록의 담기·선택 개수·조회 상태를 앱 언어로 표시한다. */
export function getHomePlaceListText(language: AppLanguage) {
  return copy[language];
}

export type HomePlaceListText = ReturnType<typeof getHomePlaceListText>;
