/**
 * 용도: DAY 포토카드를 테마별 사진과 방문 목록을 담은 저장용 SVG로 만든다.
 * 동작 방식: 테마별 배경과 프레임을 그리고, 사진 원본과 방문 기록을 같은 좌표에 조합한다.
 */
import type { RoutePosterThemeInput, RoutePosterThemeItem, RoutePosterThemeId } from "../../models/routePosterTheme";
import { renderPosterVisits } from "./renderPosterVisits";
import { getRoutePosterPhotoLayout, type PosterPhotoRect } from "./routePosterLayout";
import { escapePosterText as xml, fitPosterText, renderPixelPosterText, renderPosterPhoto } from "./routePosterSvgParts";

type ThemePalette = { paper: string; base: string; dark: string; accent: string; soft: string };
const PALETTES: Record<string, ThemePalette> = {
  paper: { paper: "#f1e4c8", base: "#b8d5d7", dark: "#202b41", accent: "#cce98d", soft: "#ffd45d" },
  sunset: { paper: "#f5dcc9", base: "#ebbfab", dark: "#3b2534", accent: "#ffca9e", soft: "#ffc596" },
  ocean: { paper: "#dcece7", base: "#a8d8e5", dark: "#182f45", accent: "#9ce2e5", soft: "#b9e9ea" },
  forest: { paper: "#e1e6cf", base: "#b7d3ae", dark: "#213c32", accent: "#cde5a5", soft: "#dbe98d" },
  lavender: { paper: "#e9deea", base: "#c8b9dd", dark: "#302b47", accent: "#dac1fc", soft: "#e6c6eb" },
  dawn: { paper: "#e0e6f1", base: "#b7c9e1", dark: "#24334e", accent: "#b9d4fa", soft: "#d8ddf7" },
};

function renderThemeBackground(input: RoutePosterThemeInput, colors: ThemePalette) {
  const isPixel = input.themeId === "pixel";
  const base = isPixel ? colors.dark : input.themeId === "blocks" ? colors.base : colors.paper;
  // 앨범 사진은 종이색과 섞어 은은하게 깔고, 문구 뒤의 바탕으로 가독성을 유지한다.
  const customTintOpacity = ["fantasy", "journal", "polaroid"].includes(input.themeId) ? 0.6 : isPixel ? 0.88 : 0.76;
  const custom = input.backgroundId === "custom" && input.backgroundImageDataUrl
    ? `<image href="${xml(input.backgroundImageDataUrl)}" x="0" y="0" width="1080" height="1350" preserveAspectRatio="xMidYMid slice"/><rect width="1080" height="1350" fill="${base}" opacity="${customTintOpacity}"/>`
    : "";
  const pattern = input.themeId === "blocks"
    ? `<pattern id="themeTexture" width="44" height="44" patternUnits="userSpaceOnUse"><circle cx="14" cy="17" r="10" fill="#315c6a" opacity=".12"/><circle cx="14" cy="14" r="10" fill="#ffffff" opacity=".30"/><path d="M7 13a7 7 0 0 1 10-5" stroke="#fff" stroke-width="2" opacity=".45" fill="none"/></pattern>`
    : isPixel
      ? `<pattern id="themeTexture" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" stroke="#ffffff" stroke-width="1" opacity=".06" fill="none"/></pattern>`
      : `<pattern id="themeTexture" width="39" height="39" patternUnits="userSpaceOnUse"><circle cx="8" cy="13" r="1.3" fill="#826443" opacity=".09"/><circle cx="28" cy="32" r="1" fill="#826443" opacity=".07"/></pattern>`;
  return `<defs>${pattern}</defs><rect width="1080" height="1350" fill="${base}"/>${custom}<rect width="1080" height="1350" fill="url(#themeTexture)"/>`;
}

function renderJournalShell(input: RoutePosterThemeInput) {
  const polaroid = input.themeId === "polaroid";
  return `<rect x="32" y="32" width="1016" height="1286" rx="${polaroid ? 20 : 0}" fill="#fffdf6" fill-opacity=".18" stroke="#bdb5a0" stroke-width="2"/>
    <rect x="68" y="65" width="944" height="226" rx="10" fill="#fffdf6" fill-opacity=".94"/>
    <text x="100" y="110" class="eyebrow" fill="#597366">${polaroid ? "A DAY TO REMEMBER" : "MY TRAVEL JOURNAL"}</text>
    <text x="100" y="187" class="title" fill="#293c34">${xml(fitPosterText(input.title, 15.5))}</text>
    <text x="100" y="241" class="meta" fill="#69766e">DAY ${input.dayIndex} · ${xml(input.dateLabel ?? "TRAVEL MEMORY")} · ${input.stopCount}곳의 기록</text>
    <rect x="84" y="1135" width="912" height="96" rx="8" fill="#fffdf6" fill-opacity=".94"/>
    <text x="112" y="1177" font-size="26" font-weight="700" fill="#40584d">${input.stopCount}곳을 둘러본 하루</text>
    <text x="112" y="1211" font-size="21" fill="#718075">${input.photoCount ? `사진 ${input.photoCount}장과 함께 남긴 여행` : "장소마다 쌓인 오늘의 기억"}</text>
    <text x="966" y="1192" text-anchor="end" font-size="23" fill="#597366">DAY ${String(input.dayIndex).padStart(2, "0")}</text>
    <text x="540" y="1280" text-anchor="middle" class="brand" fill="#637669">ROUTEONE · MY TRAVEL MEMORY</text>`;
}

function renderBlockShell(input: RoutePosterThemeInput, colors: ThemePalette) {
  return `<rect x="40" y="40" width="1000" height="1270" rx="22" stroke="#517b83" stroke-width="4" fill="none"/>
    <rect x="89" y="79" width="912" height="211" rx="14" fill="#47646b" opacity=".20"/>
    <rect x="80" y="64" width="912" height="211" rx="14" fill="#c7a13e"/>
    <rect x="80" y="64" width="912" height="197" rx="14" fill="${colors.soft}"/>
    <text x="114" y="112" class="eyebrow" fill="#29475a">BUILD YOUR MEMORIES · DAY ${input.dayIndex}</text>
    <text x="114" y="181" class="title" fill="#18384c">${xml(fitPosterText(input.title, 15.5))}</text>
    <text x="114" y="229" class="meta" fill="#38536a">${xml(input.dateLabel ?? `DAY ${input.dayIndex}`)} · ${input.stopCount}곳 방문</text>
    <rect x="84" y="1135" width="912" height="98" rx="12" fill="#fff7df"/>
    <text x="120" y="1195" class="footer" fill="#24475d">${input.stopCount} PLACES · ${input.photoCount} PHOTOS</text>
    <rect x="759" y="1153" width="211" height="58" rx="6" fill="${colors.soft}"/>
    <text x="865" y="1190" text-anchor="middle" font-size="23" font-weight="900" fill="#24475d">DAY BUILT!</text>
    <text x="540" y="1280" text-anchor="middle" class="brand" fill="#38536a">ROUTEONE · BUILD YOUR JOURNEY</text>`;
}

function renderPixelShell(input: RoutePosterThemeInput, colors: ThemePalette) {
  return `<rect x="32" y="32" width="1016" height="1286" fill="none" stroke="#71849b" stroke-width="12"/><rect x="49" y="49" width="982" height="1252" fill="none" stroke="#0e192c" stroke-width="6"/>
    ${renderPixelPosterText(`DAY ${String(input.dayIndex).padStart(2, "0")}`, 86, 84, 6, colors.accent)}
    <text x="86" y="209" class="title" fill="#f4f2d6">${xml(fitPosterText(input.title, 16))}</text>
    <text x="86" y="264" class="meta" fill="#c0ccdd">${xml(input.dateLabel ?? "TRAVEL LOG")} · ${input.stopCount} PLACES</text>
    <g fill="${colors.accent}" shape-rendering="crispEdges"><path d="M950 91h12v12h12v12h-12v12h-12v-12h-12v-12h12z"/><rect x="917" y="150" width="9" height="9" opacity=".5"/></g>
    <path d="M84 1126H996" stroke="#8294ab" stroke-width="4" stroke-dasharray="12 12"/>
    ${renderPixelPosterText("STAGE CLEAR", 86, 1160, 6, colors.accent)}
    <text x="995" y="1200" text-anchor="end" font-size="25" fill="#d5deeb">${input.photoCount} PHOTOS</text>
    <text x="540" y="1280" text-anchor="middle" class="brand" fill="#aebed2">ROUTEONE / TRAVEL SAVE DATA</text>`;
}

function renderFantasyShell(input: RoutePosterThemeInput) {
  const textBacking = input.backgroundId === "custom" && input.backgroundImageDataUrl
    ? `<g fill="#fcf2da" fill-opacity=".94" stroke="#bca06a" stroke-width="2">
        <rect x="84" y="70" width="912" height="184" rx="10"/>
        <rect x="68" y="1159" width="698" height="60" rx="8"/>
        <rect x="236" y="1248" width="608" height="48" rx="8"/>
      </g>`
    : "";
  return `<rect x="32" y="32" width="1016" height="1286" rx="5" fill="none" stroke="#a98a54" stroke-width="4"/>
    <rect x="47" y="47" width="986" height="1256" rx="3" fill="none" stroke="#bc9c65" stroke-width="2"/>
    ${[[64,64],[1016,64],[64,1286],[1016,1286]].map(([x,y])=>`<g transform="translate(${x} ${y})"><path d="M-19 0L0-19 19 0 0 19Z" fill="#c2a16b"/><circle r="5" fill="#7c6844"/></g>`).join("")}
    ${textBacking}
    <text x="540" y="107" text-anchor="middle" class="eyebrow" fill="#93733f">THE TRAVELER’S JOURNAL</text>
    <text x="540" y="184" text-anchor="middle" class="title" fill="#563e2b">${xml(fitPosterText(input.title, 16))}</text>
    <text x="540" y="236" text-anchor="middle" class="meta" fill="#886a48">DAY ${input.dayIndex} · ${xml(input.dateLabel ?? "TRAVEL MEMORY")}</text>
    <path d="M333 278H507m66 0h174m-207-10 10 10-10 10-10-10Z" fill="none" stroke="#ac8a52" stroke-width="2"/>
    <path d="M84 1148H744" stroke="#bea473" stroke-width="2"/>
    <text x="84" y="1197" class="footer" fill="#795c3d">${input.stopCount}곳의 발자취 · ${input.photoCount}장의 기억</text>
    <g transform="translate(900 1178) rotate(-9)"><circle r="64" fill="#844951"/><circle r="53" fill="none" stroke="#bd8580" stroke-width="3"/><text y="-6" text-anchor="middle" font-size="22" fill="#fff0cb">모험 완료</text><text y="25" text-anchor="middle" font-size="20" fill="#efd8b8">DAY ${input.dayIndex}</text></g>
    <text x="540" y="1280" text-anchor="middle" class="brand" fill="#8d6e43">ROUTEONE · A JOURNEY TO REMEMBER</text>`;
}

function renderPhotoFrame(item: RoutePosterThemeItem, rect: PosterPhotoRect, index: number, theme: RoutePosterThemeId, dayIndex: number) {
  const { x, y, width, height } = rect;
  const padding = theme === "blocks" ? 22 : 16;
  const photoRect = { x: x + padding, y: y + padding, width: width - padding * 2, height: height - padding - 92 };
  const color = theme === "pixel" ? "#e1e9e5" : theme === "blocks" ? "#234258" : "#674d32";
  let frame: string;
  if (theme === "blocks") {
    const frameColor = ["#347cba", "#dc6452", "#479a78", "#d6a736", "#946daf", "#467f95"][index];
    frame = `<rect x="${x + 7}" y="${y + 10}" width="${width}" height="${height}" rx="13" fill="#315764" opacity=".22"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="${frameColor}"/>
      <rect x="${x + 12}" y="${y + 14}" width="${width - 24}" height="${height - 31}" rx="3" fill="#fff8e6"/>
      ${Array.from({length: Math.floor((width - 35) / 32)}, (_,i)=>`<circle cx="${x + 24 + i * 32}" cy="${y + 7}" r="4" fill="#fff" opacity=".45"/>`).join("")}`;
  } else if (theme === "pixel") {
    frame = `<g shape-rendering="crispEdges"><rect x="${x + 8}" y="${y + 8}" width="${width}" height="${height}" fill="#0c1729"/><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#344159" stroke="#869bb0" stroke-width="7"/><path d="M${x + 5} ${y + height - 6}V${y + 6}H${x + width - 6}" stroke="#c9d5e0" stroke-width="3" opacity=".2" fill="none"/></g>`;
  } else if (theme === "journal" || theme === "polaroid") {
    frame = `<rect x="${x + 4}" y="${y + 7}" width="${width}" height="${height}" fill="#524735" opacity=".10"/><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fffdf8" stroke="#d8d0bf" stroke-width="2"/>`;
  } else {
    frame = `<rect x="${x + 4}" y="${y + 7}" width="${width}" height="${height}" fill="#785630" opacity=".12"/><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#fcf2da" stroke="#bca06a" stroke-width="3"/>`;
  }
  const photo = renderPosterPhoto(item.imageDataUrl, photoRect, `theme-photo-${dayIndex}-${index}`);
  const title = fitPosterText(item.title, (width - padding * 2 - 42) / 27);
  const meta = item.subtitle;
  const content = `${frame}${photo}<text x="${x + padding}" y="${y + height - 54}" font-size="23" fill="${color}" opacity=".65">${String(item.order ?? index + 1).padStart(2, "0")}</text><text x="${x + padding + 40}" y="${y + height - 54}" font-size="27" font-weight="800" fill="${color}">${xml(title)}</text><text x="${x + padding}" y="${y + height - 25}" font-size="19" fill="${color}" opacity=".78">${xml(fitPosterText(meta, (width - padding * 2) / 19))}</text>`;
  if (theme !== "polaroid") return content;
  const angle = index % 2 ? 1.2 : -1.2;
  return `<g transform="rotate(${angle} ${x + width / 2} ${y + height / 2})">${content}<rect x="${x + width / 2 - 42}" y="${y - 8}" width="84" height="22" fill="#cab9a1" opacity=".75"/></g>`;
}

export function renderRoutePosterTheme(input: RoutePosterThemeInput) {
  const colors = PALETTES[input.backgroundId] ?? PALETTES.paper;
  const hasPhotos = input.items.length > 0;
  const visits = input.visits ?? [];
  const visitHeight = visits.length ? (hasPhotos ? 94 + Math.ceil(visits.length / 2) * 64 : 766) : 0;
  const photoArea = { x: 84, y: 326, width: 912, height: 766 - (hasPhotos && visitHeight ? visitHeight + 24 : 0) };
  const layouts = getRoutePosterPhotoLayout(input.items.length, input.themeId, photoArea);
  const shell = input.themeId === "blocks" ? renderBlockShell(input, colors)
    : input.themeId === "pixel" ? renderPixelShell(input, colors) : input.themeId === "fantasy" ? renderFantasyShell(input) : renderJournalShell(input);
  const font = input.themeId === "fantasy" ? 'Georgia, "Apple SD Gothic Neo", serif' : input.themeId === "pixel" ? 'ui-monospace, "Apple SD Gothic Neo", monospace' : '-apple-system, "Apple SD Gothic Neo", sans-serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" data-poster-theme="${input.themeId}">
    <style>text{font-family:${font}}.title{font-size:56px;font-weight:900}.eyebrow{font-size:24px;font-weight:800;letter-spacing:3px}.meta{font-size:26px;font-weight:600}.footer{font-size:29px;font-weight:700}.brand{font-size:21px;font-weight:700;letter-spacing:2px}</style>
    ${renderThemeBackground(input, colors)}${shell}
    ${renderPosterVisits(visits, hasPhotos ? 1092 - visitHeight : 326, visitHeight, hasPhotos, input.themeId === "pixel")}
    ${input.items.map((item,index)=>renderPhotoFrame(item,layouts[index],index,input.themeId,input.dayIndex)).join("")}
    ${input.pageCount > 1 ? `<text x="980" y="1300" text-anchor="end" font-size="20" fill="${input.themeId === "pixel" ? "#becbdb" : "#677568"}">${input.pageIndex} / ${input.pageCount}</text>` : ""}
  </svg>`;
}
