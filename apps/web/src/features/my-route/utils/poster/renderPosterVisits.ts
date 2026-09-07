/**
 * 용도: 사진이 없는 방문지를 카드 안의 순서 있는 여행 기록으로 보여준다.
 * 동작 방식: 사진이 함께 있으면 짧은 목록, 사진이 없으면 넓은 세로 기록으로 배치한다.
 */
import type { RoutePosterThemeItem } from "../../models/routePosterTheme";
import { escapePosterText as xml, fitPosterText } from "./routePosterSvgParts";

export function renderPosterVisits(visits: RoutePosterThemeItem[], y: number, height: number, hasPhotos: boolean, isPixel: boolean) {
  if (!visits.length) return "";
  const ink = isPixel ? "#e1e9e5" : "#354943";
  const muted = isPixel ? "#becbdb" : "#697871";
  const surface = isPixel ? "#344159" : "#fffdf6";
  const columns = hasPhotos ? 2 : 1;
  const rows = Math.ceil(visits.length / columns);
  const rowHeight = hasPhotos ? 64 : Math.min(180, (height - 150) / rows);
  return `<g>
    <rect x="84" y="${y}" width="912" height="${height}" rx="${isPixel ? 0 : 12}" fill="${surface}" fill-opacity=".94"/>
    <text x="112" y="${y + 42}" font-size="28" font-weight="800" fill="${ink}">${hasPhotos ? "함께 들른 곳" : "이날의 발자취"}</text>
    ${!hasPhotos ? `<text x="112" y="${y + 76}" font-size="21" fill="${muted}">방문한 순서대로 남긴 하루의 기록</text>` : ""}
    ${visits.map((stop, index) => {
      const x = 112 + (index % columns) * 440;
      const top = y + (hasPhotos ? 76 : 130 + (height - 160 - rows * rowHeight) / 2) + Math.floor(index / columns) * rowHeight;
      return `${!hasPhotos && index < visits.length - 1 ? `<path d="M${x + 17} ${top + 13}V${top + rowHeight - 34}" stroke="${isPixel ? "#60748b" : "#c8d9ce"}" stroke-width="3" stroke-dasharray="5 7"/>` : ""}<circle cx="${x + 17}" cy="${top - 8}" r="17" fill="${isPixel ? "#60748b" : "#e2ebe3"}"/>
        <text x="${x + 17}" y="${top - 1}" text-anchor="middle" font-size="18" font-weight="700" fill="${ink}">${stop.order ?? index + 1}</text>
        <text x="${x + 48}" y="${top}" font-size="${hasPhotos ? 26 : 36}" font-weight="700" fill="${ink}">${xml(fitPosterText(stop.title, hasPhotos ? 13 : 22))}</text>
        <text x="${x + 48}" y="${top + 28}" font-size="19" fill="${muted}">${xml(fitPosterText(stop.subtitle, hasPhotos ? 18 : 35))}</text>`;
    }).join("")}
  </g>`;
}
