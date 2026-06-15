export const CAFE_LCLS_CODE = "FD050100";

export type PlaceCategoryLabel = "관광지" | "음식점" | "카페" | "장소";
export type RoutePlaceCategory = "tourist" | "food" | "cafe";

type PlaceCategorySource = {
  title?: string;
  contentTypeId: string;
  contentTypeLabel?: string;
  categoryName?: string;
  lclsSystm1?: string;
  lclsSystm2?: string;
  lclsSystm3?: string;
};

export function isReadableCategoryName(categoryName?: string) {
  return Boolean(categoryName && /[가-힣]/.test(categoryName));
}

export function getReadablePlaceCategoryName(
  categoryCandidates: Array<string | undefined>,
  fallbackLabel: PlaceCategoryLabel
) {
  return (
    categoryCandidates
      .map((value) => value?.trim() ?? "")
      .find((value) => isReadableCategoryName(value)) ?? fallbackLabel
  );
}

export function isCafePlace(
  place: PlaceCategorySource,
  readableCategoryName = place.categoryName ?? ""
) {
  const targetText = `${place.title ?? ""} ${readableCategoryName} ${
    place.lclsSystm1 ?? ""
  } ${place.lclsSystm2 ?? ""} ${place.lclsSystm3 ?? ""}`;

  return (
    place.contentTypeLabel === "카페" ||
    (place.contentTypeId === "39" &&
      (place.lclsSystm3 === CAFE_LCLS_CODE ||
        /카페|커피|coffee|디저트|찻집/i.test(targetText)))
  );
}

export function getPlaceCategoryLabel(
  place: PlaceCategorySource,
  readableCategoryName = place.categoryName ?? ""
): PlaceCategoryLabel {
  if (isCafePlace(place, readableCategoryName)) {
    return "카페";
  }

  if (place.contentTypeId === "12") {
    return "관광지";
  }

  if (place.contentTypeId === "39") {
    return "음식점";
  }

  if (
    place.contentTypeLabel === "관광지" ||
    place.contentTypeLabel === "음식점" ||
    place.contentTypeLabel === "카페"
  ) {
    return place.contentTypeLabel;
  }

  return "장소";
}

export function getPlaceCategoryIcon(categoryLabel: PlaceCategoryLabel) {
  if (categoryLabel === "카페") {
    return "☕";
  }

  if (categoryLabel === "음식점") {
    return "🍽";
  }

  if (categoryLabel === "장소") {
    return "📌";
  }

  return "📍";
}

export function isTouristPlace(
  place: Pick<PlaceCategorySource, "contentTypeId" | "contentTypeLabel">
) {
  return place.contentTypeLabel === "관광지" || place.contentTypeId === "12";
}

export function getRoutePlaceCategory(
  place: Pick<PlaceCategorySource, "contentTypeId" | "contentTypeLabel">
): RoutePlaceCategory {
  if (place.contentTypeLabel === "카페") {
    return "cafe";
  }

  if (place.contentTypeId === "39") {
    return "food";
  }

  return "tourist";
}
