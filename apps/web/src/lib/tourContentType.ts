import type { AppLanguage } from "@/stores/appLanguageStore";

export type TourContentTypeCategory =
  | "tourist"
  | "culture"
  | "festival"
  | "leisure"
  | "shopping"
  | "food";

const TOUR_CONTENT_TYPE_ID_BY_CATEGORY: Record<
  TourContentTypeCategory,
  Record<AppLanguage, string>
> = {
  tourist: { ko: "12", en: "76" },
  culture: { ko: "14", en: "78" },
  festival: { ko: "15", en: "85" },
  leisure: { ko: "28", en: "77" },
  shopping: { ko: "38", en: "79" },
  food: { ko: "39", en: "82" },
};

const TOUR_CONTENT_TYPE_CATEGORIES = Object.keys(
  TOUR_CONTENT_TYPE_ID_BY_CATEGORY
) as TourContentTypeCategory[];

export function getTourContentTypeId(
  language: AppLanguage,
  category: TourContentTypeCategory
) {
  return TOUR_CONTENT_TYPE_ID_BY_CATEGORY[category][language];
}

export function getTourContentTypeCategory(contentTypeId: string) {
  return (
    TOUR_CONTENT_TYPE_CATEGORIES.find((category) =>
      Object.values(TOUR_CONTENT_TYPE_ID_BY_CATEGORY[category]).includes(
        contentTypeId
      )
    ) ?? null
  );
}

export function isTourContentTypeId(
  contentTypeId: string,
  category: TourContentTypeCategory
) {
  return Object.values(TOUR_CONTENT_TYPE_ID_BY_CATEGORY[category]).includes(
    contentTypeId
  );
}

export function localizeTourContentTypeId(
  contentTypeId: string,
  language: AppLanguage
) {
  const category = getTourContentTypeCategory(contentTypeId);
  return category ? getTourContentTypeId(language, category) : contentTypeId;
}

export function getDefaultTourContentTypeIds(language: AppLanguage) {
  return TOUR_CONTENT_TYPE_CATEGORIES.map((category) =>
    getTourContentTypeId(language, category)
  );
}
