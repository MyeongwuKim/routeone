import { create } from "zustand";
import { isSamePlaceDuplicate } from "@/lib/placeDuplicate";
import type { MapSheetPlace } from "@/types/place";

export type SavedPlaceItem = {
  id: string;
  place: MapSheetPlace;
  thumbnailUrl: string;
  savedAt: number;
};

type PlaceCartState = {
  isSavedListOpen: boolean;
  savedPlaceIds: string[];
  savedPlaces: SavedPlaceItem[];
  openSavedList: () => void;
  closeSavedList: () => void;
  toggleSavedPlace: (place: MapSheetPlace, thumbnailUrl?: string) => void;
  removeSavedPlace: (placeId: string) => void;
  clearSavedPlaces: () => void;
};

const getSavedPlaceThumbnailUrl = (
  place: MapSheetPlace,
  thumbnailUrl: string
) => thumbnailUrl || place.images[0] || "";

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
  areaCode: "32",
  signguCode: "1",
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

export const usePlaceCartStore = create<PlaceCartState>((set) => ({
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
  toggleSavedPlace: (place, thumbnailUrl = "") =>
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
}));
