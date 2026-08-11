// VisitKorea EngService2 returns these labels in Korean or omits the codes.
// Keep this catalog aligned with the Web override used before cache storage.
export const TOUR_CATEGORY_ENGLISH_LABEL_BY_CODE = {
  C01: "Recommended Courses",
  C0112: "Family Courses",
  C01120001: "Family Courses",
  C0113: "Solo Courses",
  C01130001: "Solo Courses",
  C0114: "Healing Courses",
  C01140001: "Healing Courses",
  C0115: "Walking Courses",
  C01150001: "Walking Courses",
  C0116: "Camping Courses",
  C01160001: "Camping Courses",
  C0117: "Food Tours",
  C01170001: "Food Tours",
  FD030200: "Hamburgers",
  HS010800: "Royal Tombs",
  NA010100: "Mountain Passes",
  VE040100: "Cultural Streets",
  VE100200: "Training Facilities",
} as const satisfies Readonly<Record<string, string>>;

export function getTourCategoryEnglishLabelOverride(code: string) {
  return TOUR_CATEGORY_ENGLISH_LABEL_BY_CODE[
    code as keyof typeof TOUR_CATEGORY_ENGLISH_LABEL_BY_CODE
  ];
}
