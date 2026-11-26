/** 기본 DAY 카드에서 날짜와 방문 순서를 강조하고, 사진 없는 페이지를 방문 기록 중심으로 채운다. */
import type { RoutePosterThemeInput, RoutePosterThemeItem } from "../../models/routePosterTheme";
import { escapePosterText as xml, fitPosterText } from "./routePosterSvgParts";

const INK = "#193e34";
const MUTED = "#486056";
const RULE = "#a9b4a2";
const PAPER = "#fffaf0";

export function renderDayJournalHeader(input: RoutePosterThemeInput) {
  const day = `DAY ${input.dayIndex}`;
  const date = input.dateLabel ? fitPosterText(input.dateLabel, 7) : day;
  return `
    <text x="84" y="185" font-size="96" font-weight="850" letter-spacing="-3" fill="${INK}">${xml(date)}</text>
    ${input.dateLabel ? `<text x="996" y="126" text-anchor="end" font-size="29" font-weight="750" fill="${MUTED}">${day}</text>` : ""}
    <text x="996" y="183" text-anchor="end" font-size="34" font-weight="800" fill="${INK}">${input.stopCount}곳 방문</text>
    <text x="84" y="250" font-size="34" font-weight="650" fill="${MUTED}">${xml(fitPosterText(input.title, 26))}</text>
    <path d="M84 288H996 M84 1164H996" fill="none" stroke="${RULE}" stroke-width="2"/>
    <text x="84" y="1232" font-size="30" font-weight="800" fill="${INK}">Masil</text>`;
}

/** 한 곳부터 여섯 곳까지 순서를 유지하면서 본문 높이에 맞춰 행 간격을 정한다. */
export function renderDayJournalItinerary(visits: RoutePosterThemeItem[], top: number, height: number) {
  if (!visits.length) return "";
  const multiple = visits.length > 1;
  const center = top + height / 2 + 35;
  const step = multiple ? Math.min(230, (height - 282) / (visits.length - 1)) : 0;
  const first = center - (step * (visits.length - 1)) / 2;
  const titleSize = multiple ? 42 : 54;

  return `<g data-no-photo-layout="${multiple ? "itinerary" : "single"}">
    <text x="84" y="${top + 52}" font-size="32" font-weight="800" fill="${INK}">방문 순서</text>
    ${multiple ? `<path d="M114 ${first}V${first + step * (visits.length - 1)}" stroke="${RULE}" stroke-width="3" fill="none"/>` : ""}
    ${visits.map((visit, index) => {
      const y = first + step * index;
      return `<circle cx="114" cy="${y}" r="30" fill="${PAPER}" stroke="${INK}" stroke-width="2"/>
        <text x="114" y="${y + 9}" text-anchor="middle" font-size="25" font-weight="800" fill="${INK}">${visit.order ?? index + 1}</text>
        <text x="174" y="${y + (visit.subtitle ? 1 : 14)}" font-size="${titleSize}" font-weight="850" fill="${INK}">${xml(fitPosterText(visit.title, 802 / titleSize))}</text>
        ${visit.subtitle ? `<text x="176" y="${y + 37}" font-size="24" font-weight="600" fill="${MUTED}">${xml(fitPosterText(visit.subtitle, 32))}</text>` : ""}`;
    }).join("")}
  </g>`;
}
