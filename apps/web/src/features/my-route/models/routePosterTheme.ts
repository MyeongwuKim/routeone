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
