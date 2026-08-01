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
