import { fetchImageAsDataUrl } from "../routeCompletionPoster";
import type { TravelCardDraft, TravelCardPhoto } from "../models/travelCard";
import { getTravelCardPhotoLayout, TRAVEL_CARD_PHOTO_BACKGROUND } from "../utils/travelCardPhotoLayout";

export type TravelCardFrame = { x: number; y: number; width: number; height: number };
export type TravelCardErrors = { title?: "empty" | "long"; caption?: "long"; photos?: "empty" | "failed" };
export type TravelCardImage = {
  dataUrl: string | null;
  fileName: string;
  mimeType: "image/png";
  errors: TravelCardErrors;
  missingPhotoIds: string[];
  photoIds: string[];
};

const TITLE_FONT = '70px "Jua", sans-serif';
const BODY_FONT = '28px "Roboto", sans-serif';

/** 선택 사진 수에 맞춰 대표 사진과 보조 사진 영역을 반환한다. 좌표는 1080×1350 출력 기준이다. */
export function getTravelCardPhotoFrames(count: number): TravelCardFrame[] {
  const area = { x: 54, y: 54, width: 972, height: 906 };
  if (count < 1) return [];
  if (count === 1) return [area];
  if (count === 2) return [
    { ...area, width: 620 },
    { ...area, x: 688, width: 338 },
  ];
  const width = (area.width - (count - 2) * 14) / (count - 1);
  return [
    { ...area, height: 580 },
    ...Array.from({ length: count - 1 }, (_, index) => ({ x: 54 + index * (width + 14), y: 648, width, height: 312 })),
  ];
}

async function loadPhoto(photo: TravelCardPhoto) {
  const source = await fetchImageAsDataUrl(photo.url);
  if (!source) throw new Error("Photo could not be loaded.");
  const image = new Image();
  image.src = source;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error("Photo is empty.");
  return { photo, image };
}

/**
 * 초안의 인증 사진 후보를 기록 순서대로 읽어 사용 가능한 사진을 최대 네 장 선택한다.
 * 실패 후보는 ID로 반환하고, 세션이 끝났으면 다음 후보 묶음을 더 읽지 않는다.
 */
export async function prepareTravelCardDraft(draft: TravelCardDraft, isCurrent = () => true) {
  const photos: TravelCardPhoto[] = [];
  const missingPhotoIds: string[] = [];
  let cursor = 0;
  while (cursor < draft.candidates.length && photos.length < 4 && isCurrent()) {
    const batch = draft.candidates.slice(cursor, cursor + 4 - photos.length);
    const results = await Promise.allSettled(batch.map(loadPhoto));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") photos.push(result.value.photo);
      else missingPhotoIds.push(batch[index].id);
    });
    cursor += batch.length;
  }
  return { draft: { ...draft, photos }, missingPhotoIds };
}

function drawPhoto(context: CanvasRenderingContext2D, image: HTMLImageElement, photo: TravelCardPhoto, frame: TravelCardFrame) {
  const { x, y, width, height } = getTravelCardPhotoLayout({ width: image.naturalWidth, height: image.naturalHeight }, frame, photo);
  context.save();
  context.beginPath();
  context.roundRect(frame.x, frame.y, frame.width, frame.height, 16);
  context.clip();
  context.drawImage(image, frame.x + x, frame.y + y, width, height);
  context.restore();
}

/**
 * 현재 선택한 사진·초점 위치·배율·문구를 실제 PNG 한 장으로 만든다. 원본과 방문 기록은 변경하지 않는다.
 * 한 줄을 넘는 입력이나 사진이 없는 경우 dataUrl 없이 입력 오류를 돌려준다.
 * 일부 사진만 실패하면 성공한 사진으로 재배치하고 누락 ID를 반환해 재시도·교체 안내에 사용한다.
 */
export async function renderTravelCard(draft: TravelCardDraft): Promise<TravelCardImage> {
  await Promise.all([
    document.fonts.load(TITLE_FONT, draft.title || "마실"),
    document.fonts.load(BODY_FONT, draft.caption || "Masil"),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable.");
  const errors: TravelCardErrors = {};
  context.font = TITLE_FONT;
  if (!draft.title.trim()) errors.title = "empty";
  else if (/[\r\n]/.test(draft.title) || context.measureText(draft.title.trim()).width > 972) errors.title = "long";
  context.font = BODY_FONT;
  if (/[\r\n]/.test(draft.caption) || context.measureText(draft.caption.trim()).width > 972) errors.caption = "long";
  if (!draft.photos.length) errors.photos = "empty";
  const fileName = `masil-travel-${draft.routeId.slice(0, 12).replace(/[^a-zA-Z0-9-]/g, "")}.png`;
  const base = { dataUrl: null, fileName, mimeType: "image/png" as const, errors, missingPhotoIds: [] as string[], photoIds: [] as string[] };
  if (Object.keys(errors).length) return base;

  const results = await Promise.allSettled(draft.photos.slice(0, 4).map(loadPhoto));
  const loaded: Awaited<ReturnType<typeof loadPhoto>>[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") loaded.push(result.value);
    else base.missingPhotoIds.push(draft.photos[index].id);
  });
  if (!loaded.length) return { ...base, errors: { photos: "failed" } };

  context.fillStyle = TRAVEL_CARD_PHOTO_BACKGROUND;
  context.fillRect(0, 0, 1080, 1350);
  const frames = getTravelCardPhotoFrames(loaded.length);
  loaded.forEach(({ image, photo }, index) => drawPhoto(context, image, photo, frames[index]));
  context.fillStyle = "#123e35";
  context.font = TITLE_FONT;
  context.fillText(draft.title.trim(), 54, draft.caption.trim() ? 1064 : 1085);
  if (draft.caption.trim()) {
    context.font = BODY_FONT;
    context.fillStyle = "#46625a";
    context.fillText(draft.caption.trim(), 56, 1123);
  }
  context.font = '24px "Roboto", sans-serif';
  context.fillStyle = "#46625a";
  const metadata = [draft.locationLabel, draft.dateLabel].filter(Boolean).join(" · ");
  // 지역 정보는 시스템 데이터다. 제목·한 줄과 달리 보조 정보의 최대 너비만 제한한다.
  context.fillText(metadata, 56, 1218, 968);
  context.strokeStyle = "#d9e3db";
  context.beginPath(); context.moveTo(54, 1260); context.lineTo(1026, 1260); context.stroke();
  context.font = '30px "Jua", sans-serif';
  context.fillStyle = "#21594c";
  context.textAlign = "right";
  context.fillText("Masil", 1026, 1310);
  return { ...base, dataUrl: canvas.toDataURL("image/png"), photoIds: loaded.map(item => item.photo.id) };
}

/** 앨범 원본을 방향과 비율을 유지한 최대 1920px 로컬 사진으로 줄인다. 서버 업로드나 원본 수정은 하지 않는다. */
export async function prepareTravelCardAlbumPhoto(dataUrl: string) {
  if (!dataUrl.startsWith("data:image/")) throw new Error("An image is required.");
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context is unavailable.");
  context.fillStyle = "white";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}
