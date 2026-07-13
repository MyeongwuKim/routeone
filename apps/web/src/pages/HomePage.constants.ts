import type { SearchFilter } from "@/lib/gangwonAttractionMap";

export const NCP_KEY_ID = import.meta.env.VITE_NCP_MAPS_KEY_ID;
export const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;
export const SEARCH_RESULTS_PAGE_SIZE = 12;

type PlaceSearchFilterOption = {
  key: SearchFilter;
  label: string;
};

export const PLACE_SEARCH_FILTERS: PlaceSearchFilterOption[] = [
  { key: "all", label: "전체" },
  { key: "tourist", label: "관광지" },
  { key: "food", label: "음식점" },
  { key: "cafe", label: "카페" },
  { key: "festival", label: "축제" },
];
