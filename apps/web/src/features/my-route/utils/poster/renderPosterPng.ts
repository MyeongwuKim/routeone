/**
 * 용도: 사진과 배경이 포함된 포토카드 SVG를 저장용 PNG로 변환한다.
 * 동작 방식: 내부 사진을 먼저 읽고, SVG가 렌더링될 프레임을 기다린 뒤 캔버스에 그린다.
 */
async function decodePosterImage(source: string) {
  const image = new Image();
  image.src = source;
  await image.decode();
  return image;
}

function waitForSvgPaint() {
  // iOS WebKit은 decode()가 끝나도 SVG 내부 이미지를 다음 프레임에 반영한다.
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderPosterPng(svg: string, width: number, height: number) {
  const svgDocument = new DOMParser().parseFromString(svg, "image/svg+xml");
  const sources = new Set(
    Array.from(svgDocument.querySelectorAll("image"))
      .map((image) => image.getAttribute("href"))
      .filter((source): source is string => Boolean(source))
  );
  await Promise.all(Array.from(sources, decodePosterImage));

  const imageUrl = URL.createObjectURL(
    new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  );

  try {
    const image = await decodePosterImage(imageUrl);
    await waitForSvgPaint();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas context is not available.");
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
