import { Buffer } from "node:buffer";

const MAX_POSTER_IMAGE_PROXY_BYTES = 8 * 1024 * 1024;

function assertPosterImageProxyUrl(imageUrl: string) {
  const url = new URL(imageUrl);

  if (url.protocol !== "https:" || url.hostname !== "imagedelivery.net") {
    throw new Error("포토카드에 사용할 수 없는 이미지 URL입니다.");
  }

  return url;
}

export async function fetchPosterImageDataUrl(imageUrl: string) {
  const url = assertPosterImageProxyUrl(imageUrl.trim());
  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*",
    },
  });

  if (!response.ok) {
    return null;
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();

  if (!contentType?.startsWith("image/")) {
    return null;
  }

  const contentLength = Number(response.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_POSTER_IMAGE_PROXY_BYTES
  ) {
    throw new Error("포토카드 이미지가 너무 큽니다.");
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > MAX_POSTER_IMAGE_PROXY_BYTES) {
    throw new Error("포토카드 이미지가 너무 큽니다.");
  }

  return `data:${contentType};base64,${Buffer.from(arrayBuffer).toString("base64")}`;
}
