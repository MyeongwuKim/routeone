/** 여행 기록 카드의 테마, 사진과 방문 목록, 페이지 구성을 정의한다. */
export const ROUTE_POSTER_THEMES = ["journal", "polaroid", "blocks", "pixel", "fantasy"] as const;

export type RoutePosterThemeId = (typeof ROUTE_POSTER_THEMES)[number];

export type RoutePosterThemeItem = {
  stopId?: string;
  order?: number;
  title: string;
  subtitle: string;
  verificationLabel: string;
  imageDataUrl: string | null;
};

/** 한 장의 포토카드에 배치할 사진 항목과 방문 기록, 전체 페이지 안의 위치를 묶는다. */
export type RoutePosterPage = {
  items: RoutePosterThemeItem[];
  visits: RoutePosterThemeItem[];
  pageIndex: number;
  pageCount: number;
};

export type RoutePosterThemeInput = RoutePosterPage & {
  themeId: RoutePosterThemeId;
  backgroundId: string;
  backgroundImageDataUrl?: string | null;
  title: string;
  dayIndex: number;
  dateLabel: string | null;
  stopCount: number;
  photoCount: number;
};
