import type { TravelCardPhoto } from "../models/travelCard";

export const TRAVEL_CARD_PHOTO_BACKGROUND = "#fffcf5";
export const MAX_TRAVEL_CARD_PHOTO_ZOOM = 3;

/**
 * 원본 크기·프레임·사진 구도로 프레임 내부의 이미지 사각형을 계산한다.
 * 배율은 전체 보기와 3배 사이로 제한하며, 배율 없는 기존 사진은 틀 채움으로 표시한다.
 * 반환 좌표는 프레임 왼쪽 위 기준으로 편집 미리보기·터치 이동·PNG 출력이 함께 사용한다.
 */
export function getTravelCardPhotoLayout(
  image: { width: number; height: number },
  frame: { width: number; height: number },
  photo: Pick<TravelCardPhoto, "focal" | "zoom">,
) {
  const cover = Math.max(frame.width / image.width, frame.height / image.height);
  const minZoom = Math.min(frame.width / image.width, frame.height / image.height) / cover;
  const zoom = Math.max(minZoom, Math.min(MAX_TRAVEL_CARD_PHOTO_ZOOM, typeof photo.zoom === "number" && Number.isFinite(photo.zoom) ? photo.zoom : 1));
  const width = image.width * cover * zoom;
  const height = image.height * cover * zoom;
  const align = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
  return { x: (frame.width - width) * align(photo.focal.x), y: (frame.height - height) * align(photo.focal.y), width, height, zoom, minZoom };
}
