/** 담은 장소의 제목과 주소를 현재 앱 언어에 맞춰 다시 조회하고 Place Cart 저장값에 반영한다. */
import { useEffect } from "react";
import { localizeTourPlaces } from "@/lib/placeLocalization";
import { fetchTourPlaceBasicInfo } from "@/lib/visitKoreaTourApi";
import { useAppLanguageStore } from "@/stores/appLanguageStore";
import {
  usePlaceCartStore,
  type SavedPlaceItem,
  type SavedPlaceLabelUpdate,
} from "@/stores/placeCartStore";

const TOUR_API_SERVICE_KEY = import.meta.env.VITE_VISITKOREA_SERVICE_KEY;

function hasKoreanText(value: string) {
  return /[가-힣]/u.test(value);
}

function needsLabelSync(
  item: SavedPlaceItem,
  language: "ko" | "en"
) {
  if (item.labelLanguage) {
    return item.labelLanguage !== language;
  }

  const containsKorean = hasKoreanText(
    `${item.place.title} ${item.place.address}`
  );
  return language === "en" ? containsKorean : !containsKorean;
}

async function getKoreanLabelUpdate(
  item: SavedPlaceItem
): Promise<SavedPlaceLabelUpdate | null> {
  if (!TOUR_API_SERVICE_KEY) {
    return null;
  }

  try {
    const basicInfo = await fetchTourPlaceBasicInfo(
      TOUR_API_SERVICE_KEY,
      item.place.contentId,
      "ko"
    );

    return {
      id: item.id,
      title: basicInfo.title || item.place.title,
      address: basicInfo.address || item.place.address,
      language: "ko",
    };
  } catch (error) {
    console.warn("장바구니 장소의 한국어 원문을 불러오지 못했습니다.", error);
    return null;
  }
}

async function getEnglishLabelUpdates(
  items: SavedPlaceItem[]
): Promise<SavedPlaceLabelUpdate[]> {
  const localizedPlaces = await localizeTourPlaces(
    items.map((item) => ({
      ...item.place,
      id: item.place.contentId,
    })),
    "en",
    {
      retryUncached: true,
      retryAttempts: 2,
      retryDelayMs: 1200,
      waitForFresh: true,
    }
  );

  return localizedPlaces.flatMap((place, index) => {
    if (hasKoreanText(`${place.title} ${place.address}`)) {
      return [];
    }

    return [
      {
        id: items[index].id,
        title: place.title,
        address: place.address,
        language: "en" as const,
      },
    ];
  });
}

/**
 * 저장 언어와 현재 언어가 다르거나 영어 목록에 한글이 남은 장소만 동기화한다.
 * 한국어는 관광 API 원문을, 영어는 번역 API를 사용하며 취소된 Effect의 늦은 결과는 Store에 반영하지 않는다.
 */
export function usePlaceCartLanguageSync() {
  const language = useAppLanguageStore((state) => state.language);
  const savedPlaces = usePlaceCartStore((state) => state.savedPlaces);
  const updateSavedPlaceLabels = usePlaceCartStore(
    (state) => state.updateSavedPlaceLabels
  );

  useEffect(() => {
    const targets = savedPlaces.filter((item) =>
      needsLabelSync(item, language)
    );

    if (targets.length === 0) {
      return;
    }

    let isCancelled = false;

    const synchronize = async () => {
      const updates =
        language === "ko"
          ? (
              await Promise.all(targets.map(getKoreanLabelUpdate))
            ).filter(
              (update): update is SavedPlaceLabelUpdate => update !== null
            )
          : await getEnglishLabelUpdates(targets);

      if (
        isCancelled ||
        useAppLanguageStore.getState().language !== language
      ) {
        return;
      }

      updateSavedPlaceLabels(updates);
    };

    void synchronize();

    return () => {
      isCancelled = true;
    };
  }, [language, savedPlaces, updateSavedPlaceLabels]);
}
