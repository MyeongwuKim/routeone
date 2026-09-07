/**
 * 용도: 방문 기록을 사진 중심의 카드와 사진 없는 장소 목록으로 나눈다.
 * 동작 방식: 방문 순서를 보존하며 사진 4장·목록 6곳씩 나눠 모든 기록을 남긴다.
 */
import type { RoutePosterPage, RoutePosterThemeItem } from "../../models/routePosterTheme";

export function buildRoutePosterPages(stops: RoutePosterThemeItem[]): RoutePosterPage[] {
  if (!stops.length) return [];
  const photos = stops.filter((stop) => Boolean(stop.imageDataUrl));
  const visits = stops.filter((stop) => !stop.imageDataUrl);
  const pageCount = Math.max(Math.ceil(photos.length / 4), Math.ceil(visits.length / 6));
  return Array.from({ length: pageCount }, (_, index) => ({
    items: photos.slice(index * 4, index * 4 + 4),
    visits: visits.slice(index * 6, index * 6 + 6),
    pageIndex: index + 1,
    pageCount,
  }));
}
