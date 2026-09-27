/**
 * 용도:
 * 지도에서 선택한 장소와 장소 상세 시트의 열림 여부·표시 모드·길찾기 출발점을 공유한다.
 * 지도 마커, 검색 결과, 경로 편집 화면 어디에서 장소를 열어도 하나의 상세 UI로 연결할 때 사용한다.
 *
 * 동작 방식:
 * openSheet가 장소와 호출 화면의 문맥을 저장하면 전역 PlaceBottomSheet가 이를 구독해 표시한다.
 * 닫거나 초기화할 때 선택 장소와 출발점·문맥 액션을 비우고 resetVersion을 증가시킨다.
 */
import { create } from "zustand";
import type { MapSheetPlace } from "@/types/place";

export type MapSheetMode =
  | "bottom-sheet"
  | "full-popup"
  | "directions-popup";

export type MapSheetDirectionOrigin = {
  /** 길찾기 출발점으로 전달할 위도·경도 */
  coordinates: {
    lat: number;
    lng: number;
  };
  /** 출발지 선택 영역과 길찾기 화면에 표시할 이름 */
  label: string;
  /** 저장 장소가 아니라 전역 현재 위치를 따라가야 하는 출발지이면 true */
  isCurrentLocation: boolean;
};

export type MapSheetContextAction = {
  /** 장소 상세 하단의 추가 액션 버튼 문구 */
  label: string;
  /** 버튼을 누른 장소를 호출 화면의 담기·삽입 처리로 전달한다. */
  onSelect: (place: MapSheetPlace) => void;
};

type MapSheetState = {
  /** 전역 장소 상세 UI의 표시 여부 */
  isOpen: boolean;
  /** bottom sheet, 전체 팝업, 길찾기 팝업 중 현재 표시 형태 */
  sheetMode: MapSheetMode;
  /** 시트를 닫거나 초기화할 때 증가해 내부 로컬 상태 재설정을 알리는 값 */
  sheetResetVersion: number;
  /** 길찾기에 우선 사용하도록 호출 화면이 명시한 출발지 */
  directionOrigin: MapSheetDirectionOrigin | null;
  /** 명시 출발지와 현재 위치를 사용할 수 없을 때 적용할 지역 기준 출발지 */
  fallbackDirectionOrigin: MapSheetDirectionOrigin | null;
  /** 장소 담기처럼 호출 화면이 상세 시트에 추가하는 문맥 액션 */
  contextAction: MapSheetContextAction | null;
  /** 상세 조회와 화면 표시의 기준이 되는 현재 장소 */
  selectedPlace: MapSheetPlace | null;
  /** 장소와 호출 문맥을 저장하고 지정한 표시 형태로 상세 UI를 연다. */
  openSheet: (
    place: MapSheetPlace,
    options?: {
      directionOrigin?: MapSheetDirectionOrigin;
      fallbackDirectionOrigin?: MapSheetDirectionOrigin;
      contextAction?: MapSheetContextAction;
      mode?: MapSheetMode;
    }
  ) => void;
  /** ID가 현재 선택 장소와 같을 때만 갱신된 장소 객체로 교체한다. */
  updateSelectedPlace: (place: MapSheetPlace) => void;
  /** 선택 장소와 길찾기 문맥을 유지한 채 표시 형태만 변경한다. */
  setSheetMode: (mode: MapSheetMode) => void;
  /** 상세 UI를 닫고 장소·문맥을 비우며 resetVersion을 증가시킨다. */
  closeSheet: () => void;
  /** 현재 열림 여부와 관계없이 닫힌 기본 상태로 되돌리고 resetVersion을 증가시킨다. */
  resetSheet: () => void;
};

const getClosedSheetState = (sheetResetVersion: number) => ({
  isOpen: false,
  sheetMode: "bottom-sheet" as const,
  directionOrigin: null,
  fallbackDirectionOrigin: null,
  contextAction: null,
  selectedPlace: null,
  sheetResetVersion: sheetResetVersion + 1,
});

export const useMapSheetStore = create<MapSheetState>((set) => ({
  isOpen: false,
  sheetMode: "bottom-sheet",
  sheetResetVersion: 0,
  directionOrigin: null,
  fallbackDirectionOrigin: null,
  contextAction: null,
  selectedPlace: null,
  openSheet: (place, options) =>
    set({
      isOpen: true,
      sheetMode: options?.mode ?? "bottom-sheet",
      directionOrigin: options?.directionOrigin ?? null,
      fallbackDirectionOrigin: options?.fallbackDirectionOrigin ?? null,
      contextAction: options?.contextAction ?? null,
      selectedPlace: place,
    }),
  updateSelectedPlace: (place) =>
    set((state) =>
      state.selectedPlace?.id === place.id
        ? {
            selectedPlace: place,
          }
        : state
    ),
  setSheetMode: (mode) =>
    set({
      sheetMode: mode,
    }),
  closeSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
  resetSheet: () =>
    set((state) => getClosedSheetState(state.sheetResetVersion)),
}));
