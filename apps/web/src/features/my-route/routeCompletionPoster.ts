/**
 * 용도: 여행 기록의 사진을 불러오고 DAY 포토카드를 PNG로 생성·저장한다.
 * 동작 방식: 방문 기록을 테마 렌더러에 전달하며, 사진은 원본 데이터를 그대로 사용한다.
 */
import { routeApi } from "@/api/routeApi";
import { nativeBridge } from "@/native-bridge";
import type { RoutePosterThemeId } from "./models/routePosterTheme";
import { renderRoutePosterTheme } from "./utils/poster/renderRoutePosterTheme";
import { buildRoutePosterPages } from "./utils/poster/routePosterPages";
import { renderPosterPng } from "./utils/poster/renderPosterPng";
import {
  formatRouteDate,
  getRouteSubtitle,
  getRouteTitle,
  getSortedRouteDays,
  isVisitedStop,
} from "./routeDisplay";
import type { MyRoute, MyRouteStop } from "./types";

export const ROUTE_COMPLETION_POSTER_WIDTH = 1080;
export const ROUTE_COMPLETION_POSTER_HEIGHT = 1350;

export const ROUTE_COMPLETION_POSTER_BACKGROUNDS = [
  {
    id: "paper",
    preview: "linear-gradient(135deg, #fffaf0 0%, #f8edd8 54%, #e5f4df 100%)",
  },
  {
    id: "sunset",
    preview: "linear-gradient(135deg, #fff1e6 0%, #ffd9c2 54%, #fbcfe8 100%)",
  },
  {
    id: "ocean",
    preview: "linear-gradient(135deg, #ecfeff 0%, #cffafe 54%, #dbeafe 100%)",
  },
  {
    id: "forest",
    preview: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 54%, #fef3c7 100%)",
  },
  {
    id: "lavender",
    preview: "linear-gradient(135deg, #faf5ff 0%, #ede9fe 54%, #fce7f3 100%)",
  },
  {
    id: "dawn",
    preview: "linear-gradient(135deg, #eef2ff 0%, #dbeafe 54%, #e0e7ff 100%)",
  },
] as const;

export type RouteCompletionPosterBackgroundId =
  | (typeof ROUTE_COMPLETION_POSTER_BACKGROUNDS)[number]["id"]
  | "custom";

type PosterStop = MyRouteStop & {
  dayIndex: number;
};

type EmbeddedPhoto = {
  stopId: string;
  dataUrl: string | null;
};

type EmbeddedPlaceImage = {
  stopId: string;
  dataUrl: string | null;
};

type EmbeddedStopImage = {
  stopId: string;
  dataUrl: string | null;
};

const routeStopVerificationPhotoDataUrlCache = new Map<string, string>();
const routeStopVerificationPhotoUrlCache = new Map<string, string>();
const posterImageDataUrlCache = new Map<string, string>();
const posterImageRequestCache = new Map<string, Promise<string | null>>();
const POSTER_IMAGE_RETRY_DELAYS_MS = [450, 1_200, 2_000];
const MAX_POSTER_IMAGE_CACHE_ENTRIES = 24;

export type RouteCompletionPosterCard = {
  dayIndex: number;
  pageIndex: number;
  pageCount: number;
  label: string;
  dataUrl: string;
  fileName: string;
  embeddedPhotoCount: number;
  missingPhotoCount: number;
};

export type RouteCompletionPosterSaveResult = {
  mode: "native" | "web";
  completed: boolean;
};


type PosterTile = {
  index: number;
  stopId?: string;
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  verificationStatus: MyRouteStop["verificationStatus"] | "SUMMARY";
  isSummary?: boolean;
};

type PosterDayGroup = {
  key: string;
  label: string;
  subtitle: string;
  tiles: PosterTile[];
};

type BoardTilePosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const MAX_VISIBLE_DAY_GROUPS = 5;
const MAX_TILES_PER_DAY = 4;
const DAY_LIST_X = 72;
const DAY_LIST_Y = 280;
const DAY_LABEL_WIDTH = 110;
const DAY_ROW_HEIGHT = 112;
const DAY_ROW_GAP = 14;
const DAY_TILE_GAP = 12;
const DAY_TILE_WIDTH = 190;

const TILE_COLORS = [
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#ef4444",
  "#38bdf8",
  "#84cc16",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#22c55e",
  "#f43f5e",
  "#0ea5e9",
  "#a855f7",
  "#10b981",
];

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateText(value: string, maxLength: number) {
  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`;
}

function wrapText(value: string, maxLength: number, maxLines: number) {
  const text = value.replace(/\s+/g, " ").trim();

  if (!text) {
    return [""];
  }

  if (!text.includes(" ")) {
    const lines: string[] = [];

    for (let index = 0; index < text.length; index += maxLength) {
      lines.push(text.slice(index, index + maxLength));
    }

    return lines.slice(0, maxLines).map((line, index, linesToRender) => {
      const hasHiddenText = text.length > maxLength * maxLines;
      return hasHiddenText && index === linesToRender.length - 1
        ? truncateText(line, maxLength)
        : line;
    });
  }

  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (nextLine.length <= maxLength) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, maxLines).map((line, index, linesToRender) => {
    const hasHiddenText = lines.length > maxLines;
    return hasHiddenText && index === linesToRender.length - 1
      ? truncateText(line, maxLength)
      : line;
  });
}

function renderTextLines({
  lines,
  x,
  y,
  lineHeight,
  className,
  textAnchor = "start",
}: {
  lines: string[];
  x: number;
  y: number;
  lineHeight: number;
  className: string;
  textAnchor?: "start" | "middle" | "end";
}) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" class="${className}" text-anchor="${textAnchor}">${escapeXml(
          line
        )}</text>`
    )
    .join("");
}

function getPosterStops(route: MyRoute) {
  const dayStops = getSortedRouteDays(route).flatMap((day) =>
    [...day.stops]
      .sort((left, right) => left.order - right.order)
      .map(
        (stop): PosterStop => ({
          ...stop,
          dayIndex: day.dayIndex,
        })
      )
  );

  if (dayStops.length > 0) {
    return dayStops;
  }

  return [...route.stops]
    .sort((left, right) => left.order - right.order)
    .map(
      (stop): PosterStop => ({
        ...stop,
        dayIndex: 1,
      })
    );
}

function getCompletedPosterStops(route: MyRoute) {
  return getPosterStops(route).filter(isVisitedStop);
}

function getCompletedPosterDayGroups(route: MyRoute) {
  const days = getSortedRouteDays(route);

  if (days.length > 0) {
    return days
      .filter((day) => day.stops.length > 0 && day.stops.every(isVisitedStop))
      .map((day) => {
        const stops = [...day.stops]
          .sort((left, right) => left.order - right.order)
          .map(
            (stop): PosterStop => ({
              ...stop,
              dayIndex: day.dayIndex,
            })
          )
          .filter(isVisitedStop);

        return {
          dayIndex: day.dayIndex,
          dateLabel: formatRouteDate(day.date),
          stops,
        };
      })
      .filter((day) => day.stops.length > 0);
  }

  if (!route.stops.length || !route.stops.every(isVisitedStop)) return [];
  const groupedStops = new Map<number, PosterStop[]>();

  getCompletedPosterStops(route).forEach((stop) => {
    const stops = groupedStops.get(stop.dayIndex) ?? [];
    stops.push(stop);
    groupedStops.set(stop.dayIndex, stops);
  });

  return [...groupedStops.entries()]
    .sort(([leftDayIndex], [rightDayIndex]) => leftDayIndex - rightDayIndex)
    .map(([dayIndex, stops]) => ({
      dayIndex,
      dateLabel: null,
      stops: [...stops].sort((left, right) => left.order - right.order),
    }));
}

export function getRouteCompletionPosterStats(route: MyRoute) {
  const posterStops = getPosterStops(route);
  const completedStops = posterStops.filter(isVisitedStop);
  const photoVerifiedStopCount = completedStops.filter(
    (stop) => Boolean(stop.verificationPhotoUrl)
  ).length;
  const totalStopCount = Math.max(route.totalStopCount, posterStops.length);
  const completedStopCount = Math.max(
    route.completedStopCount,
    completedStops.length
  );

  return {
    canCreate: getCompletedPosterDayGroups(route).length > 0,
    completedStopCount,
    totalStopCount,
    photoVerifiedStopCount,
  };
}

function getPosterRank({
  completedStopCount,
  photoVerifiedStopCount,
}: {
  completedStopCount: number;
  photoVerifiedStopCount: number;
}) {
  if (completedStopCount > 0 && photoVerifiedStopCount === completedStopCount) {
    return {
      title: "PHOTO MASTER",
      label: "사진 기록 올클리어",
      color: "#b91c1c",
      accent: "#f59e0b",
    };
  }

  if (photoVerifiedStopCount > 0) {
    return {
      title: "PHOTO VERIFIED",
      label: `사진 기록 ${photoVerifiedStopCount}곳`,
      color: "#be123c",
      accent: "#f97316",
    };
  }

  return {
    title: "ROUTE CLEAR",
    label: "사진 인증 완료",
    color: "#0f766e",
    accent: "#14b8a6",
  };
}

function getVerificationLabel(status: PosterTile["verificationStatus"]) {
  if (status === "GPS_PHOTO") {
    return "PHOTO";
  }

  if (status === "GPS") {
    return "GPS";
  }

  if (status === "MANUAL") {
    return "VISIT";
  }

  if (status === "SUMMARY") {
    return "MORE";
  }

  return "CLEAR";
}

function getDateRangeLabel(route: MyRoute) {
  const startDate = formatRouteDate(route.travelStartDate);
  const endDate = formatRouteDate(route.travelEndDate);

  if (!startDate) {
    return "DATE OPEN";
  }

  if (!endDate || startDate === endDate) {
    return startDate;
  }

  return `${startDate} - ${endDate}`;
}

function getCompletionDateLabel(route: MyRoute) {
  const completedDate = formatRouteDate(route.completedAt);

  return completedDate ? `${completedDate} CLEAR` : "ROUTE CLEAR";
}

function createPosterTile(stop: PosterStop, index: number): PosterTile {
  return {
    index,
    stopId: stop.id,
    title: stop.place.title,
    subtitle: stop.place.categoryLabel ?? `DAY ${stop.dayIndex}`,
    imageUrl: stop.place.imageUrl,
    verificationStatus: stop.verificationPhotoUrl
      ? "GPS_PHOTO"
      : stop.verificationStatus,
  };
}

function createSummaryTile(index: number, hiddenStopCount: number): PosterTile {
  return {
    index,
    title: `외 ${hiddenStopCount}곳`,
    subtitle: "MORE",
    verificationStatus: "SUMMARY",
    isSummary: true,
  };
}

function buildPosterDayGroups(completedStops: PosterStop[]) {
  const groupedStops = new Map<number, PosterStop[]>();

  completedStops.forEach((stop) => {
    const stops = groupedStops.get(stop.dayIndex) ?? [];
    stops.push(stop);
    groupedStops.set(stop.dayIndex, stops);
  });

  const dayEntries = [...groupedStops.entries()]
    .sort(([leftDayIndex], [rightDayIndex]) => leftDayIndex - rightDayIndex)
    .map(([dayIndex, stops]) => [
      dayIndex,
      [...stops].sort((left, right) => left.order - right.order),
    ] as const);
  const visibleDayEntries =
    dayEntries.length > MAX_VISIBLE_DAY_GROUPS
      ? dayEntries.slice(0, MAX_VISIBLE_DAY_GROUPS - 1)
      : dayEntries;
  const overflowStops =
    dayEntries.length > MAX_VISIBLE_DAY_GROUPS
      ? dayEntries
          .slice(MAX_VISIBLE_DAY_GROUPS - 1)
          .flatMap(([, stops]) => stops)
      : [];
  let nextStopIndex = 1;

  const groups: PosterDayGroup[] = visibleDayEntries.map(
    ([dayIndex, dayStops]) => {
      const visibleStops =
        dayStops.length > MAX_TILES_PER_DAY
          ? dayStops.slice(0, MAX_TILES_PER_DAY - 1)
          : dayStops;
      const hiddenStopCount = dayStops.length - visibleStops.length;
      const tiles = visibleStops.map((stop) =>
        createPosterTile(stop, nextStopIndex++)
      );

      if (hiddenStopCount > 0) {
        tiles.push(createSummaryTile(nextStopIndex, hiddenStopCount));
        nextStopIndex += hiddenStopCount;
      }

      return {
        key: `day-${dayIndex}`,
        label: `DAY ${dayIndex}`,
        subtitle: `${dayStops.length}곳`,
        tiles,
      };
    }
  );

  if (overflowStops.length > 0) {
    const visibleStops = overflowStops.slice(0, MAX_TILES_PER_DAY - 1);
    const hiddenStopCount = overflowStops.length - visibleStops.length;
    const tiles = visibleStops.map((stop) =>
      createPosterTile(stop, nextStopIndex++)
    );

    if (hiddenStopCount > 0) {
      tiles.push(createSummaryTile(nextStopIndex, hiddenStopCount));
    }

    groups.push({
      key: "day-more",
      label: "MORE",
      subtitle: `${overflowStops.length}곳`,
      tiles,
    });
  }

  return groups;
}

function renderTile(
  tile: PosterTile,
  tileIndex: number,
  placeImageData: EmbeddedPlaceImage[],
  position: BoardTilePosition
) {
  const color = TILE_COLORS[tileIndex % TILE_COLORS.length];
  const titleLines = wrapText(tile.title, tile.isSummary ? 8 : 7, 2);
  const label = getVerificationLabel(tile.verificationStatus);
  const isPhotoVerified = tile.verificationStatus === "GPS_PHOTO";
  const stampColor = isPhotoVerified ? "#b91c1c" : "#0f766e";
  const stampFill = isPhotoVerified ? "#fff1c2" : "#dff9ef";
  const imageDataUrl = tile.stopId
    ? placeImageData.find((image) => image.stopId === tile.stopId)?.dataUrl
    : null;
  const clipId = `routeone-tile-image-${tileIndex}`;
  const headerX = position.x + 8;
  const headerY = position.y + 8;
  const headerWidth = position.w - 16;
  const headerHeight = 44;
  const imageX = position.x + 14;
  const imageY = position.y + 58;
  const imageWidth = position.w - 28;
  const imageHeight = 44;

  return `
    <g>
      <rect x="${position.x}" y="${position.y}" width="${position.w}" height="${position.h}" rx="18" fill="#fffdf7" stroke="#1f2937" stroke-width="4"/>
      <rect x="${headerX}" y="${headerY}" width="${headerWidth}" height="${headerHeight}" rx="12" fill="${color}"/>
      <rect x="${headerX + 8}" y="${headerY + 10}" width="36" height="24" rx="12" fill="#ffffff" opacity="0.92"/>
      <text x="${headerX + 26}" y="${headerY + 29}" class="tileHeaderIndex" text-anchor="middle">${String(
        tile.index
      ).padStart(2, "0")}</text>
      ${renderTextLines({
        lines: titleLines,
        x: headerX + 52,
        y: titleLines.length > 1 ? headerY + 20 : headerY + 29,
        lineHeight: 17,
        className: "tileHeaderTitle",
      })}
      <clipPath id="${clipId}">
        <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="12"/>
      </clipPath>
      <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="12" fill="#f3efe4"/>
      ${
        imageDataUrl
          ? `<image href="${escapeXml(
              imageDataUrl
            )}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
          : `<g clip-path="url(#${clipId})">
              <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" fill="#edf7ee"/>
              <path d="M${position.x + 18} ${position.y + 101} C${position.x + 52} ${position.y + 76} ${position.x + 82} ${position.y + 88} ${position.x + 114} ${position.y + 68} C${position.x + 144} ${position.y + 88} ${position.x + 168} ${position.y + 77} ${position.x + position.w - 18} ${position.y + 102} Z" fill="#cbd5e1"/>
              <circle cx="${position.x + position.w - 42}" cy="${position.y + 74}" r="11" fill="#facc15"/>
            </g>`
      }
      <rect x="${imageX + 6}" y="${imageY + imageHeight - 20}" width="48" height="16" rx="8" fill="#ffffff" opacity="0.92"/>
      <text x="${imageX + 30}" y="${imageY + imageHeight - 8}" class="tileSubtitle" text-anchor="middle">${escapeXml(
        tile.subtitle
      )}</text>
      <g transform="translate(${position.x + position.w - 58} ${imageY + imageHeight - 10}) rotate(-9)">
        <rect x="-36" y="-16" width="72" height="28" rx="14" fill="${stampFill}" stroke="${stampColor}" stroke-width="3"/>
        <text x="0" y="7" class="tileStamp" fill="${stampColor}" text-anchor="middle">${label}</text>
      </g>
    </g>
  `;
}

function renderDayGroup(
  group: PosterDayGroup,
  groupIndex: number,
  placeImageData: EmbeddedPlaceImage[]
) {
  const y = DAY_LIST_Y + groupIndex * (DAY_ROW_HEIGHT + DAY_ROW_GAP);
  const tileStartX = DAY_LIST_X + DAY_LABEL_WIDTH + 14;
  const labelColor = TILE_COLORS[groupIndex % TILE_COLORS.length];

  return `
    <g>
      <rect x="${DAY_LIST_X}" y="${y}" width="926" height="${DAY_ROW_HEIGHT}" rx="22" fill="#fffaf0" opacity="0.76"/>
      <rect x="${DAY_LIST_X}" y="${y}" width="${DAY_LABEL_WIDTH}" height="${DAY_ROW_HEIGHT}" rx="20" fill="${labelColor}" stroke="#111827" stroke-width="4"/>
      <text x="${DAY_LIST_X + DAY_LABEL_WIDTH / 2}" y="${y + 46}" class="dayLabel" text-anchor="middle">${escapeXml(
        group.label
      )}</text>
      <text x="${DAY_LIST_X + DAY_LABEL_WIDTH / 2}" y="${y + 78}" class="dayCount" text-anchor="middle">${escapeXml(
        group.subtitle
      )}</text>
      ${group.tiles
        .slice(0, MAX_TILES_PER_DAY)
        .map((tile, tileIndex) =>
          renderTile(
            tile,
            groupIndex * MAX_TILES_PER_DAY + tileIndex,
            placeImageData,
            {
              x: tileStartX + tileIndex * (DAY_TILE_WIDTH + DAY_TILE_GAP),
              y,
              w: DAY_TILE_WIDTH,
              h: DAY_ROW_HEIGHT,
            }
          )
        )
        .join("")}
    </g>
  `;
}

function renderPhotoSlot({
  photo,
  stop,
  index,
  y,
}: {
  photo: EmbeddedPhoto | null;
  stop: PosterStop | null;
  index: number;
  y: number;
}) {
  const x = 112 + index * 294;
  const clipId = `routeone-photo-${index}`;
  const rotation = index === 0 ? -4 : index === 1 ? 2 : 4;
  const title = stop ? truncateText(stop.place.title, 12) : "PHOTO PROOF";
  const dayLabel = stop ? `DAY ${stop.dayIndex}` : "LOCKED";

  return `
    <g transform="translate(${x} ${y}) rotate(${rotation} 122 122)">
      <rect x="0" y="0" width="244" height="244" rx="20" fill="#fffdf7" stroke="#1f2937" stroke-width="4"/>
      <rect x="18" y="18" width="208" height="158" rx="14" fill="#e5e7eb"/>
      <clipPath id="${clipId}">
        <rect x="18" y="18" width="208" height="158" rx="14"/>
      </clipPath>
      ${
        photo?.dataUrl
          ? `<image href="${escapeXml(
              photo.dataUrl
            )}" x="18" y="18" width="208" height="158" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
          : `<g>
              <rect x="18" y="18" width="208" height="158" rx="14" fill="#f3efe4"/>
              <path d="M58 132 C84 99 105 111 128 82 C154 116 173 99 214 142 L214 176 L58 176 Z" fill="#cbd5e1"/>
              <circle cx="88" cy="68" r="20" fill="#f59e0b"/>
              <text x="122" y="150" class="emptyPhoto" text-anchor="middle">STAMP</text>
            </g>`
      }
      <text x="122" y="204" class="photoTitle" text-anchor="middle">${escapeXml(
        title
      )}</text>
      <text x="122" y="226" class="photoSubtitle" text-anchor="middle">${escapeXml(
        dayLabel
      )}</text>
    </g>
  `;
}

function renderEmbossedText({
  x,
  y,
  text,
  className,
  textAnchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  className: string;
  textAnchor?: "start" | "middle" | "end";
}) {
  const escapedText = escapeXml(text);

  return `
    <text x="${x - 1}" y="${y - 1}" class="${className} embossHighlight" text-anchor="${textAnchor}">${escapedText}</text>
    <text x="${x + 1}" y="${y + 1}" class="${className} embossShadow" text-anchor="${textAnchor}">${escapedText}</text>
    <text x="${x}" y="${y}" class="${className} embossBase" text-anchor="${textAnchor}">${escapedText}</text>
  `;
}

function renderAwardBadge({
  rank,
  stats,
  route,
}: {
  rank: ReturnType<typeof getPosterRank>;
  stats: ReturnType<typeof getRouteCompletionPosterStats>;
  route: MyRoute;
}) {
  const statLabel = `${stats.completedStopCount} VISITED · ${stats.photoVerifiedStopCount} PHOTO · ${route.tripDays} DAYS`;

  return `
    <g>
      <rect x="704" y="66" width="316" height="182" rx="30" fill="#fffdf7" opacity="0.32"/>
      <rect x="714" y="76" width="296" height="162" rx="25" fill="none" stroke="#7c5c2a" stroke-width="2" opacity="0.14"/>
      <circle cx="760" cy="174" r="48" fill="none" stroke="${rank.color}" stroke-width="6" opacity="0.16"/>
      <circle cx="760" cy="174" r="32" fill="none" stroke="${rank.accent}" stroke-width="3" stroke-dasharray="8 7" opacity="0.18"/>
      <path d="M741 213 L724 248 L760 229 L795 248 L780 213 Z" fill="${rank.color}" opacity="0.09"/>
      ${renderEmbossedText({
        x: 862,
        y: 122,
        text: "CERTIFIED",
        className: "awardKicker",
      })}
      ${renderEmbossedText({
        x: 760,
        y: 171,
        text: "CLEAR",
        className: "awardSeal",
      })}
      ${renderEmbossedText({
        x: 760,
        y: 190,
        text: getCompletionDateLabel(route),
        className: "awardSealDate",
      })}
      ${renderEmbossedText({
        x: 892,
        y: 160,
        text: rank.title,
        className: "awardTitle",
      })}
      ${renderEmbossedText({
        x: 892,
        y: 198,
        text: rank.label,
        className: "awardLabel",
      })}
      ${renderEmbossedText({
        x: 892,
        y: 226,
        text: statLabel,
        className: "awardMeta",
      })}
    </g>
  `;
}

function renderPosterSvg({
  route,
  photoData,
  placeImageData,
}: {
  route: MyRoute;
  photoData: EmbeddedPhoto[];
  placeImageData: EmbeddedPlaceImage[];
}) {
  const completedStops = getCompletedPosterStops(route);
  const photoRecordStops = completedStops.filter((stop) =>
    Boolean(stop.verificationPhotoUrl)
  );
  const stats = getRouteCompletionPosterStats(route);
  const rank = getPosterRank(stats);
  const dayGroups = buildPosterDayGroups(completedStops);
  const titleLines = wrapText(getRouteTitle(route), 16, 2);
  const titleY = titleLines.length > 1 ? 152 : 178;
  const metaY = titleLines.length > 1 ? 228 : 226;
  const subtitle = getRouteSubtitle(route);
  const dayListEndY =
    DAY_LIST_Y +
    dayGroups.length * DAY_ROW_HEIGHT +
    Math.max(0, dayGroups.length - 1) * DAY_ROW_GAP;
  const statsY = Math.max(858, dayListEndY + 24);
  const photoY = statsY + 94;
  const photoSlots = Array.from({ length: 3 }, (_, index) => {
    const stop = photoRecordStops[index] ?? null;
    const photo = stop
      ? photoData.find((candidate) => candidate.stopId === stop.id) ?? null
      : null;

    return renderPhotoSlot({
      photo,
      stop,
      index,
      y: photoY,
    });
  }).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${ROUTE_COMPLETION_POSTER_WIDTH}" height="${ROUTE_COMPLETION_POSTER_HEIGHT}" viewBox="0 0 ${ROUTE_COMPLETION_POSTER_WIDTH} ${ROUTE_COMPLETION_POSTER_HEIGHT}">
  <defs>
    <linearGradient id="paperGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fff7df"/>
      <stop offset="48%" stop-color="#f8e7bf"/>
      <stop offset="100%" stop-color="#d8f3dc"/>
    </linearGradient>
    <radialGradient id="centerGlow" cx="50%" cy="42%" r="56%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#fef3c7" stop-opacity="0"/>
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="14" flood-color="#6b4f1d" flood-opacity="0.22"/>
    </filter>
    <style>
      .font { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
      text { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
      .kicker { font-size: 25px; font-weight: 900; letter-spacing: 4px; fill: #0f766e; }
      .posterTitle { font-size: 68px; font-weight: 950; fill: #111827; }
      .posterMeta { font-size: 28px; font-weight: 850; fill: #475569; }
      .rankWatermark { font-size: 88px; font-weight: 950; fill: #0f766e; opacity: 0.07; letter-spacing: 4px; }
      .awardKicker { font-size: 22px; font-weight: 950; letter-spacing: 4px; }
      .awardTitle { font-size: 31px; font-weight: 950; letter-spacing: 0.4px; }
      .awardLabel { font-size: 22px; font-weight: 900; }
      .awardMeta { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
      .awardSeal { font-size: 18px; font-weight: 950; }
      .awardSealDate { font-size: 12px; font-weight: 900; }
      .embossHighlight { fill: #fffefa; opacity: 0.7; }
      .embossShadow { fill: #6b4f1d; opacity: 0.2; }
      .embossBase { fill: #6b5b37; opacity: 0.26; }
      .statValue { font-size: 58px; font-weight: 950; fill: #111827; }
      .statLabel { font-size: 23px; font-weight: 900; fill: #64748b; }
      .dayLabel { font-size: 27px; font-weight: 950; fill: #ffffff; }
      .dayCount { font-size: 21px; font-weight: 950; fill: rgba(255,255,255,0.9); }
      .tileHeaderIndex { font-size: 19px; font-weight: 950; fill: #111827; }
      .tileHeaderTitle { font-size: 15px; font-weight: 950; fill: #111827; stroke: rgba(255,255,255,0.78); stroke-width: 3px; paint-order: stroke; }
      .tileSubtitle { font-size: 15px; font-weight: 900; fill: #64748b; }
      .tileStamp { font-size: 17px; font-weight: 950; }
      .photoTitle { font-size: 24px; font-weight: 950; fill: #111827; }
      .photoSubtitle { font-size: 19px; font-weight: 900; fill: #64748b; }
      .emptyPhoto { font-size: 20px; font-weight: 950; fill: #94a3b8; letter-spacing: 2px; }
      .footer { font-size: 22px; font-weight: 900; fill: #334155; letter-spacing: 3px; }
    </style>
  </defs>
  <rect width="1080" height="1350" fill="url(#paperGradient)"/>
  <rect x="30" y="30" width="1020" height="1290" rx="34" fill="none" stroke="#111827" stroke-width="7"/>
  <rect x="48" y="48" width="984" height="1254" rx="26" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.72"/>
  <path d="M72 224 C220 194 308 218 456 188 C616 158 730 176 1004 126" fill="none" stroke="#0f766e" stroke-width="5" stroke-dasharray="14 14" opacity="0.26"/>
  <path d="M74 980 C245 1038 396 992 532 1026 C686 1066 786 1028 1002 1076" fill="none" stroke="#b45309" stroke-width="5" stroke-dasharray="10 14" opacity="0.22"/>

  <text x="78" y="118" class="kicker">ROUTEONE TRAVEL BOARD</text>
  ${renderTextLines({
    lines: titleLines,
    x: 78,
    y: titleY,
    lineHeight: 58,
    className: "posterTitle",
  })}
  <text x="78" y="${metaY}" class="posterMeta">${escapeXml(
    `${getDateRangeLabel(route)} · ${subtitle}`
  )}</text>

  ${renderAwardBadge({ rank, stats, route })}

  <text x="540" y="640" class="rankWatermark" text-anchor="middle" transform="rotate(-8 540 640)">${escapeXml(
    rank.title
  )}</text>

  ${dayGroups
    .map((group, index) => renderDayGroup(group, index, placeImageData))
    .join("")}

  <g>
    <rect x="98" y="${statsY}" width="884" height="72" rx="24" fill="#fffdf7" stroke="#111827" stroke-width="4"/>
    <line x1="394" y1="${statsY + 16}" x2="394" y2="${statsY + 56}" stroke="#e2e8f0" stroke-width="3"/>
    <line x1="686" y1="${statsY + 16}" x2="686" y2="${statsY + 56}" stroke="#e2e8f0" stroke-width="3"/>
    <text x="246" y="${statsY + 48}" class="statValue" text-anchor="middle">${stats.completedStopCount}</text>
    <text x="326" y="${statsY + 46}" class="statLabel" text-anchor="middle">VISITED</text>
    <text x="540" y="${statsY + 48}" class="statValue" text-anchor="middle">${stats.photoVerifiedStopCount}</text>
    <text x="620" y="${statsY + 46}" class="statLabel" text-anchor="middle">PHOTO</text>
    <text x="820" y="${statsY + 48}" class="statValue" text-anchor="middle">${route.tripDays}</text>
    <text x="888" y="${statsY + 46}" class="statLabel" text-anchor="middle">DAYS</text>
  </g>

  ${photoSlots}

  <text x="540" y="1288" class="footer" text-anchor="middle">ROUTEONE · MY TRAVEL ACHIEVEMENT</text>
</svg>
`.trim();
}

export function cacheRouteStopVerificationPhotoDataUrl({
  stopId,
  photoUrl,
  dataUrl,
}: {
  stopId: string;
  photoUrl?: string | null;
  dataUrl?: string | null;
}) {
  if (!dataUrl?.startsWith("data:image/")) {
    return;
  }

  routeStopVerificationPhotoDataUrlCache.set(stopId, dataUrl);

  if (photoUrl) {
    routeStopVerificationPhotoUrlCache.set(photoUrl, dataUrl);
  }
}

function getCachedRouteStopVerificationPhotoDataUrl(stop: PosterStop) {
  const stopDataUrl = routeStopVerificationPhotoDataUrlCache.get(stop.id);

  if (stopDataUrl) {
    return stopDataUrl;
  }

  return stop.verificationPhotoUrl
    ? routeStopVerificationPhotoUrlCache.get(stop.verificationPhotoUrl) ?? null
    : null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function waitForPosterImageRetry(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function setPosterImageDataUrlCache(url: string, dataUrl: string) {
  posterImageDataUrlCache.delete(url);
  posterImageDataUrlCache.set(url, dataUrl);

  while (posterImageDataUrlCache.size > MAX_POSTER_IMAGE_CACHE_ENTRIES) {
    const oldestUrl = posterImageDataUrlCache.keys().next().value;

    if (!oldestUrl) {
      break;
    }

    posterImageDataUrlCache.delete(oldestUrl);
  }
}

function isCloudflareImageDeliveryUrl(url: string) {
  try {
    return new URL(url, window.location.href).hostname === "imagedelivery.net";
  } catch {
    return false;
  }
}

function getRouteOneTestPhotoDataUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "routeone-test:") {
      return null;
    }
  } catch {
    return null;
  }

  const accentColors = ["#14b8a6", "#f59e0b", "#38bdf8", "#f472b6"];
  const colorIndex = Array.from(url).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0
  ) % accentColors.length;
  const accent = accentColors[colorIndex];
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="260" viewBox="0 0 360 260">
  <rect width="360" height="260" rx="22" fill="#f8edd8"/>
  <rect x="18" y="18" width="324" height="224" rx="18" fill="#fffaf0" stroke="${accent}" stroke-width="6" stroke-dasharray="14 10"/>
  <path d="M42 198 C92 132 129 164 168 108 C218 174 256 136 318 204 L318 224 L42 224 Z" fill="#cbd5e1"/>
  <circle cx="268" cy="70" r="28" fill="#facc15"/>
  <text x="180" y="82" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Pretendard,sans-serif" font-size="28" font-weight="900" fill="#0f766e">TEST PHOTO</text>
  <text x="180" y="118" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Pretendard,sans-serif" font-size="18" font-weight="800" fill="#64748b">NO REAL IMAGE FILE</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function fetchCloudflareImageAsDataUrl(url: string) {
  if (!isCloudflareImageDeliveryUrl(url)) {
    return null;
  }

  try {
    const result = await routeApi.posterImageDataUrl(url);
    return result.posterImageDataUrl;
  } catch {
    return null;
  }
}

async function fetchImageAsDataUrlOnce(
  normalizedUrl: string,
  bypassBrowserCache: boolean
) {
  try {
    const response = await fetch(normalizedUrl, {
      cache: bypassBrowserCache ? "reload" : "default",
    });

    if (!response.ok) {
      return fetchCloudflareImageAsDataUrl(normalizedUrl);
    }

    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      return fetchCloudflareImageAsDataUrl(normalizedUrl);
    }

    return await blobToDataUrl(blob);
  } catch {
    return fetchCloudflareImageAsDataUrl(normalizedUrl);
  }
}

async function fetchImageAsDataUrlWithRetry(normalizedUrl: string) {
  const retryDelays = isCloudflareImageDeliveryUrl(normalizedUrl)
    ? POSTER_IMAGE_RETRY_DELAYS_MS
    : POSTER_IMAGE_RETRY_DELAYS_MS.slice(0, 1);

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const dataUrl = await fetchImageAsDataUrlOnce(
      normalizedUrl,
      attempt > 0
    );

    if (dataUrl?.startsWith("data:image/")) {
      return dataUrl;
    }

    const retryDelay = retryDelays[attempt];

    if (retryDelay !== undefined) {
      await waitForPosterImageRetry(retryDelay);
    }
  }

  return null;
}

async function fetchImageAsDataUrl(url: string) {
  if (url.startsWith("data:image/")) {
    return url;
  }

  const testPhotoDataUrl = getRouteOneTestPhotoDataUrl(url);

  if (testPhotoDataUrl) {
    return testPhotoDataUrl;
  }

  let normalizedUrl: string;

  try {
    normalizedUrl = new URL(url, window.location.href).toString();
  } catch {
    return null;
  }

  const cachedDataUrl = posterImageDataUrlCache.get(normalizedUrl);

  if (cachedDataUrl) {
    setPosterImageDataUrlCache(normalizedUrl, cachedDataUrl);
    return cachedDataUrl;
  }

  const inFlightRequest = posterImageRequestCache.get(normalizedUrl);

  if (inFlightRequest) {
    return inFlightRequest;
  }

  const request = fetchImageAsDataUrlWithRetry(normalizedUrl)
    .then((dataUrl) => {
      if (dataUrl) {
        setPosterImageDataUrlCache(normalizedUrl, dataUrl);
      }

      return dataUrl;
    })
    .finally(() => {
      posterImageRequestCache.delete(normalizedUrl);
    });

  posterImageRequestCache.set(normalizedUrl, request);

  return request;
}

async function getEmbeddedPhotoData(route: MyRoute) {
  const photoStops = getCompletedPosterStops(route)
    .filter((stop) => stop.verificationPhotoUrl)
    .slice(0, 3);

  return Promise.all(
    photoStops.map(async (stop): Promise<EmbeddedPhoto> => {
      const cachedDataUrl = getCachedRouteStopVerificationPhotoDataUrl(stop);
      const dataUrl = stop.verificationPhotoUrl
        ? cachedDataUrl ?? (await fetchImageAsDataUrl(stop.verificationPhotoUrl))
        : null;

      return {
        stopId: stop.id,
        dataUrl,
      };
    })
  );
}

async function getEmbeddedPlaceImageData(route: MyRoute) {
  const tiles = buildPosterDayGroups(getCompletedPosterStops(route)).flatMap(
    (group) => group.tiles
  );

  return Promise.all(
    tiles
      .filter((tile) => tile.stopId && tile.imageUrl)
      .map(async (tile): Promise<EmbeddedPlaceImage> => {
        const dataUrl = tile.imageUrl
          ? await fetchImageAsDataUrl(tile.imageUrl)
          : null;

        return {
          stopId: tile.stopId ?? "",
          dataUrl,
        };
      })
  );
}

async function getEmbeddedDayMemoryImageData(route: MyRoute) {
  const stops = getCompletedPosterDayGroups(route).flatMap((day) => day.stops);

  return Promise.all(
    stops
      .filter((stop) => Boolean(stop.verificationPhotoUrl))
      .map(async (stop): Promise<EmbeddedStopImage> => {
        const imageUrl = stop.verificationPhotoUrl;
        const cachedDataUrl =
          stop.verificationPhotoUrl
            ? getCachedRouteStopVerificationPhotoDataUrl(stop)
            : null;

        return {
          stopId: stop.id,
          dataUrl: imageUrl
            ? cachedDataUrl ?? (await fetchImageAsDataUrl(imageUrl))
            : null,
        };
      })
  );
}

function svgToPngDataUrl(svg: string) {
  return renderPosterPng(
    svg,
    ROUTE_COMPLETION_POSTER_WIDTH,
    ROUTE_COMPLETION_POSTER_HEIGHT
  );
}

export function prepareRouteCompletionPosterBackgroundImage(dataUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = ROUTE_COMPLETION_POSTER_WIDTH;
        canvas.height = ROUTE_COMPLETION_POSTER_HEIGHT;

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas context is not available."));
          return;
        }

        const sourceAspectRatio = image.naturalWidth / image.naturalHeight;
        const posterAspectRatio =
          ROUTE_COMPLETION_POSTER_WIDTH / ROUTE_COMPLETION_POSTER_HEIGHT;
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = image.naturalWidth;
        let sourceHeight = image.naturalHeight;

        if (sourceAspectRatio > posterAspectRatio) {
          sourceWidth = image.naturalHeight * posterAspectRatio;
          sourceX = (image.naturalWidth - sourceWidth) / 2;
        } else {
          sourceHeight = image.naturalWidth / posterAspectRatio;
          sourceY = (image.naturalHeight - sourceHeight) / 2;
        }

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          ROUTE_COMPLETION_POSTER_WIDTH,
          ROUTE_COMPLETION_POSTER_HEIGHT
        );
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      reject(new Error("Background image could not be loaded."));
    };
    image.src = dataUrl;
  });
}

export async function createRouteCompletionPosterDataUrl(route: MyRoute) {
  const [photoData, placeImageData] = await Promise.all([
    getEmbeddedPhotoData(route),
    getEmbeddedPlaceImageData(route),
  ]);
  const svg = renderPosterSvg({
    route,
    photoData,
    placeImageData,
  });

  return svgToPngDataUrl(svg);
}

export async function createRouteCompletionPosterCards(
  route: MyRoute,
  backgroundId: RouteCompletionPosterBackgroundId = "paper",
  backgroundImageDataUrl?: string | null,
  themeId: RoutePosterThemeId = "journal"
) {
  const dayGroups = getCompletedPosterDayGroups(route);
  const imageData = await getEmbeddedDayMemoryImageData(route);
  const imagesByStopId = new Map(imageData.map((image) => [image.stopId, image.dataUrl]));
  const cards: RouteCompletionPosterCard[] = [];

  // 여러 날의 고해상도 이미지를 한꺼번에 그려 모바일 메모리를 차지하지 않도록 순서대로 만든다.
  for (const day of dayGroups) {
    const stops = day.stops.map((stop, index) => ({
      stopId: stop.id,
      order: index + 1,
      title: stop.place.title,
      subtitle: stop.place.categoryLabel ?? "",
      verificationLabel: "",
      imageDataUrl: imagesByStopId.get(stop.id) ?? null,
    }));
    const embeddedPhotoCount = stops.filter((stop) => stop.imageDataUrl).length;
    const missingPhotoCount = day.stops.filter((stop) => stop.verificationPhotoUrl && !imagesByStopId.get(stop.id)).length;
    for (const page of buildRoutePosterPages(stops)) {
      const svg = renderRoutePosterTheme({
        ...page, themeId, backgroundId, backgroundImageDataUrl,
        title: getRouteTitle(route), dayIndex: day.dayIndex, dateLabel: day.dateLabel,
        stopCount: day.stops.length, photoCount: embeddedPhotoCount,
      });
      const suffix = page.pageCount > 1 ? `-${page.pageIndex}` : "";
      cards.push({
        dayIndex: day.dayIndex, pageIndex: page.pageIndex, pageCount: page.pageCount,
        label: `DAY ${day.dayIndex}${page.pageCount > 1 ? ` · ${page.pageIndex}/${page.pageCount}` : ""}`,
        dataUrl: await svgToPngDataUrl(svg),
        fileName: getRouteCompletionPosterFileName(route, day.dayIndex).replace(/\.png$/, `-${themeId}${suffix}.png`),
        embeddedPhotoCount: page.items.length,
        missingPhotoCount: page.pageIndex === 1 ? missingPhotoCount : 0,
      });
    }
  }
  return cards;
}

export function getRouteCompletionPosterFileName(
  route: MyRoute,
  dayIndex?: number
) {
  const safeTitle = getRouteTitle(route)
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 36);

  const daySuffix = dayIndex ? `-day-${String(dayIndex).padStart(2, "0")}` : "";

  return `routeone-${safeTitle}${daySuffix}-${route.id.slice(0, 8)}.png`;
}

export async function downloadRouteCompletionPoster(
  dataUrl: string,
  fileName: string,
  title = "RouteOne 포토카드"
): Promise<RouteCompletionPosterSaveResult> {
  const nativeSaveRequest = nativeBridge.media.saveImage({
    dataUrl,
    fileName,
    title,
  });

  if (nativeSaveRequest) {
    const saveResult = await nativeSaveRequest;

    return {
      mode: "native",
      completed: saveResult.shared,
    };
  }

  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  return {
    mode: "web",
    completed: true,
  };
}

export async function shareRouteCompletionPoster(
  dataUrl: string,
  fileName: string,
  title: string
) {
  if (!navigator.share || !navigator.canShare) {
    return false;
  }

  const blob = await fetch(dataUrl).then((response) => response.blob());
  const file = new File([blob], fileName, {
    type: "image/png",
  });

  if (!navigator.canShare({ files: [file] })) {
    return false;
  }

  await navigator.share({
    files: [file],
    title,
  });

  return true;
}
