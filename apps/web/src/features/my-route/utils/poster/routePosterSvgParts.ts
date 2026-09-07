/**
 * 용도: 테마 포토카드의 문자열, 사진 영역, 도트 글자를 SVG 조각으로 만든다.
 * 동작 방식: 사용자 문구를 이스케이프하고 사진은 필터 없이 원본 이미지로 삽입한다.
 */
import type { PosterPhotoRect } from "./routePosterLayout";

export function escapePosterText(value: string | number) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function fitPosterText(value: string, maxUnits: number) {
  let units = 0;
  let result = "";
  for (const char of value.trim()) {
    const nextUnits = char.charCodeAt(0) <= 0x7f ? 0.58 : 1;
    if (units + nextUnits > maxUnits) return result.trimEnd() + "…";
    units += nextUnits;
    result += char;
  }
  return result;
}

export function renderPosterPhoto(
  dataUrl: string | null,
  rect: PosterPhotoRect,
  clipId: string
) {
  const { x, y, width, height } = rect;
  const shape = `<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`;
  return `<defs><clipPath id="${clipId}">${shape}</clipPath></defs>
    <g fill="#e3e9e2">${shape}</g>
    ${dataUrl ? `<image href="${escapePosterText(dataUrl)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>` : `<text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" font-size="22" fill="#637364">PHOTO MEMORY</text>`}`;
}

// 장식용 영문 제목만 도트로 그린다. 사진과 장소명에는 이 처리를 적용하지 않는다.
const PIXEL_GLYPHS: Record<string, string[]> = {
  A: ["01110","10001","10001","11111","10001","10001","10001"],
  C: ["01111","10000","10000","10000","10000","10000","01111"],
  D: ["11110","10001","10001","10001","10001","10001","11110"],
  E: ["11111","10000","10000","11110","10000","10000","11111"],
  G: ["01111","10000","10000","10111","10001","10001","01110"],
  L: ["10000","10000","10000","10000","10000","10000","11111"],
  R: ["11110","10001","10001","11110","10100","10010","10001"],
  S: ["01111","10000","10000","01110","00001","00001","11110"],
  T: ["11111","00100","00100","00100","00100","00100","00100"],
  Y: ["10001","10001","01010","00100","00100","00100","00100"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
};
export function renderPixelPosterText(value: string, x: number, y: number, size: number, color: string) {
  return `<g aria-label="${escapePosterText(value)}" fill="${color}" shape-rendering="crispEdges">${Array.from(value).map((char, index) => (PIXEL_GLYPHS[char] ?? []).flatMap((row, rowIndex) => Array.from(row).map((pixel, column) => pixel === "1" ? `<rect x="${x + index * size * 6 + column * size}" y="${y + rowIndex * size}" width="${size}" height="${size}"/>` : "")).join("")).join("")}</g>`;
}
