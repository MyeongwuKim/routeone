/**
 * 용도: 사진 수와 방문 목록의 여유 공간에 맞춰 포토카드 안의 프레임 위치를 계산한다.
 * 동작 방식: 헤더와 하단 기록 영역을 비워 두고, 최대 여섯 장을 사진 영역 안에 배치한다.
 */
import type { RoutePosterThemeId } from "../../models/routePosterTheme";

export type PosterPhotoRect = { x: number; y: number; width: number; height: number };
const AREA = { x: 84, y: 326, width: 912, height: 766 };
const GAP = 28;

export function getRoutePosterPhotoLayout(
  count: number,
  themeId: RoutePosterThemeId,
  area: PosterPhotoRect = AREA
): PosterPhotoRect[] {
  if (count < 1 || count > 6) return [];
  if (count === 1) {
    const width = area.width;
    return [{ ...area, x: (1080 - width) / 2, width }];
  }
  if (count === 3 && themeId === "pixel") {
    const width = 550;
    const sideWidth = area.width - width - GAP;
    const height = (area.height - GAP) / 2;
    return [
      { ...area, width },
      { x: area.x + width + GAP, y: area.y, width: sideWidth, height },
      { x: area.x + width + GAP, y: area.y + height + GAP, width: sideWidth, height },
    ];
  }
  if (count === 3) {
    const height = (area.height - GAP) * 0.56;
    const lowerY = area.y + height + GAP;
    const width = (area.width - GAP) / 2;
    return [
      { ...area, height },
      { x: area.x, y: lowerY, width, height: area.height - height - GAP },
      { x: area.x + width + GAP, y: lowerY, width, height: area.height - height - GAP },
    ];
  }
  const rows = count === 2 ? [2] : count === 4 ? [2, 2] : count === 5 ? [3, 2] : [3, 3];
  const height = (area.height - GAP * (rows.length - 1)) / rows.length;
  return rows.flatMap((columns, row) => {
    const width = (area.width - GAP * (columns - 1)) / columns;
    return Array.from({ length: columns }, (_, column) => ({
      x: area.x + column * (width + GAP),
      y: area.y + row * (height + GAP),
      width,
      height,
    }));
  });
}
