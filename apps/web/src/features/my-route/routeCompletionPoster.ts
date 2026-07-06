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

export type RouteCompletionPosterCard = {
  dayIndex: number;
  label: string;
  dataUrl: string;
  fileName: string;
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
    (stop) => stop.verificationStatus === "GPS_PHOTO"
  ).length;
  const totalStopCount = Math.max(route.totalStopCount, posterStops.length);
  const completedStopCount = Math.max(
    route.completedStopCount,
    completedStops.length
  );

  return {
    canCreate: totalStopCount > 0 && completedStopCount >= totalStopCount,
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
      label: "사진 인증 올클리어",
      color: "#b91c1c",
      accent: "#f59e0b",
    };
  }

  if (photoVerifiedStopCount > 0) {
    return {
      title: "PHOTO VERIFIED",
      label: `사진 인증 ${photoVerifiedStopCount}곳`,
      color: "#be123c",
      accent: "#f97316",
    };
  }

  return {
    title: "ROUTE CLEAR",
    label: "방문 인증 완료",
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
    verificationStatus: stop.verificationStatus,
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
  const photoVerifiedStops = completedStops.filter(
    (stop) => stop.verificationStatus === "GPS_PHOTO"
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
    const stop = photoVerifiedStops[index] ?? null;
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

type DayMemoryItem = {
  index: number;
  stopId?: string;
  title: string;
  subtitle: string;
  verificationStatus: PosterTile["verificationStatus"];
  isSummary?: boolean;
};

type PolaroidLayout = {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  rowIndex: number;
};

const DAY_MEMORY_MAX_POLAROIDS = 6;

function getStopMemoryImageUrl(stop: PosterStop) {
  if (stop.verificationStatus === "GPS_PHOTO" && stop.verificationPhotoUrl) {
    return stop.verificationPhotoUrl;
  }

  return stop.place.imageUrl;
}

function buildDayMemoryItems(stops: PosterStop[]) {
  const visibleStops =
    stops.length > DAY_MEMORY_MAX_POLAROIDS
      ? stops.slice(0, DAY_MEMORY_MAX_POLAROIDS - 1)
      : stops;
  const items = visibleStops.map(
    (stop, index): DayMemoryItem => ({
      index: index + 1,
      stopId: stop.id,
      title: stop.place.title,
      subtitle: stop.place.categoryLabel ?? `DAY ${stop.dayIndex}`,
      verificationStatus: stop.verificationStatus,
    })
  );

  if (stops.length > DAY_MEMORY_MAX_POLAROIDS) {
    items.push({
      index: DAY_MEMORY_MAX_POLAROIDS,
      title: `외 ${stops.length - DAY_MEMORY_MAX_POLAROIDS + 1}곳`,
      subtitle: "추가 방문지",
      verificationStatus: "SUMMARY",
      isSummary: true,
    });
  }

  return items;
}

function getPolaroidLayouts(count: number): PolaroidLayout[] {
  const cardWidth = 254;
  const cardHeight = 326;
  const gap = 42;
  const rotations = [-5, 3, -2, 4, -4, 2];
  const rowCounts =
    count <= 3 ? [count] : count === 4 ? [2, 2] : count === 5 ? [3, 2] : [3, 3];
  const rowYs = rowCounts.length === 1 ? [432] : [336, 728];

  return rowCounts.flatMap((rowCount, rowIndex) => {
    const rowWidth = rowCount * cardWidth + Math.max(0, rowCount - 1) * gap;
    const startX = Math.round((ROUTE_COMPLETION_POSTER_WIDTH - rowWidth) / 2);

    return Array.from({ length: rowCount }, (_, index) => {
      const absoluteIndex =
        rowCounts.slice(0, rowIndex).reduce((sum, value) => sum + value, 0) +
        index;

      return {
        x: startX + index * (cardWidth + gap),
        y: rowYs[rowIndex] ?? rowYs[0],
        w: cardWidth,
        h: cardHeight,
        rotation: rotations[absoluteIndex % rotations.length] ?? 0,
        rowIndex,
      };
    });
  });
}

function renderWashiTape({
  x,
  y,
  rotation,
}: {
  x: number;
  y: number;
  rotation: number;
}) {
  return `
    <g transform="translate(${x} ${y}) rotate(${rotation} 34 12)" opacity="0.82">
      <rect x="0" y="0" width="68" height="24" rx="4" fill="#8b7ab8"/>
      <path d="M8 2 L20 22 M28 2 L40 22 M48 2 L60 22" stroke="#ffffff" stroke-width="3" opacity="0.22"/>
    </g>
  `;
}

function renderMemoryLine(y: number) {
  return `
    <path d="M92 ${y} C250 ${y - 30} 370 ${y + 30} 528 ${y} C690 ${
      y - 28
    } 820 ${y + 30} 990 ${y - 4}" fill="none" stroke="#b08a55" stroke-width="6" stroke-linecap="round" opacity="0.46"/>
    <path d="M92 ${y + 6} C250 ${y - 24} 370 ${y + 36} 528 ${
      y + 6
    } C690 ${y - 22} 820 ${y + 36} 990 ${
      y + 2
    }" fill="none" stroke="#fef3c7" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
  `;
}

function renderPolaroidCard({
  item,
  layout,
  imageData,
}: {
  item: DayMemoryItem;
  layout: PolaroidLayout;
  imageData: EmbeddedStopImage[];
}) {
  const imageX = 22;
  const imageY = 26;
  const imageWidth = layout.w - 44;
  const imageHeight = 196;
  const clipId = `routeone-day-polaroid-${item.stopId ?? "summary"}-${
    item.index
  }`;
  const dataUrl = item.stopId
    ? imageData.find((image) => image.stopId === item.stopId)?.dataUrl
    : null;
  const titleLines = wrapText(item.title, item.isSummary ? 8 : 10, 2);
  const statusLabel = getVerificationLabel(item.verificationStatus);
  const isPhoto = item.verificationStatus === "GPS_PHOTO";
  const stampColor = isPhoto ? "#be123c" : "#0f766e";
  const stampFill = isPhoto ? "#fff1c2" : "#dff9ef";

  return `
    <g transform="translate(${layout.x} ${layout.y}) rotate(${layout.rotation} ${
      layout.w / 2
    } ${layout.h / 2})">
      <rect x="8" y="10" width="${layout.w}" height="${
        layout.h
      }" rx="10" fill="#6b4f1d" opacity="0.16"/>
      <rect x="0" y="0" width="${layout.w}" height="${
        layout.h
      }" rx="10" fill="#fffdf7" stroke="#f2e6cc" stroke-width="3"/>
      <clipPath id="${clipId}">
        <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="4"/>
      </clipPath>
      <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="4" fill="#efe7d4"/>
      ${
        dataUrl
          ? `<image href="${escapeXml(
              dataUrl
            )}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`
          : `<g clip-path="url(#${clipId})">
              <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" fill="#dbeafe"/>
              <path d="M${imageX} ${imageY + 156} C${
                imageX + 50
              } ${imageY + 104} ${imageX + 88} ${imageY + 132} ${
                imageX + 126
              } ${imageY + 86} C${imageX + 160} ${imageY + 134} ${
                imageX + 186
              } ${imageY + 110} ${imageX + imageWidth} ${
                imageY + 148
              } L${imageX + imageWidth} ${imageY + imageHeight} L${imageX} ${
                imageY + imageHeight
              } Z" fill="#bfdbfe"/>
              <circle cx="${imageX + imageWidth - 38}" cy="${
                imageY + 38
              }" r="18" fill="#facc15"/>
            </g>`
      }
      ${
        item.isSummary
          ? `<g>
              <rect x="${imageX + 18}" y="${imageY + 34}" width="${
                imageWidth - 36
              }" height="${imageHeight - 68}" rx="18" fill="#ffffff" opacity="0.74"/>
              <text x="${layout.w / 2}" y="${
                imageY + 104
              }" class="memorySummaryValue" text-anchor="middle">${escapeXml(
                item.title
              )}</text>
              <text x="${layout.w / 2}" y="${
                imageY + 142
              }" class="memorySummaryLabel" text-anchor="middle">MORE PLACES</text>
            </g>`
          : ""
      }
      <g transform="translate(${layout.w - 58} ${
        imageY + imageHeight - 4
      }) rotate(-8)">
        <rect x="-46" y="-17" width="92" height="30" rx="15" fill="${stampFill}" stroke="${stampColor}" stroke-width="3"/>
        <text x="0" y="6" class="memoryStamp" fill="${stampColor}" text-anchor="middle">${statusLabel}</text>
      </g>
      ${renderTextLines({
        lines: titleLines,
        x: layout.w / 2,
        y: 260,
        lineHeight: 29,
        className: "memoryPlaceTitle",
        textAnchor: "middle",
      })}
      <text x="${layout.w / 2}" y="314" class="memoryPlaceMeta" text-anchor="middle">${escapeXml(
        item.subtitle
      )}</text>
      <g transform="translate(${layout.w / 2 - 29} -24) rotate(${
        -layout.rotation * 0.45
      } 29 36)">
        <ellipse cx="29" cy="62" rx="32" ry="7" fill="#6b4f1d" opacity="0.13"/>
        <rect x="6" y="0" width="46" height="66" rx="7" fill="#d7ad76" stroke="#9a6b3a" stroke-width="2"/>
        <rect x="12" y="6" width="34" height="54" rx="5" fill="#f1cf9b" opacity="0.72"/>
        <line x1="29" y1="5" x2="29" y2="61" stroke="#9a6b3a" stroke-width="2" opacity="0.44"/>
        <rect x="18" y="22" width="22" height="18" rx="7" fill="#b98d58" opacity="0.42"/>
        <circle cx="29" cy="31" r="7" fill="#d7d9de" stroke="#8b8f97" stroke-width="2" opacity="0.86"/>
        <path d="M12 18 L46 15" stroke="#fff3d8" stroke-width="2" opacity="0.45"/>
        <path d="M12 48 L46 45" stroke="#8a6236" stroke-width="2" opacity="0.22"/>
        <rect x="18" y="62" width="22" height="16" rx="4" fill="#c79a62" stroke="#9a6b3a" stroke-width="2"/>
      </g>
    </g>
  `;
}

function renderDayMemoryBadge({
  dayIndex,
  photoCount,
  stopCount,
}: {
  dayIndex: number;
  photoCount: number;
  stopCount: number;
}) {
  return `
    <g opacity="0.46" transform="rotate(-7 848 170)">
      <circle cx="848" cy="170" r="104" fill="none" stroke="#b45309" stroke-width="6" stroke-dasharray="16 12"/>
      <circle cx="848" cy="170" r="78" fill="none" stroke="#0f766e" stroke-width="5" opacity="0.5"/>
      <circle cx="848" cy="170" r="52" fill="none" stroke="#b45309" stroke-width="3" opacity="0.18"/>
      ${renderEmbossedText({
        x: 848,
        y: 146,
        text: `DAY ${dayIndex}`,
        className: "memoryBadgeTitle",
      })}
      ${renderEmbossedText({
        x: 848,
        y: 186,
        text: "MEMORY",
        className: "memoryBadgeLabel",
      })}
      ${renderEmbossedText({
        x: 848,
        y: 222,
        text: `${stopCount} VISITED · ${photoCount} PHOTO`,
        className: "memoryBadgeMeta",
      })}
    </g>
  `;
}

function renderDayMemorySvg({
  route,
  day,
  imageData,
}: {
  route: MyRoute;
  day: ReturnType<typeof getCompletedPosterDayGroups>[number];
  imageData: EmbeddedStopImage[];
}) {
  const items = buildDayMemoryItems(day.stops);
  const layouts = getPolaroidLayouts(items.length);
  const rowIndexes = [...new Set(layouts.map((layout) => layout.rowIndex))];
  const lineYs = rowIndexes.map((rowIndex) => {
    const rowLayout = layouts.find((layout) => layout.rowIndex === rowIndex);

    return (rowLayout?.y ?? 336) + 16;
  });
  const photoCount = day.stops.filter(
    (stop) => stop.verificationStatus === "GPS_PHOTO"
  ).length;
  const subtitle = day.dateLabel
    ? `${day.dateLabel} · ${day.stops.length}곳`
    : `${day.stops.length}곳`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${ROUTE_COMPLETION_POSTER_WIDTH}" height="${ROUTE_COMPLETION_POSTER_HEIGHT}" viewBox="0 0 ${ROUTE_COMPLETION_POSTER_WIDTH} ${ROUTE_COMPLETION_POSTER_HEIGHT}">
  <defs>
    <linearGradient id="memoryPaper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fffaf0"/>
      <stop offset="54%" stop-color="#f8edd8"/>
      <stop offset="100%" stop-color="#e5f4df"/>
    </linearGradient>
    <pattern id="memoryGrain" width="36" height="36" patternUnits="userSpaceOnUse">
      <circle cx="5" cy="8" r="1.4" fill="#7c5c2a" opacity="0.08"/>
      <circle cx="26" cy="19" r="1.1" fill="#0f766e" opacity="0.06"/>
      <circle cx="15" cy="31" r="1.2" fill="#b45309" opacity="0.05"/>
    </pattern>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif; }
      .memoryKicker { font-size: 25px; font-weight: 950; fill: #0f766e; letter-spacing: 4px; }
      .memoryTitle { font-size: 78px; font-weight: 950; fill: #111827; }
      .memorySubtitle { font-size: 28px; font-weight: 900; fill: #64748b; }
      .memoryRoute { font-size: 24px; font-weight: 900; fill: #b45309; letter-spacing: 1px; }
      .memoryPlaceTitle { font-size: 27px; font-weight: 950; fill: #111827; }
      .memoryPlaceMeta { font-size: 18px; font-weight: 900; fill: #64748b; }
      .memoryStamp { font-size: 18px; font-weight: 950; }
      .memorySummaryValue { font-size: 34px; font-weight: 950; fill: #111827; }
      .memorySummaryLabel { font-size: 19px; font-weight: 950; fill: #64748b; letter-spacing: 2px; }
      .memoryBadgeTitle { font-size: 42px; font-weight: 950; letter-spacing: 1px; }
      .memoryBadgeLabel { font-size: 30px; font-weight: 950; letter-spacing: 3px; }
      .memoryBadgeMeta { font-size: 17px; font-weight: 900; letter-spacing: 0.5px; }
      .embossHighlight { fill: #fffefa; opacity: 0.74; }
      .embossShadow { fill: #6b4f1d; opacity: 0.19; }
      .embossBase { fill: #6b5b37; opacity: 0.28; }
      .memoryStatValue { font-size: 46px; font-weight: 950; fill: #111827; }
      .memoryStatLabel { font-size: 20px; font-weight: 900; fill: #64748b; }
      .memoryFooter { font-size: 22px; font-weight: 950; fill: #334155; letter-spacing: 3px; }
    </style>
  </defs>
  <rect width="1080" height="1350" fill="url(#memoryPaper)"/>
  <rect width="1080" height="1350" fill="url(#memoryGrain)"/>
  <rect x="36" y="36" width="1008" height="1278" rx="42" fill="none" stroke="#111827" stroke-width="7" opacity="0.9"/>
  <rect x="56" y="56" width="968" height="1238" rx="32" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.8"/>
  ${renderWashiTape({ x: 70, y: 152, rotation: -18 })}
  ${renderWashiTape({ x: 918, y: 274, rotation: 16 })}
  ${renderWashiTape({ x: 106, y: 1122, rotation: 14 })}
  ${renderWashiTape({ x: 882, y: 1116, rotation: -12 })}

  <text x="88" y="128" class="memoryKicker">ROUTEONE DAY MEMORY</text>
  <text x="88" y="204" class="memoryTitle">DAY ${day.dayIndex}</text>
  <text x="88" y="252" class="memorySubtitle">${escapeXml(subtitle)}</text>
  <text x="88" y="292" class="memoryRoute">${escapeXml(getRouteTitle(route))}</text>
  ${renderDayMemoryBadge({
    dayIndex: day.dayIndex,
    photoCount,
    stopCount: day.stops.length,
  })}

  ${lineYs.map(renderMemoryLine).join("")}
  ${items
    .map((item, index) =>
      renderPolaroidCard({
        item,
        layout: layouts[index],
        imageData,
      })
    )
    .join("")}

  <g>
    <rect x="170" y="1136" width="740" height="76" rx="24" fill="#fffdf7" stroke="#111827" stroke-width="4" opacity="0.94"/>
    <line x1="416" y1="1152" x2="416" y2="1196" stroke="#e2e8f0" stroke-width="3"/>
    <line x1="664" y1="1152" x2="664" y2="1196" stroke="#e2e8f0" stroke-width="3"/>
    <text x="290" y="1187" class="memoryStatValue" text-anchor="middle">${day.stops.length}</text>
    <text x="354" y="1185" class="memoryStatLabel" text-anchor="middle">VISITED</text>
    <text x="538" y="1187" class="memoryStatValue" text-anchor="middle">${photoCount}</text>
    <text x="604" y="1185" class="memoryStatLabel" text-anchor="middle">PHOTO</text>
    <text x="784" y="1187" class="memoryStatValue" text-anchor="middle">${day.dayIndex}</text>
    <text x="834" y="1185" class="memoryStatLabel" text-anchor="middle">DAY</text>
  </g>

  <text x="540" y="1270" class="memoryFooter" text-anchor="middle">ROUTEONE · MY TRAVEL MEMORY</text>
</svg>
`.trim();
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchImageAsDataUrl(url: string) {
  try {
    const response = await fetch(new URL(url, window.location.href).toString());

    if (!response.ok) {
      return null;
    }

    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
}

async function getEmbeddedPhotoData(route: MyRoute) {
  const photoStops = getCompletedPosterStops(route)
    .filter(
      (stop) => stop.verificationStatus === "GPS_PHOTO" && stop.verificationPhotoUrl
    )
    .slice(0, 3);

  return Promise.all(
    photoStops.map(async (stop): Promise<EmbeddedPhoto> => {
      const dataUrl = stop.verificationPhotoUrl
        ? await fetchImageAsDataUrl(stop.verificationPhotoUrl)
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
  const stops = getCompletedPosterStops(route);

  return Promise.all(
    stops
      .filter((stop) => getStopMemoryImageUrl(stop))
      .map(async (stop): Promise<EmbeddedStopImage> => {
        const imageUrl = getStopMemoryImageUrl(stop);

        return {
          stopId: stop.id,
          dataUrl: imageUrl ? await fetchImageAsDataUrl(imageUrl) : null,
        };
      })
  );
}

function svgToPngDataUrl(svg: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();
    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const imageUrl = URL.createObjectURL(blob);

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

        context.drawImage(
          image,
          0,
          0,
          ROUTE_COMPLETION_POSTER_WIDTH,
          ROUTE_COMPLETION_POSTER_HEIGHT
        );
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error("Poster image could not be rendered."));
    };

    image.src = imageUrl;
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

export async function createRouteCompletionPosterCards(route: MyRoute) {
  const [dayGroups, imageData] = await Promise.all([
    Promise.resolve(getCompletedPosterDayGroups(route)),
    getEmbeddedDayMemoryImageData(route),
  ]);

  return Promise.all(
    dayGroups.map(async (day): Promise<RouteCompletionPosterCard> => {
      const dataUrl = await svgToPngDataUrl(
        renderDayMemorySvg({
          route,
          day,
          imageData,
        })
      );

      return {
        dayIndex: day.dayIndex,
        label: `DAY ${day.dayIndex}`,
        dataUrl,
        fileName: getRouteCompletionPosterFileName(route, day.dayIndex),
      };
    })
  );
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

export function downloadRouteCompletionPoster(dataUrl: string, fileName: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
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
