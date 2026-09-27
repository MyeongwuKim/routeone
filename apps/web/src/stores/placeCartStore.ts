/**
 * 용도:
 * 사용자가 여행에 담은 장소 목록과 경로 생성 모달의 열림 여부를 공유한다.
 * 홈 지도·장소 상세에서 담은 장소를 경로 계산 단계까지 유지하고 수정할 때 사용한다.
 *
 * 동작 방식:
 * 장소 추가·삭제·전체 삭제와 번역된 이름 갱신을 처리하고 중복 장소는 하나로 유지한다.
 * 담은 장소 ID와 상세 정보는 localStorage에 저장해 새로고침 후에도 복원한다.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_GANGWON_REGION,
  GANGWON_AREA_CODE,
} from "@/data/gangwonRegions";
import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import type { AppLanguage } from "@/stores/appLanguageStore";
import type { MapSheetPlace } from "@/types/place";

export type SavedPlaceItem = {
  /** 저장 목록과 삭제 동작에 사용하는 장소 ID */
  id: string;
  /** 경로 생성과 장소 상세에 다시 전달할 장소 스냅샷 */
  place: MapSheetPlace;
  /** 목록 카드에 표시할 대표 이미지 URL */
  thumbnailUrl: string;
  /** 담은 순서를 식별하는 Unix 밀리초 시각 */
  savedAt: number;
  /** 저장된 제목·주소가 어느 언어로 변환됐는지 나타내며 확인되지 않으면 undefined */
  labelLanguage?: AppLanguage;
};

export type SavedPlaceLabelUpdate = {
  /** 제목·주소를 교체할 저장 장소 ID */
  id: string;
  /** language로 번역된 새 장소명 */
  title: string;
  /** language로 번역된 새 주소 */
  address: string;
  /** title과 address에 적용된 언어 */
  language: AppLanguage;
};

type PlaceCartState = {
  /** 담은 장소 목록 모달의 표시 여부. 영속 저장하지 않는다. */
  isSavedListOpen: boolean;
  /** 포함 여부를 빠르게 확인하는 장소 ID 목록. savedPlaces 순서와 동일하게 유지한다. */
  savedPlaceIds: string[];
  /** 최근에 담은 장소가 앞에 오도록 저장한 장소 스냅샷 목록 */
  savedPlaces: SavedPlaceItem[];
  /** 저장 목록과 장소 데이터는 유지하고 목록 모달만 연다. */
  openSavedList: () => void;
  /** 저장 목록과 장소 데이터는 유지하고 목록 모달만 닫는다. */
  closeSavedList: () => void;
  /** 같은 장소가 있으면 제거하고, 없으면 썸네일·언어 정보와 함께 목록 앞에 추가한다. */
  toggleSavedPlace: (
    place: MapSheetPlace,
    thumbnailUrl?: string,
    language?: AppLanguage
  ) => void;
  /** ID가 일치하는 저장 장소의 제목·주소·번역 언어를 일괄 교체한다. */
  updateSavedPlaceLabels: (updates: SavedPlaceLabelUpdate[]) => void;
  /** placeId를 savedPlaceIds와 savedPlaces 양쪽에서 제거한다. */
  removeSavedPlace: (placeId: string) => void;
  /** 담은 장소 두 목록을 모두 비우고 영속 저장값에 반영한다. */
  clearSavedPlaces: () => void;
};

type PersistedPlaceCartState = Pick<
  PlaceCartState,
  "savedPlaceIds" | "savedPlaces"
>;

const getSavedPlaceThumbnailUrl = (
  place: MapSheetPlace,
  thumbnailUrl: string
) => thumbnailUrl || place.images[0] || "";

const hasKoreanText = (value: string) => /[가-힣]/u.test(value);

const getSavedPlaceLabelLanguage = (
  place: MapSheetPlace,
  language?: AppLanguage
) => {
  if (language !== "en") {
    return language;
  }

  return hasKoreanText(`${place.title} ${place.address}`)
    ? undefined
    : language;
};

const isPersistedPlaceCartState = (
  value: unknown
): value is Partial<PersistedPlaceCartState> =>
  typeof value === "object" && value !== null;

const createSeedPlace = (
  place: Omit<
    MapSheetPlace,
    | "id"
    | "contentId"
    | "areaCode"
    | "signguCode"
    | "touristTrendName"
    | "topRank"
    | "images"
  > & {
    id: string;
    images?: string[];
  }
): MapSheetPlace => ({
  id: place.id,
  contentId: place.id,
  areaCode: GANGWON_AREA_CODE,
  signguCode: DEFAULT_GANGWON_REGION.sigunguCode,
  touristTrendName: place.title,
  topRank: null,
  images: place.images ?? [],
  contentTypeId: place.contentTypeId,
  title: place.title,
  address: place.address,
  lat: place.lat,
  lng: place.lng,
  contentTypeLabel: place.contentTypeLabel,
  categoryName: place.categoryName,
  icon: place.icon,
  eventStartDate: place.eventStartDate,
  eventEndDate: place.eventEndDate,
});

const DEV_GANGNEUNG_SEED_PLACES: MapSheetPlace[] = [
  createSeedPlace({
    id: "seed-gangneung-o-jukheon",
    contentTypeId: "12",
    title: "오죽헌",
    address: "강원 강릉시 율곡로3139번길 24",
    lat: 37.7796,
    lng: 128.8785,
    contentTypeLabel: "관광지",
    categoryName: "역사관광",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-seongyojang",
    contentTypeId: "12",
    title: "강릉 선교장",
    address: "강원 강릉시 운정길 63",
    lat: 37.7867,
    lng: 128.8836,
    contentTypeLabel: "관광지",
    categoryName: "역사관광",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-gyeongpo-lake",
    contentTypeId: "12",
    title: "경포호수광장",
    address: "강원 강릉시 저동",
    lat: 37.7962,
    lng: 128.8969,
    contentTypeLabel: "관광지",
    categoryName: "자연관광",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-gyeongpo-beach",
    contentTypeId: "12",
    title: "경포해변",
    address: "강원 강릉시 강문동 산1",
    lat: 37.8056,
    lng: 128.9098,
    contentTypeLabel: "관광지",
    categoryName: "해변·해수욕장",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-gangmun-beach",
    contentTypeId: "12",
    title: "강문해변",
    address: "강원 강릉시 강문동",
    lat: 37.7947,
    lng: 128.9172,
    contentTypeLabel: "관광지",
    categoryName: "해변·해수욕장",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-anmok-beach",
    contentTypeId: "12",
    title: "안목해변",
    address: "강원 강릉시 창해로14번길 20-1",
    lat: 37.7735,
    lng: 128.9475,
    contentTypeLabel: "관광지",
    categoryName: "해변·해수욕장",
    icon: "📍",
  }),
  createSeedPlace({
    id: "seed-gangneung-chodang-sundubu",
    contentTypeId: "39",
    title: "초당순두부마을",
    address: "강원 강릉시 초당동",
    lat: 37.7915,
    lng: 128.9145,
    contentTypeLabel: "음식점",
    categoryName: "한식",
    icon: "🍽",
  }),
  createSeedPlace({
    id: "seed-gangneung-eomjine",
    contentTypeId: "39",
    title: "엄지네포장마차",
    address: "강원 강릉시 경강로2255번길 21",
    lat: 37.7576,
    lng: 128.9004,
    contentTypeLabel: "음식점",
    categoryName: "한식",
    icon: "🍽",
  }),
  createSeedPlace({
    id: "seed-gangneung-terarosa-gyeongpo",
    contentTypeId: "39",
    title: "테라로사 경포호수점",
    address: "강원 강릉시 난설헌로 145",
    lat: 37.7938,
    lng: 128.8993,
    contentTypeLabel: "카페",
    categoryName: "카페",
    icon: "☕",
  }),
  createSeedPlace({
    id: "seed-gangneung-toetmaru",
    contentTypeId: "39",
    title: "툇마루",
    address: "강원 강릉시 난설헌로 232",
    lat: 37.7908,
    lng: 128.914,
    contentTypeLabel: "카페",
    categoryName: "카페",
    icon: "☕",
  }),
];

const DEV_GANGNEUNG_SEED_SAVED_PLACES: SavedPlaceItem[] =
  import.meta.env.DEV
    ? DEV_GANGNEUNG_SEED_PLACES.map((place, index) => ({
        id: place.id,
        place,
        thumbnailUrl: getSavedPlaceThumbnailUrl(place, ""),
        savedAt: Date.now() - index,
      }))
    : [];

export const usePlaceCartStore = create<PlaceCartState>()(
  persist(
    (set) => ({
      isSavedListOpen: false,
      savedPlaceIds: DEV_GANGNEUNG_SEED_SAVED_PLACES.map((item) => item.id),
      savedPlaces: DEV_GANGNEUNG_SEED_SAVED_PLACES,
      openSavedList: () =>
        set({
          isSavedListOpen: true,
        }),
      closeSavedList: () =>
        set({
          isSavedListOpen: false,
        }),
      toggleSavedPlace: (place, thumbnailUrl = "", language) =>
        set((state) => {
          const exists = state.savedPlaces.some((item) =>
            isSamePlaceDuplicate(item.place, place)
          );
          const nextSavedPlaces = exists
            ? state.savedPlaces.filter(
                (item) => !isSamePlaceDuplicate(item.place, place)
              )
            : [
                {
                  id: place.id,
                  place,
                  thumbnailUrl: getSavedPlaceThumbnailUrl(place, thumbnailUrl),
                  savedAt: Date.now(),
                  labelLanguage: getSavedPlaceLabelLanguage(place, language),
                },
                ...state.savedPlaces.filter(
                  (item) => !isSamePlaceDuplicate(item.place, place)
                ),
              ];

          return {
            savedPlaceIds: nextSavedPlaces.map((item) => item.id),
            savedPlaces: nextSavedPlaces,
          };
        }),
      updateSavedPlaceLabels: (updates) =>
        set((state) => {
          if (updates.length === 0) {
            return state;
          }

          const updateById = new Map(
            updates.map((update) => [update.id, update])
          );
          const savedPlaces = state.savedPlaces.map((item) => {
            const update = updateById.get(item.id);

            if (!update) {
              return item;
            }

            return {
              ...item,
              place: {
                ...item.place,
                title: update.title,
                address: update.address,
              },
              labelLanguage: update.language,
            };
          });

          return {
            savedPlaces,
          };
        }),
      removeSavedPlace: (placeId) =>
        set((state) => ({
          savedPlaceIds: state.savedPlaceIds.filter((id) => id !== placeId),
          savedPlaces: state.savedPlaces.filter((item) => item.id !== placeId),
        })),
      clearSavedPlaces: () =>
        set({
          savedPlaceIds: [],
          savedPlaces: [],
        }),
    }),
    {
      name: "routeone-place-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        savedPlaceIds: state.savedPlaceIds,
        savedPlaces: state.savedPlaces,
      }),
      merge: (persistedState, currentState) => {
        if (!isPersistedPlaceCartState(persistedState)) {
          return currentState;
        }

        const savedPlaces = Array.isArray(persistedState.savedPlaces)
          ? persistedState.savedPlaces
          : currentState.savedPlaces;

        return {
          ...currentState,
          savedPlaceIds: savedPlaces.map((item) => item.id),
          savedPlaces,
        };
      },
      version: 1,
    }
  )
);
