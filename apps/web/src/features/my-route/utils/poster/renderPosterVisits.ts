/**
 * 용도: 사진이 없는 방문지를 카드 안의 순서 있는 여행 기록으로 보여준다.
 * 동작 방식: 사진이 함께 있으면 짧은 목록으로, 사진이 전혀 없으면 장소 수에 맞는 전용 기록 화면으로 배치한다.
 */
import type { RoutePosterThemeItem } from "../../models/routePosterTheme";
import { escapePosterText as xml, fitPosterText } from "./routePosterSvgParts";

function renderSingleVisit(
  visit: RoutePosterThemeItem,
  y: number,
  height: number,
  colors: { ink: string; muted: string; surface: string; accent: string }
) {
  const centerY = y + Math.round(height * 0.48);

  return `<g data-no-photo-layout="single">
    <rect x="84" y="${y}" width="912" height="${height}" rx="12" fill="${colors.surface}" fill-opacity=".94"/>
    <text x="112" y="${y + 48}" font-size="28" font-weight="800" fill="${colors.ink}">이날의 발자취</text>
    <text x="112" y="${y + 84}" font-size="21" fill="${colors.muted}">사진 없이 남긴 방문 기록</text>
    <circle cx="540" cy="${centerY - 36}" r="132" fill="${colors.accent}" fill-opacity=".34"/>
    <circle cx="540" cy="${centerY - 36}" r="88" fill="${colors.accent}" fill-opacity=".72"/>
    <path d="M540 ${centerY - 94}c-31 0-56 25-56 56 0 42 56 102 56 102s56-60 56-102c0-31-25-56-56-56Z" fill="${colors.surface}" stroke="${colors.ink}" stroke-width="5"/>
    <circle cx="540" cy="${centerY - 38}" r="18" fill="${colors.accent}"/>
    <text x="540" y="${centerY + 156}" text-anchor="middle" font-size="42" font-weight="800" fill="${colors.ink}">${xml(fitPosterText(visit.title, 20))}</text>
    ${visit.subtitle ? `<text x="540" y="${centerY + 198}" text-anchor="middle" font-size="23" fill="${colors.muted}">${xml(fitPosterText(visit.subtitle, 32))}</text>` : ""}
    <rect x="310" y="${y + height - 104}" width="460" height="54" rx="27" fill="${colors.accent}" fill-opacity=".3"/>
    <text x="540" y="${y + height - 69}" text-anchor="middle" font-size="21" font-weight="700" fill="${colors.ink}">1곳의 방문을 완료했어요</text>
  </g>`;
}

function renderVisitItinerary(
  visits: RoutePosterThemeItem[],
  y: number,
  height: number,
  colors: { ink: string; muted: string; surface: string; accent: string }
) {
  const listTop = y + 124;
  const listBottom = y + height - 48;
  const gap = 14;
  const rowHeight = Math.min(
    112,
    (listBottom - listTop - gap * (visits.length - 1)) / visits.length
  );

  return `<g data-no-photo-layout="itinerary">
    <rect x="84" y="${y}" width="912" height="${height}" rx="12" fill="${colors.surface}" fill-opacity=".94"/>
    <text x="112" y="${y + 48}" font-size="28" font-weight="800" fill="${colors.ink}">이날의 발자취</text>
    <text x="112" y="${y + 84}" font-size="21" fill="${colors.muted}">사진 없이 남긴 ${visits.length}곳의 방문 기록</text>
    ${visits
      .map((stop, index) => {
        const top = listTop + index * (rowHeight + gap);
        const centerY = top + rowHeight / 2;
        return `<rect x="112" y="${top}" width="856" height="${rowHeight}" rx="18" fill="${colors.accent}" fill-opacity=".18"/>
          <circle cx="158" cy="${centerY}" r="25" fill="${colors.accent}" fill-opacity=".7"/>
          <text x="158" y="${centerY + 7}" text-anchor="middle" font-size="19" font-weight="800" fill="${colors.ink}">${String(stop.order ?? index + 1).padStart(2, "0")}</text>
          <text x="202" y="${centerY - (stop.subtitle ? 5 : -9)}" font-size="29" font-weight="800" fill="${colors.ink}">${xml(fitPosterText(stop.title, 21))}</text>
          ${stop.subtitle ? `<text x="202" y="${centerY + 28}" font-size="19" fill="${colors.muted}">${xml(fitPosterText(stop.subtitle, 36))}</text>` : ""}`;
      })
      .join("")}
  </g>`;
}

export function renderPosterVisits(visits: RoutePosterThemeItem[], y: number, height: number, hasPhotos: boolean, isPixel: boolean) {
  if (!visits.length) return "";
  const ink = isPixel ? "#e1e9e5" : "#354943";
  const muted = isPixel ? "#becbdb" : "#697871";
  const surface = isPixel ? "#344159" : "#fffdf6";
  const accent = isPixel ? "#60748b" : "#b8d5c1";

  if (!hasPhotos) {
    const colors = { ink, muted, surface, accent };
    return visits.length === 1
      ? renderSingleVisit(visits[0], y, height, colors)
      : renderVisitItinerary(visits, y, height, colors);
  }

  const columns = 2;
  const rowHeight = 64;
  return `<g>
    <rect x="84" y="${y}" width="912" height="${height}" rx="${isPixel ? 0 : 12}" fill="${surface}" fill-opacity=".94"/>
    <text x="112" y="${y + 42}" font-size="28" font-weight="800" fill="${ink}">함께 들른 곳</text>
    ${visits.map((stop, index) => {
      const x = 112 + (index % columns) * 440;
      const top = y + 76 + Math.floor(index / columns) * rowHeight;
      return `<circle cx="${x + 17}" cy="${top - 8}" r="17" fill="${isPixel ? "#60748b" : "#e2ebe3"}"/>
        <text x="${x + 17}" y="${top - 1}" text-anchor="middle" font-size="18" font-weight="700" fill="${ink}">${stop.order ?? index + 1}</text>
        <text x="${x + 48}" y="${top}" font-size="26" font-weight="700" fill="${ink}">${xml(fitPosterText(stop.title, 13))}</text>
        <text x="${x + 48}" y="${top + 28}" font-size="19" fill="${muted}">${xml(fitPosterText(stop.subtitle, 18))}</text>`;
    }).join("")}
  </g>`;
}
